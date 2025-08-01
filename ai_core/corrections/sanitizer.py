"""
Correction Sanitizer
Security layer for user corrections to prevent injection attacks.
"""

import re
import logging
import html
import urllib.parse
from typing import Dict, Any, List, Optional
from .types import UserCorrection, CorrectionType

logger = logging.getLogger(__name__)


class CorrectionSanitizer:
    """Sanitizes user corrections to prevent security vulnerabilities"""
    
    def __init__(self):
        # Enhanced SQL injection patterns with bypass protection
        self.sql_injection_patterns = [
            # Basic SQL injection
            r';\s*drop\s+table',
            r';\s*delete\s+from',
            r';\s*insert\s+into',
            r';\s*update\s+.*\s+set',
            r';\s*create\s+table',
            r';\s*alter\s+table',
            r';\s*truncate\s+table',
            r'union\s+select',
            r'union\s+all\s+select',

            # Stored procedures and functions
            r'exec\s*\(',
            r'execute\s*\(',
            r'sp_\w+',
            r'xp_\w+',
            r'fn_\w+',

            # Comments and obfuscation
            r'--\s*$',
            r'/\*.*\*/',
            r'#.*$',

            # Advanced injection techniques
            r'0x[0-9a-f]+',  # Hex encoding
            r'char\s*\(',
            r'ascii\s*\(',
            r'substring\s*\(',
            r'waitfor\s+delay',
            r'benchmark\s*\(',
            r'sleep\s*\(',
            r'pg_sleep\s*\(',

            # Boolean-based blind injection
            r'and\s+1\s*=\s*1',
            r'or\s+1\s*=\s*1',
            r'and\s+\d+\s*=\s*\d+',
            r'or\s+\d+\s*=\s*\d+',

            # Time-based blind injection
            r'if\s*\(\s*\d+\s*=\s*\d+',
            r'case\s+when',

            # Information schema attacks
            r'information_schema',
            r'sys\.',
            r'sysobjects',
            r'syscolumns',

            # File operations
            r'load_file\s*\(',
            r'into\s+outfile',
            r'into\s+dumpfile',
        ]
        
        # Enhanced prompt injection patterns
        self.prompt_injection_patterns = [
            # Direct instruction overrides
            r'ignore\s+previous\s+instructions',
            r'forget\s+everything',
            r'disregard\s+all\s+previous',
            r'override\s+system',
            r'new\s+instructions',
            r'updated\s+instructions',

            # Role manipulation
            r'system\s*:',
            r'assistant\s*:',
            r'human\s*:',
            r'user\s*:',
            r'<\s*system\s*>',
            r'<\s*assistant\s*>',
            r'<\s*user\s*>',
            r'role\s*:\s*system',
            r'role\s*:\s*assistant',
            r'role\s*:\s*user',

            # Identity manipulation
            r'you\s+are\s+now',
            r'pretend\s+to\s+be',
            r'act\s+as\s+if',
            r'imagine\s+you\s+are',
            r'roleplay\s+as',
            r'simulate\s+being',

            # Context breaking
            r'end\s+of\s+context',
            r'new\s+context',
            r'context\s+switch',
            r'break\s+character',
            r'stop\s+being',

            # Jailbreak attempts
            r'developer\s+mode',
            r'debug\s+mode',
            r'admin\s+mode',
            r'god\s+mode',
            r'unrestricted\s+mode',
            r'jailbreak',
            r'dan\s+mode',

            # Encoding attempts
            r'base64',
            r'rot13',
            r'hex\s+decode',
            r'url\s+decode',

            # Meta-instructions
            r'this\s+is\s+a\s+test',
            r'for\s+educational\s+purposes',
            r'hypothetically',
            r'in\s+theory',
            r'what\s+if',
        ]
        
        # Dangerous characters and sequences
        self.dangerous_chars = ['<script>', '</script>', 'javascript:', 'data:', 'vbscript:']
        
        # Maximum lengths
        self.max_query_length = 10000
        self.max_reason_length = 1000
        self.max_session_id_length = 100
        
    async def sanitize_correction(self, correction: UserCorrection) -> UserCorrection:
        """Sanitize a user correction for security"""
        try:
            # Create a copy to avoid modifying the original
            sanitized = UserCorrection(
                id=correction.id,
                session_id=self._sanitize_session_id(correction.session_id),
                query_id=self._sanitize_id(correction.query_id),
                project_id=self._sanitize_id(correction.project_id),
                original_query=self._sanitize_query(correction.original_query),
                corrected_query=self._sanitize_query(correction.corrected_query) if correction.corrected_query else None,
                correction_type=correction.correction_type,
                feedback_score=correction.feedback_score,
                correction_reason=self._sanitize_text(correction.correction_reason),
                context=self._sanitize_context(correction.context),
                timestamp=correction.timestamp,
                applied=correction.applied,
                confidence=correction.confidence,
                metadata=self._sanitize_metadata(correction.metadata)
            )
            
            # Validate the sanitized correction
            validation_result = self._validate_correction(sanitized)
            if not validation_result['valid']:
                logger.warning(f"Correction validation failed: {validation_result['reason']}")
                raise ValueError(f"Invalid correction: {validation_result['reason']}")
            
            return sanitized
            
        except Exception as e:
            logger.error(f"Correction sanitization failed: {e}")
            raise ValueError(f"Correction sanitization failed: {e}")
    
    def _sanitize_query(self, query: Optional[str]) -> Optional[str]:
        """Sanitize SQL query text with enhanced security"""
        if not query:
            return None

        # Length check
        if len(query) > self.max_query_length:
            raise ValueError(f"Query too long: {len(query)} > {self.max_query_length}")

        # Multi-layer sanitization
        sanitized = query

        # 1. HTML decode to catch encoded attacks
        sanitized = html.unescape(sanitized)

        # 2. URL decode to catch URL-encoded attacks
        try:
            sanitized = urllib.parse.unquote(sanitized)
        except Exception:
            pass  # If decoding fails, continue with original

        # 3. Remove dangerous characters (with encoding awareness)
        for dangerous in self.dangerous_chars:
            sanitized = sanitized.replace(dangerous, '')
            # Also check URL-encoded versions
            encoded_dangerous = urllib.parse.quote(dangerous)
            sanitized = sanitized.replace(encoded_dangerous, '')

        # 4. Normalize whitespace before pattern matching
        normalized = ' '.join(sanitized.split())
        query_lower = normalized.lower()

        # 5. Check for SQL injection patterns with strict blocking
        for pattern in self.sql_injection_patterns:
            if re.search(pattern, query_lower, re.IGNORECASE | re.MULTILINE):
                logger.error(f"SQL injection attempt blocked: {pattern}")
                raise ValueError(f"Query contains potentially dangerous SQL pattern: {pattern}")

        # 6. Check for prompt injection patterns with strict blocking
        for pattern in self.prompt_injection_patterns:
            if re.search(pattern, query_lower, re.IGNORECASE | re.MULTILINE):
                logger.error(f"Prompt injection attempt blocked: {pattern}")
                raise ValueError(f"Query contains potentially dangerous prompt pattern: {pattern}")

        # 7. Additional security checks
        if self._contains_suspicious_patterns(normalized):
            raise ValueError("Query contains suspicious patterns")

        # 8. Final cleanup
        sanitized = normalized.strip()

        # 9. Validate final result
        if not sanitized or len(sanitized.strip()) == 0:
            raise ValueError("Query became empty after sanitization")

        return sanitized
    
    def _sanitize_text(self, text: str) -> str:
        """Sanitize general text input"""
        if not text:
            return ""
            
        # Length check
        if len(text) > self.max_reason_length:
            text = text[:self.max_reason_length]
        
        # Remove dangerous characters
        sanitized = text
        for dangerous in self.dangerous_chars:
            sanitized = sanitized.replace(dangerous, '')
        
        # Check for prompt injection patterns
        text_lower = sanitized.lower()
        for pattern in self.prompt_injection_patterns:
            if re.search(pattern, text_lower, re.IGNORECASE):
                logger.warning(f"Potential prompt injection in text: {pattern}")
                # Remove the problematic part
                sanitized = re.sub(pattern, '', sanitized, flags=re.IGNORECASE)
        
        # Clean up whitespace
        sanitized = ' '.join(sanitized.split())
        
        return sanitized.strip()
    
    def _sanitize_id(self, id_value: str) -> str:
        """Sanitize ID values"""
        if not id_value:
            return ""
        
        # Only allow alphanumeric, hyphens, and underscores
        sanitized = re.sub(r'[^a-zA-Z0-9\-_]', '', id_value)
        
        # Length limit
        if len(sanitized) > 100:
            sanitized = sanitized[:100]
        
        return sanitized
    
    def _sanitize_session_id(self, session_id: str) -> str:
        """Sanitize session ID"""
        if not session_id:
            return ""
        
        # Session IDs should be alphanumeric with hyphens
        sanitized = re.sub(r'[^a-zA-Z0-9\-]', '', session_id)
        
        # Length limit
        if len(sanitized) > self.max_session_id_length:
            sanitized = sanitized[:self.max_session_id_length]
        
        return sanitized
    
    def _sanitize_context(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize context dictionary"""
        if not context:
            return {}
        
        sanitized = {}
        for key, value in context.items():
            # Sanitize key
            clean_key = self._sanitize_id(str(key))
            if not clean_key:
                continue
            
            # Sanitize value based on type
            if isinstance(value, str):
                sanitized[clean_key] = self._sanitize_text(value)
            elif isinstance(value, (int, float, bool)):
                sanitized[clean_key] = value
            elif isinstance(value, dict):
                sanitized[clean_key] = self._sanitize_context(value)
            elif isinstance(value, list):
                sanitized[clean_key] = [
                    self._sanitize_text(str(item)) if isinstance(item, str) else item
                    for item in value[:10]  # Limit list size
                ]
            else:
                # Convert to string and sanitize
                sanitized[clean_key] = self._sanitize_text(str(value))
        
        return sanitized
    
    def _sanitize_metadata(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize metadata dictionary"""
        return self._sanitize_context(metadata)
    
    def _validate_correction(self, correction: UserCorrection) -> Dict[str, Any]:
        """Validate a sanitized correction"""
        errors = []
        
        # Required fields
        if not correction.session_id:
            errors.append("Session ID is required")
        
        if not correction.query_id:
            errors.append("Query ID is required")
        
        if not correction.project_id:
            errors.append("Project ID is required")
        
        if not correction.original_query:
            errors.append("Original query is required")
        
        # Correction type validation
        if correction.correction_type in [CorrectionType.EDIT, CorrectionType.REPLACEMENT, CorrectionType.REFINEMENT]:
            if not correction.corrected_query:
                errors.append(f"Corrected query is required for {correction.correction_type.value}")
        
        # Feedback validation
        if correction.correction_type == CorrectionType.FEEDBACK:
            if correction.feedback_score is None:
                errors.append("Feedback score is required for feedback corrections")
        
        # Length validations
        if len(correction.original_query) > self.max_query_length:
            errors.append(f"Original query too long: {len(correction.original_query)}")
        
        if correction.corrected_query and len(correction.corrected_query) > self.max_query_length:
            errors.append(f"Corrected query too long: {len(correction.corrected_query)}")
        
        if len(correction.correction_reason) > self.max_reason_length:
            errors.append(f"Correction reason too long: {len(correction.correction_reason)}")
        
        # Confidence validation
        if not 0 <= correction.confidence <= 1:
            errors.append(f"Confidence must be between 0 and 1: {correction.confidence}")
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'reason': '; '.join(errors) if errors else 'Valid'
        }
    
    def is_safe_query(self, query: str) -> bool:
        """Quick check if a query is safe"""
        if not query or len(query) > self.max_query_length:
            return False
        
        query_lower = query.lower()
        
        # Check for dangerous patterns
        for pattern in self.sql_injection_patterns:
            if re.search(pattern, query_lower, re.IGNORECASE):
                return False
        
        for pattern in self.prompt_injection_patterns:
            if re.search(pattern, query_lower, re.IGNORECASE):
                return False
        
        for dangerous in self.dangerous_chars:
            if dangerous.lower() in query_lower:
                return False
        
        return True

    def _contains_suspicious_patterns(self, text: str) -> bool:
        """Check for additional suspicious patterns"""
        text_lower = text.lower()

        # Check for excessive special characters (potential obfuscation)
        special_char_count = sum(1 for c in text if not c.isalnum() and not c.isspace())
        if special_char_count > len(text) * 0.3:  # More than 30% special chars
            return True

        # Check for repeated patterns (potential injection)
        words = text_lower.split()
        if len(words) != len(set(words)) and len(words) > 10:  # Repeated words in long text
            return True

        # Check for suspicious character sequences
        suspicious_sequences = [
            '0x',  # Hex encoding
            'char(',  # Character encoding
            'chr(',   # Character encoding
            'eval(',  # Code execution
            'exec(',  # Code execution
            '${',     # Template injection
            '#{',     # Template injection
            '<%',     # Template injection
            '%>',     # Template injection
        ]

        for seq in suspicious_sequences:
            if seq in text_lower:
                return True

        return False
