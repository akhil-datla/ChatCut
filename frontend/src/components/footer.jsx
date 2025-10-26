import React from "react";
import "./footer.css";
import { mediacoreBackend } from "uxp";
export const Footer = (props) => {
  const [draft, setDraft] = React.useState("");
  // Removed unused functions
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
        <sp-button className="clip-btn" onClick={() => console.log("Clear Selected Clip (no-op)")}>
          Clear
        </sp-button>
        <sp-button className="clip-btn" onClick={() => console.log("Add Another Clip (no-op)")}>
          Add
        </sp-button>
      </div>
    </sp-body>
  );
};
