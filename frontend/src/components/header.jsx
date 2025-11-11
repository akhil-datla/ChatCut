import React from "react";

import "./header.css";

export const Header = ({ onUndo, canUndo }) => {
  console.log("[Header] Rendering with canUndo:", canUndo, "typeof:", typeof canUndo);
  
  const handleUndoClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("[Header] Undo button clicked", { canUndo, disabled: !canUndo, event: e });
    if (canUndo && onUndo) {
      console.log("[Header] Calling onUndo handler");
      onUndo();
    } else {
      console.log("[Header] Undo button clicked but disabled or no handler", { 
        canUndo, 
        hasOnUndo: !!onUndo,
        canUndoType: typeof canUndo,
        canUndoValue: canUndo
      });
    }
  };

  // Force boolean conversion
  const isEnabled = Boolean(canUndo);
  console.log("[Header] Button enabled state:", isEnabled, "canUndo prop:", canUndo);

  // Use React.useEffect to log when canUndo changes
  React.useEffect(() => {
    console.log("[Header] canUndo changed to:", canUndo, "isEnabled:", isEnabled);
  }, [canUndo, isEnabled]);

  return (
    <sp-body>
      <div className="plugin-header">
        <span>Welcome to ChatCut</span>
        <button
          type="button"
          key={`undo-${isEnabled}`} // Force re-render when enabled state changes
          className={`undo-btn ${isEnabled ? 'enabled' : 'disabled'}`}
          aria-label="Undo last edit"
          title={isEnabled ? "Undo last edit" : "No edits to undo"}
          disabled={!isEnabled}
          onClick={handleUndoClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            fontSize: '12px',
            cursor: isEnabled ? 'pointer' : 'not-allowed',
            border: isEnabled ? '1px solid rgba(100, 150, 255, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
            background: isEnabled ? '#4A90E2' : '#666666',
            color: 'white',
            transition: 'all 0.2s',
            opacity: isEnabled ? 1 : 0.6
          }}
        >
          <svg
            className="undo-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            role="img"
            aria-hidden="true"
            style={{ width: '16px', height: '16px', fill: 'currentColor' }}
          >
            <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
          </svg>
          Undo
        </button>
      </div>
    </sp-body>
  );
};
