/**
 * SendInput - Text input with send and undo buttons
 * Uses native HTML elements for UXP compatibility
 */
import React, { useState } from "react";
import { SendIcon, UndoIcon } from "../UI";
import "./SendInput.css";

export const SendInput = ({ 
  onSend, 
  onUndo,
  canUndo = false,
  disabled = false,
  placeholder = "Describe your edit..."
}) => {
  const [value, setValue] = useState("");

  const handleSend = () => {
    const trimmed = value.trim();
    if (trimmed && onSend) {
      onSend(trimmed);
      setValue("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleUndoClick = () => {
    if (canUndo && onUndo) {
      onUndo();
    }
  };

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div className="send-input-container">
      <input
        type="text"
        className="chat-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
      />
      
      <button
        className="send-button"
        onClick={handleSend}
        disabled={!canSend}
        title="Send"
        aria-label="Send message"
      >
        <SendIcon size={18} />
      </button>

      <button
        className={`undo-button ${canUndo ? '' : 'disabled'}`}
        onClick={handleUndoClick}
        disabled={!canUndo}
        title={canUndo ? "Undo last edit" : "No edits to undo"}
        aria-label="Undo last edit"
      >
        <UndoIcon size={16} />
      </button>
    </div>
  );
};
