/**
 * ModeSelector - Dropdown for selecting edit mode
 * Uses native <select> for UXP compatibility (sp-picker not available in Premiere Pro)
 */
import React from "react";
import "./ModeSelector.css";

export const EDIT_MODES = {
  NATIVE: "native",
  AI_GENERATION: "ai-generation",
  OBJECT_TRACKING: "object-tracking"
};

export const MODE_LABELS = {
  [EDIT_MODES.NATIVE]: "Native Edits",
  [EDIT_MODES.AI_GENERATION]: "AI Generation",
  [EDIT_MODES.OBJECT_TRACKING]: "Object Tracking"
};

export const ModeSelector = ({ value = EDIT_MODES.NATIVE, onChange, disabled = false }) => {
  const handleChange = (e) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  return (
    <div className="mode-selector">
      <select
        className="mode-select"
        value={value}
        onChange={handleChange}
        disabled={disabled}
      >
        <option value={EDIT_MODES.NATIVE}>{MODE_LABELS[EDIT_MODES.NATIVE]}</option>
        <option value={EDIT_MODES.AI_GENERATION}>{MODE_LABELS[EDIT_MODES.AI_GENERATION]}</option>
        <option value={EDIT_MODES.OBJECT_TRACKING} disabled>
          {MODE_LABELS[EDIT_MODES.OBJECT_TRACKING]} (soon)
        </option>
      </select>
    </div>
  );
};
