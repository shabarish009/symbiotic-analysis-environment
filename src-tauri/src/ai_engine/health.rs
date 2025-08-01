// In src-tauri/src/ai_engine/health.rs
use super::types::{HealthStats, JsonRpcMessage};
use super::communication::IPCChannel;
use std::collections::HashMap;

pub struct HealthMonitor<'a> {
    ipc_channel: &'a IPCChannel,
}

impl<'a> HealthMonitor<'a> {
    pub fn new(ipc_channel: &'a IPCChannel) -> Self {
        HealthMonitor { ipc_channel }
    }
    pub async fn check_health(&self) -> HealthStats {
        let ping_message = JsonRpcMessage {
            jsonrpc: "2.0".to_string(),
            method: "health.ping".to_string(),
            params: HashMap::new(),
            id: Some(rand::random()),
        };

        if self.ipc_channel.send(&ping_message).await.is_ok() {
            // In a real implementation, we would wait for a "pong" response.
            HealthStats {
                is_healthy: true,
                last_result: "OK".to_string(),
            }
        } else {
            HealthStats {
                is_healthy: false,
                last_result: "Failed to send ping".to_string(),
            }
        }
    }
}
