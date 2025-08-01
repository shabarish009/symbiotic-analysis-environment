// In src-tauri/src/ai_engine/mod.rs
pub mod communication;
pub mod config;
pub mod health;
pub mod manager;
pub mod task_manager;
pub mod types;

// This line is crucial for enabling the test module
#[cfg(test)]
mod tests;

pub use manager::AIEngineManager;
pub use types::{
    AIEngineStatus, AIEngineConfig, SQLGenerationRequest, SQLGenerationOptions,
    SQLGenerationResponse, SQLGenerationProgress, CancellationRequest
};
