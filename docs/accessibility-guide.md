# Accessibility Guide

## Overview

This guide documents the comprehensive accessibility implementation for the XP Desktop Environment, ensuring full WCAG 2.1 Level AA compliance while maintaining authentic Windows XP aesthetics.

## Core Principle: Adaptive Authenticity

Our accessibility approach follows the **Adaptive Authenticity** principle:
- **Primary Goal**: Full WCAG 2.1 Level AA compliance
- **Secondary Goal**: Maintain authentic XP visual experience
- **Conflict Resolution**: Accessibility always takes precedence over visual authenticity

## WCAG 2.1 AA Compliance

### Implemented Standards

#### 1. Perceivable
- **1.1.1 Non-text Content**: All images, icons, and decorative elements have appropriate alternative text or are marked as presentational
- **1.3.1 Info and Relationships**: Proper semantic HTML structure with ARIA landmarks and relationships
- **1.4.3 Contrast (Minimum)**: 4.5:1 contrast ratio for normal text, 3:1 for large text and UI elements
- **1.4.11 Non-text Contrast**: UI components and graphical objects meet 3:1 contrast ratio

#### 2. Operable
- **2.1.1 Keyboard**: All functionality is available via keyboard navigation
- **2.1.2 No Keyboard Trap**: Proper focus management prevents keyboard traps
- **2.4.3 Focus Order**: Logical tab order throughout the application
- **2.4.7 Focus Visible**: Visible focus indicators on all interactive elements

#### 3. Understandable
- **3.2.2 On Input**: No unexpected context changes when interacting with form controls
- **3.3.1 Error Identification**: Clear, descriptive error messages for form validation
- **3.3.2 Labels or Instructions**: Proper labels and instructions for all form controls

#### 4. Robust
- **4.1.2 Name, Role, Value**: Proper ARIA implementation for all custom components

## Component Accessibility

### Shell Components

#### DesktopCanvas
- **Role**: `main` with `aria-label="Desktop"`
- **Keyboard Navigation**: Arrow keys for icon navigation, Enter/Space for activation
- **Screen Reader**: Live region announcements for selection changes
- **Focus Management**: Visible focus indicators on desktop icons

#### Taskbar
- **Role**: `toolbar` with `aria-label="Taskbar"`
- **Keyboard Navigation**: Tab navigation through Start button and task buttons
- **Screen Reader**: Proper button labels and pressed states
- **Time Announcement**: Clock updates announced to screen readers

#### StartMenu
- **Role**: `menu` with proper `menuitem` children
- **Focus Trapping**: Focus contained within menu when open
- **Keyboard Navigation**: Arrow keys for menu navigation, Escape to close
- **Screen Reader**: Proper menu structure with shortcuts announced

#### WindowFrame
- **Role**: `dialog` with `aria-labelledby` referencing window title
- **Focus Management**: Focus trapping within window, restoration on close
- **Keyboard Shortcuts**: Alt+F4 to close, proper window controls
- **Resize Accessibility**: Keyboard-accessible resize handles

### UI Components

#### Button System
- **Semantic HTML**: Proper `button` elements with accessible names
- **Keyboard Support**: Enter and Space key activation
- **States**: Proper `aria-pressed` for toggle buttons, `aria-disabled` for disabled state
- **Focus Indicators**: Visible focus outlines meeting contrast requirements

#### Menu System
- **ARIA Patterns**: Proper `menu`/`menuitem` roles with `menubar` for top-level menus
- **Keyboard Navigation**: Arrow keys for navigation, Enter/Space for activation
- **Submenus**: Proper `aria-haspopup` and `aria-expanded` states
- **Separators**: Semantic `separator` role for menu dividers

#### Form Controls
- **Label Association**: Proper `label` elements or `aria-labelledby`
- **Error Handling**: `aria-invalid` and `aria-describedby` for error messages
- **Required Fields**: `aria-required` and visual indicators
- **Help Text**: Associated via `aria-describedby`

#### Dialog System
- **Modal Behavior**: `aria-modal="true"` and focus trapping
- **Labeling**: `aria-labelledby` referencing dialog title
- **Backdrop**: Proper backdrop click handling with escape key support
- **Focus Restoration**: Return focus to trigger element on close

## Testing Infrastructure

### Automated Testing

#### axe-core Integration
```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

it('should pass axe accessibility tests', async () => {
  const { container } = render(<Component />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

#### Custom Test Utilities
- **Color Contrast**: Automated contrast ratio validation
- **Keyboard Navigation**: Tab order and activation testing
- **Focus Management**: Focus trapping and restoration validation
- **Screen Reader**: ARIA attribute and semantic structure testing

### Manual Testing Procedures

#### Screen Reader Testing
1. **NVDA**: Primary screen reader for testing
2. **JAWS**: Secondary validation
3. **Windows Narrator**: Built-in screen reader compatibility

#### Keyboard Navigation Testing
1. **Tab Order**: Verify logical navigation sequence
2. **Activation**: Test Enter and Space key functionality
3. **Shortcuts**: Validate keyboard shortcuts don't conflict
4. **Focus Trapping**: Ensure proper modal behavior

#### High Contrast Testing
1. **Windows High Contrast**: Test all high contrast themes
2. **Forced Colors**: Validate forced colors mode compatibility
3. **Custom Themes**: Test with user-defined high contrast settings

## Development Guidelines

### Component Development

#### ARIA Best Practices
```typescript
// Proper button with accessible name
<button aria-label="Close window" onClick={onClose}>
  <CloseIcon aria-hidden="true" />
</button>

// Form input with label and error
<div>
  <label htmlFor="username">Username</label>
  <input
    id="username"
    aria-required="true"
    aria-invalid={!!error}
    aria-describedby={error ? "username-error" : undefined}
  />
  {error && <div id="username-error" role="alert">{error}</div>}
</div>
```

#### Focus Management
```typescript
// Focus trapping in modals
useEffect(() => {
  if (isOpen && modalRef.current) {
    const cleanup = trapFocus(modalRef.current);
    return cleanup;
  }
}, [isOpen]);

// Focus restoration
useEffect(() => {
  const previousFocus = document.activeElement;
  return () => {
    if (previousFocus instanceof HTMLElement) {
      previousFocus.focus();
    }
  };
}, []);
```

#### Color Contrast
```css
/* Ensure minimum 4.5:1 contrast for normal text */
.text-primary {
  color: #000000; /* Black text */
  background-color: #ffffff; /* White background */
  /* Contrast ratio: 21:1 (exceeds requirement) */
}

/* Ensure minimum 3:1 contrast for UI elements */
.button-primary {
  color: #ffffff; /* White text */
  background-color: #0066cc; /* Blue background */
  /* Contrast ratio: 4.5:1 (exceeds requirement) */
}
```

### Testing Guidelines

#### Writing Accessibility Tests
```typescript
describe('Component Accessibility', () => {
  it('should pass axe accessibility tests', async () => {
    const { container } = render(<Component />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should support keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<Component />);
    
    const button = screen.getByRole('button');
    button.focus();
    
    await user.keyboard('{Enter}');
    expect(mockCallback).toHaveBeenCalled();
  });

  it('should have proper ARIA attributes', () => {
    render(<Component />);
    
    const element = screen.getByRole('button');
    expect(element).toHaveAttribute('aria-label', 'Expected Label');
  });
});
```

## Running Accessibility Tests

### Command Line
```bash
# Run all accessibility tests
npm run test:a11y

# Run accessibility tests in watch mode
npm run test:a11y:watch

# Run accessibility tests with coverage
npm run test:a11y:coverage
```

### Continuous Integration
Accessibility tests are integrated into the CI/CD pipeline and must pass before code can be merged.

## Browser Support

### Screen Readers
- **NVDA** (Windows) - Primary support
- **JAWS** (Windows) - Secondary support
- **Windows Narrator** - Built-in support
- **VoiceOver** (macOS) - Future consideration

### Assistive Technologies
- **Voice Control Software** - Dragon NaturallySpeaking compatibility
- **Switch Navigation** - Support for switch-based navigation devices
- **Eye Tracking** - Compatible with eye-tracking software

## Maintenance

### Regular Testing
- **Weekly**: Automated accessibility test runs
- **Monthly**: Manual screen reader testing
- **Quarterly**: Full accessibility audit

### Updates and Improvements
- Monitor WCAG guideline updates
- Incorporate user feedback from accessibility community
- Regular review of assistive technology compatibility

## Resources

### Documentation
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [axe-core Documentation](https://github.com/dequelabs/axe-core)

### Tools
- **axe DevTools**: Browser extension for accessibility testing
- **WAVE**: Web accessibility evaluation tool
- **Lighthouse**: Built-in accessibility auditing

### Community
- **WebAIM**: Web accessibility resources and training
- **A11Y Project**: Community-driven accessibility resources
- **Deque University**: Accessibility training and certification

---

*This guide is maintained as part of Story 1.6 implementation and should be updated as accessibility features evolve.*
