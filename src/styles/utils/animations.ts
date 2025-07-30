/**
 * XP Animation Utilities
 * Authentic Windows XP animation timings and easing functions
 */

// XP Animation Timings (in milliseconds)
export const XP_TIMINGS = {
  // Button interactions
  buttonPress: 0, // Immediate
  buttonHover: 0, // Immediate
  
  // Menu animations
  menuSlideDown: 150,
  menuFadeIn: 150,
  menuFadeOut: 100,
  
  // Dialog animations
  dialogAppear: 200,
  dialogDisappear: 150,
  
  // Window operations
  windowOpen: 200,
  windowClose: 200,
  windowMinimize: 300,
  windowMaximize: 200,
  
  // Tooltip
  tooltipShow: 500,
  tooltipHide: 100,
  
  // Focus indicators
  focusAppear: 0, // Immediate
} as const;

// XP Easing Functions
export const XP_EASING = {
  // Standard easing for most animations
  standard: 'ease-out',
  
  // Menu animations
  menuSlide: 'ease-out',
  menuFade: 'ease-out',
  
  // Dialog animations
  dialogScale: 'ease-out',
  
  // Window animations
  windowSlide: 'ease-out',
  windowScale: 'ease-out',
} as const;

// CSS Animation Classes
export const XP_ANIMATIONS = {
  // Fade animations
  fadeIn: 'xp-fade-in',
  fadeOut: 'xp-fade-out',
  
  // Slide animations
  slideDown: 'xp-slide-down',
  slideUp: 'xp-slide-up',
  slideLeft: 'xp-slide-left',
  slideRight: 'xp-slide-right',
  
  // Scale animations
  scaleIn: 'xp-scale-in',
  scaleOut: 'xp-scale-out',
  
  // Button press animation
  buttonPress: 'xp-button-press',
} as const;

// Animation utility functions
export const animationUtils = {
  /**
   * Create a CSS animation string
   */
  createAnimation: (
    name: string,
    duration: number,
    easing: string = XP_EASING.standard,
    delay: number = 0,
    fillMode: string = 'both'
  ): string => {
    return `${name} ${duration}ms ${easing} ${delay}ms ${fillMode}`;
  },

  /**
   * Apply animation with proper XP timing
   */
  applyXPAnimation: (
    element: HTMLElement,
    animationType: keyof typeof XP_ANIMATIONS,
    onComplete?: () => void
  ): void => {
    const animationClass = XP_ANIMATIONS[animationType];
    element.classList.add(animationClass);

    if (onComplete) {
      const handleAnimationEnd = () => {
        element.removeEventListener('animationend', handleAnimationEnd);
        element.classList.remove(animationClass);
        onComplete();
      };
      element.addEventListener('animationend', handleAnimationEnd);
    }
  },

  /**
   * Remove all XP animation classes
   */
  clearAnimations: (element: HTMLElement): void => {
    Object.values(XP_ANIMATIONS).forEach(className => {
      element.classList.remove(className);
    });
  },

  /**
   * Check if reduced motion is preferred
   */
  prefersReducedMotion: (): boolean => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },

  /**
   * Get animation duration with reduced motion support
   */
  getDuration: (duration: number): number => {
    return animationUtils.prefersReducedMotion() ? 0 : duration;
  },
} as const;

// CSS Custom Properties for animations
export const XP_ANIMATION_CSS_VARS = {
  '--xp-timing-button-press': `${XP_TIMINGS.buttonPress}ms`,
  '--xp-timing-button-hover': `${XP_TIMINGS.buttonHover}ms`,
  '--xp-timing-menu-slide': `${XP_TIMINGS.menuSlideDown}ms`,
  '--xp-timing-menu-fade': `${XP_TIMINGS.menuFadeIn}ms`,
  '--xp-timing-dialog-appear': `${XP_TIMINGS.dialogAppear}ms`,
  '--xp-timing-window-open': `${XP_TIMINGS.windowOpen}ms`,
  '--xp-timing-tooltip-show': `${XP_TIMINGS.tooltipShow}ms`,
  
  '--xp-easing-standard': XP_EASING.standard,
  '--xp-easing-menu': XP_EASING.menuSlide,
  '--xp-easing-dialog': XP_EASING.dialogScale,
  '--xp-easing-window': XP_EASING.windowSlide,
} as const;

// Type definitions
export type XPTiming = keyof typeof XP_TIMINGS;
export type XPEasing = keyof typeof XP_EASING;
export type XPAnimation = keyof typeof XP_ANIMATIONS;
