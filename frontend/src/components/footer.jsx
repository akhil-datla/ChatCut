import React from "react";
import "./footer.css";
import { mediacoreBackend } from "uxp";
export const Footer = (props) => {
  const [draft, setDraft] = React.useState("");
  const [availableEffects, setAvailableEffects] = React.useState([]);
  const [selectedContexts, setSelectedContexts] = React.useState([]); // Array of { name: "Mosaic", params: {...} }
  const [isLoadingEffects, setIsLoadingEffects] = React.useState(false);
  const [showContextSelect, setShowContextSelect] = React.useState(false);
  const [isInputFocused, setIsInputFocused] = React.useState(false);

  const toggleProcessMedia = () => {
    if (props.setProcessMediaMode) {
      const newValue = !props.processMediaMode;
      props.setProcessMediaMode(newValue);
      console.log(`[Footer] Process Media Mode toggled to: ${newValue}`);
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
        </div>
      </div>
    </sp-body>
  );
};
