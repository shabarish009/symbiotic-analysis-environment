// In src-tauri/src/ai_engine/tests.rs
use super::manager::AIEngineManager;
use super::types::{AIEngineConfig, AIEngineStatus};
use std::time::Duration;
use tokio::time;

#[tokio::test]
async fn test_engine_manager_creation_and_status() {
    let config = AIEngineConfig::default();
    let manager = AIEngineManager::new(config);
    assert_eq!(manager.get_status().await, AIEngineStatus::Stopped);
}

#[tokio::test]
async fn test_start_stop_and_status_broadcast() {
    let config = AIEngineConfig {
        python_executable: if cfg!(windows) { "cmd" } else { "sh" }.to_string(),
        ai_core_script: if cfg!(windows) { "/C echo Ready" } else { "-c 'echo Ready'" }.to_string(),
        ..Default::default()
    };

    let mut manager = AIEngineManager::new(config);

    let mut status_receiver = manager.get_status_receiver();

    let listener = tokio::spawn(async move {
        let mut received = vec![];
        for _ in 0..3 {
            if let Ok(status) = time::timeout(Duration::from_secs(2), status_receiver.recv()).await {
                 received.push(status.unwrap());
            }
        }
        received
    });

    manager.start().await;
    time::sleep(Duration::from_millis(500)).await;
    assert!(matches!(manager.get_status().await, AIEngineStatus::Ready), "Engine should be ready after start");

    manager.stop().await;
    assert_eq!(manager.get_status().await, AIEngineStatus::Stopped, "Engine should be stopped");

    let received_statuses = listener.await.unwrap();
    assert!(received_statuses.contains(&AIEngineStatus::Starting), "Should have broadcasted Starting");
    assert!(received_statuses.contains(&AIEngineStatus::Ready), "Should have broadcasted Ready");
    assert!(received_statuses.contains(&AIEngineStatus::Stopped), "Should have broadcasted Stopped");
}
