"""
Local LLM Model Definitions and Configuration
"""

import time
from enum import Enum
from dataclasses import dataclass, field
from typing import Dict, Any, Optional, List
from pathlib import Path


class ModelStatus(Enum):
    """Status of a local model"""
    NOT_DOWNLOADED = "not_downloaded"
    DOWNLOADING = "downloading"
    DOWNLOADED = "downloaded"
    LOADING = "loading"
    LOADED = "loaded"
    ERROR = "error"
    CORRUPTED = "corrupted"


class ModelType(Enum):
    """Type of model for different use cases"""
    CODE_GENERATION = "code_generation"
    SQL_SPECIALIST = "sql_specialist"
    GENERAL_PURPOSE = "general_purpose"
    LIGHTWEIGHT = "lightweight"


@dataclass
class ModelConfig:
    """Configuration for a local LLM model"""
    name: str
    display_name: str
    model_type: ModelType
    download_url: str
    checksum_sha256: str
    file_size_mb: int
    memory_requirement_mb: int
    context_length: int
    quantization: Optional[str] = None
    license: str = "Apache-2.0"
    description: str = ""
    recommended_for: List[str] = field(default_factory=list)
    
    # Performance characteristics
    inference_speed_tokens_per_sec: float = 0.0
    quality_score: float = 0.0  # 0-1 scale
    
    # Technical details
    architecture: str = "llama"
    parameter_count: str = "7B"
    training_data_cutoff: str = "2023-09"
    
    # File handling
    filename: str = ""
    extraction_path: Optional[str] = None
    requires_extraction: bool = False
    
    def __post_init__(self):
        if not self.filename:
            self.filename = self.download_url.split('/')[-1]


@dataclass
class LocalModel:
    """Represents a local LLM model instance"""
    config: ModelConfig
    status: ModelStatus = ModelStatus.NOT_DOWNLOADED
    local_path: Optional[Path] = None
    loaded_at: Optional[float] = None
    last_used: Optional[float] = None
    error_message: Optional[str] = None
    
    # Runtime information
    memory_usage_mb: float = 0.0
    gpu_memory_usage_mb: float = 0.0
    inference_count: int = 0
    total_inference_time: float = 0.0
    
    # Model instance (populated when loaded)
    model_instance: Any = None
    tokenizer_instance: Any = None
    
    @property
    def is_available(self) -> bool:
        """Check if model is ready for inference"""
        return self.status == ModelStatus.LOADED and self.model_instance is not None
    
    @property
    def average_inference_time(self) -> float:
        """Calculate average inference time"""
        if self.inference_count == 0:
            return 0.0
        return self.total_inference_time / self.inference_count
    
    def update_usage_stats(self, inference_time: float):
        """Update model usage statistics"""
        self.inference_count += 1
        self.total_inference_time += inference_time
        self.last_used = time.time()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            'name': self.config.name,
            'display_name': self.config.display_name,
            'status': self.status.value,
            'model_type': self.config.model_type.value,
            'memory_requirement_mb': self.config.memory_requirement_mb,
            'memory_usage_mb': self.memory_usage_mb,
            'gpu_memory_usage_mb': self.gpu_memory_usage_mb,
            'inference_count': self.inference_count,
            'average_inference_time': self.average_inference_time,
            'last_used': self.last_used,
            'is_available': self.is_available,
            'error_message': self.error_message,
            'quality_score': self.config.quality_score,
            'parameter_count': self.config.parameter_count,
            'context_length': self.config.context_length
        }


# Predefined model configurations
AVAILABLE_MODELS = {
    "code-llama-7b-instruct": ModelConfig(
        name="code-llama-7b-instruct",
        display_name="Code Llama 7B Instruct",
        model_type=ModelType.CODE_GENERATION,
        download_url="https://huggingface.co/TheBloke/CodeLlama-7B-Instruct-GGML/resolve/main/codellama-7b-instruct.q4_0.bin",
        checksum_sha256="a8c8c9f1b2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9",
        file_size_mb=3800,
        memory_requirement_mb=6000,
        context_length=4096,
        quantization="q4_0",
        description="Optimized for code generation and SQL queries",
        recommended_for=["SQL Generation", "Code Completion", "Technical Documentation"],
        inference_speed_tokens_per_sec=15.0,
        quality_score=0.85,
        architecture="llama",
        parameter_count="7B"
    ),
    
    "mistral-7b-instruct": ModelConfig(
        name="mistral-7b-instruct",
        display_name="Mistral 7B Instruct",
        model_type=ModelType.GENERAL_PURPOSE,
        download_url="https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.1-GGML/resolve/main/mistral-7b-instruct-v0.1.q4_0.bin",
        checksum_sha256="b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2",
        file_size_mb=3600,
        memory_requirement_mb=5500,
        context_length=8192,
        quantization="q4_0",
        description="High-quality general purpose model with good SQL capabilities",
        recommended_for=["General Queries", "SQL Generation", "Data Analysis"],
        inference_speed_tokens_per_sec=18.0,
        quality_score=0.88,
        architecture="mistral",
        parameter_count="7B"
    ),
    
    "phi-2": ModelConfig(
        name="phi-2",
        display_name="Microsoft Phi-2",
        model_type=ModelType.LIGHTWEIGHT,
        download_url="https://huggingface.co/TheBloke/phi-2-GGML/resolve/main/phi-2.q4_0.bin",
        checksum_sha256="c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4",
        file_size_mb=1600,
        memory_requirement_mb=3000,
        context_length=2048,
        quantization="q4_0",
        description="Lightweight model for resource-constrained environments",
        recommended_for=["Low Memory Systems", "Quick Responses", "Basic SQL"],
        inference_speed_tokens_per_sec=25.0,
        quality_score=0.75,
        architecture="phi",
        parameter_count="2.7B"
    ),
    
    "sqlcoder-7b": ModelConfig(
        name="sqlcoder-7b",
        display_name="SQLCoder 7B",
        model_type=ModelType.SQL_SPECIALIST,
        download_url="https://huggingface.co/TheBloke/sqlcoder-7b-GGML/resolve/main/sqlcoder-7b.q4_0.bin",
        checksum_sha256="d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5",
        file_size_mb=3700,
        memory_requirement_mb=5800,
        context_length=4096,
        quantization="q4_0",
        description="Specialized model trained specifically for SQL generation",
        recommended_for=["SQL Generation", "Database Queries", "Schema Analysis"],
        inference_speed_tokens_per_sec=16.0,
        quality_score=0.92,
        architecture="llama",
        parameter_count="7B"
    )
}


def get_recommended_model(available_memory_mb: int, has_gpu: bool = False) -> str:
    """Get recommended model based on system capabilities"""
    if available_memory_mb < 4000:
        return "phi-2"
    elif available_memory_mb < 6000:
        return "mistral-7b-instruct"
    else:
        # Prefer SQL specialist if enough memory
        return "sqlcoder-7b"


def get_model_config(model_name: str) -> Optional[ModelConfig]:
    """Get model configuration by name"""
    return AVAILABLE_MODELS.get(model_name)


def list_available_models() -> List[ModelConfig]:
    """Get list of all available model configurations"""
    return list(AVAILABLE_MODELS.values())
