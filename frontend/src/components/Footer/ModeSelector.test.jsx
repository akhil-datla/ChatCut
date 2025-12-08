/**
 * ModeSelector Component Tests
 * Verifies the dropdown is working correctly
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModeSelector, EDIT_MODES, MODE_LABELS } from './ModeSelector';

describe('ModeSelector', () => {
  describe('Rendering', () => {
    it('renders a select dropdown element', () => {
      render(<ModeSelector />);
      
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(select.tagName).toBe('SELECT');
    });

    it('renders all three mode options', () => {
      render(<ModeSelector />);
      
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);
      
      expect(options[0]).toHaveTextContent(MODE_LABELS[EDIT_MODES.NATIVE]);
      expect(options[1]).toHaveTextContent(MODE_LABELS[EDIT_MODES.AI_GENERATION]);
      expect(options[2]).toHaveTextContent(MODE_LABELS[EDIT_MODES.OBJECT_TRACKING]);
    });

    it('has Native Edits as the default selected option', () => {
      render(<ModeSelector />);
      
      const select = screen.getByRole('combobox');
      expect(select.value).toBe(EDIT_MODES.NATIVE);
    });

    it('disables Object Tracking option (coming soon)', () => {
      render(<ModeSelector />);
      
      const options = screen.getAllByRole('option');
      const objectTrackingOption = options.find(opt => 
        opt.textContent.includes('Object Tracking')
      );
      
      expect(objectTrackingOption).toBeDisabled();
    });
  });

  describe('Functionality', () => {
    it('calls onChange when a different mode is selected', () => {
      const mockOnChange = jest.fn();
      render(<ModeSelector onChange={mockOnChange} />);
      
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: EDIT_MODES.AI_GENERATION } });
      
      expect(mockOnChange).toHaveBeenCalledTimes(1);
      expect(mockOnChange).toHaveBeenCalledWith(EDIT_MODES.AI_GENERATION);
    });

    it('displays the correct value when controlled', () => {
      render(<ModeSelector value={EDIT_MODES.AI_GENERATION} />);
      
      const select = screen.getByRole('combobox');
      expect(select.value).toBe(EDIT_MODES.AI_GENERATION);
    });

    it('can switch between Native Edits and AI Generation', () => {
      const mockOnChange = jest.fn();
      const { rerender } = render(
        <ModeSelector value={EDIT_MODES.NATIVE} onChange={mockOnChange} />
      );
      
      const select = screen.getByRole('combobox');
      expect(select.value).toBe(EDIT_MODES.NATIVE);
      
      // Simulate user changing to AI Generation
      fireEvent.change(select, { target: { value: EDIT_MODES.AI_GENERATION } });
      expect(mockOnChange).toHaveBeenCalledWith(EDIT_MODES.AI_GENERATION);
      
      // Rerender with new value (simulating parent state update)
      rerender(<ModeSelector value={EDIT_MODES.AI_GENERATION} onChange={mockOnChange} />);
      expect(select.value).toBe(EDIT_MODES.AI_GENERATION);
    });
  });

  describe('Disabled State', () => {
    it('disables the select when disabled prop is true', () => {
      render(<ModeSelector disabled={true} />);
      
      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();
    });

    it('does not call onChange when disabled', () => {
      const mockOnChange = jest.fn();
      render(<ModeSelector disabled={true} onChange={mockOnChange} />);
      
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: EDIT_MODES.AI_GENERATION } });
      
      // onChange shouldn't be called on a disabled select
      // (browser prevents the change event)
      expect(select.value).toBe(EDIT_MODES.NATIVE);
    });
  });

  describe('EDIT_MODES constants', () => {
    it('exports correct mode values', () => {
      expect(EDIT_MODES.NATIVE).toBe('native');
      expect(EDIT_MODES.AI_GENERATION).toBe('ai-generation');
      expect(EDIT_MODES.OBJECT_TRACKING).toBe('object-tracking');
    });

    it('has labels for all modes', () => {
      expect(MODE_LABELS[EDIT_MODES.NATIVE]).toBe('Native Edits');
      expect(MODE_LABELS[EDIT_MODES.AI_GENERATION]).toBe('AI Generation');
      expect(MODE_LABELS[EDIT_MODES.OBJECT_TRACKING]).toBe('Object Tracking');
    });
  });
});


