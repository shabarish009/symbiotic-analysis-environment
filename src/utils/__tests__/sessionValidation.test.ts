/**
 * Session Validation Utilities Tests
 * Tests for session data validation and integrity checking
 */

import { describe, it, expect } from 'vitest';
import {
  validateSessionData,
  sanitizeSessionData,
  isSessionCorrupted,
  generateSessionChecksum,
} from '../sessionValidation';
import { SessionData } from '../../services/SessionManager';

describe('Session Validation Utilities', () => {
  const validSessionData: SessionData = {
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
    desktop: {
      icons: [
        {
          id: 'icon-1',
          name: 'Test Icon',
          icon: 'test-icon.png',
          position: { x: 50, y: 50 },
          isSelected: false,
          onDoubleClick: () => {},
        },
      ],
    },
    settings: {
      snapToEdges: true,
      cascadeOffset: 30,
      autoSave: true,
      activeWindowId: 'window-1',
    },
  };

  describe('validateSessionData', () => {
    it('should validate correct session data', () => {
      const result = validateSessionData(validSessionData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should reject null or undefined data', () => {
      const result1 = validateSessionData(null);
      const result2 = validateSessionData(undefined);

      expect(result1.isValid).toBe(false);
      expect(result1.errors).toContain('Session data must be an object');
      expect(result2.isValid).toBe(false);
      expect(result2.errors).toContain('Session data must be an object');
    });

    it('should reject data without required fields', () => {
      const incompleteData = {
        version: '1.0.0',
        // Missing timestamp, windows, desktop, settings
      };

      const result = validateSessionData(incompleteData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Session data must have a valid timestamp');
      expect(result.errors).toContain('Session data must have a windows object');
      expect(result.errors).toContain('Session data must have a desktop object');
      expect(result.errors).toContain('Session data must have a settings object');
    });

    it('should validate window data structure', () => {
      const dataWithBadWindows = {
        ...validSessionData,
        windows: {
          'bad-window': {
            id: 'bad-window',
            // Missing required fields
          },
        },
      };

      const result = validateSessionData(dataWithBadWindows);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('missing required field'))).toBe(true);
    });

    it('should validate window position data types', () => {
      const dataWithBadPosition = {
        ...validSessionData,
        windows: {
          'window-1': {
            ...validSessionData.windows['window-1'],
            position: { x: 'invalid', y: 'invalid' },
          },
        },
      };

      const result = validateSessionData(dataWithBadPosition);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('position must have numeric'))).toBe(true);
    });

    it('should validate window size data types', () => {
      const dataWithBadSize = {
        ...validSessionData,
        windows: {
          'window-1': {
            ...validSessionData.windows['window-1'],
            size: { width: 'invalid', height: 'invalid' },
          },
        },
      };

      const result = validateSessionData(dataWithBadSize);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('size must have numeric'))).toBe(true);
    });

    it('should validate boolean fields', () => {
      const dataWithBadBooleans = {
        ...validSessionData,
        windows: {
          'window-1': {
            ...validSessionData.windows['window-1'],
            isMinimized: 'true',
            isMaximized: 1,
          },
        },
      };

      const result = validateSessionData(dataWithBadBooleans);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('isMinimized must be a boolean'))).toBe(true);
      expect(result.errors.some(e => e.includes('isMaximized must be a boolean'))).toBe(true);
    });

    it('should validate z-index data type', () => {
      const dataWithBadZIndex = {
        ...validSessionData,
        windows: {
          'window-1': {
            ...validSessionData.windows['window-1'],
            zIndex: 'invalid',
          },
        },
      };

      const result = validateSessionData(dataWithBadZIndex);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('zIndex must be a number'))).toBe(true);
    });

    it('should validate settings structure', () => {
      const dataWithBadSettings = {
        ...validSessionData,
        settings: {
          snapToEdges: 'true', // Should be boolean
          cascadeOffset: 'invalid', // Should be number
          autoSave: 1, // Should be boolean
        },
      };

      const result = validateSessionData(dataWithBadSettings);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('snapToEdges must be a boolean'))).toBe(true);
      expect(result.errors.some(e => e.includes('cascadeOffset must be a number'))).toBe(true);
      expect(result.errors.some(e => e.includes('autoSave must be a boolean'))).toBe(true);
    });

    it('should generate warnings for extreme values', () => {
      const dataWithExtremeValues = {
        ...validSessionData,
        timestamp: Date.now() + 86400000, // Future timestamp
        windows: {
          'window-1': {
            ...validSessionData.windows['window-1'],
            position: { x: 50000, y: -50000 }, // Extreme positions
            size: { width: 10, height: 10 }, // Very small size
          },
        },
      };

      const result = validateSessionData(dataWithExtremeValues);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('timestamp is in the future'))).toBe(true);
      expect(result.warnings.some(w => w.includes('position') && w.includes('extreme'))).toBe(true);
      expect(result.warnings.some(w => w.includes('size seems too small'))).toBe(true);
    });

    it('should validate desktop icons structure', () => {
      const dataWithBadDesktop = {
        ...validSessionData,
        desktop: {
          icons: 'invalid', // Should be array
        },
      };

      const result = validateSessionData(dataWithBadDesktop);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Desktop must have an icons array'))).toBe(true);
    });

    it('should handle optional activeWindowId field', () => {
      const dataWithoutActiveWindowId = {
        ...validSessionData,
        settings: {
          snapToEdges: true,
          cascadeOffset: 30,
          autoSave: true,
          // activeWindowId is optional
        },
      };

      const result = validateSessionData(dataWithoutActiveWindowId);

      expect(result.isValid).toBe(true);
    });

    it('should validate activeWindowId data type when present', () => {
      const dataWithBadActiveWindowId = {
        ...validSessionData,
        settings: {
          ...validSessionData.settings,
          activeWindowId: 123, // Should be string
        },
      };

      const result = validateSessionData(dataWithBadActiveWindowId);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('activeWindowId must be a string'))).toBe(true);
    });
  });

  describe('sanitizeSessionData', () => {
    it('should return sanitized data for valid input', () => {
      const result = sanitizeSessionData(validSessionData);

      expect(result).not.toBeNull();
      expect(result?.version).toBe(validSessionData.version);
      expect(result?.windows).toEqual(validSessionData.windows);
    });

    it('should return null for invalid data', () => {
      const invalidData = {
        version: 123, // Should be string
        timestamp: 'invalid', // Should be number
      };

      const result = sanitizeSessionData(invalidData);

      expect(result).toBeNull();
    });

    it('should preserve all valid fields', () => {
      const result = sanitizeSessionData(validSessionData);

      expect(result).not.toBeNull();
      expect(result?.desktop.icons).toEqual(validSessionData.desktop.icons);
      expect(result?.settings.activeWindowId).toBe(validSessionData.settings.activeWindowId);
    });
  });

  describe('isSessionCorrupted', () => {
    it('should return false for valid session data', () => {
      const result = isSessionCorrupted(validSessionData);

      expect(result).toBe(false);
    });

    it('should return true for invalid session data', () => {
      const invalidData = {
        version: 123,
        timestamp: 'invalid',
      };

      const result = isSessionCorrupted(invalidData);

      expect(result).toBe(true);
    });

    it('should return true for data that throws during validation', () => {
      const problematicData = {
        get version() {
          throw new Error('Access error');
        },
      };

      const result = isSessionCorrupted(problematicData);

      expect(result).toBe(true);
    });
  });

  describe('generateSessionChecksum', () => {
    it('should generate consistent checksums for identical data', () => {
      const checksum1 = generateSessionChecksum(validSessionData);
      const checksum2 = generateSessionChecksum(validSessionData);

      expect(checksum1).toBe(checksum2);
      expect(typeof checksum1).toBe('string');
      expect(checksum1.length).toBeGreaterThan(0);
    });

    it('should generate different checksums for different data', () => {
      const modifiedData = {
        ...validSessionData,
        timestamp: validSessionData.timestamp + 1000,
      };

      const checksum1 = generateSessionChecksum(validSessionData);
      const checksum2 = generateSessionChecksum(modifiedData);

      expect(checksum1).not.toBe(checksum2);
    });

    it('should generate checksums regardless of property order', () => {
      const reorderedData = {
        settings: validSessionData.settings,
        desktop: validSessionData.desktop,
        windows: validSessionData.windows,
        timestamp: validSessionData.timestamp,
        version: validSessionData.version,
      };

      const checksum1 = generateSessionChecksum(validSessionData);
      const checksum2 = generateSessionChecksum(reorderedData as SessionData);

      expect(checksum1).toBe(checksum2);
    });
  });
});
