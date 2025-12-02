import React, { useState, useRef } from "react";
import { Content } from "./content";
import { Footer } from "./footer";
import { Header } from "./header";
import { dispatchAction } from "../services/actionDispatcher";
import { processPrompt, processMedia } from "../services/backendClient";
import { getSelectedMediaFilePaths } from "../services/clipUtils";

const ppro = require("premierepro");

export const Container = () => {
  // messages are objects: { id: string, sender: 'user'|'bot', text: string }
  const [message, setMessage] = useState([
    { id: "welcome", sender: "bot", text: "Welcome to ChatCut! Edit videos with words, not clicks!" },
  ]);
  // sequential reply index (loops when reaching the end)
  const replyIndexRef = useRef(0);
  
  // Toggle for process media mode (send file paths to AI)
  const [processMediaMode, setProcessMediaMode] = useState(true);

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
        editClips(ppro, project, audioTrackItems, text, aiResponse);
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
        editClips(ppro, project, videoTrackItems, text, aiResponse);
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

  async function editClips(ppro, project, trackItems, text, precomputedAiResponse = null) {
    let aiResponse = null; // Declare outside try block for error handling
    try {
      // Check if we have selected clips
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
        
        // Determine which backend call to use based on processMediaMode
        if (processMediaMode) {
          // Get file paths from selected clips
          const filePaths = await getSelectedMediaFilePaths(project);
          writeToConsole(`Sending ${filePaths.length} media file path(s) to Backend`);
          aiResponse = await processMedia(filePaths, text);
        } else {
          // Standard prompt-only processing
          aiResponse = await processPrompt(text);
        }
      } else {
        writeToConsole(`🤖 Using precomputed AI response`);
      }
      
      // Log AI response for debugging
      console.log("[Edit] AI Response:", aiResponse);
      
      // Show AI confirmation
      if (aiResponse.action) {
        writeToConsole(`✨ AI extracted: "${aiResponse.action}" with parameters: ${JSON.stringify(aiResponse.parameters)}`);
        if (aiResponse.message) {
          writeToConsole(`💬 AI message: ${aiResponse.message}`);
        }
      } else {
        // Handle special non-action responses
        if (aiResponse.error === "SMALL_TALK") {
          // Friendly chat reply without error styling
          writeToConsole(aiResponse.message || "Hi! How can I help edit your video?");
          return;
        }
        // Handle uncertainty messages from backend (no parameters expected)
        if (aiResponse.error === "NEEDS_SELECTION" || aiResponse.error === "NEEDS_SPECIFICATION") {
          writeToConsole(`🤔 ${aiResponse.message}`);
        } else {
          writeToConsole(`❌ AI couldn't understand: ${aiResponse.message || "Try: 'zoom in by 120%', 'zoom out', etc."}`);
          if (aiResponse.error) {
            writeToConsole(`⚠️ Error: ${aiResponse.error}`);
          }
        }
        return;
      }
      
      // Dispatch the action with extracted parameters
      const result = await dispatchAction(
        aiResponse.action,
        trackItems,
        aiResponse.parameters || {}
      );
      
      // Determine if this is an audio action for separate error handling
      const isAudioAction = aiResponse.action === 'adjustVolume' || aiResponse.action === 'applyAudioFilter';
      
      // Report results with separate handling for audio vs video
      if (result.successful > 0) {
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
      } else {
        if (isAudioAction) {
          writeToConsole(`❌ Audio effect failed. Make sure you have audio clips selected and the requested audio filter is available.`);
        } else {
          writeToConsole(`❌ Failed to apply action to any clips. Check console for errors.`);
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

  return (
    <>
      <div className="plugin-container">
        <Header />
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
