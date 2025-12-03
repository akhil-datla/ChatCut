import React, { useState, useEffect } from "react";
import premiereAPI from "../services/premiereAPI";

export function TimelineSelector({ onSelectionChange }) {
  const [selection, setSelection] = useState(null);
  const [sequenceInfo, setSequenceInfo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSequenceInfo();
  }, []);

  const formatFrameRate = (value) => {
    if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
      return null;
    }
    const rounded = Number.isInteger(value) ? value : value.toFixed(2);
    return parseFloat(rounded);
  };

  const loadSequenceInfo = async () => {
    try {
      // Test if Premiere Pro API is available
      const isConnected = await premiereAPI.testConnection();
      if (!isConnected) {
        setError("Premiere Pro API not available. Make sure the plugin is loaded correctly.");
        return;
      }

      const info = await premiereAPI.getSequenceInfo();
      if (!info) {
        setError("No active sequence found. Please open or create a sequence in Premiere Pro.");
        return;
      }

      setSequenceInfo(info);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error("Error loading sequence info:", err);
    }
  };

  const updateSelection = async () => {
    try {
      const sel = await premiereAPI.getSelection();
      setSelection(sel);
      setError(null);

      if (onSelectionChange) {
        onSelectionChange(sel);
      }
    } catch (err) {
      setError(err.message);
      console.error("Error getting selection:", err);
    }
  };

  return (
    <div className="timeline-selector">
      <h3>Timeline Selection</h3>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {sequenceInfo && (
        <div className="sequence-info">
          <p><strong>Sequence:</strong> {sequenceInfo.name}</p>
          <p>
            <strong>Frame Rate:</strong>{" "}
            {(() => {
              const formatted = formatFrameRate(sequenceInfo.frameRate);
              return formatted !== null ? `${formatted} fps` : "Unknown";
            })()}
          </p>
          <p>
            <strong>Duration:</strong>{" "}
            {typeof sequenceInfo.duration === "number"
              ? `${sequenceInfo.duration.toFixed(2)}s`
              : "Unknown"}
          </p>
        </div>
      )}

      <button onClick={updateSelection} className="btn-primary">
        Get Current Selection
      </button>

      {selection && (
        <div className="selection-info">
          {selection.hasSelection ? (
            <>
              <p><strong>Duration:</strong> {selection.duration.toFixed(2)}s</p>
              <p className="hint">Selection captured! Enter a prompt below to apply effects.</p>
            </>
          ) : (
            <p className="warning">No in/out points set. Please set in and out points on the timeline.</p>
          )}
        </div>
      )}
    </div>
  );
}
