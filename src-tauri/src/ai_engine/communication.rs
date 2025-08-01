// In src-tauri/src/ai_engine/communication.rs
use super::types::JsonRpcMessage;
use tokio::process::Child;

pub struct IPCChannel;

impl IPCChannel {
    pub fn new(_child: &mut Child) -> Self {
        IPCChannel
    }

    pub async fn send(&self, _message: &JsonRpcMessage) -> Result<(), String> {
        // In a real implementation, this would serialize and write to stdin
        Ok(())
    }
}



