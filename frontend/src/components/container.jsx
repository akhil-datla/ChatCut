// src/components/container.jsx
import React, { useState, useRef } from "react";
import { Content } from "./content";
import { Footer } from "./footer";
import { Header } from "./header";
import { dispatchAction } from "../services/actionDispatcher";
import { processPrompt, processMedia } from "../services/backendClient";
import { getSelectedMediaFilePaths } from "../services/clipUtils";
import { capturePreviousState, executeUndo } from "../services/undoService";

let ppro;
try {
  ppro = require("premierepro");
  console.log("[Container] Premiere Pro API loaded");
} catch (err) {
  console.error("[Container] Error loading Premiere Pro API:", err);
  // Create a mock object to prevent crashes
  ppro = {
    Project: {
      getActiveProject: async () => {
        throw new Error("Premiere Pro API not available");
      }
    }
  };
}

export const Container = () => {
  console.log("[Container] Rendering Container component");
  const [message, setMessage] = useState([
    { id: "welcome", sender: "bot", text: "Welcome to ChatCut! Edit videos with words, not clicks!" },
  ]);
  const replyIndexRef = useRef(0);

  // Toggle for process media mode (send file paths to AI)
  const [processMediaMode, setProcessMediaMode] = useState(true);

  // Track ChatCut edits: history of edits and undos performed
  const [editHistory, setEditHistory] = useState([]); // Array of { actionName, trackItems, previousState, parameters }
  const [chatCutUndosCount, setChatCutUndosCount] = useState(0);

  const addMessage = (msg) => {
    setMessage((prev) => [...prev, msg]);
  };

  const writeToConsole = (consoleMessage) => {
    if (typeof consoleMessage === "string") {
      addMessage({ id: Date.now().toString(), sender: "bot", text: consoleMessage });
    } else if (consoleMessage && consoleMessage.text) {
      addMessage(consoleMessage);
    }
  };

  const clearConsole = () => setMessage([]);

  // Undo handler: only undo ChatCut edits using custom undo service
  const handleUndo = async () => {
    console.log("[Undo] handleUndo called - current state:", {
      editHistoryLength: editHistory.length,
      chatCutUndosCount,
      editHistory: editHistory.map(e => e.actionName)
    });
    
    const remainingEdits = editHistory.length - chatCutUndosCount;
    
    if (remainingEdits <= 0) {
      writeToConsole("ℹ️ No ChatCut edits to undo.");
      writeToConsole(`💡 Tip: Make a new ChatCut edit first, then you can undo it.`);
      console.log("[Undo] No remaining ChatCut edits to undo");
      return;
    }
    
    // Get the edit to undo (most recent one that hasn't been undone)
    const editIndex = editHistory.length - chatCutUndosCount - 1;
    const historyEntry = editHistory[editIndex];
    
    if (!historyEntry) {
      writeToConsole("❌ Could not find edit history entry to undo.");
      console.error("[Undo] historyEntry is null/undefined at index:", editIndex);
      return;
    }
    
    writeToConsole(`🔄 Attempting to undo ChatCut edit ${chatCutUndosCount + 1} of ${editHistory.length} (${historyEntry.actionName})...`);
    
    try {
      const result = await executeUndo(historyEntry);
      if (result.successful > 0) {
        // Update undo count after successful undo
        setChatCutUndosCount(prev => {
          const newCount = prev + 1;
          console.log("[Undo] Undo count updated to:", newCount);
          return newCount;
        });
        writeToConsole(`↩️ Undo completed! Reversed ${result.successful} clip(s).`);
        if (result.failed > 0) {
          writeToConsole(`⚠️ Failed to undo ${result.failed} clip(s).`);
        }
      } else {
        writeToConsole("❌ Undo failed - could not reverse the edit.");
        console.error("[Undo] executeUndo returned no successful undos");
      }
    } catch (err) {
      writeToConsole(`❌ Undo failed with error: ${err.message || err}`);
      console.error("[Undo] executeUndo threw exception:", err);
    }
  };
  
  // Redo handler: not implemented yet (would require re-applying the edit)
  const handleRedo = async () => {
    writeToConsole("ℹ️ Redo is not yet implemented. Use Premiere's native undo/redo (Ctrl+Z / Ctrl+Shift+Z) if needed.");
  };

  const onSend = (text) => {
    if (!text || !text.trim()) return;
    const userMsg = { id: `u-${Date.now()}`, sender: "user", text: text.trim() };
    addMessage(userMsg);
    selectClips(text);
  };

  async function selectClips(text) {
    try {
      const project = await ppro.Project.getActiveProject();
      const sequence = await project.getActiveSequence();
      const selection = await sequence.getSelection();

      // Only video clips (Motion effect is on video)
      const trackItems = await selection.getTrackItems(
        ppro.Constants.TrackItemType.CLIP,
        false // only video clips
      );

      // Filter clips that have video components
      const videoTrackItems = [];
      for (let i = 0; i < trackItems.length; i++) {
        try {
          const clip = trackItems[i];
          const componentChain = await clip.getComponentChain();
          const componentCount = await componentChain.getComponentCount();
          let hasVideo = false;
          for (let j = 0; j < componentCount; j++) {
            try {
              const component = await componentChain.getComponentAtIndex(j);
              const matchName = await component.getMatchName();
              if (matchName.includes("Motion") || matchName.includes("ADBE") || matchName.includes("Video")) {
                hasVideo = true;
                break;
              }
            } catch (_) {}
          }
          if (hasVideo) videoTrackItems.push(clip);
        } catch (_) {}
      }

      if (videoTrackItems.length === 0) {
        writeToConsole("❌ No video clips selected. Please select clips with video content on video tracks.");
        return;
      }

      console.log("Select Clips with prompt:", { trackItems: videoTrackItems, text });

      await editClips(ppro, project, videoTrackItems, text);
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
      if (!trackItems || trackItems.length === 0) {
        writeToConsole("❌ No clips selected. Please select at least one clip on the timeline.");
        console.error("[Edit] No trackItems provided");
        return;
      }

      writeToConsole(`Found ${trackItems.length} selected clip(s)`);
      writeToConsole(`🤖 Sending to AI: "${text}"`);

      // Choose prompt vs media flow
      let aiResponse;
      if (processMediaMode) {
        const filePaths = await getSelectedMediaFilePaths(project);
        if (filePaths.length === 0) {
          writeToConsole(`⚠️ No accessible file paths found. Falling back to prompt-only mode.`);
          writeToConsole(`💡 Tip: Make sure clips are not offline and have valid media paths.`);
          aiResponse = await processPrompt(text);
        } else {
          writeToConsole(`Sending ${filePaths.length} media file path(s) to Backend`);
          aiResponse = await processMedia(filePaths, text);
          if (aiResponse.error === "FILE_ACCESS_ERROR") {
            writeToConsole(`⚠️ File access error. Falling back to prompt-only mode.`);
            aiResponse = await processPrompt(text);
          }
        }
      } else {
        aiResponse = await processPrompt(text);
      }

      console.log("[Edit] AI Response:", aiResponse);

      if (aiResponse.action) {
        writeToConsole(`✨ AI extracted: "${aiResponse.action}" with parameters: ${JSON.stringify(aiResponse.parameters)}`);
        if (aiResponse.message) writeToConsole(`💬 AI message: ${aiResponse.message}`);
      } else {
        if (aiResponse.error === "SMALL_TALK") {
          writeToConsole(aiResponse.message || "Hi! How can I help edit your video?");
          return;
        }
        if (aiResponse.error === "NEEDS_SELECTION" || aiResponse.error === "NEEDS_SPECIFICATION") {
          writeToConsole(`🤔 ${aiResponse.message}`);
        } else {
          writeToConsole(`❌ AI couldn't understand: ${aiResponse.message || "Try: 'zoom in by 120%', 'zoom out', etc."}`);
          if (aiResponse.error) writeToConsole(`⚠️ Error: ${aiResponse.error}`);
        }
        return;
      }

      // Capture previous state before making the edit (for undo)
      writeToConsole("📸 Capturing previous state for undo...");
      const previousState = await capturePreviousState(trackItems, aiResponse.action);
      
      // Dispatch the edit to Premiere (editingActions.js handles Undo Groups)
      const result = await dispatchAction(
        aiResponse.action,
        trackItems,
        aiResponse.parameters || {}
      );

      if (result.successful > 0) {
        // Store edit in history for undo
        const historyEntry = {
          actionName: aiResponse.action,
          trackItems: trackItems,
          previousState: previousState,
          parameters: aiResponse.parameters || {}
        };
        
        // Read current undo count before state updates
        const currentUndoCount = chatCutUndosCount;
        
        // Update history and reset undo count
        setEditHistory(prev => {
          let newHistory;
          if (currentUndoCount > 0) {
            // Remove undone edits from history and add new one
            console.log("[Edit] Resetting undo count, trimming", currentUndoCount, "undone edits");
            newHistory = prev.slice(0, prev.length - currentUndoCount);
            newHistory = [...newHistory, historyEntry];
          } else {
            // Just add new edit
            newHistory = [...prev, historyEntry];
          }
          console.log("[Edit] Edit history updated, total edits:", newHistory.length);
          return newHistory;
        });
        
        // Reset undo count if needed
        if (currentUndoCount > 0) {
          setChatCutUndosCount(0);
        }
        
        writeToConsole(`✅ Action applied successfully to ${result.successful} clip(s)!`);
        if (result.failed > 0) writeToConsole(`⚠️ Failed on ${result.failed} clip(s)`);
        writeToConsole(`ℹ️ Use the panel's Undo button to revert ChatCut edits only.`);
      } else {
        writeToConsole(`❌ Failed to apply action to any clips. Check console for errors.`);
        console.log("[Edit] No successful edits, not adding to history");
      }
    } catch (err) {
      const errorMessage = err.message || err;
      writeToConsole(`❌ Error: ${errorMessage}`);

      if (errorMessage.includes("Backend server is not running")) {
        writeToConsole(`💡 Hint: Start the backend: cd ChatCut/backend && . .venv/bin/activate && python main.py`);
      } else if (errorMessage.includes("503") || errorMessage.includes("Network request failed")) {
        writeToConsole(`💡 Hint: Make sure the backend server is running on port 3001`);
      }

      console.error("[Edit] Edit function error:", err);
    }
  }

  // Calculate canUndo value
  const canUndo = editHistory.length > chatCutUndosCount;
  
  // Debug logging
  console.log("[Container] Render - canUndo calculation:", {
    editHistoryLength: editHistory.length,
    chatCutUndosCount,
    canUndo,
    editHistory: editHistory.map(e => e.actionName)
  });

  return (
    <>
      <div className="plugin-container">
        <Header
          onUndo={handleUndo}
          canUndo={canUndo}
        />
        {/* Debug info - always show to help diagnose undo issues */}
        <div style={{ 
          fontSize: '10px', 
          opacity: 0.7, 
          padding: '4px', 
          borderTop: '1px solid rgba(255,255,255,0.1)',
          backgroundColor: editHistory.length > chatCutUndosCount ? 'rgba(0,255,0,0.1)' : 'rgba(255,0,0,0.1)'
        }}>
          ChatCut Edits: {editHistory.length} | Undone: {chatCutUndosCount} | Undo Available: {editHistory.length > chatCutUndosCount ? '✅ Yes' : '❌ No'}
          {editHistory.length > 0 && (
            <span style={{ marginLeft: '8px', fontSize: '9px' }}>
              (Last: {editHistory[editHistory.length - 1] && editHistory[editHistory.length - 1].actionName || 'N/A'})
            </span>
          )}
        </div>
        <Content message={message} />
        <Footer
          writeToConsole={writeToConsole}
          clearConsole={clearConsole}
          onSend={onSend}
          processMediaMode={processMediaMode}
          setProcessMediaMode={setProcessMediaMode}
        />
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
