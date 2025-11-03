import React from "react";
import "./footer.css";
import { mediacoreBackend } from "uxp";
export const Footer = (props) => {
  const [draft, setDraft] = React.useState("");
  
  const toggleProcessMedia = () => {
    if (props.setProcessMediaMode) {
      const newValue = !props.processMediaMode;
      props.setProcessMediaMode(newValue);
      console.log(`[Footer] Process Media Mode toggled to: ${newValue}`);
    }
  };
  
  return (
    <sp-body>
      <div className="plugin-footer">
        <input
          className="chat-input"
          value={draft}
          placeholder="Type a message..."
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (props.onSend) props.onSend(draft);
              setDraft("");
            }
          }}
        />
        <sp-button
          className="send-btn"
          aria-label="Send message"
          title="Send"
          onClick={() => {
            if (props.onSend) props.onSend(draft);
            setDraft("");
          }}
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
    </sp-body>
  );
};
