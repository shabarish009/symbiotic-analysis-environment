// Symbiotic Analysis Environment - Main Frontend Entry Point
import { invoke } from '@tauri-apps/api/core';

/**
 * Application initialization and setup
 */
class SymbioticApp {
    constructor() {
        this.initialized = false;
        this.backendConnected = false;
    }

    /**
     * Initialize the application
     */
    async init() {
        if (this.initialized) return;

        console.log('Symbiotic Analysis Environment - Frontend Initializing...');

        try {
            await this.testBackendConnection();
            this.setupEventListeners();
            this.initialized = true;
            console.log('Application initialization complete');
        } catch (error) {
            console.error('Application initialization failed:', error);
            this.showError('Failed to initialize application');
        }
    }

    /**
     * Test connection to Tauri backend
     */
    async testBackendConnection() {
        try {
            const response = await invoke('greet', { name: 'Data Analyst' });
            console.log('Backend connection successful:', response);
            this.backendConnected = true;
            this.updateConnectionStatus(true);
        } catch (error) {
            console.error('Backend connection failed:', error);
            this.backendConnected = false;
            this.updateConnectionStatus(false);
            throw error;
        }
    }

    /**
     * Setup event listeners for UI interactions
     */
    setupEventListeners() {
        const container = document.querySelector('.container');
        if (container) {
            container.addEventListener('click', () => {
                console.log('Application is responsive and ready for development!');
                if (this.backendConnected) {
                    this.showMessage('Application is fully operational!');
                }
            });
        }
    }

    /**
     * Update connection status in UI
     */
    updateConnectionStatus(connected) {
        const statusElement = document.querySelector('.status');
        if (statusElement) {
            if (connected) {
                statusElement.innerHTML = '✅ Installation Complete - Backend Connected!';
                statusElement.style.background = '#e8f5e8';
                statusElement.style.borderColor = '#4caf50';
                statusElement.style.color = '#2e7d32';
            } else {
                statusElement.innerHTML = '⚠️ Frontend Ready - Backend Connection Failed';
                statusElement.style.background = '#fff3cd';
                statusElement.style.borderColor = '#ffc107';
                statusElement.style.color = '#856404';
            }
        }
    }

    /**
     * Show error message to user
     */
    showError(message) {
        console.error(message);
        // Could be enhanced with toast notifications or modal dialogs
    }

    /**
     * Show success message to user
     */
    showMessage(message) {
        console.log(message);
        // Could be enhanced with toast notifications
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const app = new SymbioticApp();
    await app.init();
});

// Export for potential testing or external access
window.SymbioticApp = SymbioticApp;
