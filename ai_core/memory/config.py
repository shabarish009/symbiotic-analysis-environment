"""
Memory System Configuration
Configuration settings for the Project Cortex memory system.
"""

import os
from dataclasses import dataclass, field
from typing import Dict, Any, Optional


@dataclass
class MemoryConfig:
    """Configuration for the memory system"""
    
    # Database configuration
    database_path: str = "cortex.db"
    enable_encryption: bool = True
    connection_pool_size: int = 10
    connection_timeout: float = 30.0
    
    # Performance settings
    cache_size: int = 1000
    cache_ttl: int = 3600  # 1 hour
    max_context_items: int = 50
    context_retrieval_timeout: float = 0.1  # 100ms
    
    # Learning parameters
    min_pattern_confidence: float = 0.6
    max_patterns_per_type: int = 100
    pattern_decay_rate: float = 0.95
    similarity_threshold: float = 0.7
    
    # Query history settings
    max_query_history: int = 10000
    query_retention_days: int = 365
    auto_cleanup_enabled: bool = True
    cleanup_interval_hours: int = 24
    
    # Schema detection settings
    schema_scan_interval_hours: int = 6
    auto_schema_update: bool = True
    schema_change_threshold: float = 0.1
    
    # Security settings
    enable_query_sanitization: bool = True
    max_query_length: int = 10000
    enable_audit_logging: bool = True
    
    # Backup and recovery
    auto_backup_enabled: bool = True
    backup_interval_hours: int = 12
    max_backup_files: int = 7
    backup_compression: bool = True
    
    # Debug and monitoring
    debug_mode: bool = False
    enable_performance_monitoring: bool = True
    log_slow_queries: bool = True
    slow_query_threshold: float = 0.05  # 50ms
    
    @classmethod
    def from_env(cls) -> 'MemoryConfig':
        """Create configuration from environment variables"""
        return cls(
            database_path=os.getenv('CORTEX_DB_PATH', 'cortex.db'),
            enable_encryption=os.getenv('CORTEX_ENCRYPTION', 'true').lower() == 'true',
            connection_pool_size=int(os.getenv('CORTEX_POOL_SIZE', '10')),
            connection_timeout=float(os.getenv('CORTEX_TIMEOUT', '30.0')),
            
            cache_size=int(os.getenv('CORTEX_CACHE_SIZE', '1000')),
            cache_ttl=int(os.getenv('CORTEX_CACHE_TTL', '3600')),
            max_context_items=int(os.getenv('CORTEX_MAX_CONTEXT', '50')),
            context_retrieval_timeout=float(os.getenv('CORTEX_RETRIEVAL_TIMEOUT', '0.1')),
            
            min_pattern_confidence=float(os.getenv('CORTEX_MIN_CONFIDENCE', '0.6')),
            max_patterns_per_type=int(os.getenv('CORTEX_MAX_PATTERNS', '100')),
            pattern_decay_rate=float(os.getenv('CORTEX_DECAY_RATE', '0.95')),
            similarity_threshold=float(os.getenv('CORTEX_SIMILARITY_THRESHOLD', '0.7')),
            
            max_query_history=int(os.getenv('CORTEX_MAX_HISTORY', '10000')),
            query_retention_days=int(os.getenv('CORTEX_RETENTION_DAYS', '365')),
            auto_cleanup_enabled=os.getenv('CORTEX_AUTO_CLEANUP', 'true').lower() == 'true',
            cleanup_interval_hours=int(os.getenv('CORTEX_CLEANUP_INTERVAL', '24')),
            
            schema_scan_interval_hours=int(os.getenv('CORTEX_SCHEMA_SCAN_INTERVAL', '6')),
            auto_schema_update=os.getenv('CORTEX_AUTO_SCHEMA_UPDATE', 'true').lower() == 'true',
            schema_change_threshold=float(os.getenv('CORTEX_SCHEMA_CHANGE_THRESHOLD', '0.1')),
            
            enable_query_sanitization=os.getenv('CORTEX_SANITIZATION', 'true').lower() == 'true',
            max_query_length=int(os.getenv('CORTEX_MAX_QUERY_LENGTH', '10000')),
            enable_audit_logging=os.getenv('CORTEX_AUDIT_LOGGING', 'true').lower() == 'true',
            
            auto_backup_enabled=os.getenv('CORTEX_AUTO_BACKUP', 'true').lower() == 'true',
            backup_interval_hours=int(os.getenv('CORTEX_BACKUP_INTERVAL', '12')),
            max_backup_files=int(os.getenv('CORTEX_MAX_BACKUPS', '7')),
            backup_compression=os.getenv('CORTEX_BACKUP_COMPRESSION', 'true').lower() == 'true',
            
            debug_mode=os.getenv('CORTEX_DEBUG', 'false').lower() == 'true',
            enable_performance_monitoring=os.getenv('CORTEX_PERFORMANCE_MONITORING', 'true').lower() == 'true',
            log_slow_queries=os.getenv('CORTEX_LOG_SLOW_QUERIES', 'true').lower() == 'true',
            slow_query_threshold=float(os.getenv('CORTEX_SLOW_QUERY_THRESHOLD', '0.05'))
        )
    
    def validate(self) -> Dict[str, Any]:
        """Validate configuration and return validation results"""
        errors = []
        warnings = []
        
        # Validate database settings
        if self.connection_pool_size < 1:
            errors.append("Connection pool size must be at least 1")
        if self.connection_timeout <= 0:
            errors.append("Connection timeout must be positive")
            
        # Validate performance settings
        if self.cache_size < 0:
            errors.append("Cache size cannot be negative")
        if self.cache_ttl <= 0:
            warnings.append("Cache TTL should be positive for effective caching")
        if self.context_retrieval_timeout <= 0:
            errors.append("Context retrieval timeout must be positive")
        if self.context_retrieval_timeout > 1.0:
            warnings.append("Context retrieval timeout > 1s may impact consensus performance")
            
        # Validate learning parameters
        if not 0 <= self.min_pattern_confidence <= 1:
            errors.append("Pattern confidence must be between 0 and 1")
        if self.max_patterns_per_type < 1:
            errors.append("Max patterns per type must be at least 1")
        if not 0 <= self.pattern_decay_rate <= 1:
            errors.append("Pattern decay rate must be between 0 and 1")
        if not 0 <= self.similarity_threshold <= 1:
            errors.append("Similarity threshold must be between 0 and 1")
            
        # Validate history settings
        if self.max_query_history < 1:
            errors.append("Max query history must be at least 1")
        if self.query_retention_days < 1:
            warnings.append("Query retention less than 1 day may limit learning effectiveness")
        if self.cleanup_interval_hours < 1:
            warnings.append("Cleanup interval less than 1 hour may impact performance")
            
        # Validate security settings
        if self.max_query_length < 100:
            warnings.append("Max query length < 100 may be too restrictive")
        if self.max_query_length > 100000:
            warnings.append("Max query length > 100KB may impact performance")
            
        # Validate backup settings
        if self.backup_interval_hours < 1:
            warnings.append("Backup interval less than 1 hour may impact performance")
        if self.max_backup_files < 1:
            errors.append("Must keep at least 1 backup file")
            
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }
    
    def get_database_url(self) -> str:
        """Get database connection URL"""
        if self.enable_encryption:
            return f"sqlite+pysqlcipher://:{self.database_path}"
        else:
            return f"sqlite:///{self.database_path}"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            'database_path': self.database_path,
            'enable_encryption': self.enable_encryption,
            'connection_pool_size': self.connection_pool_size,
            'connection_timeout': self.connection_timeout,
            'cache_size': self.cache_size,
            'cache_ttl': self.cache_ttl,
            'max_context_items': self.max_context_items,
            'context_retrieval_timeout': self.context_retrieval_timeout,
            'min_pattern_confidence': self.min_pattern_confidence,
            'max_patterns_per_type': self.max_patterns_per_type,
            'pattern_decay_rate': self.pattern_decay_rate,
            'similarity_threshold': self.similarity_threshold,
            'max_query_history': self.max_query_history,
            'query_retention_days': self.query_retention_days,
            'auto_cleanup_enabled': self.auto_cleanup_enabled,
            'cleanup_interval_hours': self.cleanup_interval_hours,
            'schema_scan_interval_hours': self.schema_scan_interval_hours,
            'auto_schema_update': self.auto_schema_update,
            'schema_change_threshold': self.schema_change_threshold,
            'enable_query_sanitization': self.enable_query_sanitization,
            'max_query_length': self.max_query_length,
            'enable_audit_logging': self.enable_audit_logging,
            'auto_backup_enabled': self.auto_backup_enabled,
            'backup_interval_hours': self.backup_interval_hours,
            'max_backup_files': self.max_backup_files,
            'backup_compression': self.backup_compression,
            'debug_mode': self.debug_mode,
            'enable_performance_monitoring': self.enable_performance_monitoring,
            'log_slow_queries': self.log_slow_queries,
            'slow_query_threshold': self.slow_query_threshold
        }
