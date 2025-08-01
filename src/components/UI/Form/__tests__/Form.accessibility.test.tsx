/**
 * Form Components Accessibility Tests
 * Comprehensive WCAG AA compliance testing for Form components
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { TextInput, Checkbox, RadioButton, Select, Textarea } from '../';
import { a11yTestSuite, keyboardTestUtils, screenReaderTestUtils, focusTestUtils, colorContrastUtils } from '../../../../test/accessibility-utils';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('Form Components Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('TextInput Component', () => {
    const mockOnChange = vi.fn();

    it('should pass axe accessibility tests', async () => {
      const { container } = render(
        <TextInput
          label="Username"
          value=""
          onChange={mockOnChange}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should run complete accessibility audit', async () => {
      const renderResult = render(
        <TextInput
          label="Username"
          value=""
          onChange={mockOnChange}
        />
      );
      await a11yTestSuite.runCompleteAudit(renderResult);
    });

    it('should have proper label association', () => {
      render(
        <TextInput
          label="Username"
          value=""
          onChange={mockOnChange}
        />
      );
      
      const input = screen.getByRole('textbox');
      const label = screen.getByText('Username');
      
      expect(input).toHaveAccessibleName('Username');
      expect(label).toBeInTheDocument();
      
      // Check for proper label association
      const labelElement = label.closest('label');
      expect(labelElement).toHaveAttribute('for', input.id);
    });

    it('should support required field indication', async () => {
      render(
        <TextInput
          label="Username"
          value=""
          onChange={mockOnChange}
          required
        />
      );
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-required', 'true');
      expect(input).toBeRequired();
      
      const { container } = render(
        <TextInput
          label="Username"
          value=""
          onChange={mockOnChange}
          required
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should handle error states properly', async () => {
      const errorMessage = 'Username is required';
      render(
        <TextInput
          label="Username"
          value=""
          onChange={mockOnChange}
          error={errorMessage}
        />
      );
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      
      const errorElement = screen.getByText(errorMessage);
      expect(errorElement).toBeInTheDocument();
      expect(input).toHaveAttribute('aria-describedby', errorElement.id);
      
      const { container } = render(
        <TextInput
          label="Username"
          value=""
          onChange={mockOnChange}
          error={errorMessage}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support help text', () => {
      const helpText = 'Enter your username';
      render(
        <TextInput
          label="Username"
          value=""
          onChange={mockOnChange}
          helpText={helpText}
        />
      );
      
      const input = screen.getByRole('textbox');
      const helpElement = screen.getByText(helpText);
      
      expect(helpElement).toBeInTheDocument();
      expect(input).toHaveAttribute('aria-describedby', helpElement.id);
    });

    it('should support multiline (textarea) mode', async () => {
      render(
        <TextInput
          label="Description"
          value=""
          onChange={mockOnChange}
          multiline
          rows={4}
        />
      );
      
      const textarea = screen.getByRole('textbox');
      expect(textarea.tagName).toBe('TEXTAREA');
      expect(textarea).toHaveAttribute('rows', '4');
      
      const { container } = render(
        <TextInput
          label="Description"
          value=""
          onChange={mockOnChange}
          multiline
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have visible focus indicators', () => {
      render(
        <TextInput
          label="Username"
          value=""
          onChange={mockOnChange}
        />
      );
      
      const input = screen.getByRole('textbox');
      focusTestUtils.validateFocusIndicators(input);
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(
        <TextInput
          label="Username"
          value=""
          onChange={mockOnChange}
        />
      );
      
      const input = screen.getByRole('textbox');
      
      await user.click(input);
      expect(document.activeElement).toBe(input);
      
      await user.type(input, 'test');
      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  describe('Checkbox Component', () => {
    const mockOnChange = jest.fn();

    it('should pass axe accessibility tests', async () => {
      const { container } = render(
        <Checkbox
          label="Accept terms"
          checked={false}
          onChange={mockOnChange}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper label association', () => {
      render(
        <Checkbox
          label="Accept terms"
          checked={false}
          onChange={mockOnChange}
        />
      );
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAccessibleName('Accept terms');
      
      const label = screen.getByText('Accept terms');
      const labelElement = label.closest('label');
      expect(labelElement).toHaveAttribute('for', checkbox.id);
    });

    it('should support indeterminate state', async () => {
      render(
        <Checkbox
          label="Select all"
          checked={false}
          indeterminate={true}
          onChange={mockOnChange}
        />
      );
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'mixed');
      
      const { container } = render(
        <Checkbox
          label="Select all"
          checked={false}
          indeterminate={true}
          onChange={mockOnChange}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard activation', async () => {
      const user = userEvent.setup();
      render(
        <Checkbox
          label="Accept terms"
          checked={false}
          onChange={mockOnChange}
        />
      );
      
      const checkbox = screen.getByRole('checkbox');
      checkbox.focus();
      
      await user.keyboard(' ');
      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should have visible focus indicators', () => {
      render(
        <Checkbox
          label="Accept terms"
          checked={false}
          onChange={mockOnChange}
        />
      );
      
      const checkbox = screen.getByRole('checkbox');
      focusTestUtils.validateFocusIndicators(checkbox);
    });

    it('should handle disabled state properly', async () => {
      render(
        <Checkbox
          label="Accept terms"
          checked={false}
          onChange={mockOnChange}
          disabled
        />
      );
      
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeDisabled();
      expect(checkbox).toHaveAttribute('aria-disabled', 'true');
      
      const { container } = render(
        <Checkbox
          label="Accept terms"
          checked={false}
          onChange={mockOnChange}
          disabled
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('RadioButton Component', () => {
    const mockOnChange = jest.fn();

    it('should pass axe accessibility tests', async () => {
      const { container } = render(
        <div role="radiogroup" aria-labelledby="size-label">
          <div id="size-label">Size</div>
          <RadioButton
            name="size"
            value="small"
            label="Small"
            checked={false}
            onChange={mockOnChange}
          />
          <RadioButton
            name="size"
            value="medium"
            label="Medium"
            checked={true}
            onChange={mockOnChange}
          />
          <RadioButton
            name="size"
            value="large"
            label="Large"
            checked={false}
            onChange={mockOnChange}
          />
        </div>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper label association', () => {
      render(
        <RadioButton
          name="size"
          value="small"
          label="Small"
          checked={false}
          onChange={mockOnChange}
        />
      );
      
      const radio = screen.getByRole('radio');
      expect(radio).toHaveAccessibleName('Small');
      
      const label = screen.getByText('Small');
      const labelElement = label.closest('label');
      expect(labelElement).toHaveAttribute('for', radio.id);
    });

    it('should support keyboard navigation within group', async () => {
      const user = userEvent.setup();
      render(
        <div role="radiogroup">
          <RadioButton
            name="size"
            value="small"
            label="Small"
            checked={false}
            onChange={mockOnChange}
          />
          <RadioButton
            name="size"
            value="medium"
            label="Medium"
            checked={true}
            onChange={mockOnChange}
          />
          <RadioButton
            name="size"
            value="large"
            label="Large"
            checked={false}
            onChange={mockOnChange}
          />
        </div>
      );
      
      const radios = screen.getAllByRole('radio');
      
      // Focus first radio
      radios[0].focus();
      expect(document.activeElement).toBe(radios[0]);
      
      // Arrow down to next radio
      await user.keyboard('{ArrowDown}');
      expect(document.activeElement).toBe(radios[1]);
      
      // Arrow up to previous radio
      await user.keyboard('{ArrowUp}');
      expect(document.activeElement).toBe(radios[0]);
    });

    it('should have visible focus indicators', () => {
      render(
        <RadioButton
          name="size"
          value="small"
          label="Small"
          checked={false}
          onChange={mockOnChange}
        />
      );
      
      const radio = screen.getByRole('radio');
      focusTestUtils.validateFocusIndicators(radio);
    });
  });

  describe('Select Component', () => {
    const mockOnChange = jest.fn();
    const options = [
      { value: 'option1', label: 'Option 1' },
      { value: 'option2', label: 'Option 2' },
      { value: 'option3', label: 'Option 3' },
    ];

    it('should pass axe accessibility tests', async () => {
      const { container } = render(
        <Select
          label="Choose option"
          value=""
          onChange={mockOnChange}
          options={options}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper label association', () => {
      render(
        <Select
          label="Choose option"
          value=""
          onChange={mockOnChange}
          options={options}
        />
      );
      
      const select = screen.getByRole('combobox');
      expect(select).toHaveAccessibleName('Choose option');
      
      const label = screen.getByText('Choose option');
      const labelElement = label.closest('label');
      expect(labelElement).toHaveAttribute('for', select.id);
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(
        <Select
          label="Choose option"
          value=""
          onChange={mockOnChange}
          options={options}
        />
      );
      
      const select = screen.getByRole('combobox');
      select.focus();
      
      // Arrow down to open and navigate
      await user.keyboard('{ArrowDown}');
      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should have visible focus indicators', () => {
      render(
        <Select
          label="Choose option"
          value=""
          onChange={mockOnChange}
          options={options}
        />
      );
      
      const select = screen.getByRole('combobox');
      focusTestUtils.validateFocusIndicators(select);
    });

    it('should handle error states properly', async () => {
      const errorMessage = 'Please select an option';
      render(
        <Select
          label="Choose option"
          value=""
          onChange={mockOnChange}
          options={options}
          error={errorMessage}
        />
      );
      
      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-invalid', 'true');
      
      const errorElement = screen.getByText(errorMessage);
      expect(errorElement).toBeInTheDocument();
      expect(select).toHaveAttribute('aria-describedby', errorElement.id);
      
      const { container } = render(
        <Select
          label="Choose option"
          value=""
          onChange={mockOnChange}
          options={options}
          error={errorMessage}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Textarea Component', () => {
    const mockOnChange = jest.fn();

    it('should pass axe accessibility tests', async () => {
      const { container } = render(
        <Textarea
          label="Comments"
          value=""
          onChange={mockOnChange}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper label association', () => {
      render(
        <Textarea
          label="Comments"
          value=""
          onChange={mockOnChange}
        />
      );
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAccessibleName('Comments');
      expect(textarea.tagName).toBe('TEXTAREA');
      
      const label = screen.getByText('Comments');
      const labelElement = label.closest('label');
      expect(labelElement).toHaveAttribute('for', textarea.id);
    });

    it('should support resize controls accessibly', () => {
      render(
        <Textarea
          label="Comments"
          value=""
          onChange={mockOnChange}
          resize="both"
        />
      );
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveStyle('resize: both');
    });

    it('should have visible focus indicators', () => {
      render(
        <Textarea
          label="Comments"
          value=""
          onChange={mockOnChange}
        />
      );
      
      const textarea = screen.getByRole('textbox');
      focusTestUtils.validateFocusIndicators(textarea);
    });
  });

  describe('High Contrast and User Preferences', () => {
    it('should support high contrast mode for all form components', () => {
      const components = [
        { component: TextInput, props: { label: 'Text', value: '', onChange: jest.fn() } },
        { component: Checkbox, props: { label: 'Check', checked: false, onChange: jest.fn() } },
        { component: RadioButton, props: { name: 'radio', value: 'test', label: 'Radio', checked: false, onChange: jest.fn() } },
        { component: Select, props: { label: 'Select', value: '', onChange: jest.fn(), options: [] } },
        { component: Textarea, props: { label: 'Textarea', value: '', onChange: jest.fn() } },
      ];

      components.forEach(({ component: Component, props }) => {
        const { container } = render(<Component {...props} />);
        
        // Simulate high contrast mode
        container.classList.add('high-contrast-mode');
        
        const input = container.querySelector('input, select, textarea');
        if (input) {
          const styles = window.getComputedStyle(input);
          expect(styles.backgroundColor).not.toBe('transparent');
          expect(styles.color).not.toBe('transparent');
        }
      });
    });

    it('should validate color contrast for form components', () => {
      render(
        <TextInput
          label="Username"
          value=""
          onChange={jest.fn()}
        />
      );
      
      const input = screen.getByRole('textbox');
      const colors = colorContrastUtils.extractColorsFromElement(input);
      
      if (colors.color && colors.backgroundColor) {
        const validation = colorContrastUtils.validateWCAGContrast(
          colors.color,
          colors.backgroundColor
        );
        expect(validation.isValid).toBe(true);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle form components without labels', async () => {
      // This should be caught by accessibility testing
      const { container } = render(
        <input type="text" onChange={jest.fn()} />
      );
      
      const results = await axe(container);
      // This should have violations due to missing label
      expect(results.violations.length).toBeGreaterThan(0);
    });

    it('should handle empty options in Select', async () => {
      const { container } = render(
        <Select
          label="Choose option"
          value=""
          onChange={jest.fn()}
          options={[]}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should handle missing onChange handlers gracefully', async () => {
      const { container } = render(
        <TextInput
          label="Username"
          value=""
          onChange={undefined as any}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
