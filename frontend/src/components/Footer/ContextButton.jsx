/**
 * ContextButton - Plus button for adding effects context
 * Opens a dropdown to select effects from selected clips
 * Uses native HTML elements for UXP compatibility
 */
import React, { useState, useEffect, useRef } from "react";
import { PlusIcon, CloseIcon } from "../UI";
import { Spinner } from "../UI";
import "./ContextButton.css";

export const ContextButton = ({ 
  selectedContexts = [], 
  onContextsChange,
  fetchAvailableEffects,
  disabled = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [availableEffects, setAvailableEffects] = useState([]);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleToggle = async () => {
    if (disabled) return;
    
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    // Fetch effects when opening
    if (fetchAvailableEffects) {
      setIsLoading(true);
      try {
        const effects = await fetchAvailableEffects();
        setAvailableEffects(effects);
      } catch (err) {
        console.error("[ContextButton] Error fetching effects:", err);
        setAvailableEffects([]);
      }
      setIsLoading(false);
    }
    
    setIsOpen(true);
  };

  const handleSelectEffect = (componentName) => {
    if (!componentName || !onContextsChange) return;

    // Check if already selected
    if (selectedContexts.find(c => c.name === componentName)) {
      setIsOpen(false);
      return;
    }

    // Get parameters for this component
    const relevantParams = availableEffects.filter(ef => ef.component === componentName);
    const paramsObj = {};
    relevantParams.forEach(p => {
      paramsObj[p.parameter] = p.value;
    });

    onContextsChange([...selectedContexts, {
      name: componentName,
      params: paramsObj
    }]);
    
    setIsOpen(false);
  };

  const handleRemoveContext = (name, e) => {
    e.stopPropagation();
    if (onContextsChange) {
      onContextsChange(selectedContexts.filter(c => c.name !== name));
    }
  };

  // Get unique component names
  const uniqueComponents = [...new Set(availableEffects.map(e => e.component))];

  return (
    <div className="context-button-wrapper" ref={dropdownRef}>
      {/* Context chips display */}
      {selectedContexts.length > 0 && (
        <div className="context-chips">
          {selectedContexts.map(ctx => (
            <div 
              key={ctx.name} 
              className="context-chip"
              title={JSON.stringify(ctx.params, null, 2)}
            >
              <span className="chip-label">{ctx.name}</span>
              <button 
                type="button"
                className="chip-remove"
                onClick={(e) => handleRemoveContext(ctx.name, e)}
                aria-label={`Remove ${ctx.name}`}
              >
                <CloseIcon size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Plus button */}
      <button
        type="button"
        className={`context-btn ${isOpen ? 'active' : ''} ${selectedContexts.length > 0 ? 'has-context' : ''}`}
        onClick={handleToggle}
        disabled={disabled}
        aria-label="Add effect context"
        title={selectedContexts.length > 0 ? "Add more context" : "Add effect context"}
      >
        {isLoading ? (
          <Spinner size="small" />
        ) : (
          <PlusIcon size={16} />
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="context-dropdown">
          {isLoading ? (
            <div className="dropdown-item disabled">Loading effects...</div>
          ) : uniqueComponents.length === 0 ? (
            <div className="dropdown-item disabled">No effects found. Select a clip first.</div>
          ) : (
            uniqueComponents.map(name => (
              <button
                type="button"
                key={name}
                className={`dropdown-item ${selectedContexts.find(c => c.name === name) ? 'selected' : ''}`}
                onClick={() => handleSelectEffect(name)}
              >
                {name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
