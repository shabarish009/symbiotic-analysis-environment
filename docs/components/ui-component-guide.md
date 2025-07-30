# XP UI Component Library Guide

## Overview

This guide provides comprehensive documentation for the Windows XP UI component library. All components are designed to match authentic XP styling while maintaining WCAG AA accessibility compliance.

## Design Principles

### Adaptive Authenticity
- **Primary Goal**: Pixel-perfect XP visual authenticity
- **Secondary Goal**: Modern accessibility standards (WCAG AA)
- **Conflict Resolution**: Accessibility overrides retro aesthetics when necessary

### Visual Benchmark
- **Reference**: https://mitchivin.com/
- **Theme**: Windows XP Luna (Blue) theme
- **Typography**: Tahoma 8pt (10.67px) for UI elements

## Component Categories

### Button Components

#### Button
The primary button component with multiple variants and states.

**Variants:**
- `default` - Standard XP button with raised 3D effect
- `primary` - Blue gradient button for primary actions
- `secondary` - Silver gradient button for secondary actions
- `icon` - Transparent button for icon-only interactions
- `toolbar` - Flat button for toolbar usage

**States:**
- Normal, hover, active, disabled, loading, pressed (for toggles)

**Usage:**
```tsx
import { Button } from '@/components/UI';

<Button variant="primary" size="medium" onClick={handleClick}>
  Save Changes
</Button>
```

#### ButtonGroup
Groups multiple buttons together with proper XP styling.

**Features:**
- Horizontal and vertical orientation
- Automatic border management between buttons
- Consistent sizing across grouped buttons

#### IconButton
Specialized button for icon-only interactions.

**Features:**
- Requires `aria-label` for accessibility
- Automatic tooltip support
- Optimized sizing for icons

#### ToolbarButton
Flat button variant optimized for toolbar usage.

**Features:**
- Minimal visual weight when inactive
- Proper hover and active states
- Consistent with XP toolbar patterns

### Menu Components

#### Menu & MenuItem
Basic menu container and item components.

**Features:**
- Authentic XP menu styling with 3D borders
- Icon and keyboard shortcut support
- Proper focus management and keyboard navigation
- Separator support

#### MenuBar
Application-level menu bar component.

**Features:**
- Horizontal menu layout
- Dropdown menu support
- Keyboard navigation (Arrow keys, Enter, Escape)
- Proper ARIA roles and states

#### ContextMenu
Right-click context menu component.

**Features:**
- Portal-based rendering for proper z-index
- Automatic viewport positioning
- Click-outside and Escape key handling
- Smooth slide-down animation

### Form Components

#### TextInput
Standard text input with XP sunken 3D styling.

**Features:**
- Label, error, and helper text support
- Required field indicators
- Multiline support (textarea mode)
- Proper focus states and validation styling

#### Checkbox
XP-styled checkbox with authentic checkmark.

**Features:**
- Custom XP checkmark styling
- Indeterminate state support
- Label association for accessibility
- Error state styling

#### RadioButton & RadioGroup
Radio button components with proper grouping.

**Features:**
- Authentic XP radio button styling
- Automatic group management
- Keyboard navigation within groups
- Proper ARIA relationships

#### Select
Dropdown select component with XP styling.

**Features:**
- Custom dropdown arrow
- Option grouping support
- Placeholder text support
- Keyboard navigation

#### Textarea
Multi-line text input with XP styling.

**Features:**
- Resizable (vertical, horizontal, both, none)
- Proper XP sunken border styling
- Label and validation support
- Character count support (optional)

### Dialog Components

#### Dialog
Base modal dialog component.

**Features:**
- XP window chrome styling
- Focus trapping and management
- Escape key and click-outside handling
- Proper ARIA attributes

#### MessageBox
XP-style message boxes for alerts and confirmations.

**Features:**
- Multiple types (info, warning, error, question)
- Authentic XP icons
- Customizable button layouts
- Promise-based API for easy usage

#### PropertyDialog
Tabbed dialog for settings and configuration.

**Features:**
- Tab-based navigation
- Keyboard navigation between tabs
- OK, Cancel, and Apply button support
- Proper tab panel management

## Styling Guidelines

### 3D Effects
All components use authentic XP 3D border effects:

```css
/* Raised 3D border */
box-shadow: 
  1px 1px 0 #FFFFFF inset,
  -1px -1px 0 #808080 inset;

/* Sunken 3D border */
box-shadow: 
  -1px -1px 0 #FFFFFF inset,
  1px 1px 0 #808080 inset;
```

### Color Palette
- **Primary Blue**: #3B77BC
- **Light Blue**: #4A90E2
- **Dark Blue**: #0054E3
- **Silver**: #ECE9D8
- **Light Gray**: #F0F0F0
- **Medium Gray**: #C0C0C0
- **Dark Gray**: #808080

### Typography
- **Font Family**: 'Tahoma', 'Segoe UI', 'Arial', sans-serif
- **Font Size**: 10.67px (8pt) for UI elements
- **Font Weight**: Normal (400) for most text, Bold (700) for headers

### Animation Timings
- **Button Press**: Immediate (0ms)
- **Menu Slide**: 150ms ease-out
- **Dialog Appear**: 200ms ease-out
- **Tooltip Show**: 500ms delay

## Accessibility Features

### Keyboard Navigation
- All interactive elements are keyboard accessible
- Proper tab order and focus management
- Arrow key navigation for menus and radio groups
- Escape key handling for modals and menus

### Screen Reader Support
- Proper ARIA labels, roles, and properties
- Semantic HTML structure
- Descriptive error messages
- Live region updates for dynamic content

### High Contrast Support
- Automatic high contrast mode detection
- System color usage in high contrast mode
- Maintained functionality across all contrast levels

### Reduced Motion Support
- Respects `prefers-reduced-motion` setting
- Disables animations when requested
- Maintains functionality without animations

## Usage Examples

### Basic Form
```tsx
import { TextInput, Checkbox, Button, ButtonGroup } from '@/components/UI';

function SettingsForm() {
  return (
    <form>
      <TextInput
        label="Username"
        required
        helperText="Enter your display name"
      />
      
      <Checkbox label="Remember me" />
      
      <ButtonGroup>
        <Button variant="primary" type="submit">
          Save
        </Button>
        <Button variant="default" type="button">
          Cancel
        </Button>
      </ButtonGroup>
    </form>
  );
}
```

### Context Menu
```tsx
import { ContextMenu } from '@/components/UI';

function FileExplorer() {
  const [contextMenu, setContextMenu] = useState(null);
  
  const contextMenuItems = [
    { id: 'copy', label: 'Copy', shortcut: 'Ctrl+C' },
    { id: 'paste', label: 'Paste', shortcut: 'Ctrl+V' },
    { id: 'separator', separator: true },
    { id: 'delete', label: 'Delete', shortcut: 'Del' },
  ];
  
  return (
    <div onContextMenu={handleContextMenu}>
      {/* File list */}
      
      {contextMenu && (
        <ContextMenu
          items={contextMenuItems}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onItemSelect={handleItemSelect}
        />
      )}
    </div>
  );
}
```

## Testing Guidelines

### Unit Testing
- Test all component variants and states
- Verify accessibility attributes
- Test keyboard navigation
- Validate error handling

### Visual Testing
- Screenshot-based regression testing
- Cross-browser compatibility
- High contrast mode testing
- Responsive behavior validation

### Integration Testing
- Component interaction testing
- Form submission workflows
- Dialog and menu interactions
- Theme integration verification

## Performance Considerations

### Bundle Size
- Tree-shakeable exports
- Minimal dependencies
- Optimized CSS delivery

### Runtime Performance
- Efficient re-rendering
- Proper memoization
- Minimal DOM manipulation
- Optimized animations

### Accessibility Performance
- Fast focus management
- Efficient screen reader updates
- Minimal layout thrashing
- Smooth keyboard navigation
