import React, { useState, useEffect } from "react";
import { TimelineSelector } from "../components/TimelineSelector.jsx";
import { PromptInput } from "../components/PromptInput.jsx";
import backendAPI from "../services/backendAPI";

export const App = () => {
  const [selection, setSelection] = useState(null);
  const [backendConnected, setBackendConnected] = useState(false);

  useEffect(() => {
    // Test backend connection on mount
    checkBackendConnection();
  }, []);

  const checkBackendConnection = async () => {
    try {
      const connected = await backendAPI.testConnection();
      setBackendConnected(connected);
    } catch (error) {
      console.error("Failed to connect to backend:", error);
      setBackendConnected(false);
    }
  };

  const handleSelectionChange = (newSelection) => {
    setSelection(newSelection);
  };

  return (
    <div className="chatcut-app">
      <header className="app-header">
        <h1>ChatCut</h1>
        <p className="tagline">Edit videos with words, not clicks</p>
        {!backendConnected && (
          <div className="warning-banner">
            Backend not connected. Make sure the Python server is running on localhost:3001
          </div>
        )}
      </header>

      <main className="app-main">
        <TimelineSelector onSelectionChange={handleSelectionChange} />
        <PromptInput selection={selection} />
      </main>

      <footer className="app-footer">
        <p>MVP v0.1.0 | Backend: {backendConnected ? "✓ Connected" : "✗ Disconnected"}</p>
      </footer>
    </div>
  );
};

