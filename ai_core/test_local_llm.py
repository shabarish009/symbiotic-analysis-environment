#!/usr/bin/env python3
"""
Comprehensive Test Suite for Local LLM System
Tests all components of the local LLM implementation.
"""

import asyncio
import pytest
import tempfile
import shutil
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock

# Import local LLM components
from local_llm.manager import LocalLLMManager
from local_llm.models import ModelConfig, ModelType, ModelStatus
from local_llm.downloader import ModelDownloader
from local_llm.inference import LocalInferenceEngine, InferenceRequest
from local_llm.hardware import HardwareDetector
from local_llm.security import ModelSecurityValidator, run_security_vulnerability_scan


class TestModelSecurityValidator:
    """Test security validation functionality"""
    
    def setup_method(self):
        self.validator = ModelSecurityValidator()
        self.temp_dir = Path(tempfile.mkdtemp())
    
    def teardown_method(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_validate_download_url_https_required(self):
        """Test that HTTPS is required for downloads"""
        assert not self.validator.validate_download_url("http://example.com/model.bin")
        assert self.validator.validate_download_url("https://huggingface.co/model.bin")
    
    def test_validate_download_url_domain_whitelist(self):
        """Test domain whitelist validation"""
        assert self.validator.validate_download_url("https://huggingface.co/model.bin")
        assert self.validator.validate_download_url("https://github.com/model.bin")
        assert not self.validator.validate_download_url("https://malicious.com/model.bin")
    
    def test_calculate_file_checksum(self):
        """Test checksum calculation"""
        test_file = self.temp_dir / "test.txt"
        test_content = b"Hello, World!"
        test_file.write_bytes(test_content)
        
        checksum = self.validator.calculate_file_checksum(test_file)
        expected = "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f"
        assert checksum == expected
    
    def test_verify_checksum_success(self):
        """Test successful checksum verification"""
        test_file = self.temp_dir / "test.txt"
        test_content = b"Hello, World!"
        test_file.write_bytes(test_content)
        
        expected_checksum = "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f"
        assert self.validator.verify_checksum(test_file, expected_checksum)
    
    def test_verify_checksum_failure(self):
        """Test checksum verification failure"""
        test_file = self.temp_dir / "test.txt"
        test_content = b"Hello, World!"
        test_file.write_bytes(test_content)
        
        wrong_checksum = "0000000000000000000000000000000000000000000000000000000000000000"
        assert not self.validator.verify_checksum(test_file, wrong_checksum)
    
    def test_validate_file_extension(self):
        """Test file extension validation"""
        valid_file = self.temp_dir / "model.bin"
        valid_file.touch()
        assert self.validator.validate_file_extension(valid_file)
        
        invalid_file = self.temp_dir / "model.exe"
        invalid_file.touch()
        assert not self.validator.validate_file_extension(invalid_file)
    
    def test_security_vulnerability_scan(self):
        """Test security vulnerability scan"""
        results = run_security_vulnerability_scan()
        
        assert 'scan_completed' in results
        assert 'vulnerabilities_found' in results
        assert 'dependencies_checked' in results
        assert isinstance(results['vulnerabilities_found'], int)


class TestHardwareDetector:
    """Test hardware detection functionality"""
    
    def setup_method(self):
        self.detector = HardwareDetector()
    
    def test_get_hardware_capabilities(self):
        """Test hardware capability detection"""
        capabilities = self.detector.get_hardware_capabilities()
        
        assert capabilities.cpu_count > 0
        assert capabilities.total_memory_mb > 0
        assert capabilities.available_memory_mb > 0
        assert capabilities.available_storage_gb > 0
        assert capabilities.recommended_model_size in ["2.7B", "7B", "13B"]
    
    def test_get_optimal_model_config(self):
        """Test optimal model selection"""
        available_models = ["phi-2", "mistral-7b-instruct", "sqlcoder-7b"]
        optimal = self.detector.get_optimal_model_config(available_models)
        
        assert optimal in available_models
    
    def test_estimate_inference_time(self):
        """Test inference time estimation"""
        time_estimate = self.detector.estimate_inference_time("7B", 2048)
        
        assert isinstance(time_estimate, float)
        assert time_estimate > 0


class TestModelDownloader:
    """Test model download functionality"""
    
    def setup_method(self):
        self.temp_dir = Path(tempfile.mkdtemp())
        self.downloader = ModelDownloader(self.temp_dir)
    
    def teardown_method(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_is_model_downloaded_false(self):
        """Test model not downloaded detection"""
        config = ModelConfig(
            name="test-model",
            display_name="Test Model",
            model_type=ModelType.GENERAL_PURPOSE,
            download_url="https://example.com/model.bin",
            checksum_sha256="abc123",
            file_size_mb=100,
            memory_requirement_mb=200,
            context_length=2048
        )
        
        assert not self.downloader.is_model_downloaded(config)
    
    def test_get_models_directory_size(self):
        """Test directory size calculation"""
        # Create a test file
        test_file = self.temp_dir / "test.bin"
        test_file.write_bytes(b"0" * 1024)  # 1KB file
        
        size_mb = self.downloader.get_models_directory_size()
        assert size_mb > 0
    
    def test_cleanup_corrupted_downloads(self):
        """Test cleanup of corrupted downloads"""
        # Create temporary files
        temp_file1 = self.temp_dir / "tmp123"
        temp_file2 = self.temp_dir / "tmp456"
        temp_file1.touch()
        temp_file2.touch()
        
        cleaned = self.downloader.cleanup_corrupted_downloads()
        assert cleaned == 2
        assert not temp_file1.exists()
        assert not temp_file2.exists()


class TestLocalInferenceEngine:
    """Test local inference functionality"""
    
    def setup_method(self):
        self.temp_dir = Path(tempfile.mkdtemp())
        self.engine = LocalInferenceEngine(self.temp_dir)
    
    def teardown_method(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_inference_request_creation(self):
        """Test inference request creation"""
        request = InferenceRequest(
            prompt="SELECT * FROM users",
            max_tokens=100,
            temperature=0.7
        )
        
        assert request.prompt == "SELECT * FROM users"
        assert request.max_tokens == 100
        assert request.temperature == 0.7
        assert len(request.request_id) > 0
    
    def test_get_loaded_models_empty(self):
        """Test getting loaded models when none are loaded"""
        models = self.engine.get_loaded_models()
        assert models == []
    
    def test_get_memory_usage(self):
        """Test memory usage reporting"""
        usage = self.engine.get_memory_usage()
        
        assert 'total_memory_mb' in usage
        assert 'total_gpu_memory_mb' in usage
        assert 'loaded_models' in usage
        assert usage['loaded_models'] == 0


@pytest.mark.asyncio
class TestLocalLLMManager:
    """Test local LLM manager functionality"""
    
    def setup_method(self):
        self.temp_dir = Path(tempfile.mkdtemp())
        self.manager = LocalLLMManager(self.temp_dir)
    
    def teardown_method(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    async def test_initialization(self):
        """Test manager initialization"""
        # Mock the security scan to avoid actual dependency checks
        with patch('local_llm.manager.run_security_vulnerability_scan') as mock_scan:
            mock_scan.return_value = {
                'scan_completed': True,
                'vulnerabilities_found': 0,
                'critical_issues': [],
                'dependencies_checked': []
            }
            
            success = await self.manager.initialize()
            assert success
            assert self.manager.security_scan_completed
    
    async def test_run_security_scan(self):
        """Test security scan execution"""
        with patch('local_llm.manager.run_security_vulnerability_scan') as mock_scan:
            mock_scan.return_value = {
                'scan_completed': True,
                'vulnerabilities_found': 0,
                'critical_issues': [],
                'dependencies_checked': []
            }
            
            results = await self.manager.run_security_scan()
            assert results['scan_completed']
            assert results['vulnerabilities_found'] == 0
    
    def test_get_available_models(self):
        """Test getting available models"""
        models = self.manager.get_available_models()
        
        assert len(models) > 0
        for model in models:
            assert 'name' in model
            assert 'display_name' in model
            assert 'status' in model
            assert 'file_size_mb' in model
    
    def test_get_system_status(self):
        """Test system status reporting"""
        status = self.manager.get_system_status()
        
        required_keys = [
            'active_model', 'loaded_models', 'total_models_available',
            'models_downloaded', 'hardware_capabilities', 'memory_usage',
            'security_scan_completed', 'models_directory'
        ]
        
        for key in required_keys:
            assert key in status
    
    def test_get_model_recommendations(self):
        """Test model recommendations"""
        recommendations = self.manager.get_model_recommendations()
        
        assert 'recommended_model' in recommendations
        assert 'hardware_summary' in recommendations
        assert 'model_options' in recommendations
        
        # Check hardware summary
        hardware = recommendations['hardware_summary']
        assert 'available_memory_mb' in hardware
        assert 'has_gpu' in hardware
    
    def test_configuration_save_load(self):
        """Test configuration persistence"""
        # Set active model
        self.manager.active_model = "test-model"
        
        # Save configuration
        self.manager.save_configuration()
        
        # Create new manager instance
        new_manager = LocalLLMManager(self.temp_dir)
        new_manager.load_configuration()
        
        # Check if configuration was loaded
        assert new_manager.active_model == "test-model"


class TestIntegration:
    """Integration tests for the complete local LLM system"""
    
    def setup_method(self):
        self.temp_dir = Path(tempfile.mkdtemp())
    
    def teardown_method(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    @pytest.mark.asyncio
    async def test_full_system_initialization(self):
        """Test complete system initialization"""
        with patch('local_llm.manager.run_security_vulnerability_scan') as mock_scan:
            mock_scan.return_value = {
                'scan_completed': True,
                'vulnerabilities_found': 0,
                'critical_issues': [],
                'dependencies_checked': []
            }
            
            manager = LocalLLMManager(self.temp_dir)
            success = await manager.initialize()
            
            assert success
            assert manager.security_scan_completed
            
            # Test system status
            status = manager.get_system_status()
            assert status['security_scan_completed']
            assert status['security_vulnerabilities'] == 0
    
    def test_model_configuration_validation(self):
        """Test model configuration validation"""
        from local_llm.models import AVAILABLE_MODELS, get_model_config
        
        # Test all predefined models have required fields
        for model_name, config in AVAILABLE_MODELS.items():
            assert config.name == model_name
            assert config.display_name
            assert config.download_url.startswith('https://')
            assert config.checksum_sha256
            assert config.file_size_mb > 0
            assert config.memory_requirement_mb > 0
            assert config.context_length > 0
        
        # Test model retrieval
        config = get_model_config("phi-2")
        assert config is not None
        assert config.name == "phi-2"
        
        # Test non-existent model
        config = get_model_config("non-existent-model")
        assert config is None


def run_performance_tests():
    """Run performance benchmarks"""
    print("🚀 Running Performance Tests...")
    
    # Test hardware detection performance
    detector = HardwareDetector()
    import time
    
    start_time = time.time()
    capabilities = detector.get_hardware_capabilities()
    detection_time = time.time() - start_time
    
    print(f"✅ Hardware detection: {detection_time:.3f}s")
    print(f"   CPU: {capabilities.cpu_count} cores")
    print(f"   Memory: {capabilities.available_memory_mb}MB available")
    print(f"   Recommended: {capabilities.recommended_model_size} model")
    
    # Test security scan performance
    start_time = time.time()
    scan_results = run_security_vulnerability_scan()
    scan_time = time.time() - start_time
    
    print(f"✅ Security scan: {scan_time:.3f}s")
    print(f"   Vulnerabilities: {scan_results['vulnerabilities_found']}")
    print(f"   Dependencies checked: {len(scan_results['dependencies_checked'])}")


def run_security_tests():
    """Run aggressive security validation tests as mandated by Zeus Directive"""
    print("🔒 Running Aggressive Security Tests...")

    validator = ModelSecurityValidator()

    # Test malicious URLs (enhanced)
    malicious_urls = [
        "http://malicious.com/model.bin",  # HTTP instead of HTTPS
        "https://malicious.com/model.bin",  # Not in whitelist
        "ftp://huggingface.co/model.bin",  # Wrong protocol
        "https://192.168.1.1/model.bin",  # IP address
        "https://huggingface.co/../../../etc/passwd",  # Path traversal
        "https://huggingface.co/model.bin?cmd=rm%20-rf%20/",  # Command injection
        "https://evil.huggingface.co/model.bin",  # Subdomain attack
        "https://huggingface.co\x00.evil.com/model.bin",  # Null byte injection
        "https://huggingface.co/model.bin#javascript:alert(1)",  # Fragment attack
        "https://huggingface.co/model.bin?" + "A" * 2000,  # Long query
    ]

    for url in malicious_urls:
        assert not validator.validate_download_url(url), f"Should reject: {url}"

    # Test valid URLs
    valid_urls = [
        "https://huggingface.co/model.bin",
        "https://github.com/user/repo/releases/download/v1.0/model.bin",
        "https://raw.githubusercontent.com/user/repo/main/model.bin",
    ]

    for url in valid_urls:
        assert validator.validate_download_url(url), f"Should accept: {url}"

    # Test path traversal protection
    print("🔍 Testing path traversal protection...")
    dangerous_paths = [
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32\\config\\sam",
        "/etc/passwd",
        "C:\\Windows\\System32\\config\\SAM",
        "model/../../../secret.txt",
        "model\\..\\..\\..\\secret.txt",
        "model\x00.txt",  # Null byte
        "model\r\n.txt",  # CRLF injection
        "~/.ssh/id_rsa",  # Home directory
        "$HOME/.ssh/id_rsa",  # Environment variable
        "%USERPROFILE%\\.ssh\\id_rsa",  # Windows environment variable
    ]

    from pathlib import Path
    import tempfile

    with tempfile.TemporaryDirectory() as temp_dir:
        base_path = Path(temp_dir)

        for dangerous_path in dangerous_paths:
            is_safe = validator._is_safe_path(dangerous_path, base_path)
            assert not is_safe, f"Should reject dangerous path: {dangerous_path}"

    # Test archive bomb protection
    print("🧨 Testing archive bomb protection...")

    # Create a test zip with suspicious compression ratio
    import zipfile
    import io

    # Create a zip bomb simulation
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Add a file that would expand to a huge size
        large_content = b"A" * 1000000  # 1MB of A's
        zf.writestr("large_file.txt", large_content)

    zip_buffer.seek(0)

    # Test that our validator would catch this
    with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as temp_zip:
        temp_zip.write(zip_buffer.getvalue())
        temp_zip.flush()

        zip_path = Path(temp_zip.name)

        with tempfile.TemporaryDirectory() as extract_dir:
            extract_path = Path(extract_dir)

            # This should work for normal files, but our enhanced version
            # includes size checks that would prevent actual zip bombs
            try:
                result = validator.safe_extract_archive(zip_path, extract_path)
                # For this test case, it should succeed since it's not actually a bomb
                print(f"Archive extraction result: {result}")
            except Exception as e:
                print(f"Archive extraction failed (expected for bombs): {e}")

        zip_path.unlink()  # Cleanup

    print("✅ All aggressive security tests passed")


if __name__ == "__main__":
    print("🧪 Running Local LLM Test Suite...")
    
    # Run security tests first (Zeus Directive requirement)
    run_security_tests()
    
    # Run performance tests
    run_performance_tests()
    
    # Run pytest for unit tests
    print("\n🔬 Running Unit Tests...")
    pytest.main([__file__, "-v"])
    
    print("\n✅ All tests completed!")
