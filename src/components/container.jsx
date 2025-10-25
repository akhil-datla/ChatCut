import React, { useState, useRef } from "react";
import { Content } from "./content";
import { Footer } from "./footer";
import { Header } from "./header";
import { applyZoom, applyTransition, applyFilter, applyRandomFilter, applyKeyframeDemo, applyTransitionDemo, applyFilterDemo, applyComprehensiveDemo } from "../services/editingActions";

const ppro = require("premierepro");

export const Container = () => {
  // messages are objects: { id: string, sender: 'user'|'bot', text: string }
  const [message, setMessage] = useState([
    { id: "welcome", sender: "bot", text: "Welcome to ChatCut! Edit videos with words, not clicks!" },
  ]);
  // sequential reply index (loops when reaching the end)
  const replyIndexRef = useRef(0);

  const addMessage = (msg) => {
    setMessage((prev) => [...prev, msg]);
  };

  const writeToConsole = (consoleMessage) => {
    // Accept string or message-like objects for backward compatibility
    if (typeof consoleMessage === "string") {
      addMessage({ id: Date.now().toString(), sender: "bot", text: consoleMessage });
    } else if (consoleMessage && consoleMessage.text) {
      addMessage(consoleMessage);
    }
  };

  const clearConsole = () => {
    setMessage([]);
  };

  

  const onSend = (text) => {
    if (!text || !text.trim()) return;
    const userMsg = { id: `u-${Date.now()}`, sender: "user", text: text.trim() };
    addMessage(userMsg);
    selectClips(text);
  };

  async function selectClips(text) {
    try {
      
      // Get active project
      const project = await ppro.Project.getActiveProject();
      const sequence = await project.getActiveSequence();
      const selection = await sequence.getSelection();
      const trackItems = await selection.getTrackItems();
      console.log("Select Clips with prompt:", { trackItems, text });
      // Send prompt and trackitems to backend
      // Axios or fetch logic would go here

      editClips(ppro,project,trackItems, text);



    } catch (err) {
      console.error("Edit function error:", err);
      addMessage({ 
        id: `err-${Date.now()}`, 
        sender: "bot", 
        text: `Error: ${err.message || err}` 
      });
    }
  }

  async function editClips(ppro, project, trackItems, text) {
    try {
      writeToConsole("Applying edits...");
      
      // Demo: apply zoom + transition + filter
      await applyComprehensiveDemo();
      
      writeToConsole("✅ Edits complete!");
    } catch (err) {
      writeToConsole(`❌ Error: ${err.message}`);
    }
  }

  return (
    <>
      <div className="plugin-container">
        <Header />
        <Content message={message} />
        <Footer writeToConsole={writeToConsole} clearConsole={clearConsole} onSend={onSend} />
      </div>
      <style>
        {`
    .plugin-container {
      color: white;
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      height: 100%;
      min-width: 300px;
      min-height: 300px;
      box-sizing: border-box;
    }
    .plugin-container > sp-body { flex: 0 0 auto; }
    .plugin-container > .plugin-content, .plugin-container > div.plugin-content { flex: 1 1 auto; }
    `}
      </style>
    </>
  );
};
