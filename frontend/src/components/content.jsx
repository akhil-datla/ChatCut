import React, { useEffect, useRef, useState } from "react";
import "./content.css";

/**
 * TypingMessage: Component that types out text character by character
 */
const TypingMessage = ({ text, speed = 10 }) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!text) {
      setIsComplete(true);
      return;
    }

    setDisplayedText("");
    setIsComplete(false);
    let currentIndex = 0;

    const typeInterval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.substring(0, currentIndex + 1));
        currentIndex++;
      } else {
        setIsComplete(true);
        clearInterval(typeInterval);
      }
    }, speed);

    return () => clearInterval(typeInterval);
  }, [text, speed]);

  return (
    <span className={isComplete ? "typing-complete" : "typing-in-progress"}>
      {displayedText}
      {!isComplete && <span className="typing-cursor">|</span>}
    </span>
  );
};

/**
 * LoadingDots: Component that animates dots using JS state
 * More reliable than CSS animations in some environments
 */
const LoadingDots = () => {
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return ".";
        return prev + ".";
      });
    }, 400);

    return () => clearInterval(interval);
  }, []);

  return <span className="loading-dots-text">{dots}</span>;
};

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
        <div key={m.id} className={`bubble ${m.sender} ${m.isLoading ? 'loading' : ''}`}>
          <div className="bubble-text">
            {m.isLoading ? (
              <span className="loading-container">
                {m.text}
                <LoadingDots />
              </span>
            ) : m.isTyping ? (
              <TypingMessage text={m.text} speed={m.typingSpeed || 45} />
            ) : (
              m.text
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
