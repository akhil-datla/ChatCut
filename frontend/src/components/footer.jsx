import React, { useState, useEffect, useRef } from "react";
import "./footer.css";
import { checkColabHealth } from "../services/backendClient";

export const Footer = (props) => {
  const [draft, setDraft] = useState("");
  const [availableEffects, setAvailableEffects] = useState([]);
  const [selectedContexts, setSelectedContexts] = useState([]); // Array of { name: "Mosaic", params: {...} }
  const [isLoadingEffects, setIsLoadingEffects] = useState(false);
  const [showContextSelect, setShowContextSelect] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Colab connection status: null = unchecked, true = connected, false = disconnected
  const [colabConnected, setColabConnected] = useState(null);
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

  const toggleProcessMedia = () => {
    if (props.setProcessMediaMode) {
      const newValue = !props.processMediaMode;
      props.setProcessMediaMode(newValue);
      console.log(`[Footer] Process Media Mode toggled to: ${newValue}`);
    }
  };

  const toggleColabMode = () => {
    if (props.setColabMode) {
      const newValue = !props.colabMode;
      props.setColabMode(newValue);
      console.log(`[Footer] Colab Mode toggled to: ${newValue}`);
    }
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

        {/* Colab URL Input - shown when Colab mode is active */}
        {props.colabMode && (
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

        {/* Context Chips Display */}
        {selectedContexts.length > 0 && (
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
        )}

        <div className="plugin-footer">
          {/* Add Context Button Wrapper */}
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
          
          {/* Toggle switch for Process Media Mode */}
          <div
            className="toggle-container"
            title="AI Video Mode"
            onClick={toggleProcessMedia}
          >
            <div className={`toggle-switch ${props.processMediaMode ? 'active' : ''}`}>
              <div className="toggle-slider"></div>
            </div>
          </div>

          {/* Toggle switch for Colab Mode with status indicator */}
          <div
            className="toggle-container colab-toggle"
            title={`Colab Mode${props.colabMode ? (colabConnected === true ? ' (Connected)' : colabConnected === false ? ' (Disconnected)' : ' (Checking...)') : ''}`}
            onClick={toggleColabMode}
          >
            <div className={`toggle-switch colab ${props.colabMode ? 'active' : ''}`}>
              <div className="toggle-slider"></div>
            </div>
            {/* Connection status dot - only shown when Colab mode is active */}
            {props.colabMode && (
              <div
                className={`colab-status-dot ${
                  colabConnected === true ? 'connected' :
                  colabConnected === false ? 'disconnected' : 'checking'
                }`}
              />
            )}
          </div>
        </div>
      </div>
    </sp-body>
  );
};
