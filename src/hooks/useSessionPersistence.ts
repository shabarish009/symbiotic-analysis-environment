/**
 * useSessionPersistence Hook
 * Handles automatic session persistence for window layouts
 */

import { useEffect, useCallback, useRef } from 'react';
import { WindowState, DesktopIcon } from '../components/Shell/types';
import { SessionManager } from '../services/SessionManager';
import { restoreWindowStates, getRestorationStats } from '../utils/windowRestoration';

interface UseSessionPersistenceProps {
  windows: WindowState[];
  desktopIcons?: DesktopIcon[];
  autoSaveEnabled?: boolean;
  autoSaveDelay?: number;
}

export const useSessionPersistence = ({
  windows,
  desktopIcons = [],
  autoSaveEnabled = true,
  autoSaveDelay = 1000,
}: UseSessionPersistenceProps) => {
  const sessionManager = useRef(SessionManager.getInstance());
  const isInitialized = useRef(false);

  /**
   * Load session data on initialization with enhanced restoration
   */
  const loadSession = useCallback(async () => {
    try {
      await sessionManager.current.loadSession();
      const savedWindows = sessionManager.current.getWindowStates();
      const savedIcons = sessionManager.current.getDesktopIcons();
      const settings = sessionManager.current.getSettings();

      // Apply window restoration validation and correction
      const restoredWindows = restoreWindowStates(savedWindows, {
        validatePositions: true,
        constrainToBounds: true,
        handleOffScreen: true,
        preserveZIndex: true,
        ensureActiveWindow: true,
      });

      // Log restoration statistics for debugging
      if (savedWindows.length > 0) {
        const stats = getRestorationStats(savedWindows, restoredWindows);
        console.log('Window restoration stats:', stats);

        if (stats.positionsCorrected > 0 || stats.sizesCorrected > 0) {
          console.log(`Corrected ${stats.positionsCorrected} positions and ${stats.sizesCorrected} sizes during restoration`);
        }
      }

      return {
        windows: restoredWindows,
        desktopIcons: savedIcons,
        settings,
      };
    } catch (error) {
      console.error('Failed to load session:', error);
      return {
        windows: [],
        desktopIcons: [],
        settings: {
          snapToEdges: true,
          cascadeOffset: 30,
          autoSave: true,
        },
      };
    }
  }, []);

  /**
   * Save current session
   */
  const saveSession = useCallback(async () => {
    try {
      await sessionManager.current.saveWindowStates(windows);
      if (desktopIcons.length > 0) {
        await sessionManager.current.saveDesktopIcons(desktopIcons);
      }
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }, [windows, desktopIcons]);

  /**
   * Save session with debouncing
   */
  const saveSessionDebounced = useCallback(() => {
    if (autoSaveEnabled && isInitialized.current) {
      sessionManager.current.scheduleAutoSave(windows, autoSaveDelay);
    }
  }, [windows, autoSaveEnabled, autoSaveDelay]);

  /**
   * Clear session data
   */
  const clearSession = useCallback(async () => {
    try {
      await sessionManager.current.clearSession();
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  }, []);

  /**
   * Update session settings
   */
  const updateSettings = useCallback(async (settings: {
    snapToEdges?: boolean;
    cascadeOffset?: number;
    autoSave?: boolean;
  }) => {
    try {
      await sessionManager.current.updateSettings(settings);
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  }, []);

  /**
   * Export session for backup
   */
  const exportSession = useCallback(() => {
    return sessionManager.current.exportSession();
  }, []);

  /**
   * Import session from backup
   */
  const importSession = useCallback(async (sessionJson: string) => {
    try {
      await sessionManager.current.importSession(sessionJson);
      return await loadSession();
    } catch (error) {
      console.error('Failed to import session:', error);
      throw error;
    }
  }, [loadSession]);

  /**
   * Get session statistics with compliance information
   */
  const getSessionStats = useCallback(() => {
    return sessionManager.current.getSessionStats();
  }, []);

  /**
   * Validate current session compliance
   */
  const validateSession = useCallback(() => {
    return sessionManager.current.validateCurrentSession();
  }, []);

  /**
   * Export session as downloadable JSON file
   */
  const exportSessionAsFile = useCallback(() => {
    sessionManager.current.exportSessionAsFile();
  }, []);

  // Auto-save when windows change
  useEffect(() => {
    if (isInitialized.current) {
      saveSessionDebounced();
    }
  }, [windows, saveSessionDebounced]);

  // Auto-save when desktop icons change
  useEffect(() => {
    if (isInitialized.current && desktopIcons.length > 0) {
      saveSessionDebounced();
    }
  }, [desktopIcons, saveSessionDebounced]);

  // Save session before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isInitialized.current) {
        // Use synchronous save for page unload
        try {
          sessionManager.current.saveWindowStates(windows);
        } catch (error) {
          console.error('Failed to save session on unload:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [windows]);

  // Mark as initialized after first render
  useEffect(() => {
    isInitialized.current = true;
  }, []);

  return {
    loadSession,
    saveSession,
    clearSession,
    updateSettings,
    exportSession,
    importSession,
    getSessionStats,
    validateSession,
    exportSessionAsFile,
  };
};
