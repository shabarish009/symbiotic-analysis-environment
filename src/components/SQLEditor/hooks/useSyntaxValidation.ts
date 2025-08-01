import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { SyntaxError, SQLDialect } from '../types';

interface UseSyntaxValidationProps {
  dialect: SQLDialect;
  connectionId?: string;
  enabled: boolean;
  debounceMs?: number;
}

interface ValidationResult {
  isValid: boolean;
  errors: SyntaxError[];
  warnings: SyntaxError[];
  suggestions: string[];
}

export function useSyntaxValidation({ 
  dialect, 
  connectionId, 
  enabled, 
  debounceMs = 500 
}: UseSyntaxValidationProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [errors, setErrors] = useState<SyntaxError[]>([]);
  const [warnings, setWarnings] = useState<SyntaxError[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [lastValidation, setLastValidation] = useState<Date | null>(null);

  // Refs for managing async operations
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const validationCounterRef = useRef(0);

  // Client-side basic SQL validation patterns
  const basicValidationPatterns = {
    // Common SQL syntax errors
    unmatchedParentheses: /\([^)]*$|[^(]*\)/g,
    unmatchedQuotes: /('[^']*$|"[^"]*$)/g,
    invalidKeywordSequence: /\b(SELECT\s+FROM|WHERE\s+SELECT|GROUP\s+WHERE)\b/gi,
    missingFromClause: /\bSELECT\b(?!.*\bFROM\b)/gi,
    trailingComma: /,\s*(?:FROM|WHERE|GROUP|ORDER|HAVING|LIMIT)\b/gi,
    
    // Dialect-specific patterns
    postgresql: {
      invalidArraySyntax: /ARRAY\s*\[(?![^\]]*\])/gi,
      invalidJsonOperator: /->(?![>'])/g,
    },
    mysql: {
      invalidBackticks: /`[^`]*$/g,
      invalidLimitSyntax: /LIMIT\s+\d+\s*,(?!\s*\d+)/gi,
    },
    sqlite: {
      invalidPragma: /PRAGMA\s+(?![\w_]+)/gi,
      invalidAutoincrement: /AUTOINCREMENT(?!\s+|$)/gi,
    },
    mssql: {
      invalidTopSyntax: /SELECT\s+TOP(?!\s+\d+)/gi,
      invalidSquareBrackets: /\[[^\]]*$/g,
    },
    oracle: {
      invalidDualUsage: /FROM\s+DUAL\s+WHERE/gi,
      invalidRownum: /ROWNUM\s*[<>=]\s*0/gi,
    }
  };

  // Perform client-side basic validation
  const performBasicValidation = useCallback((sql: string): SyntaxError[] => {
    const errors: SyntaxError[] = [];
    const lines = sql.split('\n');

    // Check for unmatched parentheses
    let parenCount = 0;
    let lastParenLine = 0;
    for (let i = 0; i < sql.length; i++) {
      if (sql[i] === '(') {
        parenCount++;
        lastParenLine = sql.substring(0, i).split('\n').length;
      } else if (sql[i] === ')') {
        parenCount--;
        if (parenCount < 0) {
          const line = sql.substring(0, i).split('\n').length;
          errors.push({
            from: i,
            to: i + 1,
            message: 'Unmatched closing parenthesis',
            severity: 'error',
            source: 'syntax-validator',
          });
          parenCount = 0; // Reset to continue checking
        }
      }
    }
    if (parenCount > 0) {
      errors.push({
        from: sql.lastIndexOf('('),
        to: sql.lastIndexOf('(') + 1,
        message: 'Unmatched opening parenthesis',
        severity: 'error',
        source: 'syntax-validator',
      });
    }

    // Check for unmatched quotes
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let lastQuotePos = 0;
    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];
      const prevChar = i > 0 ? sql[i - 1] : '';
      
      if (char === "'" && prevChar !== '\\' && !inDoubleQuote) {
        if (inSingleQuote) {
          inSingleQuote = false;
        } else {
          inSingleQuote = true;
          lastQuotePos = i;
        }
      } else if (char === '"' && prevChar !== '\\' && !inSingleQuote) {
        if (inDoubleQuote) {
          inDoubleQuote = false;
        } else {
          inDoubleQuote = true;
          lastQuotePos = i;
        }
      }
    }
    
    if (inSingleQuote || inDoubleQuote) {
      errors.push({
        from: lastQuotePos,
        to: lastQuotePos + 1,
        message: `Unmatched ${inSingleQuote ? 'single' : 'double'} quote`,
        severity: 'error',
        source: 'syntax-validator',
      });
    }

    // Check for common SQL mistakes
    const patterns = basicValidationPatterns;
    
    // Missing FROM clause in SELECT
    if (patterns.missingFromClause.test(sql) && !sql.toLowerCase().includes('from')) {
      const selectMatch = sql.match(/\bSELECT\b/i);
      if (selectMatch) {
        errors.push({
          from: selectMatch.index!,
          to: selectMatch.index! + selectMatch[0].length,
          message: 'SELECT statement is missing FROM clause',
          severity: 'warning',
          source: 'syntax-validator',
        });
      }
    }

    // Trailing comma before keywords
    const trailingCommaMatches = sql.matchAll(patterns.trailingComma);
    for (const match of trailingCommaMatches) {
      errors.push({
        from: match.index!,
        to: match.index! + 1,
        message: 'Trailing comma before keyword',
        severity: 'error',
        source: 'syntax-validator',
      });
    }

    // Dialect-specific validation
    const dialectPatterns = patterns[dialect as keyof typeof patterns];
    if (dialectPatterns && typeof dialectPatterns === 'object') {
      Object.entries(dialectPatterns).forEach(([patternName, pattern]) => {
        if (pattern instanceof RegExp) {
          const matches = sql.matchAll(pattern);
          for (const match of matches) {
            errors.push({
              from: match.index!,
              to: match.index! + match[0].length,
              message: `Invalid ${dialect} syntax: ${patternName.replace(/([A-Z])/g, ' $1').toLowerCase()}`,
              severity: 'error',
              source: 'syntax-validator',
            });
          }
        }
      });
    }

    return errors;
  }, [dialect]);

  // Perform server-side validation (enhanced with security measures)
  const performServerValidation = useCallback(async (
    sql: string,
    validationId: number
  ): Promise<ValidationResult | null> => {
    if (!enabled || !sql.trim()) {
      return { isValid: true, errors: [], warnings: [], suggestions: [] };
    }

    // Security: Input size validation to prevent DoS attacks
    const MAX_SQL_SIZE = 1024 * 1024; // 1MB limit
    if (sql.length > MAX_SQL_SIZE) {
      return {
        isValid: false,
        errors: [{
          from: 0,
          to: sql.length,
          message: `SQL query too large (${sql.length} characters). Maximum allowed: ${MAX_SQL_SIZE} characters.`,
          severity: 'error' as const,
          source: 'size-validator',
        }],
        warnings: [],
        suggestions: ['Consider breaking your query into smaller parts'],
      };
    }

    // Security: Basic input sanitization check
    const suspiciousPatterns = [
      /\x00/g, // Null bytes
      /[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, // Control characters (except \t, \n, \r)
    ];

    let sanitizedSql = sql;
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(sanitizedSql)) {
        sanitizedSql = sanitizedSql.replace(pattern, '');
      }
    }

    // Cancel any existing validation request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      setIsValidating(true);

      const result = await invoke<{
        is_valid: boolean;
        errors: Array<{
          line: number;
          column: number;
          length: number;
          message: string;
          severity: 'error' | 'warning' | 'info';
        }>;
        warnings: Array<{
          line: number;
          column: number;
          length: number;
          message: string;
          severity: 'error' | 'warning' | 'info';
        }>;
        suggestions: string[];
      }>('validate_sql_syntax', {
        sql: sanitizedSql, // Use sanitized SQL
        dialect,
        connectionId,
        signal: abortControllerRef.current.signal,
      });

      // Check if this validation is still current
      if (validationId !== validationCounterRef.current) {
        return null; // Outdated validation
      }

      // Convert server response to our format
      const errors: SyntaxError[] = result.errors.map(error => ({
        from: getPositionFromLineColumn(sql, error.line, error.column),
        to: getPositionFromLineColumn(sql, error.line, error.column + error.length),
        message: error.message,
        severity: error.severity,
        source: 'server-validator',
      }));

      const warnings: SyntaxError[] = result.warnings.map(warning => ({
        from: getPositionFromLineColumn(sql, warning.line, warning.column),
        to: getPositionFromLineColumn(sql, warning.line, warning.column + warning.length),
        message: warning.message,
        severity: warning.severity,
        source: 'server-validator',
      }));

      return {
        isValid: result.is_valid,
        errors,
        warnings,
        suggestions: result.suggestions,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return null; // Request was cancelled
      }
      
      console.error('Server validation failed:', error);
      
      // Fall back to client-side validation only
      const clientErrors = performBasicValidation(sql);
      return {
        isValid: clientErrors.length === 0,
        errors: clientErrors,
        warnings: [],
        suggestions: ['Server validation unavailable - using client-side validation only'],
      };
    } finally {
      setIsValidating(false);
      abortControllerRef.current = null;
    }
  }, [enabled, dialect, connectionId, performBasicValidation]);

  // Helper function to convert line/column to position
  const getPositionFromLineColumn = (text: string, line: number, column: number): number => {
    const lines = text.split('\n');
    let position = 0;
    
    for (let i = 0; i < Math.min(line - 1, lines.length); i++) {
      position += lines[i].length + 1; // +1 for newline character
    }
    
    return position + Math.min(column - 1, lines[line - 1]?.length || 0);
  };

  // Main validation function with debouncing
  const validateSQL = useCallback((sql: string) => {
    if (!enabled) {
      setErrors([]);
      setWarnings([]);
      setSuggestions([]);
      return;
    }

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Increment validation counter
    validationCounterRef.current++;
    const currentValidationId = validationCounterRef.current;

    // Immediate client-side validation for quick feedback
    const clientErrors = performBasicValidation(sql);
    setErrors(clientErrors);

    // Debounced server-side validation
    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await performServerValidation(sql, currentValidationId);
        
        if (result && currentValidationId === validationCounterRef.current) {
          // Combine client and server errors, removing duplicates
          const allErrors = [...clientErrors];
          result.errors.forEach(serverError => {
            const isDuplicate = allErrors.some(clientError => 
              Math.abs(clientError.from - serverError.from) < 5 && 
              clientError.message.toLowerCase().includes(serverError.message.toLowerCase().substring(0, 10))
            );
            if (!isDuplicate) {
              allErrors.push(serverError);
            }
          });

          setErrors(allErrors);
          setWarnings(result.warnings);
          setSuggestions(result.suggestions);
          setLastValidation(new Date());
        }
      } catch (error) {
        console.error('Validation error:', error);
      }
    }, debounceMs);
  }, [enabled, debounceMs, performBasicValidation, performServerValidation]);

  // Clear validation results
  const clearValidation = useCallback(() => {
    setErrors([]);
    setWarnings([]);
    setSuggestions([]);
    setLastValidation(null);
    
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    isValidating,
    errors,
    warnings,
    suggestions,
    lastValidation,
    validateSQL,
    clearValidation,
  };
}
