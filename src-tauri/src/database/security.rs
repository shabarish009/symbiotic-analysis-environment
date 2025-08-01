use crate::database::types::{ConnectionError, ConnectionResult, DatabaseCredentials};
use keyring::{Entry, Error as KeyringError};
use ring::digest;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use uuid::Uuid;
use base64;

/// Comprehensive Threat Model for credential handling
/// This implements protection against various attack vectors
#[derive(Debug)]
pub struct ThreatModel {
    /// Track access attempts for rate limiting
    access_attempts: Arc<Mutex<HashMap<String, Vec<Instant>>>>,
    /// Maximum attempts per time window
    max_attempts: usize,
    /// Time window for rate limiting (seconds)
    time_window: Duration,
    /// Track suspicious activities
    suspicious_activities: Arc<Mutex<Vec<SecurityEvent>>>,
}

#[derive(Debug, Clone)]
pub struct SecurityEvent {
    pub event_type: SecurityEventType,
    pub timestamp: Instant,
    pub details: String,
    pub source: String,
}

#[derive(Debug, Clone)]
pub enum SecurityEventType {
    UnauthorizedAccess,
    RateLimitExceeded,
    SuspiciousPattern,
    CredentialAccess,
    MemoryScrapingAttempt,
    InvalidRequest,
}

impl ThreatModel {
    pub fn new() -> Self {
        Self {
            access_attempts: Arc::new(Mutex::new(HashMap::new())),
            max_attempts: 5, // Maximum 5 attempts per time window
            time_window: Duration::from_secs(300), // 5 minute window
            suspicious_activities: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// Validate access request and apply enhanced rate limiting
    pub fn validate_access(&self, requester: &str) -> ConnectionResult<()> {
        // Enhanced validation: check for suspicious requester patterns
        if requester.is_empty() || requester.len() > 256 {
            self.log_security_event(SecurityEventType::InvalidRequest,
                "Invalid requester identifier".to_string(), requester.to_string());
            return Err(ConnectionError::SecurityViolation("Invalid requester".to_string()));
        }

        let mut attempts = self.access_attempts.lock()
            .map_err(|e| ConnectionError::SecurityViolation(format!("Lock error: {}", e)))?;

        let now = Instant::now();
        // Use a hash of the requester to prevent enumeration attacks
        let key = format!("{:x}", ring::digest::digest(&ring::digest::SHA256, requester.as_bytes()));

        // Clean old attempts outside time window
        if let Some(request_attempts) = attempts.get_mut(&key) {
            request_attempts.retain(|&attempt_time| now.duration_since(attempt_time) < self.time_window);
        }

        // Check rate limit with progressive penalties
        let current_attempts = attempts.get(&key).map(|v| v.len()).unwrap_or(0);
        let effective_limit = if current_attempts > self.max_attempts / 2 {
            // Reduce limit for suspicious activity
            self.max_attempts / 2
        } else {
            self.max_attempts
        };

        if current_attempts >= effective_limit {
            self.log_security_event(SecurityEventType::RateLimitExceeded,
                format!("Rate limit exceeded for requester (attempts: {})", current_attempts),
                requester.to_string());
            return Err(ConnectionError::SecurityViolation("Rate limit exceeded".to_string()));
        }

        // Record this attempt
        attempts.entry(key).or_insert_with(Vec::new).push(now);

        Ok(())
    }

    /// Log security events for monitoring
    pub fn log_security_event(&self, event_type: SecurityEventType, details: String, source: String) {
        if let Ok(mut events) = self.suspicious_activities.lock() {
            events.push(SecurityEvent {
                event_type,
                timestamp: Instant::now(),
                details,
                source,
            });

            // Keep only recent events (last 1000)
            if events.len() > 1000 {
                events.drain(0..100);
            }
        }
    }

    /// Check for memory scraping patterns with advanced heuristics
    pub fn detect_memory_scraping(&self, access_pattern: &str, access_frequency: Option<f64>) -> bool {
        // Check for suspicious keywords (case-insensitive)
        let suspicious_keywords = ["rapid", "bulk", "dump", "extract", "scrape", "harvest", "batch"];
        let pattern_lower = access_pattern.to_lowercase();
        let has_suspicious_keywords = suspicious_keywords.iter().any(|&keyword| pattern_lower.contains(keyword));

        // Check for high-frequency access patterns
        let high_frequency_access = access_frequency.map_or(false, |freq| freq > 10.0); // More than 10 requests per second

        // Check for unusual access patterns (repeated identical requests)
        let repeated_pattern = access_pattern.len() > 10 &&
            access_pattern.chars().collect::<std::collections::HashSet<_>>().len() < 5;

        has_suspicious_keywords || high_frequency_access || repeated_pattern
    }

    /// Get security audit log
    pub fn get_security_audit(&self) -> Vec<SecurityEvent> {
        self.suspicious_activities.lock()
            .map(|events| events.clone())
            .unwrap_or_default()
    }
}

impl Default for ThreatModel {
    fn default() -> Self {
        Self::new()
    }
}

/// Secure credential manager using native OS keychain
#[derive(Debug)]
pub struct SecureCredentialManager {
    threat_model: ThreatModel,
    service_prefix: String,
}

impl SecureCredentialManager {
    pub fn new() -> Self {
        Self {
            threat_model: ThreatModel::new(),
            service_prefix: "symbiotic-analysis-db".to_string(),
        }
    }

    /// Store credentials securely in OS keychain with validation
    pub fn store_credentials(&self, connection_id: Uuid, credentials: &DatabaseCredentials) -> ConnectionResult<()> {
        // Validate access
        self.threat_model.validate_access("store_credentials")?;

        // Validate credential security
        self.validate_credential_security(&credentials.password)?;

        let service = format!("{}-{}", self.service_prefix, connection_id);
        let account = "password";

        // Create keyring entry
        let entry = Entry::new(&service, account)
            .map_err(|e| ConnectionError::CredentialError(format!("Failed to create keyring entry: {}", e)))?;

        // Store password securely
        entry.set_password(&credentials.password)
            .map_err(|e| ConnectionError::CredentialError(format!("Failed to store password: {}", e)))?;

        // Log successful credential storage (without sensitive data)
        self.threat_model.log_security_event(
            SecurityEventType::CredentialAccess,
            format!("Credentials stored for connection: {}", connection_id),
            "credential_manager".to_string(),
        );

        Ok(())
    }

    /// Validate credential security requirements
    fn validate_credential_security(&self, password: &str) -> ConnectionResult<()> {
        // Check minimum length
        if password.len() < 8 {
            return Err(ConnectionError::SecurityViolation(
                "Password must be at least 8 characters long".to_string()
            ));
        }

        // Check maximum length to prevent DoS attacks
        if password.len() > 1024 {
            return Err(ConnectionError::SecurityViolation(
                "Password exceeds maximum allowed length".to_string()
            ));
        }

        // Check for null bytes or control characters that could cause issues
        if password.contains('\0') || password.chars().any(|c| c.is_control() && c != '\t' && c != '\n' && c != '\r') {
            return Err(ConnectionError::SecurityViolation(
                "Password contains invalid characters".to_string()
            ));
        }

        // Warn about weak passwords (but don't block them - user choice)
        if password.len() < 12 || !password.chars().any(|c| c.is_ascii_digit()) {
            self.threat_model.log_security_event(
                SecurityEventType::SuspiciousPattern,
                "Weak password detected".to_string(),
                "credential_validator".to_string(),
            );
        }

        Ok(())
    }

    /// Retrieve credentials securely from OS keychain
    pub fn retrieve_credentials(&self, connection_id: Uuid) -> ConnectionResult<DatabaseCredentials> {
        // Validate access
        self.threat_model.validate_access("retrieve_credentials")?;

        let service = format!("{}-{}", self.service_prefix, connection_id);
        let account = "password";

        // Create keyring entry
        let entry = Entry::new(&service, account)
            .map_err(|e| ConnectionError::CredentialError(format!("Failed to create keyring entry: {}", e)))?;

        // Retrieve password
        let password = entry.get_password()
            .map_err(|e| match e {
                KeyringError::NoEntry => ConnectionError::CredentialError("Credentials not found".to_string()),
                _ => ConnectionError::CredentialError(format!("Failed to retrieve password: {}", e)),
            })?;

        // Log credential access
        self.threat_model.log_security_event(
            SecurityEventType::CredentialAccess,
            format!("Credentials retrieved for connection: {}", connection_id),
            "credential_manager".to_string(),
        );

        Ok(DatabaseCredentials::new(connection_id, password))
    }

    /// Delete credentials from OS keychain
    pub fn delete_credentials(&self, connection_id: Uuid) -> ConnectionResult<()> {
        // Validate access
        self.threat_model.validate_access("delete_credentials")?;

        let service = format!("{}-{}", self.service_prefix, connection_id);
        let account = "password";

        // Create keyring entry
        let entry = Entry::new(&service, account)
            .map_err(|e| ConnectionError::CredentialError(format!("Failed to create keyring entry: {}", e)))?;

        // Delete password
        entry.delete_password()
            .map_err(|e| match e {
                KeyringError::NoEntry => Ok(()), // Already deleted, that's fine
                _ => Err(ConnectionError::CredentialError(format!("Failed to delete password: {}", e))),
            })?;

        // Log credential deletion
        self.threat_model.log_security_event(
            SecurityEventType::CredentialAccess,
            format!("Credentials deleted for connection: {}", connection_id),
            "credential_manager".to_string(),
        );

        Ok(())
    }

    /// Check if credentials exist for a connection
    pub fn credentials_exist(&self, connection_id: Uuid) -> bool {
        let service = format!("{}-{}", self.service_prefix, connection_id);
        let account = "password";

        if let Ok(entry) = Entry::new(&service, account) {
            entry.get_password().is_ok()
        } else {
            false
        }
    }

    /// Generate secure hash for connection validation
    pub fn generate_connection_hash(&self, connection_data: &str) -> String {
        let digest = digest::digest(&digest::SHA256, connection_data.as_bytes());
        base64::encode(digest.as_ref())
    }

    /// Get threat model for security monitoring
    pub fn get_threat_model(&self) -> &ThreatModel {
        &self.threat_model
    }

    /// Perform security audit
    pub fn security_audit(&self) -> Vec<SecurityEvent> {
        self.threat_model.get_security_audit()
    }
}

impl Default for SecureCredentialManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_threat_model_rate_limiting() {
        let threat_model = ThreatModel::new();
        let requester = "test_requester";

        // First few attempts should succeed
        for _ in 0..5 {
            assert!(threat_model.validate_access(requester).is_ok());
        }

        // Next attempt should fail due to rate limiting
        assert!(threat_model.validate_access(requester).is_err());
    }

    #[test]
    fn test_memory_scraping_detection() {
        let threat_model = ThreatModel::new();

        // Test suspicious keywords
        assert!(threat_model.detect_memory_scraping("rapid access pattern", None));
        assert!(threat_model.detect_memory_scraping("bulk data access", None));
        assert!(threat_model.detect_memory_scraping("DUMP credentials", None));

        // Test high frequency access
        assert!(threat_model.detect_memory_scraping("normal request", Some(15.0)));

        // Test repeated patterns
        assert!(threat_model.detect_memory_scraping("aaaaaaaaaaaaa", None));

        // Test normal access
        assert!(!threat_model.detect_memory_scraping("normal access", Some(1.0)));
        assert!(!threat_model.detect_memory_scraping("legitimate request", None));
    }
}
