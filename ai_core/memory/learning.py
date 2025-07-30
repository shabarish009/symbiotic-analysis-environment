"""
Pattern Learning for Project Cortex
Extracts and learns patterns from user interactions and query results.
"""

import re
import time
import logging
from typing import List, Dict, Any, Optional, Set, Tuple
from collections import defaultdict, Counter
from dataclasses import dataclass

from ..consensus.types import ConsensusResult, QueryContext
from .types import LearnedPattern, PatternType
from .config import MemoryConfig

logger = logging.getLogger(__name__)


@dataclass
class QueryPattern:
    """Represents a learned query pattern"""
    template: str
    parameters: List[str]
    frequency: int
    success_rate: float
    avg_confidence: float
    examples: List[str]


class PatternLearner:
    """Learns patterns from user interactions and query results"""
    
    def __init__(self, config: MemoryConfig):
        self.config = config
        
        # Pattern extraction rules
        self.sql_keywords = {
            'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER',
            'GROUP', 'BY', 'ORDER', 'HAVING', 'UNION', 'INSERT', 'UPDATE', 'DELETE',
            'CREATE', 'ALTER', 'DROP', 'INDEX', 'TABLE', 'VIEW', 'PROCEDURE', 'FUNCTION'
        }
        
        # Common SQL patterns
        self.sql_patterns = [
            (r'\b\d+\b', '<NUMBER>'),  # Numbers
            (r"'[^']*'", '<STRING>'),  # String literals
            (r'\b[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*\b', '<TABLE.COLUMN>'),  # Table.column
            (r'\b[a-zA-Z_][a-zA-Z0-9_]*\b(?=\s*=)', '<COLUMN>'),  # Column in WHERE clause
        ]
        
        # User preference indicators
        self.preference_indicators = {
            'formatting': ['uppercase', 'lowercase', 'mixed_case'],
            'join_style': ['explicit_join', 'implicit_join'],
            'alias_usage': ['table_aliases', 'column_aliases', 'no_aliases'],
            'query_style': ['verbose', 'concise', 'commented']
        }
        
    async def extract_patterns(self, query: str, context: Optional[QueryContext],
                              result: ConsensusResult) -> List[LearnedPattern]:
        """Extract and deduplicate patterns from a query and its result"""
        raw_patterns = []

        try:
            # Extract query template patterns
            query_patterns = self._extract_query_patterns(query, result)
            raw_patterns.extend(query_patterns)

            # Extract user preference patterns
            preference_patterns = self._extract_preference_patterns(query, context, result)
            raw_patterns.extend(preference_patterns)

            # Extract schema usage patterns
            if context:
                schema_patterns = self._extract_schema_patterns(query, context, result)
                raw_patterns.extend(schema_patterns)

            # Extract success patterns
            if result.confidence > self.config.min_pattern_confidence:
                success_patterns = self._extract_success_patterns(query, context, result)
                raw_patterns.extend(success_patterns)

            # LOGIC FIX: Deduplicate and merge similar patterns
            patterns = self._deduplicate_patterns(raw_patterns)

            logger.debug(f"Extracted {len(patterns)} unique patterns from {len(raw_patterns)} raw patterns")

        except Exception as e:
            logger.error(f"Error extracting patterns: {e}")
            patterns = []

        return patterns
    
    def _extract_query_patterns(self, query: str, result: ConsensusResult) -> List[LearnedPattern]:
        """Extract query template patterns"""
        patterns = []
        
        try:
            # Normalize query
            normalized_query = self._normalize_query(query)
            
            # Create query template
            template = self._create_query_template(normalized_query)
            
            if template and len(template) > 10:  # Avoid trivial templates
                pattern = LearnedPattern(
                    pattern_type=PatternType.QUERY_TEMPLATE,
                    pattern_data={
                        'template': template,
                        'original_query': query[:200],  # Truncate for storage
                        'query_type': self._classify_query_type(query),
                        'complexity_score': self._calculate_complexity_score(query),
                        'table_count': self._count_tables(query),
                        'join_count': self._count_joins(query)
                    },
                    confidence=result.confidence,
                    metadata={
                        'execution_time': result.execution_time,
                        'supporting_models': result.supporting_models,
                        'created_from': 'query_analysis'
                    }
                )
                patterns.append(pattern)
                
        except Exception as e:
            logger.error(f"Error extracting query patterns: {e}")
            
        return patterns
    
    def _extract_preference_patterns(self, query: str, context: Optional[QueryContext], 
                                    result: ConsensusResult) -> List[LearnedPattern]:
        """Extract user preference patterns"""
        patterns = []
        
        try:
            preferences = {}
            
            # Analyze formatting preferences
            if query.isupper():
                preferences['sql_case'] = 'uppercase'
            elif query.islower():
                preferences['sql_case'] = 'lowercase'
            else:
                preferences['sql_case'] = 'mixed_case'
            
            # Analyze join style preferences
            if 'JOIN' in query.upper():
                preferences['join_style'] = 'explicit_join'
            elif ',' in query and 'WHERE' in query.upper():
                preferences['join_style'] = 'implicit_join'
            
            # Analyze alias usage
            alias_count = len(re.findall(r'\bAS\s+\w+', query, re.IGNORECASE))
            if alias_count > 0:
                preferences['alias_usage'] = 'frequent'
            else:
                preferences['alias_usage'] = 'minimal'
            
            # Analyze query complexity preference
            complexity = self._calculate_complexity_score(query)
            if complexity > 0.7:
                preferences['complexity_preference'] = 'complex'
            elif complexity < 0.3:
                preferences['complexity_preference'] = 'simple'
            else:
                preferences['complexity_preference'] = 'moderate'
            
            if preferences:
                pattern = LearnedPattern(
                    pattern_type=PatternType.USER_PREFERENCE,
                    pattern_data=preferences,
                    confidence=min(result.confidence * 0.8, 0.9),  # Slightly lower confidence
                    metadata={
                        'query_sample': query[:100],
                        'analysis_date': time.time(),
                        'created_from': 'preference_analysis'
                    }
                )
                patterns.append(pattern)
                
        except Exception as e:
            logger.error(f"Error extracting preference patterns: {e}")
            
        return patterns
    
    def _extract_schema_patterns(self, query: str, context: QueryContext, 
                                result: ConsensusResult) -> List[LearnedPattern]:
        """Extract schema usage patterns"""
        patterns = []
        
        try:
            # Extract table usage patterns
            tables_used = self._extract_table_names(query)
            
            if tables_used:
                pattern = LearnedPattern(
                    pattern_type=PatternType.SCHEMA_USAGE,
                    pattern_data={
                        'tables_used': list(tables_used),
                        'table_count': len(tables_used),
                        'query_type': self._classify_query_type(query),
                        'join_pattern': self._analyze_join_pattern(query, tables_used),
                        'column_usage': self._extract_column_usage(query)
                    },
                    confidence=result.confidence * 0.9,
                    metadata={
                        'schema_context': getattr(context, 'database_schemas', []),
                        'created_from': 'schema_analysis'
                    }
                )
                patterns.append(pattern)
                
        except Exception as e:
            logger.error(f"Error extracting schema patterns: {e}")
            
        return patterns
    
    def _extract_success_patterns(self, query: str, context: Optional[QueryContext], 
                                 result: ConsensusResult) -> List[LearnedPattern]:
        """Extract patterns from successful queries"""
        patterns = []
        
        try:
            if result.confidence > 0.8:  # High confidence queries
                success_factors = {
                    'query_length': len(query),
                    'keyword_count': len([w for w in query.upper().split() if w in self.sql_keywords]),
                    'has_comments': '--' in query or '/*' in query,
                    'proper_formatting': self._check_formatting_quality(query),
                    'execution_time': result.execution_time,
                    'model_agreement': len(result.supporting_models)
                }
                
                pattern = LearnedPattern(
                    pattern_type=PatternType.SUCCESS_PATTERN,
                    pattern_data=success_factors,
                    confidence=result.confidence,
                    metadata={
                        'consensus_status': result.status.value,
                        'resolution_method': result.resolution_method,
                        'created_from': 'success_analysis'
                    }
                )
                patterns.append(pattern)
                
        except Exception as e:
            logger.error(f"Error extracting success patterns: {e}")
            
        return patterns
    
    def _normalize_query(self, query: str) -> str:
        """Normalize query for pattern extraction"""
        # Remove extra whitespace
        normalized = re.sub(r'\s+', ' ', query.strip())
        
        # Remove comments
        normalized = re.sub(r'--.*$', '', normalized, flags=re.MULTILINE)
        normalized = re.sub(r'/\*.*?\*/', '', normalized, flags=re.DOTALL)
        
        return normalized
    
    def _create_query_template(self, query: str) -> str:
        """Create a template from a query by replacing literals with placeholders"""
        template = query
        
        # Apply pattern replacements
        for pattern, replacement in self.sql_patterns:
            template = re.sub(pattern, replacement, template, flags=re.IGNORECASE)
        
        return template
    
    def _classify_query_type(self, query: str) -> str:
        """Classify the type of SQL query"""
        query_upper = query.upper().strip()
        
        if query_upper.startswith('SELECT'):
            if 'JOIN' in query_upper:
                return 'select_join'
            elif 'GROUP BY' in query_upper:
                return 'select_aggregate'
            elif 'UNION' in query_upper:
                return 'select_union'
            else:
                return 'select_simple'
        elif query_upper.startswith('INSERT'):
            return 'insert'
        elif query_upper.startswith('UPDATE'):
            return 'update'
        elif query_upper.startswith('DELETE'):
            return 'delete'
        elif query_upper.startswith('CREATE'):
            return 'create'
        elif query_upper.startswith('ALTER'):
            return 'alter'
        elif query_upper.startswith('DROP'):
            return 'drop'
        else:
            return 'unknown'
    
    def _calculate_complexity_score(self, query: str) -> float:
        """Calculate a complexity score for the query"""
        score = 0.0
        query_upper = query.upper()
        
        # Base complexity factors
        score += len(query) / 1000.0  # Length factor
        score += query_upper.count('JOIN') * 0.2
        score += query_upper.count('SUBQUERY') * 0.3
        score += query_upper.count('UNION') * 0.25
        score += query_upper.count('GROUP BY') * 0.15
        score += query_upper.count('ORDER BY') * 0.1
        score += query_upper.count('HAVING') * 0.2
        score += query_upper.count('CASE') * 0.15
        
        # Nested query complexity
        paren_depth = 0
        max_depth = 0
        for char in query:
            if char == '(':
                paren_depth += 1
                max_depth = max(max_depth, paren_depth)
            elif char == ')':
                paren_depth -= 1
        
        score += max_depth * 0.1
        
        return min(score, 1.0)
    
    def _count_tables(self, query: str) -> int:
        """Count the number of tables referenced in the query"""
        return len(self._extract_table_names(query))
    
    def _count_joins(self, query: str) -> int:
        """Count the number of joins in the query"""
        return len(re.findall(r'\bJOIN\b', query, re.IGNORECASE))
    
    def _extract_table_names(self, query: str) -> Set[str]:
        """Extract table names from the query"""
        tables = set()
        
        # Simple pattern matching for table names
        # This is a basic implementation - could be enhanced with proper SQL parsing
        
        # FROM clause
        from_matches = re.findall(r'\bFROM\s+([a-zA-Z_][a-zA-Z0-9_]*)', query, re.IGNORECASE)
        tables.update(from_matches)
        
        # JOIN clauses
        join_matches = re.findall(r'\bJOIN\s+([a-zA-Z_][a-zA-Z0-9_]*)', query, re.IGNORECASE)
        tables.update(join_matches)
        
        # UPDATE clause
        update_matches = re.findall(r'\bUPDATE\s+([a-zA-Z_][a-zA-Z0-9_]*)', query, re.IGNORECASE)
        tables.update(update_matches)
        
        # INSERT INTO clause
        insert_matches = re.findall(r'\bINSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)', query, re.IGNORECASE)
        tables.update(insert_matches)
        
        return tables
    
    def _analyze_join_pattern(self, query: str, tables: Set[str]) -> Dict[str, Any]:
        """Analyze join patterns in the query"""
        join_info = {
            'join_count': self._count_joins(query),
            'join_types': [],
            'table_count': len(tables)
        }
        
        # Identify join types
        join_types = re.findall(r'\b(INNER|LEFT|RIGHT|FULL|CROSS)\s+JOIN\b', query, re.IGNORECASE)
        join_info['join_types'] = [jt.upper() for jt in join_types]
        
        return join_info
    
    def _extract_column_usage(self, query: str) -> Dict[str, Any]:
        """Extract column usage patterns"""
        column_info = {
            'select_columns': [],
            'where_columns': [],
            'group_by_columns': [],
            'order_by_columns': []
        }
        
        # This is a simplified extraction - could be enhanced with proper SQL parsing
        
        # SELECT columns (basic pattern)
        select_match = re.search(r'\bSELECT\s+(.*?)\s+FROM', query, re.IGNORECASE | re.DOTALL)
        if select_match:
            select_part = select_match.group(1)
            if select_part.strip() != '*':
                columns = [col.strip() for col in select_part.split(',')]
                column_info['select_columns'] = columns[:10]  # Limit for storage
        
        return column_info
    
    def _check_formatting_quality(self, query: str) -> float:
        """Check the formatting quality of the query"""
        score = 0.0
        
        # Check for proper indentation
        lines = query.split('\n')
        if len(lines) > 1:
            score += 0.3
        
        # Check for keyword capitalization consistency
        keywords_found = re.findall(r'\b(?:SELECT|FROM|WHERE|JOIN|GROUP|ORDER|BY)\b', query)
        if keywords_found:
            upper_count = sum(1 for kw in keywords_found if kw.isupper())
            lower_count = sum(1 for kw in keywords_found if kw.islower())
            
            if upper_count > lower_count:
                score += 0.4 if upper_count == len(keywords_found) else 0.2
            elif lower_count > upper_count:
                score += 0.4 if lower_count == len(keywords_found) else 0.2
        
        # Check for proper spacing
        if not re.search(r'\w\w+\(', query):  # No functions without spaces
            score += 0.3
        
        return min(score, 1.0)

    def _deduplicate_patterns(self, patterns: List[LearnedPattern]) -> List[LearnedPattern]:
        """LOGIC FIX: Deduplicate and merge similar patterns"""
        if not patterns:
            return []

        # Group patterns by type
        pattern_groups = {}
        for pattern in patterns:
            pattern_type = pattern.pattern_type
            if pattern_type not in pattern_groups:
                pattern_groups[pattern_type] = []
            pattern_groups[pattern_type].append(pattern)

        deduplicated = []

        for pattern_type, group in pattern_groups.items():
            if pattern_type == PatternType.QUERY_TEMPLATE:
                # Merge similar query templates
                deduplicated.extend(self._merge_query_templates(group))
            elif pattern_type == PatternType.USER_PREFERENCE:
                # Merge user preferences
                deduplicated.extend(self._merge_user_preferences(group))
            else:
                # For other types, take the highest confidence
                if group:
                    best_pattern = max(group, key=lambda p: p.confidence)
                    deduplicated.append(best_pattern)

        return deduplicated

    def _merge_query_templates(self, templates: List[LearnedPattern]) -> List[LearnedPattern]:
        """Merge similar query templates"""
        if not templates:
            return []

        # Group by template similarity
        template_groups = {}
        for template in templates:
            template_str = template.pattern_data.get('template', '')

            # Find similar existing template
            similar_key = None
            for existing_key in template_groups.keys():
                if self._templates_similar(template_str, existing_key):
                    similar_key = existing_key
                    break

            if similar_key:
                template_groups[similar_key].append(template)
            else:
                template_groups[template_str] = [template]

        # Merge each group
        merged = []
        for group in template_groups.values():
            if len(group) == 1:
                merged.append(group[0])
            else:
                # Merge multiple templates
                best_template = max(group, key=lambda t: t.confidence)
                best_template.usage_count = sum(t.usage_count for t in group)
                best_template.confidence = sum(t.confidence for t in group) / len(group)
                merged.append(best_template)

        return merged

    def _merge_user_preferences(self, preferences: List[LearnedPattern]) -> List[LearnedPattern]:
        """Merge user preference patterns"""
        if not preferences:
            return []

        # Combine all preference data
        combined_data = {}
        total_confidence = 0
        total_usage = 0

        for pref in preferences:
            for key, value in pref.pattern_data.items():
                if key in combined_data:
                    # For conflicting preferences, keep the higher confidence one
                    if pref.confidence > combined_data[key].get('confidence', 0):
                        combined_data[key] = {'value': value, 'confidence': pref.confidence}
                else:
                    combined_data[key] = {'value': value, 'confidence': pref.confidence}

            total_confidence += pref.confidence
            total_usage += pref.usage_count

        # Create merged preference pattern
        merged_pattern = LearnedPattern(
            pattern_type=PatternType.USER_PREFERENCE,
            pattern_data={k: v['value'] for k, v in combined_data.items()},
            confidence=total_confidence / len(preferences),
            usage_count=total_usage,
            metadata={'merged_from': len(preferences), 'created_from': 'preference_merge'}
        )

        return [merged_pattern]

    def _templates_similar(self, template1: str, template2: str, threshold: float = 0.8) -> bool:
        """Check if two query templates are similar"""
        if not template1 or not template2:
            return False

        # Simple similarity based on common tokens
        tokens1 = set(template1.lower().split())
        tokens2 = set(template2.lower().split())

        if not tokens1 or not tokens2:
            return False

        intersection = len(tokens1.intersection(tokens2))
        union = len(tokens1.union(tokens2))

        similarity = intersection / union if union > 0 else 0
        return similarity >= threshold
