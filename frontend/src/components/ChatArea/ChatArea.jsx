/**
 * ChatArea - Scrollable message display area
 * Shows conversation between user and bot
 */
import React, { useEffect, useRef } from "react";
import "./ChatArea.css";

const MessageBubble = ({ sender, text }) => (
  <div className={`message-bubble ${sender}`}>
    <div className="bubble-content">{text}</div>
  </div>
);

export const ChatArea = ({ messages = [] }) => {
  const scrollRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      try {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      } catch {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages.length]);

  return (
    <div className="chat-area" ref={scrollRef}>
      {messages.length === 0 ? (
        <div className="empty-state">
          <div className="empty-title">Ready to edit</div>
          <div className="empty-subtitle">
            Select clips in your timeline and describe what you want to do
          </div>
        </div>
      ) : (
        messages.map((msg) => (
          <MessageBubble 
            key={msg.id} 
            sender={msg.sender} 
            text={msg.text} 
          />
        ))
      )}
    </div>
  );
};


