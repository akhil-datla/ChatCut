import React, { useState, useRef } from "react";
import { Content } from "./content";
import { Footer } from "./footer";
import { Header } from "./header";

const BOT_REPLIES = [
  "Not Implemented",


];

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
    edit(text);

    // Simulate a bot reply (placeholder). Replace with real AI call later.
    setTimeout(() => {
      if (BOT_REPLIES.length === 0) return;
      const replyText = BOT_REPLIES[replyIndexRef.current];
      replyIndexRef.current = (replyIndexRef.current + 1) % BOT_REPLIES.length;
      const botReply = { id: `b-${Date.now()}`, sender: "bot", text: replyText };
      addMessage(botReply);
    }, 700);
  };

  async function edit(text){
    console.log("Editing with text:", text);
    const ppro = require('premierepro');
    const project = await ppro.Project.getActiveProject();
    const seq = await project.getActiveSequence();
    const videoTrack = await seq.getVideoTrack(0);
    const videoTrack2 = await seq.getVideoTrack(1);
    const videoTrackItems = await videoTrack.getTrackItems(1,false)[0];
    console.log(videoTrackItems);
    

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
