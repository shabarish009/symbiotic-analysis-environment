/**
 * Session Validation Utilities
 * Enhanced validation and integrity checking for session data
 */

import { SessionData } from '../services/SessionManager';
import { DesktopIcon } from '../components/Shell/types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Comprehensive session data validation
 */
export const validateSessionData = (data: any): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  // Basic structure validation
  if (!data || typeof data !== 'object') {
    result.errors.push('Session data must be an object');
    result.isValid = false;
    return result;
  }

  // Version validation
  if (!data.version || typeof data.version !== 'string') {
    result.errors.push('Session data must have a valid version string');
    result.isValid = false;
  }

  // Timestamp validation
  if (!data.timestamp || typeof data.timestamp !== 'number') {
    result.errors.push('Session data must have a valid timestamp');
    result.isValid = false;
  } else if (data.timestamp > Date.now()) {
    result.warnings.push('Session timestamp is in the future');
  }

  // Windows validation
  if (!data.windows || typeof data.windows !== 'object') {
    result.errors.push('Session data must have a windows object');
    result.isValid = false;
  } else {
    const windowValidation = validateWindows(data.windows);
    result.errors.push(...windowValidation.errors);
    result.warnings.push(...windowValidation.warnings);
    if (!windowValidation.isValid) {
      result.isValid = false;
    }
  }

  // Desktop validation
  if (!data.desktop || typeof data.desktop !== 'object') {
    result.errors.push('Session data must have a desktop object');
    result.isValid = false;
  } else {
    const desktopValidation = validateDesktop(data.desktop);
    result.errors.push(...desktopValidation.errors);
    result.warnings.push(...desktopValidation.warnings);
    if (!desktopValidation.isValid) {
      result.isValid = false;
    }
  }

  // Settings validation
  if (!data.settings || typeof data.settings !== 'object') {
    result.errors.push('Session data must have a settings object');
    result.isValid = false;
  } else {
    const settingsValidation = validateSettings(data.settings);
    result.errors.push(...settingsValidation.errors);
    result.warnings.push(...settingsValidation.warnings);
    if (!settingsValidation.isValid) {
      result.isValid = false;
    }
  }

  return result;
};

/**
 * Validate windows data structure
 */
const validateWindows = (windows: any): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  if (!windows || typeof windows !== 'object') {
    result.errors.push('Windows must be an object');
    result.isValid = false;
    return result;
  }

  Object.entries(windows).forEach(([windowId, windowData]: [string, any]) => {
    if (!windowData || typeof windowData !== 'object') {
      result.errors.push(`Window ${windowId} must be an object`);
      result.isValid = false;
      return;
    }

    // Required fields
    const requiredFields = ['id', 'title', 'position', 'size', 'isMinimized', 'isMaximized', 'zIndex'];
    requiredFields.forEach(field => {
      if (!(field in windowData)) {
        result.errors.push(`Window ${windowId} missing required field: ${field}`);
        result.isValid = false;
      }
    });

    // Position validation
    if (windowData.position) {
      if (typeof windowData.position.x !== 'number' || typeof windowData.position.y !== 'number') {
        result.errors.push(`Window ${windowId} position must have numeric x and y values`);
        result.isValid = false;
      }
      if (windowData.position.x < -10000 || windowData.position.x > 10000) {
        result.warnings.push(`Window ${windowId} position x seems extreme: ${windowData.position.x}`);
      }
      if (windowData.position.y < -10000 || windowData.position.y > 10000) {
        result.warnings.push(`Window ${windowId} position y seems extreme: ${windowData.position.y}`);
      }
    }

    // Size validation
    if (windowData.size) {
      if (typeof windowData.size.width !== 'number' || typeof windowData.size.height !== 'number') {
        result.errors.push(`Window ${windowId} size must have numeric width and height values`);
        result.isValid = false;
      }
      if (windowData.size.width < 50 || windowData.size.height < 50) {
        result.warnings.push(`Window ${windowId} size seems too small: ${windowData.size.width}x${windowData.size.height}`);
      }
      if (windowData.size.width > 5000 || windowData.size.height > 5000) {
        result.warnings.push(`Window ${windowId} size seems too large: ${windowData.size.width}x${windowData.size.height}`);
      }
    }

    // Boolean field validation
    if (typeof windowData.isMinimized !== 'boolean') {
      result.errors.push(`Window ${windowId} isMinimized must be a boolean`);
      result.isValid = false;
    }
    if (typeof windowData.isMaximized !== 'boolean') {
      result.errors.push(`Window ${windowId} isMaximized must be a boolean`);
      result.isValid = false;
    }

    // Z-index validation
    if (typeof windowData.zIndex !== 'number') {
      result.errors.push(`Window ${windowId} zIndex must be a number`);
      result.isValid = false;
    }
  });

  return result;
};

/**
 * Validate desktop data structure
 */
const validateDesktop = (desktop: any): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  if (!desktop.icons || !Array.isArray(desktop.icons)) {
    result.errors.push('Desktop must have an icons array');
    result.isValid = false;
    return result;
  }

  desktop.icons.forEach((icon: any, index: number) => {
    if (!icon || typeof icon !== 'object') {
      result.errors.push(`Desktop icon ${index} must be an object`);
      result.isValid = false;
      return;
    }

    const requiredFields = ['id', 'name', 'position'];
    requiredFields.forEach(field => {
      if (!(field in icon)) {
        result.errors.push(`Desktop icon ${index} missing required field: ${field}`);
        result.isValid = false;
      }
    });
  });

  return result;
};

/**
 * Validate settings data structure
 */
const validateSettings = (settings: any): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  const requiredFields = ['snapToEdges', 'cascadeOffset', 'autoSave'];
  requiredFields.forEach(field => {
    if (!(field in settings)) {
      result.errors.push(`Settings missing required field: ${field}`);
      result.isValid = false;
    }
  });

  // activeWindowId is optional
  if (settings.activeWindowId !== undefined && typeof settings.activeWindowId !== 'string') {
    result.errors.push('Settings activeWindowId must be a string if provided');
    result.isValid = false;
  }

  if (typeof settings.snapToEdges !== 'boolean') {
    result.errors.push('Settings snapToEdges must be a boolean');
    result.isValid = false;
  }

  if (typeof settings.cascadeOffset !== 'number') {
    result.errors.push('Settings cascadeOffset must be a number');
    result.isValid = false;
  }

  if (typeof settings.autoSave !== 'boolean') {
    result.errors.push('Settings autoSave must be a boolean');
    result.isValid = false;
  }

  return result;
};

/**
 * Sanitize string to prevent XSS attacks
 */
const sanitizeString = (str: string): string => {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
    .substring(0, 1000); // Limit length
};

/**
 * Sanitize and repair session data where possible
 */
export const sanitizeSessionData = (data: any): SessionData | null => {
  const validation = validateSessionData(data);

  if (!validation.isValid) {
    console.warn('Session data validation failed:', validation.errors);
    return null;
  }

  // Log warnings but continue
  if (validation.warnings.length > 0) {
    console.warn('Session data warnings:', validation.warnings);
  }

  // Sanitize window data
  const sanitizedWindows: { [key: string]: any } = {};
  Object.entries(data.windows).forEach(([windowId, windowData]: [string, any]) => {
    sanitizedWindows[sanitizeString(windowId)] = {
      id: sanitizeString(windowData.id),
      title: sanitizeString(windowData.title),
      position: {
        x: Math.max(-10000, Math.min(10000, Number(windowData.position.x) || 0)),
        y: Math.max(-10000, Math.min(10000, Number(windowData.position.y) || 0)),
      },
      size: {
        width: Math.max(50, Math.min(5000, Number(windowData.size.width) || 200)),
        height: Math.max(50, Math.min(5000, Number(windowData.size.height) || 150)),
      },
      isMinimized: Boolean(windowData.isMinimized),
      isMaximized: Boolean(windowData.isMaximized),
      zIndex: Math.max(0, Math.min(999999, Number(windowData.zIndex) || 1000)),
      ...(windowData.windowType && { windowType: sanitizeString(windowData.windowType) }),
    };
  });

  // Sanitize desktop icons
  const sanitizedIcons = (data.desktop.icons || []).map((icon: any) => ({
    id: sanitizeString(icon.id || ''),
    name: sanitizeString(icon.name || ''),
    icon: sanitizeString(icon.icon || ''),
    position: {
      x: Math.max(-1000, Math.min(5000, Number(icon.position?.x) || 0)),
      y: Math.max(-1000, Math.min(5000, Number(icon.position?.y) || 0)),
    },
    isSelected: Boolean(icon.isSelected),
    onDoubleClick: icon.onDoubleClick || (() => {}),
  }));

  // Return sanitized data
  return {
    version: sanitizeString(data.version),
    timestamp: Math.max(0, Number(data.timestamp) || Date.now()),
    windows: sanitizedWindows,
    desktop: {
      icons: sanitizedIcons,
    },
    settings: {
      snapToEdges: Boolean(data.settings.snapToEdges),
      cascadeOffset: Math.max(0, Math.min(200, Number(data.settings.cascadeOffset) || 30)),
      autoSave: Boolean(data.settings.autoSave),
      activeWindowId: data.settings.activeWindowId ? sanitizeString(data.settings.activeWindowId) : undefined,
    },
  };
};

/**
 * Check if session data is corrupted beyond repair
 */
export const isSessionCorrupted = (data: any): boolean => {
  try {
    const validation = validateSessionData(data);
    return !validation.isValid;
  } catch (error) {
    return true;
  }
};

/**
 * Generate session data checksum for integrity verification using SHA-256
 */
export const generateSessionChecksum = async (data: SessionData): Promise<string> => {
  const dataString = JSON.stringify(data, Object.keys(data).sort());

  // Use Web Crypto API for secure hashing if available
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(dataString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.warn('Web Crypto API failed, falling back to simple hash:', error);
    }
  }

  // Fallback to improved simple hash for environments without crypto
  let hash = 0;
  for (let i = 0; i < dataString.length; i++) {
    const char = dataString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `fallback_${Math.abs(hash).toString(16)}`;
};

/**
 * Synchronous checksum generation for backward compatibility
 */
export const generateSessionChecksumSync = (data: SessionData): string => {
  const dataString = JSON.stringify(data, Object.keys(data).sort());
  let hash = 0;
  for (let i = 0; i < dataString.length; i++) {
    const char = dataString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `sync_${Math.abs(hash).toString(16)}`;
};
