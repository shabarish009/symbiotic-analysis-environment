/**
 * Window Animation Utilities
 * Handles smooth animations for window operations
 */

export interface AnimationConfig {
  duration: number;
  easing: string;
  delay?: number;
}

export const ANIMATION_CONFIGS = {
  windowOpen: {
    duration: 200,
    easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  },
  windowClose: {
    duration: 150,
    easing: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
  },
  windowMinimize: {
    duration: 250,
    easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  },
  windowMaximize: {
    duration: 200,
    easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  },
  windowMove: {
    duration: 100,
    easing: 'ease-out',
  },
  windowResize: {
    duration: 100,
    easing: 'ease-out',
  },
  windowFocus: {
    duration: 150,
    easing: 'ease-out',
  },
};

/**
 * Window animation manager
 */
export class WindowAnimationManager {
  private static instance: WindowAnimationManager;
  private animationFrameId: number | null = null;
  private pendingAnimations: Map<string, Animation> = new Map();

  private constructor() {}

  static getInstance(): WindowAnimationManager {
    if (!WindowAnimationManager.instance) {
      WindowAnimationManager.instance = new WindowAnimationManager();
    }
    return WindowAnimationManager.instance;
  }

  /**
   * Animate window opening
   */
  animateWindowOpen(windowElement: HTMLElement): Promise<void> {
    return new Promise((resolve) => {
      const config = ANIMATION_CONFIGS.windowOpen;
      
      // Set initial state
      windowElement.style.opacity = '0';
      windowElement.style.transform = 'scale(0.8)';
      windowElement.style.transition = `opacity ${config.duration}ms ${config.easing}, transform ${config.duration}ms ${config.easing}`;

      // Trigger animation
      requestAnimationFrame(() => {
        windowElement.style.opacity = '1';
        windowElement.style.transform = 'scale(1)';
      });

      // Clean up after animation
      setTimeout(() => {
        windowElement.style.transition = '';
        resolve();
      }, config.duration);
    });
  }

  /**
   * Animate window closing
   */
  animateWindowClose(windowElement: HTMLElement): Promise<void> {
    return new Promise((resolve) => {
      const config = ANIMATION_CONFIGS.windowClose;
      
      windowElement.style.transition = `opacity ${config.duration}ms ${config.easing}, transform ${config.duration}ms ${config.easing}`;
      windowElement.style.opacity = '0';
      windowElement.style.transform = 'scale(0.8)';

      setTimeout(() => {
        resolve();
      }, config.duration);
    });
  }

  /**
   * Animate window minimizing
   */
  animateWindowMinimize(windowElement: HTMLElement, taskbarPosition: { x: number; y: number }): Promise<void> {
    return new Promise((resolve) => {
      const config = ANIMATION_CONFIGS.windowMinimize;
      const rect = windowElement.getBoundingClientRect();
      
      // Calculate transform to taskbar
      const deltaX = taskbarPosition.x - rect.left - rect.width / 2;
      const deltaY = taskbarPosition.y - rect.top - rect.height / 2;
      
      windowElement.style.transition = `transform ${config.duration}ms ${config.easing}, opacity ${config.duration}ms ${config.easing}`;
      windowElement.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.1)`;
      windowElement.style.opacity = '0';

      setTimeout(() => {
        windowElement.style.display = 'none';
        resolve();
      }, config.duration);
    });
  }

  /**
   * Animate window maximizing
   */
  animateWindowMaximize(windowElement: HTMLElement, fromRect: DOMRect, toRect: DOMRect): Promise<void> {
    return new Promise((resolve) => {
      const config = ANIMATION_CONFIGS.windowMaximize;
      
      // Set initial position
      windowElement.style.transition = `all ${config.duration}ms ${config.easing}`;
      
      // Animate to maximized state
      requestAnimationFrame(() => {
        windowElement.style.left = `${toRect.left}px`;
        windowElement.style.top = `${toRect.top}px`;
        windowElement.style.width = `${toRect.width}px`;
        windowElement.style.height = `${toRect.height}px`;
      });

      setTimeout(() => {
        windowElement.style.transition = '';
        resolve();
      }, config.duration);
    });
  }

  /**
   * Animate window focus change
   */
  animateWindowFocus(windowElement: HTMLElement, isFocused: boolean): void {
    const config = ANIMATION_CONFIGS.windowFocus;
    
    windowElement.style.transition = `box-shadow ${config.duration}ms ${config.easing}`;
    
    if (isFocused) {
      windowElement.style.boxShadow = '0 0 20px rgba(49, 106, 197, 0.3)';
    } else {
      windowElement.style.boxShadow = '';
    }

    setTimeout(() => {
      windowElement.style.transition = '';
    }, config.duration);
  }

  /**
   * Animate smooth window movement
   */
  animateWindowMove(
    windowElement: HTMLElement,
    fromPosition: { x: number; y: number },
    toPosition: { x: number; y: number }
  ): Promise<void> {
    return new Promise((resolve) => {
      const config = ANIMATION_CONFIGS.windowMove;
      
      windowElement.style.transition = `left ${config.duration}ms ${config.easing}, top ${config.duration}ms ${config.easing}`;
      windowElement.style.left = `${toPosition.x}px`;
      windowElement.style.top = `${toPosition.y}px`;

      setTimeout(() => {
        windowElement.style.transition = '';
        resolve();
      }, config.duration);
    });
  }

  /**
   * Animate smooth window resizing
   */
  animateWindowResize(
    windowElement: HTMLElement,
    fromSize: { width: number; height: number },
    toSize: { width: number; height: number }
  ): Promise<void> {
    return new Promise((resolve) => {
      const config = ANIMATION_CONFIGS.windowResize;
      
      windowElement.style.transition = `width ${config.duration}ms ${config.easing}, height ${config.duration}ms ${config.easing}`;
      windowElement.style.width = `${toSize.width}px`;
      windowElement.style.height = `${toSize.height}px`;

      setTimeout(() => {
        windowElement.style.transition = '';
        resolve();
      }, config.duration);
    });
  }

  /**
   * Cancel all animations for a window
   */
  cancelWindowAnimations(windowId: string): void {
    const animation = this.pendingAnimations.get(windowId);
    if (animation) {
      animation.cancel();
      this.pendingAnimations.delete(windowId);
    }
  }

  /**
   * Cancel all animations
   */
  cancelAllAnimations(): void {
    this.pendingAnimations.forEach(animation => animation.cancel());
    this.pendingAnimations.clear();
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Check if reduced motion is preferred
   */
  isReducedMotionPreferred(): boolean {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Get animation duration based on user preferences
   */
  getAnimationDuration(baseConfig: AnimationConfig): number {
    return this.isReducedMotionPreferred() ? 0 : baseConfig.duration;
  }
}

/**
 * Performance monitoring utilities
 */
export class WindowPerformanceMonitor {
  private static instance: WindowPerformanceMonitor;
  private frameCount = 0;
  private lastFrameTime = 0;
  private fps = 0;
  private isMonitoring = false;

  private constructor() {}

  static getInstance(): WindowPerformanceMonitor {
    if (!WindowPerformanceMonitor.instance) {
      WindowPerformanceMonitor.instance = new WindowPerformanceMonitor();
    }
    return WindowPerformanceMonitor.instance;
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
    this.monitorFrame();
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
  }

  /**
   * Get current FPS
   */
  getFPS(): number {
    return this.fps;
  }

  /**
   * Monitor frame performance
   */
  private monitorFrame(): void {
    if (!this.isMonitoring) return;

    const currentTime = performance.now();
    this.frameCount++;

    if (currentTime - this.lastFrameTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFrameTime));
      this.frameCount = 0;
      this.lastFrameTime = currentTime;
    }

    requestAnimationFrame(() => this.monitorFrame());
  }

  /**
   * Log performance warning if FPS is low
   */
  checkPerformance(): void {
    if (this.fps < 30 && this.fps > 0) {
      console.warn(`Window performance warning: FPS is ${this.fps}`);
    }
  }
}
