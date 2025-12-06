/**
 * SendInput Component Tests
 * Verifies text input, send button, and undo button functionality
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SendInput } from './SendInput';

describe('SendInput', () => {
  const defaultProps = {
    onSend: jest.fn(),
    onUndo: jest.fn(),
    canUndo: false,
    disabled: false,
    placeholder: 'Describe your edit...',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Structure', () => {
    it('renders a text input', () => {
      render(<SendInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'text');
    });

    it('renders a send button', () => {
      render(<SendInput {...defaultProps} />);
      
      const sendButton = screen.getByTitle('Send');
      expect(sendButton).toBeInTheDocument();
    });

    it('renders an undo button', () => {
      render(<SendInput {...defaultProps} />);
      
      const undoButton = screen.getByLabelText('Undo last edit');
      expect(undoButton).toBeInTheDocument();
    });

    it('displays the placeholder text', () => {
      render(<SendInput {...defaultProps} placeholder="Custom placeholder" />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('placeholder', 'Custom placeholder');
    });
  });

  describe('Undo Button Position', () => {
    it('undo button is to the right of send button', () => {
      render(<SendInput {...defaultProps} />);
      
      const container = document.querySelector('.send-input-container');
      const buttons = container.querySelectorAll('button');
      
      // Should have 2 buttons: send and undo
      expect(buttons).toHaveLength(2);
      
      // First button is send, second is undo
      expect(buttons[0]).toHaveAttribute('title', 'Send');
      expect(buttons[1]).toHaveAttribute('aria-label', 'Undo last edit');
    });

    it('layout order is: input -> send -> undo', () => {
      render(<SendInput {...defaultProps} />);
      
      const container = document.querySelector('.send-input-container');
      const children = Array.from(container.children);
      
      // Verify order of elements
      expect(children[0].tagName).toBe('INPUT');
      expect(children[1].tagName).toBe('BUTTON'); // Send
      expect(children[2].tagName).toBe('BUTTON'); // Undo
    });
  });

  describe('Send Functionality', () => {
    it('calls onSend with trimmed text when send button clicked', () => {
      const mockOnSend = jest.fn();
      render(<SendInput {...defaultProps} onSend={mockOnSend} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '  zoom in  ' } });
      
      const sendButton = screen.getByTitle('Send');
      fireEvent.click(sendButton);
      
      expect(mockOnSend).toHaveBeenCalledWith('zoom in');
    });

    it('calls onSend when Enter key is pressed', () => {
      const mockOnSend = jest.fn();
      render(<SendInput {...defaultProps} onSend={mockOnSend} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'add effect' } });
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
      
      expect(mockOnSend).toHaveBeenCalledWith('add effect');
    });

    it('does not call onSend when Shift+Enter is pressed', () => {
      const mockOnSend = jest.fn();
      render(<SendInput {...defaultProps} onSend={mockOnSend} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'add effect' } });
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
      
      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it('does not call onSend with empty input', () => {
      const mockOnSend = jest.fn();
      render(<SendInput {...defaultProps} onSend={mockOnSend} />);
      
      const sendButton = screen.getByTitle('Send');
      fireEvent.click(sendButton);
      
      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it('does not call onSend with whitespace-only input', () => {
      const mockOnSend = jest.fn();
      render(<SendInput {...defaultProps} onSend={mockOnSend} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '   ' } });
      
      const sendButton = screen.getByTitle('Send');
      fireEvent.click(sendButton);
      
      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it('clears input after successful send', () => {
      render(<SendInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'test message' } });
      expect(input.value).toBe('test message');
      
      const sendButton = screen.getByTitle('Send');
      fireEvent.click(sendButton);
      
      expect(input.value).toBe('');
    });

    it('send button is disabled when input is empty', () => {
      render(<SendInput {...defaultProps} />);
      
      const sendButton = screen.getByTitle('Send');
      expect(sendButton).toBeDisabled();
    });

    it('send button is enabled when input has text', () => {
      render(<SendInput {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'some text' } });
      
      const sendButton = screen.getByTitle('Send');
      expect(sendButton).not.toBeDisabled();
    });
  });

  describe('Undo Functionality', () => {
    it('undo button is disabled when canUndo is false', () => {
      render(<SendInput {...defaultProps} canUndo={false} />);
      
      const undoButton = screen.getByLabelText('Undo last edit');
      expect(undoButton).toBeDisabled();
    });

    it('undo button is enabled when canUndo is true', () => {
      render(<SendInput {...defaultProps} canUndo={true} />);
      
      const undoButton = screen.getByLabelText('Undo last edit');
      expect(undoButton).not.toBeDisabled();
    });

    it('calls onUndo when undo button is clicked and enabled', () => {
      const mockOnUndo = jest.fn();
      render(<SendInput {...defaultProps} canUndo={true} onUndo={mockOnUndo} />);
      
      const undoButton = screen.getByLabelText('Undo last edit');
      fireEvent.click(undoButton);
      
      expect(mockOnUndo).toHaveBeenCalledTimes(1);
    });

    it('does not call onUndo when undo button is clicked and disabled', () => {
      const mockOnUndo = jest.fn();
      render(<SendInput {...defaultProps} canUndo={false} onUndo={mockOnUndo} />);
      
      const undoButton = screen.getByLabelText('Undo last edit');
      fireEvent.click(undoButton);
      
      expect(mockOnUndo).not.toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('disables input when disabled prop is true', () => {
      render(<SendInput {...defaultProps} disabled={true} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });

    it('disables send button when disabled prop is true', () => {
      render(<SendInput {...defaultProps} disabled={true} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'test' } });
      
      const sendButton = screen.getByTitle('Send');
      expect(sendButton).toBeDisabled();
    });
  });
});


