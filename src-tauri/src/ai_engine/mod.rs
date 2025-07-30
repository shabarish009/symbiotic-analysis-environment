//! AI Engine Management Module
//! 
//! This module handles the lifecycle management of the Python AI Core process,
//! including spawning, monitoring, health checking, and communication via JSON-RPC.

pub mod manager;
pub mod communication;
pub mod types;
pub mod config;
pub mod health;

#[cfg(test)]
mod tests;

pub use manager::AIEngineManager;
pub use types::AIEngineStatus;
pub use config::AIEngineConfig;
