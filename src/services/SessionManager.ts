/**
 * SessionManager Service
 * Handles window layout persistence and session management
 */

import { WindowState, DesktopIcon } from '../components/Shell/types';
import {
  validateSessionData as validateSessionDataUtil,
  sanitizeSessionData,
  isSessionCorrupted,
  generateSessionChecksumSync as generateSessionChecksum
} from '../utils/sessionValidation';

export interface SessionData {
  version: string;
  timestamp: number;
  windows: {
    [windowId: string]: {
      id: string;
      title: string;
      position: { x: number; y: number };
      size: { width: number; height: number };
      isMinimized: boolean;
      isMaximized: boolean;
      zIndex: number;
      windowType?: string; // For future window type identification
    };
  };
  desktop: {
    icons: DesktopIcon[];
  };
  settings: {
    snapToEdges: boolean;
    cascadeOffset: number;
    autoSave: boolean;
    activeWindowId?: string;
  };
}

export interface SessionMetadata {
  checksum: string;
  lastSaved: number;
  saveCount: number;
}

const SESSION_VERSION = '1.0.0';
const SESSION_KEY = 'xp-desktop-session';
const SESSION_METADATA_KEY = 'xp-desktop-session-metadata';
const SESSION_BACKUP_KEY = 'xp-desktop-session-backup';

/**
 * Default session data structure
 */
const createDefaultSession = (): SessionData => ({
  version: SESSION_VERSION,
  timestamp: Date.now(),
  windows: {},
  desktop: {
    icons: [],
  },
  settings: {
    snapToEdges: true,
    cascadeOffset: 30,
    autoSave: true,
    activeWindowId: undefined,
  },
});

/**
 * Simple session data structure check (for migration compatibility)
 */
const isValidSessionStructure = (data: any): data is SessionData => {
  if (!data || typeof data !== 'object') return false;
  if (!data.version || typeof data.version !== 'string') return false;
  if (!data.windows || typeof data.windows !== 'object') return false;
  if (!data.desktop || typeof data.desktop !== 'object') return false;
  if (!data.settings || typeof data.settings !== 'object') return false;
  return true;
};

/**
 * Migrate session data to current version
 */
const migrateSessionData = (data: any): SessionData => {
  // For now, just return default if migration is needed
  // In the future, implement version-specific migrations
  if (!isValidSessionStructure(data) || data.version !== SESSION_VERSION) {
    console.warn('Session data migration required, using defaults');
    return createDefaultSession();
  }
  return data;
};

export class SessionManager {
  private static instance: SessionManager;
  private currentSession: SessionData;
  private autoSaveEnabled: boolean = true;
  private saveTimeout: NodeJS.Timeout | null = null;
  private saveInProgress: boolean = false;
  private lastSaveTime: number = 0;
  private saveFailureCount: number = 0;
  private readonly MAX_SAVE_FAILURES = 3;

  private constructor() {
    this.currentSession = createDefaultSession();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Load session from localStorage with enhanced validation and recovery
   */
  async loadSession(): Promise<SessionData> {
    try {
      const savedData = localStorage.getItem(SESSION_KEY);
      if (savedData) {
        const parsedData = JSON.parse(savedData);

        // Validate session data
        const validation = validateSessionDataUtil(parsedData);
        if (validation.isValid) {
          const sanitizedData = sanitizeSessionData(parsedData);
          if (sanitizedData) {
            this.currentSession = migrateSessionData(sanitizedData);
            console.log('Session loaded successfully');

            // Verify checksum if available
            const metadata = this.loadSessionMetadata();
            if (metadata && metadata.checksum) {
              const currentChecksum = generateSessionChecksum(this.currentSession);
              if (currentChecksum !== metadata.checksum) {
                console.warn('Session checksum mismatch, data may have been modified');
              }
            }
          } else {
            throw new Error('Session data sanitization failed');
          }
        } else {
          console.warn('Session validation failed:', validation.errors);
          throw new Error('Invalid session data structure');
        }
      } else {
        this.currentSession = createDefaultSession();
        console.log('No saved session found, using defaults');
      }
    } catch (error) {
      console.error('Failed to load session:', error);

      // Try to load backup session
      const backupLoaded = await this.loadBackupSession();
      if (!backupLoaded) {
        this.currentSession = createDefaultSession();
        console.log('Using default session after backup recovery failed');
      }
    }

    return this.currentSession;
  }

  /**
   * Save session to localStorage with atomic operations and validation
   */
  async saveSession(sessionData?: Partial<SessionData>): Promise<void> {
    // Prevent concurrent saves
    if (this.saveInProgress) {
      console.warn('Save already in progress, skipping');
      return;
    }

    this.saveInProgress = true;
    const saveStartTime = performance.now();

    try {
      // Update session data if provided
      if (sessionData) {
        this.currentSession = {
          ...this.currentSession,
          ...sessionData,
          timestamp: Date.now(),
        };
      }

      // Validate session data before saving
      const validation = validateSessionDataUtil(this.currentSession);
      if (!validation.isValid) {
        const errors = validation.errors || ['Unknown validation error'];
        throw new Error(`Session validation failed: ${errors.join(', ')}`);
      }

      // Create backup of current session before saving new one
      await this.createSessionBackup();

      // Generate checksum for integrity verification
      const checksum = generateSessionChecksum(this.currentSession);

      // Serialize session data (compact format for performance)
      const serializedData = JSON.stringify(this.currentSession);

      // Atomic save: save to temporary key first, then rename
      const tempKey = `${SESSION_KEY}_temp_${Date.now()}`;
      localStorage.setItem(tempKey, serializedData);

      // Verify the temporary save worked
      const verifyData = localStorage.getItem(tempKey);
      if (!verifyData || verifyData !== serializedData) {
        localStorage.removeItem(tempKey);
        throw new Error('Session save verification failed');
      }

      // Atomic move: copy temp to main key and remove temp
      localStorage.setItem(SESSION_KEY, serializedData);
      localStorage.removeItem(tempKey);

      // Save metadata
      const metadata: SessionMetadata = {
        checksum,
        lastSaved: Date.now(),
        saveCount: (this.loadSessionMetadata()?.saveCount || 0) + 1,
      };
      localStorage.setItem(SESSION_METADATA_KEY, JSON.stringify(metadata));

      this.lastSaveTime = Date.now();
      this.saveFailureCount = 0; // Reset failure count on success
      const saveTime = performance.now() - saveStartTime;

      console.log(`Session saved successfully in ${saveTime.toFixed(2)}ms`);

      // Log performance warning if save took too long
      if (saveTime > 100) {
        console.warn(`Session save took ${saveTime.toFixed(2)}ms, consider optimization`);
      }

    } catch (error) {
      this.saveFailureCount++;
      console.error(`Failed to save session (attempt ${this.saveFailureCount}/${this.MAX_SAVE_FAILURES}):`, error);

      // Disable auto-save if too many failures
      if (this.saveFailureCount >= this.MAX_SAVE_FAILURES) {
        console.error('Too many save failures, disabling auto-save');
        this.autoSaveEnabled = false;
      }

      throw error;
    } finally {
      this.saveInProgress = false;
    }
  }

  /**
   * Save window states to session with enhanced state preservation
   */
  async saveWindowStates(windows: WindowState[]): Promise<void> {
    const windowsData: SessionData['windows'] = {};
    let activeWindowId: string | null = null;

    // Find the active window and ensure proper z-index ordering
    const sortedWindows = [...windows].sort((a, b) => a.zIndex - b.zIndex);

    sortedWindows.forEach(window => {
      windowsData[window.id] = {
        id: window.id,
        title: window.title,
        position: { ...window.position },
        size: { ...window.size },
        isMinimized: window.isMinimized,
        isMaximized: window.isMaximized,
        zIndex: window.zIndex,
      };

      // Track the active window
      if (window.isActive) {
        activeWindowId = window.id;
      }
    });

    // Store active window information in settings for restoration
    const enhancedSettings = {
      ...this.currentSession.settings,
      activeWindowId: activeWindowId || undefined, // Convert null to undefined for validation
    };

    await this.saveSession({
      windows: windowsData,
      settings: enhancedSettings,
    });
  }

  /**
   * Load window states from session with proper active state restoration
   */
  getWindowStates(): WindowState[] {
    const windows: WindowState[] = [];
    const activeWindowId = (this.currentSession.settings as any)?.activeWindowId;

    // Convert session data to window states
    Object.values(this.currentSession.windows).forEach(windowData => {
      windows.push({
        id: windowData.id,
        title: windowData.title,
        position: { ...windowData.position },
        size: { ...windowData.size },
        isMinimized: windowData.isMinimized,
        isMaximized: windowData.isMaximized,
        isActive: windowData.id === activeWindowId,
        zIndex: windowData.zIndex,
      });
    });

    // Sort by z-index to maintain proper layering
    windows.sort((a, b) => a.zIndex - b.zIndex);

    // If no active window was found but we have windows, make the top one active
    if (windows.length > 0 && !windows.some(w => w.isActive)) {
      const topWindow = windows.reduce((prev, current) =>
        current.zIndex > prev.zIndex ? current : prev
      );
      topWindow.isActive = true;
    }

    return windows;
  }

  /**
   * Save desktop icon positions
   */
  async saveDesktopIcons(icons: DesktopIcon[]): Promise<void> {
    await this.saveSession({
      desktop: {
        icons: icons.map(icon => ({ ...icon })),
      },
    });
  }

  /**
   * Get desktop icon positions
   */
  getDesktopIcons(): DesktopIcon[] {
    return this.currentSession.desktop.icons.map(icon => ({ ...icon }));
  }

  /**
   * Update session settings
   */
  async updateSettings(settings: Partial<SessionData['settings']>): Promise<void> {
    await this.saveSession({
      settings: {
        ...this.currentSession.settings,
        ...settings,
      },
    });
    
    this.autoSaveEnabled = this.currentSession.settings.autoSave;
  }

  /**
   * Get current settings
   */
  getSettings(): SessionData['settings'] {
    return { ...this.currentSession.settings };
  }

  /**
   * Reset save failure count and re-enable auto-save
   */
  resetSaveFailures(): void {
    this.saveFailureCount = 0;
    this.autoSaveEnabled = this.currentSession.settings.autoSave;
    console.log('Save failure count reset, auto-save re-enabled');
  }

  /**
   * Schedule auto-save (debounced) with performance optimization
   */
  scheduleAutoSave(windows: WindowState[], delay: number = 1000): void {
    if (!this.autoSaveEnabled || this.saveInProgress) return;

    // Throttle saves to prevent excessive writes
    const timeSinceLastSave = Date.now() - this.lastSaveTime;
    if (timeSinceLastSave < 500) {
      // Too soon since last save, extend delay
      delay = Math.max(delay, 500 - timeSinceLastSave);
    }

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.saveWindowStates(windows).catch(error => {
        console.error('Auto-save failed:', error);
      });
    }, delay);
  }

  /**
   * Load session metadata
   */
  private loadSessionMetadata(): SessionMetadata | null {
    try {
      const metadataStr = localStorage.getItem(SESSION_METADATA_KEY);
      if (metadataStr) {
        return JSON.parse(metadataStr);
      }
    } catch (error) {
      console.warn('Failed to load session metadata:', error);
    }
    return null;
  }

  /**
   * Create backup of current session
   */
  private async createSessionBackup(): Promise<void> {
    try {
      const currentData = localStorage.getItem(SESSION_KEY);
      if (currentData) {
        localStorage.setItem(SESSION_BACKUP_KEY, currentData);
      }
    } catch (error) {
      console.warn('Failed to create session backup:', error);
    }
  }

  /**
   * Load backup session if main session fails
   */
  private async loadBackupSession(): Promise<boolean> {
    try {
      const backupData = localStorage.getItem(SESSION_BACKUP_KEY);
      if (backupData) {
        const parsedData = JSON.parse(backupData);
        const validation = validateSessionDataUtil(parsedData);

        if (validation.isValid) {
          const sanitizedData = sanitizeSessionData(parsedData);
          if (sanitizedData) {
            this.currentSession = migrateSessionData(sanitizedData);
            console.log('Backup session loaded successfully');
            return true;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load backup session:', error);
    }
    return false;
  }

  /**
   * Clear session data
   */
  async clearSession(): Promise<void> {
    try {
      localStorage.removeItem(SESSION_KEY);
      this.currentSession = createDefaultSession();
      console.log('Session cleared');
    } catch (error) {
      console.error('Failed to clear session:', error);
      throw error;
    }
  }

  /**
   * Export session data in compliant session.json format
   */
  exportSession(): string {
    // Ensure the session data is in the exact format specified by architecture
    const compliantSession: SessionData = {
      version: this.currentSession.version,
      timestamp: this.currentSession.timestamp,
      windows: { ...this.currentSession.windows },
      desktop: {
        icons: [...this.currentSession.desktop.icons],
      },
      settings: {
        snapToEdges: this.currentSession.settings.snapToEdges,
        cascadeOffset: this.currentSession.settings.cascadeOffset,
        autoSave: this.currentSession.settings.autoSave,
        ...(this.currentSession.settings.activeWindowId && {
          activeWindowId: this.currentSession.settings.activeWindowId,
        }),
      },
    };

    return JSON.stringify(compliantSession, null, 2);
  }

  /**
   * Export session data as a downloadable session.json file
   */
  exportSessionAsFile(): void {
    const sessionJson = this.exportSession();
    const blob = new Blob([sessionJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `session-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    console.log('Session exported as JSON file');
  }

  /**
   * Import session data from backup
   */
  async importSession(sessionJson: string): Promise<void> {
    try {
      const importedData = JSON.parse(sessionJson);
      this.currentSession = migrateSessionData(importedData);
      await this.saveSession();
      console.log('Session imported successfully');
    } catch (error) {
      console.error('Failed to import session:', error);
      throw error;
    }
  }

  /**
   * Get session statistics with compliance information
   */
  getSessionStats(): {
    windowCount: number;
    iconCount: number;
    lastSaved: Date;
    version: string;
    isCompliant: boolean;
    dataSize: number;
    checksum: string;
    saveFailureCount: number;
    autoSaveEnabled: boolean;
    memoryUsage?: number;
  } {
    const validation = validateSessionDataUtil(this.currentSession);
    const sessionJson = this.exportSession();
    const checksum = generateSessionChecksum(this.currentSession);

    // Estimate memory usage
    let memoryUsage: number | undefined;
    try {
      if ('memory' in performance && (performance as any).memory) {
        memoryUsage = (performance as any).memory.usedJSHeapSize;
      }
    } catch (error) {
      // Memory API not available
    }

    return {
      windowCount: Object.keys(this.currentSession.windows).length,
      iconCount: this.currentSession.desktop.icons.length,
      lastSaved: new Date(this.currentSession.timestamp),
      version: this.currentSession.version,
      isCompliant: validation.isValid,
      dataSize: new Blob([sessionJson]).size,
      checksum,
      saveFailureCount: this.saveFailureCount,
      autoSaveEnabled: this.autoSaveEnabled,
      memoryUsage,
    };
  }

  /**
   * Validate current session against architectural specification
   */
  validateCurrentSession(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    compliance: {
      hasRequiredFields: boolean;
      hasValidStructure: boolean;
      hasValidWindowData: boolean;
      hasValidDesktopData: boolean;
      hasValidSettings: boolean;
    };
  } {
    const validation = validateSessionDataUtil(this.currentSession);

    const compliance = {
      hasRequiredFields: !!(
        this.currentSession.version &&
        this.currentSession.timestamp &&
        this.currentSession.windows &&
        this.currentSession.desktop &&
        this.currentSession.settings
      ),
      hasValidStructure: validation.isValid,
      hasValidWindowData: Object.keys(this.currentSession.windows).length === 0 ||
        Object.values(this.currentSession.windows).every(w =>
          w.id && w.title && w.position && w.size &&
          typeof w.isMinimized === 'boolean' &&
          typeof w.isMaximized === 'boolean' &&
          typeof w.zIndex === 'number'
        ),
      hasValidDesktopData: Array.isArray(this.currentSession.desktop.icons),
      hasValidSettings: !!(
        typeof this.currentSession.settings.snapToEdges === 'boolean' &&
        typeof this.currentSession.settings.cascadeOffset === 'number' &&
        typeof this.currentSession.settings.autoSave === 'boolean'
      ),
    };

    return {
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings,
      compliance,
    };
  }
}
