/**
 * Tests for SessionManager service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager } from '../SessionManager';
import { WindowState } from '../../components/Shell/types';

// Mock localStorage with actual storage simulation
const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] || null),
  setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach(key => delete mockStorage[key]); }),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear mock storage
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    // Reset localStorage mock implementations to default behavior
    localStorageMock.getItem.mockImplementation((key: string) => mockStorage[key] || null);
    localStorageMock.setItem.mockImplementation((key: string, value: string) => { mockStorage[key] = value; });
    localStorageMock.removeItem.mockImplementation((key: string) => { delete mockStorage[key]; });
    localStorageMock.clear.mockImplementation(() => { Object.keys(mockStorage).forEach(key => delete mockStorage[key]); });
    sessionManager = SessionManager.getInstance();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  const mockWindows: WindowState[] = [
    {
      id: 'window-1',
      title: 'Test Window 1',
      position: { x: 100, y: 100 },
      size: { width: 400, height: 300 },
      isMinimized: false,
      isMaximized: false,
      isActive: true,
      zIndex: 1000,
    },
    {
      id: 'window-2',
      title: 'Test Window 2',
      position: { x: 200, y: 200 },
      size: { width: 500, height: 400 },
      isMinimized: true,
      isMaximized: false,
      isActive: false,
      zIndex: 1001,
    },
  ];

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SessionManager.getInstance();
      const instance2 = SessionManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('loadSession', () => {
    it('should load session from localStorage', async () => {
      const mockSessionData = {
        version: '1.0.0',
        timestamp: Date.now(),
        windows: {
          'window-1': {
            id: 'window-1',
            title: 'Test Window',
            position: { x: 100, y: 100 },
            size: { width: 400, height: 300 },
            isMinimized: false,
            isMaximized: false,
            zIndex: 1000,
          },
        },
        desktop: { icons: [] },
        settings: {
          snapToEdges: true,
          cascadeOffset: 30,
          autoSave: true,
        },
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockSessionData));

      const result = await sessionManager.loadSession();

      expect(localStorageMock.getItem).toHaveBeenCalledWith('xp-desktop-session');
      expect(result.version).toBe('1.0.0');
      expect(result.windows).toEqual(mockSessionData.windows);
    });

    it('should return default session when no saved data exists', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = await sessionManager.loadSession();

      expect(result.version).toBe('1.0.0');
      expect(result.windows).toEqual({});
      expect(result.settings.autoSave).toBe(true);
    });

    it('should handle corrupted session data gracefully', async () => {
      localStorageMock.getItem.mockReturnValue('invalid-json');

      const result = await sessionManager.loadSession();

      expect(result.version).toBe('1.0.0');
      expect(result.windows).toEqual({});
    });
  });

  describe('saveSession', () => {
    it('should save session to localStorage', async () => {
      const sessionData = {
        windows: {
          'test-window': {
            id: 'test-window',
            title: 'Test',
            position: { x: 0, y: 0 },
            size: { width: 100, height: 100 },
            isMinimized: false,
            isMaximized: false,
            zIndex: 1000,
          },
        },
      };

      await sessionManager.saveSession(sessionData);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'xp-desktop-session',
        expect.stringContaining('"test-window"')
      );
    });

    it('should handle save errors gracefully', async () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      await expect(sessionManager.saveSession()).rejects.toThrow('Storage quota exceeded');
    });
  });

  describe('saveWindowStates', () => {
    it('should save window states correctly', async () => {
      await sessionManager.saveWindowStates(mockWindows);

      expect(localStorageMock.setItem).toHaveBeenCalled();
      
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(savedData.windows['window-1']).toEqual({
        id: 'window-1',
        title: 'Test Window 1',
        position: { x: 100, y: 100 },
        size: { width: 400, height: 300 },
        isMinimized: false,
        isMaximized: false,
        zIndex: 1000,
      });
    });
  });

  describe('getWindowStates', () => {
    it('should return window states from session', async () => {
      const mockSessionData = {
        version: '1.0.0',
        timestamp: Date.now(),
        windows: {
          'window-1': {
            id: 'window-1',
            title: 'Test Window',
            position: { x: 100, y: 100 },
            size: { width: 400, height: 300 },
            isMinimized: false,
            isMaximized: false,
            zIndex: 1000,
          },
        },
        desktop: { icons: [] },
        settings: {
          snapToEdges: true,
          cascadeOffset: 30,
          autoSave: true,
        },
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockSessionData));
      await sessionManager.loadSession();

      const windows = sessionManager.getWindowStates();

      expect(windows).toHaveLength(1);
      expect(windows[0].id).toBe('window-1');
      expect(windows[0].title).toBe('Test Window');
      expect(windows[0].isActive).toBe(true); // Should be active since it's the only window
    });
  });

  describe('clearSession', () => {
    it('should clear session data', async () => {
      await sessionManager.clearSession();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('xp-desktop-session');
    });
  });

  describe('exportSession', () => {
    it('should export session as JSON string', async () => {
      await sessionManager.saveWindowStates(mockWindows);
      
      const exported = sessionManager.exportSession();
      const parsed = JSON.parse(exported);

      expect(parsed.version).toBe('1.0.0');
      expect(parsed.windows).toBeDefined();
    });
  });

  describe('importSession', () => {
    it('should import session from JSON string', async () => {
      const sessionJson = JSON.stringify({
        version: '1.0.0',
        timestamp: Date.now(),
        windows: {
          'imported-window': {
            id: 'imported-window',
            title: 'Imported Window',
            position: { x: 50, y: 50 },
            size: { width: 300, height: 200 },
            isMinimized: false,
            isMaximized: false,
            zIndex: 1000,
          },
        },
        desktop: { icons: [] },
        settings: {
          snapToEdges: true,
          cascadeOffset: 30,
          autoSave: true,
        },
      });

      await sessionManager.importSession(sessionJson);

      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('should handle invalid import data', async () => {
      await expect(sessionManager.importSession('invalid-json')).rejects.toThrow();
    });
  });

  describe('getSessionStats', () => {
    it('should return correct session statistics with compliance info', async () => {
      await sessionManager.saveWindowStates(mockWindows);

      const stats = sessionManager.getSessionStats();

      expect(stats.windowCount).toBe(2);
      expect(stats.iconCount).toBe(0);
      expect(stats.version).toBe('1.0.0');
      expect(stats.lastSaved).toBeInstanceOf(Date);
      expect(stats.isCompliant).toBe(true);
      expect(stats.dataSize).toBeGreaterThan(0);
      expect(stats.checksum).toBeDefined();
    });
  });

  describe('updateSettings', () => {
    it('should update session settings', async () => {
      await sessionManager.updateSettings({
        snapToEdges: false,
        autoSave: false,
      });

      const settings = sessionManager.getSettings();
      expect(settings.snapToEdges).toBe(false);
      expect(settings.autoSave).toBe(false);
      expect(settings.cascadeOffset).toBe(30); // Should preserve existing values
    });
  });

  describe('validateCurrentSession', () => {
    it('should validate session compliance', async () => {
      await sessionManager.saveWindowStates(mockWindows);

      const validation = sessionManager.validateCurrentSession();

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.compliance.hasRequiredFields).toBe(true);
      expect(validation.compliance.hasValidStructure).toBe(true);
      expect(validation.compliance.hasValidWindowData).toBe(true);
      expect(validation.compliance.hasValidDesktopData).toBe(true);
      expect(validation.compliance.hasValidSettings).toBe(true);
    });

    it('should detect invalid session data', async () => {
      // Force invalid session data by mocking corrupted localStorage
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        version: '1.0.0',
        timestamp: 'invalid-timestamp', // Should be number
        windows: 'invalid-windows', // Should be object
        desktop: { icons: [] },
        settings: {
          snapToEdges: true,
          cascadeOffset: 30,
          autoSave: true,
        },
      }));

      await sessionManager.loadSession();
      const validation = sessionManager.validateCurrentSession();

      // Should fall back to default session due to validation failure
      expect(validation.isValid).toBe(true); // Default session should be valid
    });
  });

  describe('Active Window State Management', () => {
    it('should preserve active window state during save/restore', async () => {
      const windowsWithActive = [
        {
          ...mockWindows[0],
          isActive: false,
        },
        {
          ...mockWindows[1],
          isActive: true, // This window should remain active
        },
      ];

      await sessionManager.saveWindowStates(windowsWithActive);
      const restoredWindows = sessionManager.getWindowStates();

      const activeWindow = restoredWindows.find(w => w.isActive);
      expect(activeWindow).toBeDefined();
      expect(activeWindow?.id).toBe('window-2');
    });

    it('should ensure at least one window is active when none specified', async () => {
      const windowsWithoutActive = mockWindows.map(w => ({ ...w, isActive: false }));

      await sessionManager.saveWindowStates(windowsWithoutActive);
      const restoredWindows = sessionManager.getWindowStates();

      const activeWindows = restoredWindows.filter(w => w.isActive);
      expect(activeWindows).toHaveLength(1);

      // Should make the highest z-index window active
      const activeWindow = activeWindows[0];
      expect(activeWindow.zIndex).toBe(1001);
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle concurrent save operations', async () => {
      let saveCount = 0;
      localStorageMock.setItem.mockImplementation(() => {
        saveCount++;
      });

      // Attempt multiple concurrent saves
      const promises = [
        sessionManager.saveSession(),
        sessionManager.saveSession(),
        sessionManager.saveSession(),
      ];

      await Promise.allSettled(promises);

      // Should prevent excessive concurrent saves
      expect(saveCount).toBeLessThanOrEqual(2);
    });

    it('should throttle auto-save operations', () => {
      const spy = vi.spyOn(sessionManager, 'saveWindowStates');

      // Schedule multiple rapid auto-saves
      sessionManager.scheduleAutoSave(mockWindows, 10);
      sessionManager.scheduleAutoSave(mockWindows, 10);
      sessionManager.scheduleAutoSave(mockWindows, 10);

      // Should not execute immediately due to debouncing
      expect(spy).not.toHaveBeenCalled();
    });

    it('should create backup before saving', async () => {
      // First save to create initial data
      await sessionManager.saveSession({ windows: {} });

      // Clear mock to track backup creation
      localStorageMock.setItem.mockClear();

      // Second save should create backup
      await sessionManager.saveSession({
        windows: {
          'new-window': {
            id: 'new-window',
            title: 'New Window',
            position: { x: 300, y: 300 },
            size: { width: 600, height: 500 },
            isMinimized: false,
            isMaximized: false,
            zIndex: 1002,
          }
        }
      });

      // Should have called setItem for both backup and main save
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        expect.stringContaining('backup'),
        expect.any(String)
      );
    });
  });
});
