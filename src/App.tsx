/**
 * Main Application Component
 * Windows XP desktop environment with Shell components
 */

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { XPThemeProvider } from './styles/themes/XPThemeProvider';
import {
  DesktopCanvas,
  Taskbar,
  StartMenu,
  WindowFrame,
} from './components/Shell';
import { Button } from './components/UI';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AIStatusWindow, useAIEngineStatus } from './components/AI';
import { useWindowBounds } from './hooks/useWindowBounds';
import { useSessionPersistence } from './hooks/useSessionPersistence';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useWindowAccessibility } from './hooks/useWindowAccessibility';
import { WindowManager } from './services/WindowManager';
import type {
  DesktopIcon,
  TaskbarItem,
  StartMenuItem,
  WindowState,
} from './components/Shell/types';

const App: React.FC = () => {
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [backendConnected, setBackendConnected] = useState(false);
  const [greetingMessage, setGreetingMessage] = useState<string>('');

  // AI Engine Status Management
  const {
    status: aiStatus,
    isLoading: aiLoading,
    startEngine: startAIEngine,
    stopEngine: stopAIEngine,
    retryStart: retryAIEngine,
  } = useAIEngineStatus();

  // Initialize window bounds management
  const { getCascadedWindowPosition } = useWindowBounds();

  // Initialize window manager
  const windowManager = WindowManager.getInstance();

  // Initialize session persistence
  const { loadSession, saveSession } = useSessionPersistence({
    windows,
    autoSaveEnabled: true,
    autoSaveDelay: 1000,
  });

  // Test backend connection and load session on startup
  useEffect(() => {
    const initializeApp = async () => {
      // Test backend connection
      try {
        const response = await invoke('greet', { name: 'XP User' });
        setGreetingMessage(response as string);
        setBackendConnected(true);
        console.log('Backend connection successful:', response);
      } catch (error) {
        console.error('Backend connection failed:', error);
        setBackendConnected(false);
      }

      // Load saved session
      try {
        const sessionData = await loadSession();
        if (sessionData.windows.length > 0) {
          // Restore windows with their exact states, including active state
          setWindows(sessionData.windows);
          console.log(`Restored ${sessionData.windows.length} windows from session`);
        }
      } catch (error) {
        console.error('Failed to load session:', error);
      }

      // Start AI Engine automatically
      try {
        await startAIEngine();
        console.log('AI Engine started automatically');
      } catch (error) {
        console.error('Failed to start AI Engine automatically:', error);
      }
    };

    initializeApp();
  }, [loadSession]);

  // Sample desktop icons
  const desktopIcons: DesktopIcon[] = [
    {
      id: 'welcome',
      name: 'Welcome',
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" fill="%234A90E2"/><text x="16" y="20" text-anchor="middle" fill="white" font-size="12">Hi</text></svg>',
      position: { x: 32, y: 32 },
      isSelected: false,
      onDoubleClick: () => openWelcomeWindow(),
    },
    {
      id: 'about',
      name: 'About',
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="%23316AC5"/><text x="16" y="20" text-anchor="middle" fill="white" font-size="16">?</text></svg>',
      position: { x: 32, y: 120 },
      isSelected: false,
      onDoubleClick: () => openAboutWindow(),
    },
  ];

  // Sample taskbar items
  const taskbarItems: TaskbarItem[] = windows.map(window => ({
    id: window.id,
    title: window.title,
    isActive: window.isActive,
    isMinimized: window.isMinimized,
    onClick: () => focusWindow(window.id),
  }));

  // Sample start menu items
  const startMenuItems: StartMenuItem[] = [
    {
      id: 'welcome',
      label: 'Welcome',
      onClick: () => openWelcomeWindow(),
    },
    {
      id: 'about',
      label: 'About',
      onClick: () => openAboutWindow(),
    },
    {
      id: 'separator1',
      label: '',
      separator: true,
    },
    {
      id: 'settings',
      label: 'Settings',
      onClick: () => console.log('Settings clicked'),
    },
  ];

  const openWelcomeWindow = () => {
    const template = windowManager.getWindowTemplate('welcome');
    const existingWindows = windows.map(w => ({ ...w.position, ...w.size }));
    const cascadedPosition = getCascadedWindowPosition(existingWindows, template.defaultSize);

    const newWindow = windowManager.createWindow('welcome', cascadedPosition);

    setWindows(prev =>
      windowManager.updateZIndex([...prev, newWindow], newWindow.id)
    );
    setIsStartMenuOpen(false);
  };

  const openAboutWindow = () => {
    const template = windowManager.getWindowTemplate('about');
    const existingWindows = windows.map(w => ({ ...w.position, ...w.size }));
    const cascadedPosition = getCascadedWindowPosition(existingWindows, template.defaultSize);

    const newWindow = windowManager.createWindow('about', cascadedPosition);

    setWindows(prev =>
      windowManager.updateZIndex([...prev, newWindow], newWindow.id)
    );
    setIsStartMenuOpen(false);
  };

  const closeWindow = (windowId: string) => {
    setWindows(prev => prev.filter(w => w.id !== windowId));
  };

  const minimizeWindow = (windowId: string) => {
    setWindows(prev =>
      prev.map(w =>
        w.id === windowId ? { ...w, isMinimized: true, isActive: false } : w
      )
    );
  };

  const maximizeWindow = (windowId: string) => {
    setWindows(prev =>
      prev.map(w =>
        w.id === windowId ? { ...w, isMaximized: !w.isMaximized } : w
      )
    );
  };

  const focusWindow = (windowId: string) => {
    setWindows(prev => {
      const updatedWindows = prev.map(w => ({
        ...w,
        isMinimized: w.id === windowId ? false : w.isMinimized,
      }));
      return windowManager.updateZIndex(updatedWindows, windowId);
    });
  };

  const moveWindow = (windowId: string, position: { x: number; y: number }) => {
    setWindows(prev =>
      prev.map(w => (w.id === windowId ? { ...w, position } : w))
    );
  };

  const resizeWindow = (windowId: string, size: { width: number; height: number }) => {
    setWindows(prev =>
      prev.map(w => (w.id === windowId ? { ...w, size } : w))
    );
  };

  const cascadeWindows = () => {
    const visibleWindows = windows.filter(w => !w.isMinimized);
    setWindows(prev => windowManager.cascadeWindows(prev));
    announceBulkOperation('cascade', visibleWindows.length);
  };

  const tileWindowsHorizontally = () => {
    const visibleWindows = windows.filter(w => !w.isMinimized);
    setWindows(prev => windowManager.tileWindowsHorizontally(visibleWindows));
    announceBulkOperation('tile-horizontal', visibleWindows.length);
  };

  const tileWindowsVertically = () => {
    const visibleWindows = windows.filter(w => !w.isMinimized);
    setWindows(prev => windowManager.tileWindowsVertically(visibleWindows));
    announceBulkOperation('tile-vertical', visibleWindows.length);
  };

  const minimizeAllWindows = () => {
    const visibleWindows = windows.filter(w => !w.isMinimized);
    setWindows(prev => windowManager.minimizeAllWindows(prev));
    if (visibleWindows.length > 0) {
      announceBulkOperation('minimize-all', visibleWindows.length);
    }
  };

  // Initialize accessibility features
  const { announceBulkOperation } = useWindowAccessibility({
    windows,
    enabled: true,
  });

  const handleStartClick = () => {
    setIsStartMenuOpen(!isStartMenuOpen);
  };

  const handleStartMenuClose = () => {
    setIsStartMenuOpen(false);
  };

  // Initialize keyboard shortcuts
  useKeyboardShortcuts({
    windows,
    onFocusWindow: focusWindow,
    onCloseWindow: closeWindow,
    onMinimizeWindow: minimizeWindow,
    onMaximizeWindow: maximizeWindow,
    onCascadeWindows: cascadeWindows,
    onTileHorizontally: tileWindowsHorizontally,
    onTileVertically: tileWindowsVertically,
    onMinimizeAll: minimizeAllWindows,
    enabled: true,
  });

  return (
    <XPThemeProvider>
      <ErrorBoundary>
        <div className="app">
          {/* Desktop */}
          <DesktopCanvas
            icons={desktopIcons}
            onDesktopClick={() => setIsStartMenuOpen(false)}
          >
            {/* Windows */}
            {windows.map(window => (
              <WindowFrame
                key={window.id}
                window={window}
                onClose={closeWindow}
                onMinimize={minimizeWindow}
                onMaximize={maximizeWindow}
                onFocus={focusWindow}
                onMove={moveWindow}
                onResize={resizeWindow}
              >
                {window.id.startsWith('welcome') && (
                  <div style={{ padding: '20px' }}>
                    <h2>🎭 Welcome to Symbiotic Analysis Environment</h2>
                    <p>Version 0.1.0 - Phase 1: Core Engine & Killer App</p>
                    <p>
                      Welcome to the future of data analysis! This local-first,
                      AI-powered environment is designed to be your intelligent
                      partner in data exploration and analysis.
                    </p>
                    <div
                      style={{
                        marginTop: '20px',
                        padding: '15px',
                        background: '#e8f5e8',
                        border: '1px solid #4caf50',
                        borderRadius: '5px',
                      }}
                    >
                      <strong>Status:</strong>{' '}
                      {backendConnected
                        ? '✅ Backend Connected!'
                        : '⚠️ Backend Connection Failed'}
                    </div>
                    {greetingMessage && (
                      <div style={{ marginTop: '10px', fontStyle: 'italic' }}>
                        Backend says: &ldquo;{greetingMessage}&rdquo;
                      </div>
                    )}
                    <div style={{ marginTop: '20px' }}>
                      <Button
                        variant="primary"
                        onClick={() => closeWindow(window.id)}
                      >
                        Close Welcome
                      </Button>
                    </div>
                  </div>
                )}
                {window.id.startsWith('about') && (
                  <div style={{ padding: '20px' }}>
                    <h2>About Symbiotic Analysis Environment</h2>
                    <p>
                      <strong>Version:</strong> 0.1.0
                    </p>
                    <p>
                      <strong>Architecture:</strong> Tauri + React + TypeScript
                    </p>
                    <p>
                      <strong>Theme:</strong> Windows XP Luna
                    </p>
                    <p>
                      <strong>Accessibility:</strong> WCAG AA Compliant
                    </p>
                    <div style={{ marginTop: '20px' }}>
                      <Button onClick={() => closeWindow(window.id)}>
                        Close
                      </Button>
                    </div>
                  </div>
                )}
              </WindowFrame>
            ))}
          </DesktopCanvas>

          {/* Taskbar */}
          <Taskbar
            items={taskbarItems}
            onStartClick={handleStartClick}
            onItemClick={focusWindow}
            showClock={true}
          />

          {/* Start Menu */}
          <StartMenu
            isOpen={isStartMenuOpen}
            items={startMenuItems}
            onClose={handleStartMenuClose}
            userInfo={{
              name: 'Data Analyst',
            }}
          />

          {/* AI Status Window */}
          <AIStatusWindow
            isOpen={true}
            status={aiStatus}
            onRetry={retryAIEngine}
            onStartEngine={startAIEngine}
            onStopEngine={stopAIEngine}
          />
        </div>
      </ErrorBoundary>
    </XPThemeProvider>
  );
};

export default App;
