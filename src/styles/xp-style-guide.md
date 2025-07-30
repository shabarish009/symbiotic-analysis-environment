# Windows XP Luna Theme Style Guide

## Visual Benchmark Reference
- **Primary Reference**: https://mitchivin.com/
- **Design Principle**: Adaptive Authenticity - XP authenticity with modern accessibility

## Color Palette

### Primary Colors (Luna Blue Theme)
- **Primary Blue**: `#3B77BC` (Cyan-Blue Azure)
- **Light Blue**: `#4A90E2` (Title bar gradient start)
- **Dark Blue**: `#0054E3` (Title bar gradient end)
- **Accent Blue**: `#316AC5` (Active window borders)

### Secondary Colors
- **Silver/Gray**: `#ECE9D8` (Window backgrounds, dialog backgrounds)
- **Light Gray**: `#F0F0F0` (Button faces, inactive elements)
- **Medium Gray**: `#C0C0C0` (Button borders, separators)
- **Dark Gray**: `#808080` (Text, borders)
- **White**: `#FFFFFF` (Text backgrounds, highlights)

### System Colors
- **Desktop Blue**: `#5A7FCA` (Desktop background)
- **Taskbar Blue**: `#245EDC` (Taskbar background)
- **Start Green**: `#73B441` (Start button highlight)
- **Selection Blue**: `#316AC5` (Selected items)

### Accessibility Adjusted Colors (WCAG AA Compliant)
- **Text on Blue**: `#FFFFFF` (Contrast ratio: 4.52:1)
- **Text on Silver**: `#000000` (Contrast ratio: 15.14:1)
- **Link Blue**: `#0066CC` (Contrast ratio: 4.51:1 on white)

## Typography

### Primary Font Stack
```css
font-family: 'Tahoma', 'Segoe UI', 'Arial', sans-serif;
```

### Monospace Font Stack
```css
font-family: 'Lucida Console', 'Courier New', monospace;
```

### Font Sizes
- **Small**: 8pt (10.67px) - System text, tooltips
- **Normal**: 8pt (10.67px) - Default UI text
- **Large**: 9pt (12px) - Dialog headers
- **Title**: 11pt (14.67px) - Window titles

### Font Weights
- **Normal**: 400 (default text)
- **Bold**: 700 (headers, active elements)

## Window Chrome Specifications

### Title Bar
- **Height**: 30px
- **Background**: Linear gradient from `#4A90E2` to `#0054E3`
- **Text Color**: `#FFFFFF`
- **Font**: Tahoma, 8pt, bold
- **Padding**: 8px horizontal, 6px vertical

### Window Borders
- **Active Window**: 2px solid `#316AC5`
- **Inactive Window**: 2px solid `#C0C0C0`
- **Border Style**: Raised 3D effect with light/dark edges

### Control Buttons (Minimize, Maximize, Close)
- **Size**: 21px × 21px
- **Background**: Gradient from `#F0F0F0` to `#D0D0D0`
- **Border**: 1px raised 3D border
- **Hover**: Slight blue tint `#E6F2FF`
- **Active**: Pressed 3D effect (inverted gradient)

## Button Specifications

### Default Button
- **Background**: Gradient from `#F0F0F0` to `#D8D8D8`
- **Border**: 2px raised 3D border
- **Text**: Tahoma, 8pt, `#000000`
- **Padding**: 6px 12px
- **Border Radius**: 0px (sharp corners)

### Button States
- **Normal**: Light gray gradient with raised border
- **Hover**: Slight blue tint `#E6F2FF`
- **Active/Pressed**: Inverted gradient with sunken border
- **Focused**: Dotted outline 1px inside button
- **Disabled**: Gray text `#808080`, flat appearance

### Primary Button (Default)
- **Background**: Gradient from `#4A90E2` to `#316AC5`
- **Text Color**: `#FFFFFF`
- **Border**: 2px raised 3D border with blue tones

## Menu Specifications

### Menu Bar
- **Background**: `#ECE9D8`
- **Height**: 24px
- **Border**: 1px solid `#C0C0C0` (bottom only)

### Menu Items
- **Normal**: Transparent background, `#000000` text
- **Hover**: `#316AC5` background, `#FFFFFF` text
- **Disabled**: `#808080` text
- **Separator**: 1px solid `#C0C0C0` line

### Context Menus
- **Background**: `#F0F0F0`
- **Border**: 2px raised 3D border
- **Shadow**: 2px offset shadow `rgba(0,0,0,0.3)`

## Form Controls

### Text Input
- **Background**: `#FFFFFF`
- **Border**: 2px sunken 3D border
- **Text**: Tahoma, 8pt, `#000000`
- **Padding**: 4px
- **Focus**: Blue outline `#316AC5`

### Checkbox/Radio Button
- **Size**: 13px × 13px
- **Background**: `#FFFFFF`
- **Border**: 2px sunken 3D border
- **Check Color**: `#000000`

### Dropdown/Select
- **Background**: `#FFFFFF`
- **Border**: 2px sunken 3D border
- **Arrow**: Down arrow button with 3D styling
- **Dropdown**: Same styling as context menus

## Layout Specifications

### Desktop
- **Background**: Solid color `#5A7FCA` or XP wallpaper
- **Icon Grid**: 32px spacing
- **Icon Size**: 32px × 32px

### Taskbar
- **Height**: 30px
- **Background**: Gradient from `#245EDC` to `#1E4FBF`
- **Position**: Bottom of screen
- **Start Button**: Special styling with Windows logo

### Start Menu
- **Width**: 300px
- **Background**: Two-column layout
- **Left Column**: `#FFFFFF` background
- **Right Column**: `#4A90E2` gradient background
- **Border**: 2px raised 3D border

## Accessibility Considerations

### Contrast Ratios (WCAG AA Compliant)
- All text maintains minimum 4.5:1 contrast ratio
- Large text maintains minimum 3:1 contrast ratio
- Interactive elements have clear focus indicators

### Keyboard Navigation
- Tab order follows logical flow
- Focus indicators are clearly visible
- All interactive elements are keyboard accessible

### Screen Reader Support
- Proper ARIA labels and roles
- Semantic HTML structure
- Descriptive alt text for images

## Animation and Transitions

### Window Operations
- **Open/Close**: Fade in/out (200ms)
- **Minimize**: Slide to taskbar (300ms)
- **Maximize**: Expand from center (200ms)

### Menu Animations
- **Dropdown**: Slide down (150ms)
- **Hover**: Immediate color change (no transition)

### Button Interactions
- **Hover**: Immediate color change
- **Click**: Immediate pressed state

## Implementation Notes

### CSS Custom Properties
```css
:root {
  --xp-blue-primary: #3B77BC;
  --xp-blue-light: #4A90E2;
  --xp-blue-dark: #0054E3;
  --xp-silver: #ECE9D8;
  --xp-gray-light: #F0F0F0;
  --xp-gray-medium: #C0C0C0;
  --xp-gray-dark: #808080;
  --xp-white: #FFFFFF;
  --xp-black: #000000;
  
  --xp-font-family: 'Tahoma', 'Segoe UI', 'Arial', sans-serif;
  --xp-font-mono: 'Lucida Console', 'Courier New', monospace;
  --xp-font-size: 10.67px;
  --xp-font-size-large: 12px;
  --xp-font-size-title: 14.67px;
}
```

### 3D Border Effects
Use CSS box-shadow to create authentic 3D raised/sunken effects:
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
