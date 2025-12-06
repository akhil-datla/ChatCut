import React, { useEffect, useRef } from "react";
import "./footer.css";
import { checkColabHealth } from "../services/backendClient";

/**
 * Mode Icon Components - SVG Fallbacks
 * Since Spectrum UXP icons may not load reliably, we use SVG components
 * Using fill="white" directly instead of currentColor for UXP compatibility
 * IMPORTANT: UXP requires xmlns attribute on all inline SVGs for proper rendering
 */
const EditIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg"
    className="mode-icon-svg" 
    viewBox="0 0 24 24" 
    width="20" 
    height="20" 
    fill="white"
    role="img"
    aria-hidden="true"
  >
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
  </svg>
);

const BullseyeIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg"
    className="mode-icon-svg" 
    viewBox="0 0 24 24" 
    width="20" 
    height="20" 
    fill="white"
    role="img"
    aria-hidden="true"
  >
    {/* Outer circle */}
    <circle cx="12" cy="12" r="8" fill="none" stroke="white" strokeWidth="1.5"/>
    {/* Middle circle */}
    <circle cx="12" cy="12" r="5" fill="none" stroke="white" strokeWidth="1.5"/>
    {/* Center dot */}
    <circle cx="12" cy="12" r="2" fill="white"/>
  </svg>
);

const MagicWandIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg"
    className="mode-icon-svg" 
    viewBox="0 0 24 24" 
    width="20" 
    height="20" 
    fill="white"
    role="img"
    aria-hidden="true"
  >
    {/* Minimal diagonal wand (no tip shape) */}
    <rect
      x="0.4"
      y="16.8"
      width="16"
      height="1.6"
      rx="0.8"
      fill="white"
      transform="rotate(-55 4 14.8)"
    />

    {/* Four-point twinkle star 1 (left) */}
    <path
      d="M6.5 4
         L7.1 6
         L9 6.5
         L7.1 7
         L6.5 9
         L5.9 7
         L4 6.5
         L5.9 6
         Z"
      fill="white"
    />

    {/* Four-point twinkle star 2 (upper right) — moved farther from wand tip */}
    <path
      d="M17.0 0.4
         L17.6 2.2
         L19.4 2.8
         L17.6 3.4
         L17.0 5.2
         L16.4 3.4
         L14.6 2.8
         L16.4 2.2
         Z"
      fill="white"
    />

    {/* Four-point twinkle star 3 (right / mid) */}
    <path
      d="M18.2 9.5
         L18.7 11.1
         L20.3 11.6
         L18.7 12.1
         L18.2 13.7
         L17.7 12.1
         L16.1 11.6
         L17.7 11.1
         Z"
      fill="white"
    />

    {/* Four-point twinkle star 4 (above wand body) */}
    <path
      d="M10.2 0.2
         L10.7 1.6
         L12.1 2.1
         L10.7 2.6
         L10.2 4.0
         L9.7 2.6
         L8.3 2.1
         L9.7 1.6
         Z"
      fill="white"
    />
  </svg>
);



/**
 * Mode Icon Mapping - Maps modes to icon components
 */
const MODE_ICON_COMPONENT = {
  'none': EditIcon,
  'object_tracking': BullseyeIcon,
  'ai_video': MagicWandIcon
};

/**
 * Mode Label Mapping
 * Human-readable labels for each editing mode (used in dropdown and tooltips)
 */
const MODE_LABEL = {
  'none': 'Native Edits',
  'object_tracking': 'Object Tracking',
  'ai_video': 'AI Generation'
};

export const Footer = (props) => {
  const modeDropdownRef = useRef(null);
  const [draft, setDraft] = React.useState("");
  const [availableEffects, setAvailableEffects] = React.useState([]);
  const [selectedContexts, setSelectedContexts] = React.useState([]); // Array of { name: "Mosaic", params: {...} }
  const [isLoadingEffects, setIsLoadingEffects] = React.useState(false);
  const [showContextSelect, setShowContextSelect] = React.useState(false);
  const [isInputFocused, setIsInputFocused] = React.useState(false);
  const [showModeDropdown, setShowModeDropdown] = React.useState(false);

  // Colab connection status: null = unchecked, true = connected, false = disconnected
  const [colabConnected, setColabConnected] = React.useState(null);
  const healthCheckTimeoutRef = useRef(null);
  const healthCheckIntervalRef = useRef(null);

  // Debounced health check when URL changes
  useEffect(() => {
    // Clear any pending health check
    if (healthCheckTimeoutRef.current) {
      clearTimeout(healthCheckTimeoutRef.current);
    }

    // Only check if Colab mode is active and URL exists
    if (props.colabMode && props.colabUrl && props.colabUrl.trim()) {
      setColabConnected(null); // Show checking state

      // Debounce the health check by 500ms
      healthCheckTimeoutRef.current = setTimeout(async () => {
        const isHealthy = await checkColabHealth(props.colabUrl);
        setColabConnected(isHealthy);

        // Store working URL in localStorage
        if (isHealthy) {
          try {
            localStorage.setItem('chatcut_colab_url', props.colabUrl);
          } catch (e) {
            // localStorage might not be available
          }
        }
      }, 500);
    } else if (!props.colabMode) {
      setColabConnected(null);
    }

    return () => {
      if (healthCheckTimeoutRef.current) {
        clearTimeout(healthCheckTimeoutRef.current);
      }
    };
  }, [props.colabUrl, props.colabMode]);

  // Periodic health check every 30 seconds while Colab mode is active
  useEffect(() => {
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
    }

    if (props.colabMode && props.colabUrl && props.colabUrl.trim()) {
      healthCheckIntervalRef.current = setInterval(async () => {
        const isHealthy = await checkColabHealth(props.colabUrl);
        setColabConnected(isHealthy);
      }, 30000); // Check every 30 seconds
    }

    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
    };
  }, [props.colabMode, props.colabUrl]);

  // Load last working URL from localStorage on mount
  useEffect(() => {
    if (props.setColabUrl && !props.colabUrl) {
      try {
        const savedUrl = localStorage.getItem('chatcut_colab_url');
        if (savedUrl) {
          props.setColabUrl(savedUrl);
        }
      } catch (e) {
        // localStorage might not be available
      }
    }
  }, []);

  const handleUndo = () => {
    // Placeholder for teammate's undo implementation
    if (props.onUndo) {
      props.onUndo();
    }
  };

  /**
   * Handle mode change - UXP reliable pattern
   * Automatically links object_tracking mode to Colab integration
   * Closes dropdown immediately on selection (UXP-safe)
   */
  const handleModeChange = (mode) => {
    if (props.setEditingMode) {
      props.setEditingMode(mode);
      console.log(`[Footer] Editing mode changed to: ${mode}`);
    }
    
    // Object tracking mode always uses Colab integration
    if (mode === 'object_tracking') {
      if (props.setColabMode) {
        props.setColabMode(true);
        console.log('[Footer] Object tracking mode enabled - Colab mode set to true');
      }
    } else {
      // When switching away from object_tracking, disable Colab mode
      if (props.setColabMode) {
        props.setColabMode(false);
        console.log('[Footer] Colab mode disabled');
      }
    }
    
    // Close dropdown immediately on selection (UXP-reliable pattern)
    setShowModeDropdown(false);
  };

  // Get current mode with fallback to 'none'
  const currentMode = props.editingMode || 'none';
  
  // Get icon component and label for current mode
  const CurrentModeIcon = MODE_ICON_COMPONENT[currentMode] || MODE_ICON_COMPONENT['none'];
  const currentModeLabel = MODE_LABEL[currentMode] || MODE_LABEL['none'];
  
  // Debug logging
  React.useEffect(() => {
    console.log('[Footer] Current mode:', currentMode);
    console.log('[Footer] Props editingMode:', props.editingMode);
  }, [currentMode, props.editingMode]);

  /**
   * UXP-reliable dropdown handling
   * No document-level event listeners (UXP sandbox limitation)
   * Dropdown closes on:
   * - Mode selection (handled in handleModeChange)
   * - Button click toggle (handled in onClick)
   * - Button blur/focus loss (handled in onBlur)
   */
  const handleModeButtonClick = () => {
    // Toggle dropdown - clicking button again closes it
    setShowModeDropdown(!showModeDropdown);
  };

  const handleModeButtonBlur = (e) => {
    // Close dropdown when button loses focus (UXP-reliable pattern)
    // Check if focus is moving to dropdown items - if so, don't close
    // This prevents closing when clicking dropdown items
    const relatedTarget = e.relatedTarget || document.activeElement;
    if (modeDropdownRef.current && modeDropdownRef.current.contains(relatedTarget)) {
      return; // Focus is moving to dropdown, don't close
    }
    
    // Small delay to allow onClick on dropdown items to fire first
    setTimeout(() => {
      setShowModeDropdown(false);
    }, 150);
  };
  
  /**
   * Handle dropdown item click with mouseDown to prevent blur
   * UXP-reliable pattern: prevent blur when clicking dropdown items
   */
  const handleDropdownItemMouseDown = (e) => {
    // Prevent blur on button when clicking dropdown items
    e.preventDefault();
  };

  const handleColabUrlChange = (e) => {
    if (props.setColabUrl) {
      props.setColabUrl(e.target.value);
    }
  };
  
  const handleContextFetch = async () => {
    if (!props.fetchAvailableEffects) return;
    
    // Toggle visibility if we already have effects, but still fetch to update
    if (showContextSelect) {
      setShowContextSelect(false);
      return;
    }

    setIsLoadingEffects(true);
    const effects = await props.fetchAvailableEffects();
    setAvailableEffects(effects);
    setIsLoadingEffects(false);
    setShowContextSelect(true);
  };

  const handleContextSelect = (componentName) => {
    if (!componentName) return;

    // Check if already selected
    if (selectedContexts.find(c => c.name === componentName)) {
        setShowContextSelect(false);
        return;
    }

    const relevantParams = availableEffects.filter(ef => ef.component === componentName);
    const paramsObj = {};
    relevantParams.forEach(p => {
      paramsObj[p.parameter] = p.value;
    });

    setSelectedContexts([...selectedContexts, {
      name: componentName,
      params: paramsObj
    }]);
    // Close dropdown after selection
    setShowContextSelect(false);
  };

  const removeContext = (name) => {
    setSelectedContexts(selectedContexts.filter(c => c.name !== name));
  };

  const uniqueComponents = [...new Set(availableEffects.map(e => e.component))];
  
  const handleSend = () => {
    if (props.onSend) {
      // Pass all selected contexts
      const context = selectedContexts.length > 0 
        ? selectedContexts.reduce((acc, ctx) => ({...acc, [ctx.name]: ctx.params}), {}) 
        : null;
      props.onSend(draft, context);
    }
    setDraft("");
    // Keep contexts selected until explicitly removed
  };

  return (
    <sp-body>
      <div className="plugin-footer-container">
        {/* Progress Bar - shown when processing */}
        {props.processingProgress !== null && (
          <div className="progress-bar-container">
            <div className="progress-bar-wrapper">
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${props.processingProgress}%` }}
                />
              </div>
              <span className="progress-percentage">{props.processingProgress}%</span>
            </div>
            {props.processingMessage && (
              <div className="progress-message">{props.processingMessage}</div>
            )}
          </div>
        )}

        {/* Colab URL Input - shown when Object Tracking mode is active (always uses Colab) */}
        {props.editingMode === 'object_tracking' && (
          <div className="colab-url-bar">
            <span className="colab-label">🔗 Colab URL:</span>
            <input
              className="colab-url-input"
              type="text"
              value={props.colabUrl || ""}
              placeholder="https://xxxxx.ngrok.io"
              onChange={handleColabUrlChange}
            />
          </div>
        )}

        {/* Row 1: Context chips (when selected) */}
        {selectedContexts.length > 0 && (
          <div className="plugin-footer-row-1">
            <div className="context-chips-container">
              {selectedContexts.map(ctx => (
                <div key={ctx.name} className="context-chip" title={JSON.stringify(ctx.params, null, 2)}>
                  <span className="chip-label">{ctx.name}</span>
                  <div className="chip-remove" onClick={() => removeContext(ctx.name)}>
                    <svg viewBox="0 0 24 24" className="close-icon">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Row 2: Plus button | Mode icon | Input | Undo | Send */}
        <div className="plugin-footer-row-2">
          {/* Plus button for context */}
          <div className="context-btn-wrapper">
            {showContextSelect && (
              <div className="custom-dropdown">
                {uniqueComponents.length === 0 ? (
                  <div className="dropdown-item disabled">No effects found</div>
                ) : (
                  uniqueComponents.map(name => (
                    <div 
                      key={name} 
                      className={`dropdown-item ${selectedContexts.find(c => c.name === name) ? 'selected' : ''}`}
                      onClick={() => handleContextSelect(name)}
                    >
                      <span className="effect-name">{name}</span>
                    </div>
                  ))
                )}
              </div>
            )}
            
            <div 
              className={`plus-btn ${showContextSelect ? 'active' : ''} ${selectedContexts.length > 0 ? 'has-context' : ''}`}
              title={selectedContexts.length > 0 ? "Add more context" : "Add effect context"}
              onClick={handleContextFetch}
            >
              {isLoadingEffects ? (
                <div className="spinner-small dark"></div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="plus-icon">
                  <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z"/>
                </svg>
              )}
            </div>
          </div>
          
          {/* Mode Selector Dropdown */}
          <div className={`mode-selector-wrapper ${showModeDropdown ? 'dropdown-open' : ''}`} ref={modeDropdownRef}>
            {showModeDropdown && (() => {
              const NoneIcon = MODE_ICON_COMPONENT['none'];
              const TrackingIcon = MODE_ICON_COMPONENT['object_tracking'];
              const AIIcon = MODE_ICON_COMPONENT['ai_video'];
              
              return (
              <div className="mode-selector-dropdown">
                <div 
                  className={`mode-dropdown-option ${currentMode === 'none' ? 'active' : ''}`}
                  onClick={() => handleModeChange('none')}
                    onMouseDown={handleDropdownItemMouseDown}
                  title="Use Premiere Pro's native editing features"
                >
                    <NoneIcon />
                    <span className="mode-option-text">{MODE_LABEL['none']}</span>
                </div>
                <div 
                  className={`mode-dropdown-option ${currentMode === 'object_tracking' ? 'active' : ''}`}
                  onClick={() => handleModeChange('object_tracking')}
                    onMouseDown={handleDropdownItemMouseDown}
                  title="Track objects in video and apply effects to tracked objects"
                >
                    <TrackingIcon />
                    <span className="mode-option-text">{MODE_LABEL['object_tracking']}</span>
                </div>
                <div 
                  className={`mode-dropdown-option ${currentMode === 'ai_video' ? 'active' : ''}`}
                  onClick={() => handleModeChange('ai_video')}
                    onMouseDown={handleDropdownItemMouseDown}
                  title="Generate and transform video using AI"
                >
                    <AIIcon />
                    <span className="mode-option-text">{MODE_LABEL['ai_video']}</span>
                  </div>
                </div>
              );
            })()}
            <sp-button
              quiet
              class="mode-selector-button"
              onClick={handleModeButtonClick}
              onBlur={handleModeButtonBlur}
              title={currentModeLabel}
              aria-label={`Current mode: ${currentModeLabel}. Click to change mode.`}
            >
              <span className="mode-icon-wrap">
                <CurrentModeIcon />
              </span>
            </sp-button>
          </div>
          
          <input
            className={`chat-input ${props.isProcessing ? 'processing' : ''}`}
            value={draft}
            placeholder={props.isProcessing ? "Processing..." : "Type a message..."}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            disabled={props.isProcessing}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !props.isProcessing) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <sp-button
            className="undo-btn"
            aria-label="Undo last action"
            title={props.canUndo ? "Undo last ChatCut edit" : "No edits to undo"}
            disabled={!Boolean(props.canUndo)}
            onClick={handleUndo}
          >
            <svg
              className="undo-icon"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              role="img"
              aria-hidden="true"
            >
              <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
            </svg>
          </sp-button>
          <sp-button
            className={`send-btn ${props.isProcessing ? 'processing' : ''}`}
            aria-label={props.isProcessing ? "Processing..." : "Send message"}
            title={props.isProcessing ? "Processing..." : "Send"}
            onClick={handleSend}
            disabled={props.isProcessing || !draft.trim()}
          >
            {props.isProcessing ? (
              <div className="spinner-small"></div>
            ) : (
            <svg
              className="send-icon"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              role="img"
              aria-hidden="true"
            >
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
            </svg>
            )}
          </sp-button>
        </div>
      </div>
    </sp-body>
  );
};
