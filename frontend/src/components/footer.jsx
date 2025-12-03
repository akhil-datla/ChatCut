import React, { useEffect, useRef } from "react";
import "./footer.css";
import { mediacoreBackend } from "uxp";
export const Footer = (props) => {
  const modeDropdownRef = useRef(null);
  const [draft, setDraft] = React.useState("");
  const [availableEffects, setAvailableEffects] = React.useState([]);
  const [selectedContexts, setSelectedContexts] = React.useState([]); // Array of { name: "Mosaic", params: {...} }
  const [isLoadingEffects, setIsLoadingEffects] = React.useState(false);
  const [showContextSelect, setShowContextSelect] = React.useState(false);
  const [isInputFocused, setIsInputFocused] = React.useState(false);
  const [showModeDropdown, setShowModeDropdown] = React.useState(false);

  const handleUndo = () => {
    // Placeholder for teammate's undo implementation
    if (props.onUndo) {
      props.onUndo();
    }
  };

  const handleModeChange = (mode) => {
    if (props.setEditingMode) {
      props.setEditingMode(mode);
      console.log(`[Footer] Editing mode changed to: ${mode}`);
    }
    setShowModeDropdown(false);
  };

  const getModeDisplay = (mode) => {
    const modes = {
      'none': { name: 'Regular Native Edits', icon: 'edit' },
      'object_tracking': { name: 'Object Tracking Mode', icon: 'track' },
      'ai_video': { name: 'AI Video Generation Mode', icon: 'ai' }
    };
    return modes[mode] || modes['none'];
  };

  const getModeIcon = () => {
    if (currentMode === 'object_tracking') {
      return (
        <>
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v6m0 6v6M23 12h-6m-6 0H1m16.95-4.95l-4.24 4.24m0-8.48l4.24 4.24m-8.48 0l4.24 4.24m0-8.48l-4.24 4.24"/>
        </>
      );
    } else if (currentMode === 'ai_video') {
      return <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>;
    } else {
      // Default to 'none' - edit icon
      return (
        <>
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
        </>
      );
    }
  };

  const currentMode = props.editingMode || 'none';
  const modeDisplay = getModeDisplay(currentMode);
  
  // Debug logging
  React.useEffect(() => {
    console.log('[Footer] Current mode:', currentMode);
    console.log('[Footer] Props editingMode:', props.editingMode);
  }, [currentMode, props.editingMode]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(event.target)) {
        setShowModeDropdown(false);
      }
    };

    if (showModeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showModeDropdown]);
  
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
            {showModeDropdown && (
              <div className="mode-selector-dropdown">
                <div 
                  className={`mode-dropdown-option ${currentMode === 'none' ? 'active' : ''}`}
                  onClick={() => handleModeChange('none')}
                  title="Use Premiere Pro's native editing features"
                >
                  <svg className="mode-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                  </svg>
                  <span className="mode-option-text">Regular Native Edits</span>
                </div>
                <div 
                  className={`mode-dropdown-option ${currentMode === 'object_tracking' ? 'active' : ''}`}
                  onClick={() => handleModeChange('object_tracking')}
                  title="Track objects in video and apply effects to tracked objects"
                >
                  <svg className="mode-icon " viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 1v6m0 6v6M23 12h-6m-6 0H1m16.95-4.95l-4.24 4.24m0-8.48l4.24 4.24m-8.48 0l4.24 4.24m0-8.48l-4.24 4.24"/>
                  </svg>
                  <span className="mode-option-text">Object Tracking Mode</span>
                </div>
                <div 
                  className={`mode-dropdown-option ${currentMode === 'ai_video' ? 'active' : ''}`}
                  onClick={() => handleModeChange('ai_video')}
                  title="Generate and transform video using AI"
                >
                  <svg className="mode-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  <span className="mode-option-text">AI Video Generation Mode</span>
                </div>
              </div>
            )}
            <button
              className="mode-selector-button"
              onClick={() => {
                console.log('[Footer] Button clicked, currentMode:', currentMode);
                setShowModeDropdown(!showModeDropdown);
              }}
              title={modeDisplay.name}
            >
              <svg 
                key={currentMode}
                className="mode-icon" 
                viewBox="0 0 24 24" 
                width="22" 
                height="22" 
                xmlns="http://www.w3.org/2000/svg"
                style={{ display: 'block', fill: '#FFFFFF' }}
              >
                {currentMode === 'none' ? (
                  <>
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="#FFFFFF" stroke="none"/>
                  </>
                ) : currentMode === 'object_tracking' ? (
                  <>
                    <circle cx="12" cy="12" r="3" fill="#FFFFFF" stroke="none"/>
                    <path d="M12 1v6m0 6v6M23 12h-6m-6 0H1m16.95-4.95l-4.24 4.24m0-8.48l4.24 4.24m-8.48 0l4.24 4.24m0-8.48l-4.24 4.24" fill="#FFFFFF" stroke="none"/>
                  </>
                ) : (
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#FFFFFF" stroke="none"/>
                )}
              </svg>
              <svg 
                className="mode-dropdown-arrow" 
                viewBox="0 0 24 24" 
                width="12" 
                height="12" 
                style={{
                  fill: 'rgba(255,255,255,0.5)', 
                  position: 'absolute', 
                  bottom: '2px', 
                  right: '2px'
                }}
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M7 10l5 5 5-5z" fill="rgba(255,255,255,0.5)"/>
              </svg>
            </button>
          </div>
          
          <input
            className="chat-input"
            value={draft}
            placeholder="Type a message..."
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <sp-button
            className="undo-btn"
            aria-label="Undo last action"
            title="Undo"
            disabled={true}
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
            className="send-btn"
            aria-label="Send message"
            title="Send"
            onClick={handleSend}
          >
            <svg
              className="send-icon"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              role="img"
              aria-hidden="true"
            >
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
            </svg>
          </sp-button>
        </div>
      </div>
    </sp-body>
  );
};
