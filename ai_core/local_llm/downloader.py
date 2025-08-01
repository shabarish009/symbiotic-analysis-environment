"""
Secure Model Downloader
Handles downloading and verification of local LLM models.
"""

import asyncio
import aiohttp
import logging
import time
from pathlib import Path
from typing import Optional, Callable, Dict, Any
from dataclasses import dataclass

from .models import ModelConfig, ModelStatus
from .security import ModelSecurityValidator

logger = logging.getLogger(__name__)


@dataclass
class DownloadProgress:
    """Progress information for model downloads"""
    model_name: str
    total_size_mb: float
    downloaded_mb: float
    progress_percent: float
    download_speed_mbps: float
    eta_seconds: float
    status: str
    error_message: Optional[str] = None
    
    @property
    def is_complete(self) -> bool:
        return self.progress_percent >= 100.0
    
    @property
    def is_error(self) -> bool:
        return self.error_message is not None


class ModelDownloader:
    """Secure model downloader with progress tracking"""
    
    def __init__(self, models_dir: Path):
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self.security_validator = ModelSecurityValidator()
        self.active_downloads: Dict[str, DownloadProgress] = {}
        
        # Download configuration
        self.chunk_size = 8192  # 8KB chunks
        self.timeout_seconds = 300  # 5 minutes
        self.max_retries = 3
        
    async def download_model(self, config: ModelConfig, 
                           progress_callback: Optional[Callable[[DownloadProgress], None]] = None) -> bool:
        """Download and verify a model"""
        try:
            logger.info(f"🔽 Starting download of {config.display_name}")
            
            # Validate download URL
            if not self.security_validator.validate_download_url(config.download_url):
                raise ValueError(f"Invalid download URL: {config.download_url}")
            
            # Initialize progress tracking
            progress = DownloadProgress(
                model_name=config.name,
                total_size_mb=config.file_size_mb,
                downloaded_mb=0.0,
                progress_percent=0.0,
                download_speed_mbps=0.0,
                eta_seconds=0.0,
                status="starting"
            )
            
            self.active_downloads[config.name] = progress
            
            # Create secure temporary file
            temp_file = self.security_validator.create_secure_temp_file(
                suffix=f"_{config.filename}"
            )
            
            try:
                # Download with enhanced retry logic
                success = False
                last_error = None

                for attempt in range(self.max_retries):
                    try:
                        # Clean up partial download before retry
                        if attempt > 0 and temp_file.exists():
                            temp_file.unlink()
                            temp_file = self.security_validator.create_secure_temp_file(
                                suffix=f"_{config.filename}"
                            )

                        # Reset progress for retry
                        if attempt > 0:
                            progress.downloaded_mb = 0.0
                            progress.progress_percent = 0.0
                            progress.status = f"retrying (attempt {attempt + 1})"
                            if progress_callback:
                                progress_callback(progress)

                        success = await self._download_with_progress(
                            config, temp_file, progress, progress_callback
                        )

                        if success:
                            break

                    except aiohttp.ClientError as e:
                        last_error = e
                        logger.warning(f"Network error on attempt {attempt + 1}: {e}")
                    except asyncio.TimeoutError as e:
                        last_error = e
                        logger.warning(f"Timeout on attempt {attempt + 1}: {e}")
                    except Exception as e:
                        last_error = e
                        logger.warning(f"Download attempt {attempt + 1} failed: {e}")

                        # For certain errors, don't retry
                        if isinstance(e, (ValueError, PermissionError)):
                            logger.error(f"Non-retryable error: {e}")
                            raise

                    if attempt < self.max_retries - 1:
                        # Exponential backoff with jitter
                        import random
                        delay = (2 ** attempt) + random.uniform(0, 1)
                        logger.info(f"Waiting {delay:.1f}s before retry...")
                        await asyncio.sleep(delay)

                if not success:
                    error_msg = f"Download failed after {self.max_retries} attempts"
                    if last_error:
                        error_msg += f": {last_error}"
                    raise RuntimeError(error_msg)
                
                if not success:
                    raise RuntimeError("Download failed after all retries")
                
                # Verify downloaded file
                logger.info(f"🔍 Verifying {config.display_name}...")
                progress.status = "verifying"
                if progress_callback:
                    progress_callback(progress)
                
                validation_result = self.security_validator.validate_model_file(
                    temp_file, config.checksum_sha256
                )
                
                if not validation_result['valid']:
                    error_msg = f"Validation failed: {', '.join(validation_result['errors'])}"
                    progress.error_message = error_msg
                    progress.status = "error"
                    if progress_callback:
                        progress_callback(progress)
                    raise ValueError(error_msg)
                
                # Move to final location
                final_path = self.models_dir / config.filename
                temp_file.rename(final_path)
                
                # Set secure permissions
                self.security_validator.set_secure_file_permissions(final_path)
                
                # Update progress
                progress.status = "completed"
                progress.progress_percent = 100.0
                if progress_callback:
                    progress_callback(progress)
                
                logger.info(f"✅ Successfully downloaded {config.display_name}")
                return True
                
            finally:
                # Cleanup temporary file if it still exists
                if temp_file.exists():
                    try:
                        temp_file.unlink()
                    except Exception as e:
                        logger.warning(f"Failed to cleanup temp file: {e}")
                
                # Remove from active downloads
                self.active_downloads.pop(config.name, None)
                
        except Exception as e:
            logger.error(f"❌ Failed to download {config.display_name}: {e}")
            
            # Update progress with error
            if config.name in self.active_downloads:
                progress = self.active_downloads[config.name]
                progress.error_message = str(e)
                progress.status = "error"
                if progress_callback:
                    progress_callback(progress)
            
            return False
    
    async def _download_with_progress(self, config: ModelConfig, temp_file: Path,
                                    progress: DownloadProgress,
                                    progress_callback: Optional[Callable[[DownloadProgress], None]]) -> bool:
        """Download file with progress tracking"""
        start_time = time.time()
        last_update_time = start_time
        
        timeout = aiohttp.ClientTimeout(total=self.timeout_seconds)
        
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(config.download_url) as response:
                if response.status != 200:
                    raise RuntimeError(f"HTTP {response.status}: {response.reason}")
                
                # Get actual file size from headers
                content_length = response.headers.get('content-length')
                if content_length:
                    actual_size_mb = int(content_length) / (1024 * 1024)
                    progress.total_size_mb = actual_size_mb
                
                progress.status = "downloading"
                
                with open(temp_file, 'wb') as f:
                    downloaded_bytes = 0
                    
                    async for chunk in response.content.iter_chunked(self.chunk_size):
                        f.write(chunk)
                        downloaded_bytes += len(chunk)
                        
                        # Update progress
                        current_time = time.time()
                        progress.downloaded_mb = downloaded_bytes / (1024 * 1024)
                        
                        if progress.total_size_mb > 0:
                            progress.progress_percent = (progress.downloaded_mb / progress.total_size_mb) * 100
                        
                        # Calculate speed and ETA
                        elapsed_time = current_time - start_time
                        if elapsed_time > 0:
                            progress.download_speed_mbps = progress.downloaded_mb / elapsed_time
                            
                            if progress.download_speed_mbps > 0:
                                remaining_mb = progress.total_size_mb - progress.downloaded_mb
                                progress.eta_seconds = remaining_mb / progress.download_speed_mbps
                        
                        # Call progress callback (throttled to avoid spam)
                        if progress_callback and (current_time - last_update_time) > 0.5:
                            progress_callback(progress)
                            last_update_time = current_time
                
                return True
    
    def get_download_progress(self, model_name: str) -> Optional[DownloadProgress]:
        """Get current download progress for a model"""
        return self.active_downloads.get(model_name)
    
    def is_model_downloaded(self, config: ModelConfig) -> bool:
        """Check if model is already downloaded"""
        model_path = self.models_dir / config.filename
        
        if not model_path.exists():
            return False
        
        # Verify checksum of existing file
        try:
            return self.security_validator.verify_checksum(
                model_path, config.checksum_sha256
            )
        except Exception as e:
            logger.warning(f"Error verifying existing model {config.name}: {e}")
            return False
    
    def get_model_path(self, config: ModelConfig) -> Optional[Path]:
        """Get path to downloaded model file"""
        model_path = self.models_dir / config.filename
        
        if self.is_model_downloaded(config):
            return model_path
        
        return None
    
    def delete_model(self, config: ModelConfig) -> bool:
        """Delete a downloaded model"""
        try:
            model_path = self.models_dir / config.filename
            
            if model_path.exists():
                model_path.unlink()
                logger.info(f"🗑️ Deleted model {config.display_name}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error deleting model {config.name}: {e}")
            return False
    
    def get_models_directory_size(self) -> float:
        """Get total size of models directory in MB"""
        try:
            total_size = 0
            for file_path in self.models_dir.rglob('*'):
                if file_path.is_file():
                    total_size += file_path.stat().st_size
            
            return total_size / (1024 * 1024)  # Convert to MB
            
        except Exception as e:
            logger.error(f"Error calculating models directory size: {e}")
            return 0.0
    
    def cleanup_corrupted_downloads(self) -> int:
        """Clean up any corrupted or incomplete downloads"""
        cleaned_count = 0
        
        try:
            # Look for temporary files that might be left over
            for temp_file in self.models_dir.glob('tmp*'):
                try:
                    temp_file.unlink()
                    cleaned_count += 1
                    logger.info(f"Cleaned up temporary file: {temp_file}")
                except Exception as e:
                    logger.warning(f"Failed to cleanup {temp_file}: {e}")
            
            return cleaned_count
            
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
            return cleaned_count
