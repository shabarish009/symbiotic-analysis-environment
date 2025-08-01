"""
Correction Analyzer
Analyzes user corrections to extract learnable patterns.
"""

import re
import logging
import difflib
from typing import Dict, Any, List, Optional, Tuple, Set
from collections import defaultdict, Counter

from .types import (
    UserCorrection, CorrectionType, CorrectionPattern, CorrectionPatternType,
    CorrectionAnalysis, FeedbackScore
)

logger = logging.getLogger(__name__)


class CorrectionAnalyzer:
    """Analyzes user corrections to extract learnable patterns"""
    
    def __init__(self):
        # SQL keywords for analysis
        self.sql_keywords = {
            'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER',
            'GROUP', 'BY', 'ORDER', 'HAVING', 'UNION', 'INSERT', 'UPDATE', 'DELETE',
            'CREATE', 'ALTER', 'DROP', 'INDEX', 'TABLE', 'VIEW', 'DISTINCT',
            'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'AND', 'OR', 'NOT', 'IN', 'EXISTS',
            'LIKE', 'BETWEEN', 'IS', 'NULL', 'ASC', 'DESC', 'LIMIT', 'OFFSET'
        }
        
        # Common SQL functions
        self.sql_functions = {
            'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'UPPER', 'LOWER', 'TRIM',
            'SUBSTRING', 'LENGTH', 'COALESCE', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'
        }
        
        # Join types
        self.join_types = {'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN'}
        
    async def analyze_correction(self, correction: UserCorrection,
                               existing_patterns: List[CorrectionPattern] = None) -> CorrectionAnalysis:
        """Analyze a correction and extract patterns with comprehensive validation"""
        # Input validation
        if not correction:
            raise ValueError("Correction cannot be None")

        if not correction.original_query or not correction.original_query.strip():
            raise ValueError("Original query cannot be empty")

        if correction.correction_type in [CorrectionType.EDIT, CorrectionType.REPLACEMENT, CorrectionType.REFINEMENT]:
            if not correction.corrected_query or not correction.corrected_query.strip():
                raise ValueError(f"Corrected query required for {correction.correction_type.value}")

        if correction.correction_type == CorrectionType.FEEDBACK:
            if correction.feedback_score is None:
                raise ValueError("Feedback score required for feedback corrections")

        try:
            patterns_extracted = []
            
            if correction.correction_type in [CorrectionType.EDIT, CorrectionType.REPLACEMENT, CorrectionType.REFINEMENT]:
                # Analyze query changes
                query_patterns = await self._analyze_query_changes(correction)
                patterns_extracted.extend(query_patterns)
            
            if correction.correction_type == CorrectionType.FEEDBACK:
                # Analyze feedback patterns
                feedback_patterns = await self._analyze_feedback_patterns(correction)
                patterns_extracted.extend(feedback_patterns)
            
            # Calculate confidence score
            confidence_score = self._calculate_pattern_confidence(correction, patterns_extracted)
            
            # Check similarity to existing patterns
            similarity_score = 0.0
            potential_conflicts = []
            if existing_patterns:
                similarity_score, potential_conflicts = self._check_pattern_similarity(
                    patterns_extracted, existing_patterns
                )
            
            # Generate recommendations
            recommendations = self._generate_recommendations(
                correction, patterns_extracted, similarity_score, potential_conflicts
            )
            
            return CorrectionAnalysis(
                correction_id=correction.id or 0,
                patterns_extracted=patterns_extracted,
                confidence_score=confidence_score,
                similarity_to_existing=similarity_score,
                potential_conflicts=potential_conflicts,
                recommended_actions=recommendations,
                analysis_metadata={
                    'correction_type': correction.correction_type.value,
                    'query_complexity': self._calculate_query_complexity(correction.original_query),
                    'change_magnitude': self._calculate_change_magnitude(correction),
                    'analysis_timestamp': correction.timestamp
                }
            )
            
        except Exception as e:
            logger.error(f"Error analyzing correction: {e}")
            return CorrectionAnalysis(
                correction_id=correction.id or 0,
                patterns_extracted=[],
                confidence_score=0.0,
                similarity_to_existing=0.0,
                potential_conflicts=[],
                recommended_actions=['Error in analysis - manual review required'],
                analysis_metadata={'error': str(e)}
            )
    
    async def _analyze_query_changes(self, correction: UserCorrection) -> List[CorrectionPattern]:
        """Analyze changes between original and corrected queries"""
        patterns = []
        
        if not correction.corrected_query:
            return patterns
        
        original = correction.original_query.strip()
        corrected = correction.corrected_query.strip()
        
        # Structure changes
        structure_pattern = self._analyze_structure_changes(original, corrected, correction)
        if structure_pattern:
            patterns.append(structure_pattern)
        
        # Terminology changes
        terminology_pattern = self._analyze_terminology_changes(original, corrected, correction)
        if terminology_pattern:
            patterns.append(terminology_pattern)
        
        # Condition changes
        condition_pattern = self._analyze_condition_changes(original, corrected, correction)
        if condition_pattern:
            patterns.append(condition_pattern)
        
        # Join changes
        join_pattern = self._analyze_join_changes(original, corrected, correction)
        if join_pattern:
            patterns.append(join_pattern)
        
        # Style changes
        style_pattern = self._analyze_style_changes(original, corrected, correction)
        if style_pattern:
            patterns.append(style_pattern)
        
        return patterns
    
    def _analyze_structure_changes(self, original: str, corrected: str, 
                                  correction: UserCorrection) -> Optional[CorrectionPattern]:
        """Analyze SQL structure changes"""
        original_structure = self._extract_query_structure(original)
        corrected_structure = self._extract_query_structure(corrected)
        
        changes = {}
        
        # Check for added/removed clauses
        for clause in ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT']:
            orig_has = clause in original_structure
            corr_has = clause in corrected_structure
            
            if orig_has != corr_has:
                changes[f'{clause.lower()}_added'] = corr_has
        
        # Check for subquery changes
        orig_subqueries = original.upper().count('(SELECT')
        corr_subqueries = corrected.upper().count('(SELECT')
        if orig_subqueries != corr_subqueries:
            changes['subquery_preference'] = 'more' if corr_subqueries > orig_subqueries else 'fewer'
        
        # Check for DISTINCT usage
        orig_distinct = 'DISTINCT' in original.upper()
        corr_distinct = 'DISTINCT' in corrected.upper()
        if orig_distinct != corr_distinct:
            changes['distinct_preference'] = corr_distinct
        
        if changes:
            return CorrectionPattern(
                project_id=correction.project_id,
                pattern_type=CorrectionPatternType.QUERY_STRUCTURE,
                pattern_data={
                    'structural_changes': changes,
                    'correction_reason': correction.correction_reason,
                    'change_type': correction.correction_type.value
                },
                source_corrections=[correction.id] if correction.id else [],
                confidence=0.7,  # Base confidence for structure changes
                metadata={
                    'original_structure': original_structure,
                    'corrected_structure': corrected_structure
                }
            )
        
        return None
    
    def _analyze_terminology_changes(self, original: str, corrected: str,
                                   correction: UserCorrection) -> Optional[CorrectionPattern]:
        """Analyze terminology and naming changes"""
        # Extract table and column references
        orig_tables = self._extract_table_references(original)
        corr_tables = self._extract_table_references(corrected)
        
        orig_columns = self._extract_column_references(original)
        corr_columns = self._extract_column_references(corrected)
        
        terminology_changes = {}
        
        # Check for table name changes
        if orig_tables != corr_tables:
            # Find replacements
            for orig_table in orig_tables:
                for corr_table in corr_tables:
                    if orig_table not in corr_tables and corr_table not in orig_tables:
                        # Potential replacement
                        similarity = difflib.SequenceMatcher(None, orig_table, corr_table).ratio()
                        if similarity > 0.5:  # Likely a terminology preference
                            terminology_changes[f'table_{orig_table}'] = corr_table
        
        # Check for column name changes
        if orig_columns != corr_columns:
            for orig_col in orig_columns:
                for corr_col in corr_columns:
                    if orig_col not in corr_columns and corr_col not in orig_columns:
                        similarity = difflib.SequenceMatcher(None, orig_col, corr_col).ratio()
                        if similarity > 0.5:
                            terminology_changes[f'column_{orig_col}'] = corr_col
        
        if terminology_changes:
            return CorrectionPattern(
                project_id=correction.project_id,
                pattern_type=CorrectionPatternType.TERMINOLOGY,
                pattern_data={
                    'terminology_preferences': terminology_changes,
                    'correction_reason': correction.correction_reason
                },
                source_corrections=[correction.id] if correction.id else [],
                confidence=0.8,  # High confidence for terminology changes
                metadata={
                    'original_tables': list(orig_tables),
                    'corrected_tables': list(corr_tables),
                    'original_columns': list(orig_columns),
                    'corrected_columns': list(corr_columns)
                }
            )
        
        return None
    
    def _analyze_condition_changes(self, original: str, corrected: str,
                                 correction: UserCorrection) -> Optional[CorrectionPattern]:
        """Analyze WHERE clause and condition changes"""
        orig_conditions = self._extract_where_conditions(original)
        corr_conditions = self._extract_where_conditions(corrected)
        
        condition_changes = {}
        
        # Check for added conditions
        added_conditions = corr_conditions - orig_conditions
        if added_conditions:
            condition_changes['added_conditions'] = list(added_conditions)
        
        # Check for removed conditions
        removed_conditions = orig_conditions - corr_conditions
        if removed_conditions:
            condition_changes['removed_conditions'] = list(removed_conditions)
        
        # Check for operator preferences
        orig_operators = self._extract_operators(original)
        corr_operators = self._extract_operators(corrected)
        
        if orig_operators != corr_operators:
            condition_changes['operator_preferences'] = {
                'added': list(corr_operators - orig_operators),
                'removed': list(orig_operators - corr_operators)
            }
        
        if condition_changes:
            return CorrectionPattern(
                project_id=correction.project_id,
                pattern_type=CorrectionPatternType.CONDITIONS,
                pattern_data={
                    'condition_preferences': condition_changes,
                    'correction_reason': correction.correction_reason
                },
                source_corrections=[correction.id] if correction.id else [],
                confidence=0.75,
                metadata={
                    'original_conditions': list(orig_conditions),
                    'corrected_conditions': list(corr_conditions)
                }
            )
        
        return None
    
    def _analyze_join_changes(self, original: str, corrected: str,
                            correction: UserCorrection) -> Optional[CorrectionPattern]:
        """Analyze JOIN pattern changes"""
        orig_joins = self._extract_joins(original)
        corr_joins = self._extract_joins(corrected)
        
        if orig_joins != corr_joins:
            join_changes = {
                'original_joins': orig_joins,
                'corrected_joins': corr_joins,
                'join_preference_change': True
            }
            
            # Analyze specific join type preferences
            orig_types = [join['type'] for join in orig_joins]
            corr_types = [join['type'] for join in corr_joins]
            
            if orig_types != corr_types:
                join_changes['join_type_preferences'] = {
                    'original': orig_types,
                    'corrected': corr_types
                }
            
            return CorrectionPattern(
                project_id=correction.project_id,
                pattern_type=CorrectionPatternType.JOINS,
                pattern_data={
                    'join_preferences': join_changes,
                    'correction_reason': correction.correction_reason
                },
                source_corrections=[correction.id] if correction.id else [],
                confidence=0.8,
                metadata={
                    'join_complexity_change': len(corr_joins) - len(orig_joins)
                }
            )
        
        return None
    
    def _analyze_style_changes(self, original: str, corrected: str,
                             correction: UserCorrection) -> Optional[CorrectionPattern]:
        """Analyze formatting and style changes"""
        style_changes = {}
        
        # Case preferences
        orig_upper_ratio = sum(1 for c in original if c.isupper()) / max(len(original), 1)
        corr_upper_ratio = sum(1 for c in corrected if c.isupper()) / max(len(corrected), 1)
        
        if abs(orig_upper_ratio - corr_upper_ratio) > 0.1:
            style_changes['case_preference'] = 'upper' if corr_upper_ratio > orig_upper_ratio else 'lower'
        
        # Alias usage
        orig_aliases = len(re.findall(r'\bAS\s+\w+', original, re.IGNORECASE))
        corr_aliases = len(re.findall(r'\bAS\s+\w+', corrected, re.IGNORECASE))
        
        if orig_aliases != corr_aliases:
            style_changes['alias_preference'] = 'more' if corr_aliases > orig_aliases else 'fewer'
        
        # Parentheses usage
        orig_parens = original.count('(')
        corr_parens = corrected.count('(')
        
        if orig_parens != corr_parens:
            style_changes['parentheses_preference'] = 'more' if corr_parens > orig_parens else 'fewer'
        
        if style_changes:
            return CorrectionPattern(
                project_id=correction.project_id,
                pattern_type=CorrectionPatternType.STYLE,
                pattern_data={
                    'style_preferences': style_changes,
                    'correction_reason': correction.correction_reason
                },
                source_corrections=[correction.id] if correction.id else [],
                confidence=0.6,  # Lower confidence for style changes
                metadata={
                    'original_length': len(original),
                    'corrected_length': len(corrected)
                }
            )
        
        return None

    async def _analyze_feedback_patterns(self, correction: UserCorrection) -> List[CorrectionPattern]:
        """Analyze feedback-only corrections"""
        patterns = []

        if correction.feedback_score == FeedbackScore.NEGATIVE and correction.correction_reason:
            # Extract patterns from negative feedback
            feedback_pattern = CorrectionPattern(
                project_id=correction.project_id,
                pattern_type=CorrectionPatternType.STYLE,  # Default to style for feedback
                pattern_data={
                    'feedback_type': 'negative',
                    'feedback_reason': correction.correction_reason,
                    'query_characteristics': self._analyze_query_characteristics(correction.original_query)
                },
                source_corrections=[correction.id] if correction.id else [],
                confidence=0.4,  # Lower confidence for feedback-only patterns
                metadata={
                    'feedback_score': correction.feedback_score.value,
                    'query_length': len(correction.original_query)
                }
            )
            patterns.append(feedback_pattern)

        return patterns

    def _extract_query_structure(self, query: str) -> Dict[str, bool]:
        """Extract structural elements of a query"""
        query_upper = query.upper()
        return {
            'SELECT': 'SELECT' in query_upper,
            'FROM': 'FROM' in query_upper,
            'WHERE': 'WHERE' in query_upper,
            'GROUP BY': 'GROUP BY' in query_upper,
            'HAVING': 'HAVING' in query_upper,
            'ORDER BY': 'ORDER BY' in query_upper,
            'LIMIT': 'LIMIT' in query_upper,
            'UNION': 'UNION' in query_upper,
            'JOIN': any(join in query_upper for join in self.join_types)
        }

    def _extract_table_references(self, query: str) -> Set[str]:
        """Extract table references from query with enhanced parsing"""
        if not query or not query.strip():
            return set()

        tables = set()

        try:
            # Enhanced pattern matching for table names
            # FROM clause - handle schema.table and quoted identifiers
            from_patterns = [
                r'\bFROM\s+(?:`([^`]+)`|"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?))(?:\s+(?:AS\s+)?[a-zA-Z_][a-zA-Z0-9_]*)?',
                r'\bFROM\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)'
            ]

            for pattern in from_patterns:
                matches = re.findall(pattern, query, re.IGNORECASE)
                for match in matches:
                    if isinstance(match, tuple):
                        table_name = next((m for m in match if m), None)
                    else:
                        table_name = match

                    if table_name:
                        # Extract just the table name (remove schema if present)
                        table_name = table_name.split('.')[-1]
                        tables.add(table_name)

            # JOIN clauses - enhanced to handle different join types
            join_patterns = [
                r'\b(?:INNER\s+|LEFT\s+|RIGHT\s+|FULL\s+|CROSS\s+)?JOIN\s+(?:`([^`]+)`|"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?))(?:\s+(?:AS\s+)?[a-zA-Z_][a-zA-Z0-9_]*)?',
                r'\bJOIN\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?)'
            ]

            for pattern in join_patterns:
                matches = re.findall(pattern, query, re.IGNORECASE)
                for match in matches:
                    if isinstance(match, tuple):
                        table_name = next((m for m in match if m), None)
                    else:
                        table_name = match

                    if table_name:
                        table_name = table_name.split('.')[-1]
                        tables.add(table_name)

            # UPDATE clause
            update_matches = re.findall(r'\bUPDATE\s+(?:`([^`]+)`|"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?))(?:\s+(?:AS\s+)?[a-zA-Z_][a-zA-Z0-9_]*)?', query, re.IGNORECASE)
            for match in update_matches:
                if isinstance(match, tuple):
                    table_name = next((m for m in match if m), None)
                else:
                    table_name = match

                if table_name:
                    table_name = table_name.split('.')[-1]
                    tables.add(table_name)

            # INSERT INTO clause
            insert_matches = re.findall(r'\bINSERT\s+INTO\s+(?:`([^`]+)`|"([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?))(?:\s+(?:AS\s+)?[a-zA-Z_][a-zA-Z0-9_]*)?', query, re.IGNORECASE)
            for match in insert_matches:
                if isinstance(match, tuple):
                    table_name = next((m for m in match if m), None)
                else:
                    table_name = match

                if table_name:
                    table_name = table_name.split('.')[-1]
                    tables.add(table_name)

        except Exception as e:
            logger.warning(f"Error extracting table references: {e}")
            # Fallback to simple extraction
            simple_matches = re.findall(r'\b(?:FROM|JOIN|UPDATE|INSERT\s+INTO)\s+([a-zA-Z_][a-zA-Z0-9_]*)', query, re.IGNORECASE)
            tables.update(simple_matches)

        return tables

    def _extract_column_references(self, query: str) -> Set[str]:
        """Extract column references from query"""
        columns = set()

        # SELECT clause columns
        select_match = re.search(r'\bSELECT\s+(.*?)\s+FROM', query, re.IGNORECASE | re.DOTALL)
        if select_match:
            select_part = select_match.group(1)
            if select_part.strip() != '*':
                # Extract column names (simplified)
                col_matches = re.findall(r'\b([a-zA-Z_][a-zA-Z0-9_]*)\b', select_part)
                columns.update(col_matches)

        # WHERE clause columns
        where_matches = re.findall(r'\b([a-zA-Z_][a-zA-Z0-9_]*)\s*[=<>!]', query, re.IGNORECASE)
        columns.update(where_matches)

        return columns

    def _extract_where_conditions(self, query: str) -> Set[str]:
        """Extract WHERE clause conditions"""
        conditions = set()

        where_match = re.search(r'\bWHERE\s+(.*?)(?:\s+GROUP\s+BY|\s+ORDER\s+BY|\s+LIMIT|$)',
                               query, re.IGNORECASE | re.DOTALL)
        if where_match:
            where_clause = where_match.group(1).strip()

            # Split by AND/OR and extract individual conditions
            condition_parts = re.split(r'\s+(?:AND|OR)\s+', where_clause, flags=re.IGNORECASE)
            for condition in condition_parts:
                condition = condition.strip()
                if condition:
                    conditions.add(condition.lower())

        return conditions

    def _extract_operators(self, query: str) -> Set[str]:
        """Extract comparison operators from query"""
        operators = set()

        # Common SQL operators
        operator_patterns = [
            r'=', r'!=', r'<>', r'<', r'>', r'<=', r'>=',
            r'\bLIKE\b', r'\bIN\b', r'\bBETWEEN\b', r'\bIS\b', r'\bEXISTS\b'
        ]

        for pattern in operator_patterns:
            if re.search(pattern, query, re.IGNORECASE):
                operators.add(pattern.replace(r'\b', '').replace('\\', ''))

        return operators

    def _extract_joins(self, query: str) -> List[Dict[str, str]]:
        """Extract JOIN information from query"""
        joins = []

        join_pattern = r'(INNER\s+JOIN|LEFT\s+JOIN|RIGHT\s+JOIN|FULL\s+JOIN|CROSS\s+JOIN|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)'
        matches = re.findall(join_pattern, query, re.IGNORECASE)

        for join_type, table in matches:
            joins.append({
                'type': join_type.upper(),
                'table': table
            })

        return joins

    def _analyze_query_characteristics(self, query: str) -> Dict[str, Any]:
        """Analyze general characteristics of a query"""
        return {
            'length': len(query),
            'complexity': self._calculate_query_complexity(query),
            'keyword_count': len([word for word in query.upper().split() if word in self.sql_keywords]),
            'function_count': len([word for word in query.upper().split() if word in self.sql_functions]),
            'has_subquery': '(SELECT' in query.upper(),
            'has_aggregation': any(func in query.upper() for func in ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN']),
            'has_joins': any(join in query.upper() for join in self.join_types)
        }

    def _calculate_query_complexity(self, query: str) -> float:
        """Calculate complexity score for a query"""
        if not query:
            return 0.0

        score = 0.0
        query_upper = query.upper()

        # Base complexity factors
        score += len(query) / 1000.0  # Length factor
        score += query_upper.count('JOIN') * 0.2
        score += query_upper.count('(SELECT') * 0.3  # Subqueries
        score += query_upper.count('UNION') * 0.25
        score += query_upper.count('GROUP BY') * 0.15
        score += query_upper.count('ORDER BY') * 0.1
        score += query_upper.count('HAVING') * 0.2
        score += query_upper.count('CASE') * 0.15

        return min(score, 1.0)

    def _calculate_change_magnitude(self, correction: UserCorrection) -> float:
        """Calculate the magnitude of change in a correction"""
        if not correction.corrected_query:
            return 0.0

        original = correction.original_query
        corrected = correction.corrected_query

        # Use sequence matcher to calculate similarity
        similarity = difflib.SequenceMatcher(None, original, corrected).ratio()

        # Change magnitude is inverse of similarity
        return 1.0 - similarity

    def _calculate_pattern_confidence(self, correction: UserCorrection,
                                    patterns: List[CorrectionPattern]) -> float:
        """Calculate confidence score for extracted patterns with proper bounds"""
        if not patterns:
            return 0.0

        # Start with base confidence based on correction type
        type_confidence_map = {
            CorrectionType.REPLACEMENT: 0.8,
            CorrectionType.EDIT: 0.7,
            CorrectionType.REFINEMENT: 0.6,
            CorrectionType.FEEDBACK: 0.4
        }

        base_confidence = type_confidence_map.get(correction.correction_type, 0.5)

        # Confidence modifiers (each capped to prevent overflow)
        modifiers = []

        # Reason provided modifier
        if correction.correction_reason and len(correction.correction_reason.strip()) > 10:
            modifiers.append(0.1)

        # Change magnitude modifier
        change_magnitude = self._calculate_change_magnitude(correction)
        if change_magnitude > 0.7:  # Very significant change
            modifiers.append(0.15)
        elif change_magnitude > 0.3:  # Moderate change
            modifiers.append(0.05)

        # Query complexity modifier (more complex queries = higher confidence when corrected)
        complexity = self._calculate_query_complexity(correction.original_query)
        if complexity > 0.5:
            modifiers.append(0.05)

        # Apply modifiers with diminishing returns
        total_modifier = sum(modifiers) * 0.8  # Reduce impact to prevent overflow
        adjusted_confidence = base_confidence + total_modifier

        # Average with pattern confidences if available
        pattern_confidences = [p.confidence for p in patterns if 0 <= p.confidence <= 1]
        if pattern_confidences:
            avg_pattern_confidence = sum(pattern_confidences) / len(pattern_confidences)
            # Weighted average: 60% base, 40% pattern average
            adjusted_confidence = (adjusted_confidence * 0.6) + (avg_pattern_confidence * 0.4)

        # Ensure bounds [0.0, 1.0]
        return max(0.0, min(adjusted_confidence, 1.0))

    def _check_pattern_similarity(self, new_patterns: List[CorrectionPattern],
                                existing_patterns: List[CorrectionPattern]) -> Tuple[float, List[int]]:
        """Check similarity to existing patterns and find conflicts"""
        if not existing_patterns:
            return 0.0, []

        max_similarity = 0.0
        conflicts = []

        for new_pattern in new_patterns:
            for existing_pattern in existing_patterns:
                if new_pattern.pattern_type == existing_pattern.pattern_type:
                    # Calculate similarity based on pattern data
                    similarity = self._calculate_pattern_data_similarity(
                        new_pattern.pattern_data, existing_pattern.pattern_data
                    )

                    max_similarity = max(max_similarity, similarity)

                    # Check for conflicts (high similarity but different preferences)
                    if similarity > 0.7 and self._patterns_conflict(new_pattern, existing_pattern):
                        conflicts.append(existing_pattern.id)

        return max_similarity, conflicts

    def _calculate_pattern_data_similarity(self, data1: Dict[str, Any], data2: Dict[str, Any]) -> float:
        """Calculate similarity between pattern data dictionaries"""
        if not data1 or not data2:
            return 0.0

        common_keys = set(data1.keys()) & set(data2.keys())
        if not common_keys:
            return 0.0

        similarities = []
        for key in common_keys:
            val1, val2 = data1[key], data2[key]

            if isinstance(val1, str) and isinstance(val2, str):
                sim = difflib.SequenceMatcher(None, val1, val2).ratio()
                similarities.append(sim)
            elif val1 == val2:
                similarities.append(1.0)
            else:
                similarities.append(0.0)

        return sum(similarities) / len(similarities) if similarities else 0.0

    def _patterns_conflict(self, pattern1: CorrectionPattern, pattern2: CorrectionPattern) -> bool:
        """Check if two patterns conflict with each other"""
        # Simple conflict detection - can be enhanced
        if pattern1.pattern_type != pattern2.pattern_type:
            return False

        # Check for contradictory preferences
        data1, data2 = pattern1.pattern_data, pattern2.pattern_data

        for key in set(data1.keys()) & set(data2.keys()):
            if data1[key] != data2[key] and isinstance(data1[key], (str, bool, int)):
                return True

        return False

    def _generate_recommendations(self, correction: UserCorrection, patterns: List[CorrectionPattern],
                                similarity_score: float, conflicts: List[int]) -> List[str]:
        """Generate recommendations based on analysis"""
        recommendations = []

        if not patterns:
            recommendations.append("No learnable patterns detected - consider providing more specific feedback")

        if similarity_score > 0.8:
            recommendations.append("High similarity to existing patterns - consider merging")

        if conflicts:
            recommendations.append(f"Conflicts detected with {len(conflicts)} existing patterns - manual review recommended")

        if correction.confidence < 0.5:
            recommendations.append("Low confidence correction - additional validation recommended")

        if len(patterns) > 3:
            recommendations.append("Multiple patterns extracted - prioritize by confidence")

        change_magnitude = self._calculate_change_magnitude(correction)
        if change_magnitude > 0.7:
            recommendations.append("Significant query changes detected - high learning potential")

        return recommendations
