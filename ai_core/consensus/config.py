"""
Consensus Engine Configuration
Configuration management for the consensus system.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional
import os


@dataclass
class ModelConfig:
    """Configuration for a single AI model"""
    model_id: str
    model_type: str  # e.g., "mock", "openai", "huggingface"
    weight: float = 1.0
    timeout: float = 30.0
    max_retries: int = 2
    enabled: bool = True
    config: Dict = field(default_factory=dict)
    
    def __post_init__(self):
        """Validate configuration after initialization"""
        if self.weight < 0 or self.weight > 10:
            raise ValueError(f"Model weight must be between 0 and 10, got {self.weight}")
        if self.timeout <= 0:
            raise ValueError(f"Model timeout must be positive, got {self.timeout}")
        if self.max_retries < 0:
            raise ValueError(f"Max retries must be non-negative, got {self.max_retries}")


@dataclass
class ConsensusConfig:
    """Configuration for the consensus engine"""
    
    # Consensus detection parameters
    consensus_threshold: float = 0.8
    min_supporting_models: int = 2
    max_disagreement_ratio: float = 0.3
    
    # Model management
    model_timeout: float = 30.0
    max_parallel_models: int = 5
    model_retry_attempts: int = 2
    
    # Response validation
    min_content_score: float = 0.6
    similarity_threshold: float = 0.7
    max_response_length: int = 10000
    min_response_length: int = 10
    
    # Performance tuning
    enable_caching: bool = True
    cache_ttl: int = 3600
    enable_metrics: bool = True
    
    # Timeout management
    total_timeout: float = 60.0
    validation_timeout: float = 10.0
    
    # Logging and debugging
    debug_mode: bool = False
    log_all_responses: bool = False
    
    # Model configurations
    models: List[ModelConfig] = field(default_factory=list)
    
    def __post_init__(self):
        """Validate configuration after initialization"""
        self._validate_consensus_params()
        self._validate_timeouts()
        self._validate_models()
    
    def _validate_consensus_params(self):
        """IMPROVEMENT: Enhanced consensus parameter validation"""
        if not 0.0 <= self.consensus_threshold <= 1.0:
            raise ValueError(f"Consensus threshold must be between 0 and 1, got {self.consensus_threshold}")

        # Warn about potentially problematic thresholds
        if self.consensus_threshold < 0.5:
            import logging
            logging.getLogger(__name__).warning(f"Low consensus threshold ({self.consensus_threshold}) may lead to unreliable results")

        if self.min_supporting_models < 2:
            raise ValueError(f"Minimum supporting models must be at least 2 for meaningful consensus, got {self.min_supporting_models}")

        if self.min_supporting_models > 10:
            import logging
            logging.getLogger(__name__).warning(f"High minimum supporting models ({self.min_supporting_models}) may impact performance")

        if not 0.0 <= self.max_disagreement_ratio <= 1.0:
            raise ValueError(f"Max disagreement ratio must be between 0 and 1, got {self.max_disagreement_ratio}")

        if not 0.0 <= self.min_content_score <= 1.0:
            raise ValueError(f"Min content score must be between 0 and 1, got {self.min_content_score}")

        if not 0.0 <= self.similarity_threshold <= 1.0:
            raise ValueError(f"Similarity threshold must be between 0 and 1, got {self.similarity_threshold}")

        # Validate response length constraints
        if self.max_response_length <= self.min_response_length:
            raise ValueError(f"Max response length ({self.max_response_length}) must be greater than min response length ({self.min_response_length})")

        if self.min_response_length < 1:
            raise ValueError(f"Min response length must be at least 1, got {self.min_response_length}")

        if self.max_response_length > 100000:  # 100KB limit
            import logging
            logging.getLogger(__name__).warning(f"Very large max response length ({self.max_response_length}) may impact performance")
    
    def _validate_timeouts(self):
        """Validate timeout parameters"""
        if self.model_timeout <= 0:
            raise ValueError(f"Model timeout must be positive, got {self.model_timeout}")
        
        if self.total_timeout <= 0:
            raise ValueError(f"Total timeout must be positive, got {self.total_timeout}")
        
        if self.validation_timeout <= 0:
            raise ValueError(f"Validation timeout must be positive, got {self.validation_timeout}")
        
        if self.total_timeout < self.model_timeout:
            raise ValueError("Total timeout must be greater than or equal to model timeout")
    
    def _validate_models(self):
        """Validate model configurations"""
        if len(self.models) == 0:
            # Add default mock models for testing
            self.models = self._create_default_models()
        
        enabled_models = [m for m in self.models if m.enabled]
        if len(enabled_models) < self.min_supporting_models:
            raise ValueError(f"Need at least {self.min_supporting_models} enabled models, got {len(enabled_models)}")
        
        # Validate model IDs are unique
        model_ids = [m.model_id for m in self.models]
        if len(model_ids) != len(set(model_ids)):
            raise ValueError("Model IDs must be unique")
    
    def _create_default_models(self) -> List[ModelConfig]:
        """Create default mock models for testing"""
        return [
            ModelConfig(
                model_id="mock_model_1",
                model_type="mock",
                weight=1.0,
                timeout=self.model_timeout,
                config={"response_pattern": "analytical"}
            ),
            ModelConfig(
                model_id="mock_model_2", 
                model_type="mock",
                weight=1.0,
                timeout=self.model_timeout,
                config={"response_pattern": "creative"}
            ),
            ModelConfig(
                model_id="mock_model_3",
                model_type="mock", 
                weight=0.8,
                timeout=self.model_timeout,
                config={"response_pattern": "conservative"}
            )
        ]
    
    @classmethod
    def from_dict(cls, config_dict: Dict) -> 'ConsensusConfig':
        """Create configuration from dictionary"""
        models_data = config_dict.pop('models', [])
        models = [ModelConfig(**model_data) for model_data in models_data]
        
        config = cls(**config_dict)
        config.models = models
        return config
    
    @classmethod
    def from_env(cls) -> 'ConsensusConfig':
        """Create configuration from environment variables"""
        config = cls()
        
        # Override with environment variables if present
        if os.getenv('CONSENSUS_THRESHOLD'):
            config.consensus_threshold = float(os.getenv('CONSENSUS_THRESHOLD'))
        
        if os.getenv('MIN_SUPPORTING_MODELS'):
            config.min_supporting_models = int(os.getenv('MIN_SUPPORTING_MODELS'))
        
        if os.getenv('MODEL_TIMEOUT'):
            config.model_timeout = float(os.getenv('MODEL_TIMEOUT'))
        
        if os.getenv('TOTAL_TIMEOUT'):
            config.total_timeout = float(os.getenv('TOTAL_TIMEOUT'))
        
        if os.getenv('DEBUG_MODE'):
            config.debug_mode = os.getenv('DEBUG_MODE').lower() == 'true'
        
        return config
    
    def get_enabled_models(self) -> List[ModelConfig]:
        """Get list of enabled models"""
        return [model for model in self.models if model.enabled]
    
    def get_model_by_id(self, model_id: str) -> Optional[ModelConfig]:
        """Get model configuration by ID"""
        for model in self.models:
            if model.model_id == model_id:
                return model
        return None
    
    def add_model(self, model_config: ModelConfig):
        """Add a new model configuration"""
        # Check for duplicate IDs
        if self.get_model_by_id(model_config.model_id):
            raise ValueError(f"Model with ID '{model_config.model_id}' already exists")
        
        self.models.append(model_config)
    
    def remove_model(self, model_id: str) -> bool:
        """Remove a model configuration by ID"""
        for i, model in enumerate(self.models):
            if model.model_id == model_id:
                del self.models[i]
                return True
        return False
    
    def to_dict(self) -> Dict:
        """Convert configuration to dictionary"""
        config_dict = {
            'consensus_threshold': self.consensus_threshold,
            'min_supporting_models': self.min_supporting_models,
            'max_disagreement_ratio': self.max_disagreement_ratio,
            'model_timeout': self.model_timeout,
            'max_parallel_models': self.max_parallel_models,
            'model_retry_attempts': self.model_retry_attempts,
            'min_content_score': self.min_content_score,
            'similarity_threshold': self.similarity_threshold,
            'max_response_length': self.max_response_length,
            'min_response_length': self.min_response_length,
            'enable_caching': self.enable_caching,
            'cache_ttl': self.cache_ttl,
            'enable_metrics': self.enable_metrics,
            'total_timeout': self.total_timeout,
            'validation_timeout': self.validation_timeout,
            'debug_mode': self.debug_mode,
            'log_all_responses': self.log_all_responses,
            'models': [
                {
                    'model_id': model.model_id,
                    'model_type': model.model_type,
                    'weight': model.weight,
                    'timeout': model.timeout,
                    'max_retries': model.max_retries,
                    'enabled': model.enabled,
                    'config': model.config
                }
                for model in self.models
            ]
        }
        return config_dict
