import React, { useState, useRef } from "react";
import { Content } from "./content";
import { Footer } from "./footer";
import { Header } from "./header";
import { dispatchAction, dispatchActions } from "../services/actionDispatcher";
import { getEffectParameters } from "../services/editingActions";
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
  const [processMediaMode, setProcessMediaMode] = useState(false);

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
    try {
      // Check if we have selected clips
      if (!trackItems || trackItems.length === 0) {
        writeToConsole("❌ No clips selected. Please select at least one clip on the timeline.");
        console.error("[Edit] No trackItems provided");
        return;
      }
      
      writeToConsole(`Found ${trackItems.length} selected clip(s)`);
      
      // Use precomputed AI response if available, otherwise process the prompt
      let aiResponse = precomputedAiResponse;
      
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
      if (aiResponse.action) {
        writeToConsole(`✨ AI extracted: "${aiResponse.action}" with parameters: ${JSON.stringify(aiResponse.parameters)}`);
        if (aiResponse.message) {
          writeToConsole(`💬 AI message: ${aiResponse.message}`);
        }
      } else if (aiResponse.actions && Array.isArray(aiResponse.actions)) {
        writeToConsole(`✨ AI extracted ${aiResponse.actions.length} actions`);
        if (aiResponse.message) writeToConsole(`💬 AI message: ${aiResponse.message}`);
        for (let i = 0; i < aiResponse.actions.length; i++) {
          const a = aiResponse.actions[i];
          writeToConsole(`  • ${a.action} ${JSON.stringify(a.parameters || {})}`);
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
      
      // Dispatch the action(s) with extracted parameters
      let dispatchResult;
      if (aiResponse.actions && Array.isArray(aiResponse.actions)) {
        // Multiple actions
        dispatchResult = await dispatchActions(aiResponse.actions, trackItems);
        const { summary } = dispatchResult;
        if (summary.successful > 0) {
          writeToConsole(`✅ Actions applied successfully to ${summary.successful} clip(s)!`);
          if (summary.failed > 0) writeToConsole(`⚠️ Failed on ${summary.failed} clip(s)`);
        } else {
          writeToConsole(`❌ Failed to apply actions. Check console for errors.`);
        }
      } else {
        // Single-action (legacy)
        dispatchResult = await dispatchAction(aiResponse.action, trackItems, aiResponse.parameters || {});
        const result = dispatchResult;
        if (result.successful > 0) {
          writeToConsole(`✅ Action applied successfully to ${result.successful} clip(s)!`);
          if (result.failed > 0) {
            writeToConsole(`⚠️ Failed on ${result.failed} clip(s)`);
          }
        } else {
          writeToConsole(`❌ Failed to apply action to any clips. Check console for errors.`);
        }
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
