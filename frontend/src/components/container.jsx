import React, { useState, useRef } from "react";
import { Content } from "./content";
import { Footer } from "./footer";
import { Header } from "./header";
import { dispatchAction } from "../services/actionDispatcher";
import { processPrompt, processMedia } from "../services/backendClient";
import { getSelectedMediaFilePaths, replaceClipMedia } from "../services/clipUtils";

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
      const sequence = await project.getActiveSequence();
      const selection = await sequence.getSelection();
      
      // Get only video track items (Motion effect only works on video clips)
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
      
      console.log("Select Clips with prompt:", { trackItems: videoTrackItems, text });
      // Send prompt and trackitems to backend
      // Axios or fetch logic would go here

      editClips(ppro, project, videoTrackItems, text);



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
      // Check if we have selected clips
      if (!trackItems || trackItems.length === 0) {
        writeToConsole("❌ No clips selected. Please select at least one clip on the timeline.");
        console.error("[Edit] No trackItems provided");
        return;
      }
      
      writeToConsole(`Found ${trackItems.length} selected clip(s)`);
      writeToConsole(`🤖 Sending to AI: "${text}"`);
      
      // Determine which backend call to use based on processMediaMode
      let aiResponse;
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
        aiResponse = await processPrompt(text);
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
      
      // Report results
      if (result.successful > 0) {
        writeToConsole(`✅ Action applied successfully to ${result.successful} clip(s)!`);
        if (result.failed > 0) {
          writeToConsole(`⚠️ Failed on ${result.failed} clip(s)`);
        }
      } else {
        writeToConsole(`❌ Failed to apply action to any clips. Check console for errors.`);
      }
      
    } catch (err) {
      const errorMessage = err.message || err;
      writeToConsole(`❌ Error: ${errorMessage}`);
      
      // Provide helpful guidance for common errors
      if (errorMessage.includes("Backend server is not running")) {
        writeToConsole(`💡 Hint: Start the backend server by running: cd ChatCut/backend && source venv/bin/activate && python main.py`);
      } else if (errorMessage.includes("503") || errorMessage.includes("Network request failed")) {
        writeToConsole(`💡 Hint: Make sure the backend server is running on port 3001`);
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
