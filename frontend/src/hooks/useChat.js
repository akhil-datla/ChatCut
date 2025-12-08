/**
 * useChat - Hook for managing chat message state
 */
import { useState, useCallback } from "react";

const WELCOME_MESSAGE = {
  id: "welcome",
  sender: "bot",
  text: "Welcome to ChatCut! Select clips and describe your edit."
};

export const useChat = (initialMessages = [WELCOME_MESSAGE]) => {
  const [messages, setMessages] = useState(initialMessages);

  const addMessage = useCallback((msg) => {
    const message = {
      id: msg.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sender: msg.sender || "bot",
      text: msg.text || ""
    };
    setMessages(prev => [...prev, message]);
    return message;
  }, []);

  const addUserMessage = useCallback((text) => {
    return addMessage({ sender: "user", text });
  }, [addMessage]);

  const addBotMessage = useCallback((text) => {
    return addMessage({ sender: "bot", text });
  }, [addMessage]);

  const clearMessages = useCallback(() => {
    setMessages([WELCOME_MESSAGE]);
  }, []);

  return {
    messages,
    addMessage,
    addUserMessage,
    addBotMessage,
    clearMessages
  };
};


