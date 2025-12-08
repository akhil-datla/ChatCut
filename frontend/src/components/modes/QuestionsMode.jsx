import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { askPremiereQuestion } from '../../services/backendClient';
import './QuestionsMode.css';

/**
 * LoadingDots: Component that animates dots using JS state
 */
const LoadingDots = () => {
  const [dots, setDots] = useState('.');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return '.';
        return prev + '.';
      });
    }, 400);

    return () => clearInterval(interval);
  }, []);

  return <span className="loading-dots-text">{dots}</span>;
};

export const QuestionsMode = forwardRef((props, ref) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const transcriptRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      try {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      } catch {
        // Fallback for browsers that don't support smooth scroll
        messagesEndRef.current.scrollIntoView();
      }
    }
  }, [messages]);

  // Expose handleSend method via ref
  useImperativeHandle(ref, () => ({
    handleSend: async (text) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return Promise.resolve();

      // Add user message
      const userMsg = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: Date.now()
      };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setIsLoading(true);

      try {
        // Call AI service
        const response = await askPremiereQuestion(updatedMessages);
        
        // Add assistant response
        const assistantMsg = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: response.message || response.content || "I'm not sure—can you rephrase?",
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, assistantMsg]);
      } catch (err) {
        const errorMsg = {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    isLoading
  }), [messages, isLoading]);

  return (
    <div className="questions-mode-container">
      <div className="questions-mode-header">
        <h3>Premiere Pro Help</h3>
      </div>
      <div ref={transcriptRef} className="questions-mode-transcript">
        {messages.length === 0 ? (
          <div className="questions-mode-empty">
            Ask a question about Premiere Pro...
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`question-bubble ${msg.role}`}>
              <div className="question-bubble-text">{msg.content}</div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="question-bubble assistant loading">
            <div className="question-bubble-text">
              <LoadingDots />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
});

