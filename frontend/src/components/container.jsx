// src/components/container.jsx
import React, { useState, useRef } from "react";
import { Content } from "./content";
import { Footer } from "./footer";
import { Header } from "./header";
import { dispatchAction, dispatchActions } from "../services/actionDispatcher";
import { getEffectParameters } from "../services/editingActions";
import { processPrompt, processMedia } from "../services/backendClient";
import { getSelectedMediaFilePaths, replaceClipMedia } from "../services/clipUtils";
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
  const [processMediaMode, setProcessMediaMode] = useState(false);

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

  const onSend = (text, contextParams = null) => {
    if (!text || !text.trim()) return;
    const userMsg = { id: `u-${Date.now()}`, sender: "user", text: text.trim() };
    addMessage(userMsg);
    selectClips(text, contextParams);
  };

  const fetchAvailableEffects = async () => {
    try {
      const project = await ppro.Project.getActiveProject();
      if (!project) return [];
      const sequence = await project.getActiveSequence();
      if (!sequence) return [];
      const selection = await sequence.getSelection();
      if (!selection) return [];
      const trackItems = await selection.getTrackItems();
      if (!trackItems || trackItems.length === 0) return [];

      // Use first clip for context
      const item = trackItems[0];
      const params = await getEffectParameters(item);
      
      const results = [];
      for (const p of params) {
        let value = null;
        try {
          // Try simple get value
          value = await p.param.getValue();
        } catch (e) {
          // If fails, try getting value at time 0
          try {
            const time = await ppro.TickTime.createWithSeconds(0);
            value = await p.param.getValueAtTime(time);
          } catch (e2) {
            value = "unknown";
          }
        }
        
        // Handle Keyframe objects
        if (value && typeof value === 'object' && typeof value.getValue === 'function') {
          value = await value.getValue();
        }
        
        results.push({
          component: p.componentDisplayName,
          parameter: p.paramDisplayName,
          value: value,
          id: `${p.componentDisplayName}::${p.paramDisplayName}`
        });
      }
      return results;
    } catch (err) {
      console.error("Error fetching effects:", err);
      return [];
    }
  };

  async function selectClips(text, contextParams = null) {
    try {
      const project = await ppro.Project.getActiveProject();
      if (!project) {
        writeToConsole("❌ No active project. Please open a project in Premiere Pro.");
        return;
      }
      
      const sequence = await project.getActiveSequence();
      if (!sequence) {
        writeToConsole("❌ No active sequence. Please open a sequence in Premiere Pro.");
        return;
      }
      
      const selection = await sequence.getSelection();
      if (!selection) {
        writeToConsole("❌ Could not get selection. Please select clips on the timeline.");
        return;
      }
      
      // First, check what type of action this might be by processing the prompt
      // This helps us determine if we need video or audio clips
      let aiResponse;
      try {
        aiResponse = await processPrompt(text);
        console.log("[SelectClips] AI preview:", aiResponse);
      } catch (err) {
        // If AI fails, default to video clips
        console.warn("[SelectClips] Could not preview AI response, defaulting to video clips");
      }
      
      const actionType = aiResponse && aiResponse.action;
      const isAudioAction = actionType === 'adjustVolume' || actionType === 'applyAudioFilter';
      
      if (isAudioAction) {
        // Get audio track items
        const trackItems = await selection.getTrackItems(
          ppro.Constants.TrackItemType.CLIP, 
          true  // true means include all clip types (we'll filter for audio)
        );
        
        // Filter to audio clips only
        const audioTrackItems = [];
        for (let i = 0; i < trackItems.length; i++) {
          try {
            const clip = trackItems[i];
            // Try to get audio component chain - if it works, it's an audio clip
            try {
              const audioComponentChain = await clip.getComponentChain();
              // Check if it's an audio clip by trying to get audio-specific properties
              const mediaType = await clip.getMediaType();
              // If we can get component chain without error, it might be audio
              // More reliable: check if clip is on an audio track
              const trackIndex = await clip.getTrackIndex();
              const audioTrackCount = await sequence.getAudioTrackCount();
              
              if (trackIndex < audioTrackCount) {
                audioTrackItems.push(clip);
              }
            } catch (err) {
              // Not an audio clip, skip
            }
          } catch (err) {
            // Skip this clip
          }
        }
        
        if (audioTrackItems.length === 0) {
          writeToConsole("❌ No audio clips selected. Please select audio clips on audio tracks.");
          return;
        }
        
        console.log("Select Audio Clips with prompt:", { trackItems: audioTrackItems, text });
        editClips(ppro, project, audioTrackItems, text, aiResponse, contextParams);
      } else {
        // Get video track items (default behavior)
        const trackItems = await selection.getTrackItems(
          ppro.Constants.TrackItemType.CLIP, 
          false  // false means only video clips
        );
        
        // Filter to video clips only if needed
        const videoTrackItems = [];
        for (let i = 0; i < trackItems.length; i++) {
          try {
            const clip = trackItems[i];
            const componentChain = await clip.getComponentChain();
            const componentCount = await componentChain.getComponentCount();
            
            // Check if clip has video components (Motion, Transform, etc.)
            let hasVideo = false;
            for (let j = 0; j < componentCount; j++) {
              try {
                const component = await componentChain.getComponentAtIndex(j);
                const matchName = await component.getMatchName();
                if (matchName.includes("Motion") || matchName.includes("ADBE") || matchName.includes("Video")) {
                  hasVideo = true;
                  break;
                }
              } catch (err) {
                // Continue checking
              }
            }
            
            if (hasVideo) {
              videoTrackItems.push(clip);
            }
          } catch (err) {
            // Skip this clip
          }
        }
        
        if (videoTrackItems.length === 0) {
          writeToConsole("❌ No video clips selected. Please select clips with video content on video tracks.");
          return;
        }
        
        console.log("Select Video Clips with prompt:", { trackItems: videoTrackItems, text });
        editClips(ppro, project, videoTrackItems, text, aiResponse, contextParams);
      }
    } catch (err) {
      console.error("Edit function error:", err);
      addMessage({
        id: `err-${Date.now()}`,
        sender: "bot",
        text: `Error: ${err.message || err}`
      });
    }
  }

  async function editClips(ppro, project, trackItems, text, precomputedAiResponse = null, contextParams = null) {
    let aiResponse = null; // Declare outside try block for error handling
    try {
      if (!trackItems || trackItems.length === 0) {
        writeToConsole("❌ No clips selected. Please select at least one clip on the timeline.");
        console.error("[Edit] No trackItems provided");
        return;
      }

      writeToConsole(`Found ${trackItems.length} selected clip(s)`);
      
      // Use precomputed AI response if available, otherwise process the prompt
      aiResponse = precomputedAiResponse;
      
      if (!aiResponse) {
        writeToConsole(`🤖 Sending to AI: "${text}"`);
        if (contextParams) {
          writeToConsole(`📋 With context: ${Object.keys(contextParams).length} parameters`);
        }
        
        // Determine which backend call to use based on processMediaMode
        if (processMediaMode) {
          const duration = await trackItems[0].getDuration();
          console.log("Clip duration (seconds):", duration.seconds);
          if (duration.seconds > 5){
            writeToConsole("❌ Clip too long for generative AI processing. Please trim clip to 5 seconds or less.");
            return;
          }
          const filePaths = await getSelectedMediaFilePaths(project);
          
          if (filePaths.length === 0) {
            writeToConsole("❌ No media files selected. Please select a clip.");
            return;
          }
          
          if (filePaths.length > 1) {
            writeToConsole("⚠️ Multiple clips selected. Processing first clip only.");
          }
          
          const filePath = filePaths[0];
          writeToConsole(`📹 Sending media file to AI: ${filePath.split('/').pop()}`);
          aiResponse = await processMedia(filePath, text);
          
          // If we got a processed video back, replace it in the timeline
          if (aiResponse.output_path && aiResponse.original_path) {
            writeToConsole("🎬 Replacing clip with processed video...");
            
            // Find the track item that uses this original media
            for (const trackItem of trackItems) {
              try {
                const projectItem = await trackItem.getProjectItem();
                const clipProjectItem = ppro.ClipProjectItem.cast(projectItem);
                if (clipProjectItem) {
                  const mediaPath = await clipProjectItem.getMediaFilePath();
                  if (mediaPath === aiResponse.original_path) {
                    const success = await replaceClipMedia(trackItem, aiResponse.output_path);
                    if (success) {
                      writeToConsole(`✅ Replaced clip with processed video!`);
                    } else {
                      writeToConsole(`⚠️ Failed to replace clip`);
                    }
                    break; // Only replace first matching clip
                  }
                }
              } catch (err) {
                console.error("Error replacing clip:", err);
              }
            }
          }
        } else {
          // Standard prompt-only processing
          aiResponse = await processPrompt(text, contextParams);
        }
      } else {
        writeToConsole(`🤖 Using precomputed AI response`);
      }
      
      // Log AI response for debugging
      console.log("[Edit] AI Response:", aiResponse);
      
      // Show AI confirmation
      // Support single-action responses (legacy) and multi-action responses (new)
      if (aiResponse.actions && Array.isArray(aiResponse.actions)) {
        writeToConsole(`✨ AI extracted ${aiResponse.actions.length} actions`);
        if (aiResponse.message) writeToConsole(`💬 AI message: ${aiResponse.message}`);
        for (let i = 0; i < aiResponse.actions.length; i++) {
          const a = aiResponse.actions[i];
          writeToConsole(`  • ${a.action} ${JSON.stringify(a.parameters || {})}`);
        }
      } else if (aiResponse.action) {
        writeToConsole(`✨ AI extracted: "${aiResponse.action}" with parameters: ${JSON.stringify(aiResponse.parameters)}`);
        if (aiResponse.message) {
          writeToConsole(`💬 AI message: ${aiResponse.message}`);
        }
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
      const previousState = await capturePreviousState(trackItems, aiResponse.action || (aiResponse.actions && aiResponse.actions[0]?.action));
      
      // Dispatch the action(s) with extracted parameters
      let dispatchResult;
      const isAudioAction = aiResponse.action === 'adjustVolume' || aiResponse.action === 'applyAudioFilter';
      
      if (aiResponse.actions && Array.isArray(aiResponse.actions)) {
        // Multiple actions
        dispatchResult = await dispatchActions(aiResponse.actions, trackItems);
        const { summary } = dispatchResult;
        if (summary.successful > 0) {
          // Store edit in history for undo (use first action for history)
          const historyEntry = {
            actionName: aiResponse.actions[0].action,
            trackItems: trackItems,
            previousState: previousState,
            parameters: aiResponse.actions[0].parameters || {}
          };
          
          const currentUndoCount = chatCutUndosCount;
          setEditHistory(prev => {
            let newHistory;
            if (currentUndoCount > 0) {
              newHistory = prev.slice(0, prev.length - currentUndoCount);
              newHistory = [...newHistory, historyEntry];
            } else {
              newHistory = [...prev, historyEntry];
            }
            return newHistory;
          });
          
          if (currentUndoCount > 0) {
            setChatCutUndosCount(0);
          }
          
          writeToConsole(`✅ Actions applied successfully to ${summary.successful} clip(s)!`);
          if (summary.failed > 0) writeToConsole(`⚠️ Failed on ${summary.failed} clip(s)`);
          writeToConsole(`ℹ️ Use the panel's Undo button to revert ChatCut edits only.`);
        } else {
          writeToConsole(`❌ Failed to apply actions. Check console for errors.`);
        }
      } else {
        // Single-action (legacy) - with separate audio/video error handling
        dispatchResult = await dispatchAction(aiResponse.action, trackItems, aiResponse.parameters || {});
        const result = dispatchResult;
        
        if (result.successful > 0) {
          // Store edit in history for undo
          const historyEntry = {
            actionName: aiResponse.action,
            trackItems: trackItems,
            previousState: previousState,
            parameters: aiResponse.parameters || {}
          };
          
          const currentUndoCount = chatCutUndosCount;
          setEditHistory(prev => {
            let newHistory;
            if (currentUndoCount > 0) {
              console.log("[Edit] Resetting undo count, trimming", currentUndoCount, "undone edits");
              newHistory = prev.slice(0, prev.length - currentUndoCount);
              newHistory = [...newHistory, historyEntry];
            } else {
              newHistory = [...prev, historyEntry];
            }
            console.log("[Edit] Edit history updated, total edits:", newHistory.length);
            return newHistory;
          });
          
          if (currentUndoCount > 0) {
            setChatCutUndosCount(0);
          }
          
          // Report results with separate handling for audio vs video
          if (isAudioAction) {
            writeToConsole(`✅ Audio effect applied successfully to ${result.successful} clip(s)!`);
          } else {
            writeToConsole(`✅ Action applied successfully to ${result.successful} clip(s)!`);
          }
          if (result.failed > 0) {
            if (isAudioAction) {
              writeToConsole(`⚠️ Audio effect failed on ${result.failed} clip(s). Check that audio clips are selected and have the required audio filters available.`);
            } else {
              writeToConsole(`⚠️ Failed on ${result.failed} clip(s)`);
            }
          }
          writeToConsole(`ℹ️ Use the panel's Undo button to revert ChatCut edits only.`);
        } else {
          if (isAudioAction) {
            writeToConsole(`❌ Audio effect failed. Make sure you have audio clips selected and the requested audio filter is available.`);
          } else {
            writeToConsole(`❌ Failed to apply action to any clips. Check console for errors.`);
          }
          console.log("[Edit] No successful edits, not adding to history");
        }
      }
    } catch (err) {
      const errorMessage = err.message || err;
      
      // Check if this was an audio action based on the AI response
      const isAudioAction = aiResponse && (
        aiResponse.action === 'adjustVolume' || 
        aiResponse.action === 'applyAudioFilter'
      );
      
      if (isAudioAction) {
        writeToConsole(`❌ Audio editing error: ${errorMessage}`);
        writeToConsole(`💡 Audio editing tips: Make sure audio clips are selected, and the requested audio filter exists in Premiere Pro.`);
      } else {
        writeToConsole(`❌ Error: ${errorMessage}`);
        
        // Provide helpful guidance for common errors
        if (errorMessage.includes("Backend server is not running")) {
          writeToConsole(`💡 Hint: Start the backend server by running: cd ChatCut/backend && source venv/bin/activate && python main.py`);
        } else if (errorMessage.includes("503") || errorMessage.includes("Network request failed")) {
          writeToConsole(`💡 Hint: Make sure the backend server is running on port 3001`);
        }
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
          fetchAvailableEffects={fetchAvailableEffects}
        />
      </div>
      <style>
        {`
    .plugin-container {
      background-color: var(--color-bg-dark);
      color: var(--color-text-offwhite);
      padding: 0; /* edge-to-edge */
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
