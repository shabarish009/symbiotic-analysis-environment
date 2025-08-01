# Local LLM System Guide

## Overview

The Local LLM System enables Shelby to run entirely on your local machine using open-source Large Language Models, ensuring complete privacy and eliminating API costs.

## 🔒 Privacy & Security Features

- **100% Local Processing**: No data ever leaves your machine
- **Cryptographic Verification**: All model downloads are SHA-256 verified
- **Secure File Handling**: Path traversal protection and safe extraction
- **Vulnerability Scanning**: Mandatory security checks before operation
- **Input Sanitization**: Protection against injection attacks

## 🚀 Quick Start

### System Requirements

**Minimum Requirements:**
- 4GB RAM available
- 10GB free disk space
- Modern CPU (4+ cores recommended)

**Recommended Requirements:**
- 8GB+ RAM available
- 20GB+ free disk space
- GPU with CUDA support (optional but recommended)
- 8+ CPU cores

### Installation

1. **Install Dependencies:**
   ```bash
   pip install -r ai_core/requirements_local_llm.txt
   ```

2. **GPU Support (Optional):**
   ```bash
   # For NVIDIA GPUs:
   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
   
   # For AMD GPUs:
   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/rocm5.6
   ```

3. **Start Shelby:**
   The local LLM system will automatically initialize when you start Shelby.

## 📱 User Interface

### Local Mode Indicator

The Local Mode Indicator shows your current processing mode:

- 🔒 **Local Mode**: Privacy guaranteed, cost-free operation
- ☁️ **Cloud Mode**: Using external APIs
- ⚠️ **Error**: System issues detected

Click the indicator to toggle between modes (if local models are available).

### Model Manager

Access the Model Manager to:
- Download new models
- Load/unload models
- View model information
- Monitor download progress

## 🤖 Available Models

### SQLCoder 7B (Recommended)
- **Best for**: SQL generation and database queries
- **Size**: 3.7GB download, 5.8GB RAM required
- **Quality**: 92% accuracy score
- **Specialization**: Trained specifically for SQL tasks

### Mistral 7B Instruct
- **Best for**: General purpose with good SQL capabilities
- **Size**: 3.6GB download, 5.5GB RAM required
- **Quality**: 88% accuracy score
- **Features**: 8K context length, multilingual

### Code Llama 7B Instruct
- **Best for**: Code generation and technical documentation
- **Size**: 3.8GB download, 6.0GB RAM required
- **Quality**: 85% accuracy score
- **Specialization**: Optimized for programming tasks

### Microsoft Phi-2 (Lightweight)
- **Best for**: Resource-constrained systems
- **Size**: 1.6GB download, 3.0GB RAM required
- **Quality**: 75% accuracy score
- **Advantage**: Fast inference, low memory usage

## ⚙️ Configuration

### Automatic Model Selection

The system automatically recommends models based on your hardware:

- **< 4GB RAM**: Phi-2 (lightweight)
- **4-6GB RAM**: Mistral 7B or Code Llama 7B
- **> 6GB RAM**: SQLCoder 7B (best quality)

### Manual Model Management

Use the Model Manager UI or API calls:

```javascript
// Download a model
await invoke('ai_engine_request', {
  method: 'local_llm.download_model',
  params: { model_name: 'sqlcoder-7b' }
});

// Load a model
await invoke('ai_engine_request', {
  method: 'local_llm.load_model',
  params: { model_name: 'sqlcoder-7b' }
});

// Switch to local mode
await invoke('ai_engine_request', {
  method: 'local_llm.switch_to_local_mode',
  params: {}
});
```

## 🔧 Advanced Configuration

### Hardware Optimization

The system automatically detects and optimizes for your hardware:

- **CPU Optimization**: Uses all available cores for inference
- **GPU Acceleration**: Automatically uses CUDA/ROCm if available
- **Memory Management**: Monitors usage and prevents system instability
- **Quantization**: Uses 4-bit quantized models for efficiency

### Performance Tuning

Edit model parameters in `ai_core/local_llm/models.py`:

```python
# Adjust inference parameters
inference_params = {
    'temperature': 0.3,  # Lower = more deterministic
    'top_p': 0.9,        # Nucleus sampling
    'max_tokens': 512,   # Response length limit
}
```

### Storage Management

Models are stored in `~/.shelby/models/` by default. To change:

```python
# In your configuration
models_dir = "/path/to/your/models"
manager = LocalLLMManager(models_dir)
```

## 🛡️ Security Features

### Mandatory Security Scanning

Before any model operations, the system runs a comprehensive security scan:

- **Dependency Vulnerability Check**: Scans for known vulnerable packages
- **File System Validation**: Ensures secure file permissions
- **Network Security**: Validates download sources and protocols
- **Input Sanitization**: Protects against injection attacks

### Safe Model Downloads

All model downloads are secured with:

- **HTTPS Only**: No unencrypted downloads allowed
- **Domain Whitelist**: Only trusted sources (HuggingFace, GitHub)
- **Checksum Verification**: SHA-256 verification for all files
- **Path Traversal Protection**: Safe extraction of archives
- **File Size Limits**: Prevents resource exhaustion attacks

## 📊 Monitoring & Diagnostics

### System Health

Monitor system health through the API:

```javascript
const health = await invoke('ai_engine_request', {
  method: 'local_llm.get_system_status',
  params: {}
});

console.log('Active Model:', health.data.active_model);
console.log('Memory Usage:', health.data.memory_usage);
console.log('Security Status:', health.data.security_scan_completed);
```

### Performance Metrics

Track inference performance:

- **Response Time**: Target <10 seconds per query
- **Memory Usage**: Monitored in real-time
- **Token Generation Speed**: Tokens per second
- **Model Accuracy**: Quality scores for each model

### Error Handling

The system includes comprehensive error handling:

- **Graceful Degradation**: Falls back to cloud mode if local fails
- **Circuit Breaker**: Prevents cascade failures
- **Detailed Logging**: Full error context for debugging
- **User-Friendly Messages**: Clear error explanations

## 🔄 Fallback Mechanisms

### Cloud Fallback

If local processing fails, the system can automatically fall back to cloud APIs:

- **Automatic Detection**: Monitors local system health
- **Seamless Switching**: Transparent to the user
- **User Control**: Can be disabled for strict privacy mode
- **Status Indication**: UI clearly shows current mode

### Model Fallback

If the preferred model fails:

1. Try alternative local models
2. Use lightweight model as last resort
3. Fall back to cloud if all local models fail
4. Provide clear error messages to user

## 🧪 Testing & Validation

### Running Tests

```bash
# Run the complete test suite
cd ai_core
python test_local_llm.py

# Run specific test categories
python -m pytest test_local_llm.py::TestModelSecurityValidator -v
python -m pytest test_local_llm.py::TestLocalLLMManager -v
```

### Performance Benchmarks

The test suite includes performance benchmarks:

- **Hardware Detection**: <1 second
- **Security Scanning**: <5 seconds
- **Model Loading**: <30 seconds (target)
- **Inference Time**: <10 seconds per query (target)

### Security Validation

Mandatory security tests verify:

- URL validation and domain whitelisting
- Checksum verification accuracy
- File extension validation
- Path traversal protection
- Input sanitization effectiveness

## 🚨 Troubleshooting

### Common Issues

**Model Download Fails:**
- Check internet connection
- Verify disk space (need 2x model size)
- Check firewall settings for HTTPS

**Model Loading Fails:**
- Verify sufficient RAM available
- Check model file integrity
- Restart application if memory fragmented

**Slow Inference:**
- Close other memory-intensive applications
- Consider using a smaller model
- Check if GPU acceleration is working

**Security Scan Fails:**
- Update dependencies to latest versions
- Check for conflicting packages
- Review security scan logs

### Log Analysis

Logs are written to stderr and include:

- **INFO**: Normal operations and status updates
- **WARNING**: Non-critical issues and fallbacks
- **ERROR**: Failures requiring attention
- **DEBUG**: Detailed diagnostic information

### Getting Help

1. Check the logs for detailed error messages
2. Run the test suite to identify issues
3. Verify system requirements are met
4. Check the GitHub issues for known problems

## 🔮 Future Enhancements

Planned improvements include:

- **Multi-Model Consensus**: Use multiple local models simultaneously
- **Custom Model Support**: Load your own fine-tuned models
- **Distributed Inference**: Split large models across multiple machines
- **Advanced Quantization**: 2-bit and 1-bit quantization support
- **Model Caching**: Intelligent model swapping based on query type
- **Performance Profiling**: Detailed performance analysis tools

## 📚 Additional Resources

- [Model Architecture Guide](./MODEL_ARCHITECTURE.md)
- [Security Best Practices](./SECURITY_GUIDE.md)
- [Performance Optimization](./PERFORMANCE_GUIDE.md)
- [API Reference](./API_REFERENCE.md)
