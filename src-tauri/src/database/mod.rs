// Database connection management module
pub mod connection;
pub mod credentials;
pub mod drivers;
pub mod manager;
pub mod security;
pub mod types;

#[cfg(test)]
mod tests;

pub use connection::DatabaseConnection;
pub use credentials::CredentialManager;
pub use drivers::DatabaseDriver;
pub use manager::ConnectionManager;
pub use security::ThreatModel;
pub use types::{
    ConnectionConfig, ConnectionStatus, DatabaseType, ConnectionError,
    ConnectionResult, DatabaseCredentials, ConnectionPool
};
