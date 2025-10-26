import React, { useEffect, useRef } from "react";
import "./content.css";

/**
 * Content: renders chat messages in a scrollable column.
 * Ensures messages do not compress (each message is flex: 0 0 auto)
 * and the container auto-scrolls to the bottom when new messages arrive.
 */
export const Content = ({ message = [] }) => {
  const listRef = useRef(null);

  // Auto-scroll when a new message is added (depend on length for stability)
  useEffect(() => {
    const el = listRef.current;
    if (el) {
      // scroll to bottom smoothly if supported, fallback to instant
      try {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      } catch {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [message.length]);

  return (
    <div
      ref={listRef}
      className="plugin-content"
      // expose a default font size variable; can be overridden by container or host
      style={{ "--chat-font-size": "14px" }}
    >
      {message.map((m) => (
        <div key={m.id} className={`bubble ${m.sender}`}>
          <div className="bubble-text">{m.text}</div>
        </div>
      ))}
    </div>
  );
};
