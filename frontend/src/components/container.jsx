import React, { useState, useRef } from "react";
import { Content } from "./content";
import { Footer } from "./footer";
import { Header } from "./header";
import { dispatchAction, dispatchActions } from "../services/actionDispatcher";
import { getEffectParameters } from "../services/editingActions";
import { processPrompt, processMedia, processWithColabStream } from "../services/backendClient";
import { getSelectedMediaFilePaths, replaceClipMedia, getClipTimingInfo } from "../services/clipUtils";
import { capturePreviousState, executeUndo } from "../services/undoService";
import "./container.css";

const ppro = require("premierepro");

export const Container = () => {
  // messages are objects: { id: string, sender: 'user'|'bot', text: string }
  const [message, setMessage] = useState([
    { id: "welcome", sender: "bot", text: "Welcome to ChatCut! Edit videos with words, not clicks!" },
  ]);
  // sequential reply index (loops when reaching the end)
  const replyIndexRef = useRef(0);
  
  // Editing mode: "none" | "object_tracking" | "ai_video"
  const [editingMode, setEditingMode] = useState("none");

  // Colab mode state
  const [colabMode, setColabMode] = useState(false);
  const [colabUrl, setColabUrl] = useState("");

  // Progress tracking for Colab processing
  const [processingProgress, setProcessingProgress] = useState(null); // null when not processing, 0-100 when active
  const [processingMessage, setProcessingMessage] = useState("");
  const [processingStage, setProcessingStage] = useState("");
  
  // Loading state for regular AI processing (non-Colab modes)
  const [isProcessing, setIsProcessing] = useState(false);

  // Track ChatCut edits: history of edits and undos performed
  const [editHistory, setEditHistory] = useState([]); // Array of { actionName, trackItems, previousState, parameters }
  const [chatCutUndosCount, setChatCutUndosCount] = useState(0);

  const addMessage = (msg) => {
    setMessage((prev) => [...prev, msg]);
  };

  const writeToConsole = (consoleMessage) => {
    // Accept string or message-like objects for backward compatibility
    const messageId = Date.now().toString();
    if (typeof consoleMessage === "string") {
      addMessage({ 
        id: messageId, 
        sender: "bot", 
        text: consoleMessage,
        isTyping: true, 
        typingSpeed: 10
      });
    } else if (consoleMessage && consoleMessage.text) {
      addMessage({
        ...consoleMessage,
        id: consoleMessage.id || messageId,
        isTyping: true,
        typingSpeed: 10
      });
    }
  };

  const showLoadingIndicator = () => {
    // Remove any existing loading indicator first to avoid duplicates
    setMessage((prev) => prev.filter((m) => m.id !== "loading-indicator"));
    
    // Add new loading indicator
    addMessage({ 
      id: "loading-indicator", 
      sender: "bot", 
      text: "Processing", 
      isLoading: true 
    });
  };

  const hideLoadingIndicator = () => {
    setMessage((prev) => prev.filter((m) => m.id !== "loading-indicator"));
  };

  const clearConsole = () => {
    setMessage([]);
  };

  /**
   * Replace timeline clip with processed video
   * Works for both Runway and Colab pipelines
   */
  const replaceClipWithProcessed = async (trackItems, response, writeToConsole) => {
    if (!response.output_path || !response.original_path) {
      return false;
    }

            for (const trackItem of trackItems) {
              try {
                const projectItem = await trackItem.getProjectItem();
                const clipProjectItem = ppro.ClipProjectItem.cast(projectItem);
                if (clipProjectItem) {
                  const mediaPath = await clipProjectItem.getMediaFilePath();
                  if (mediaPath === response.original_path) {
                    const success = await replaceClipMedia(trackItem, response.output_path);
                    if (success) {
                      // Success - no message needed
                      return true;
                    } else {
                      writeToConsole(`⚠️ Failed to replace clip`);
                      return false;
                    }
                  }
                }
              } catch (err) {
                console.error("Error replacing clip:", err);
              }
            }
            return false;
  };

  // Undo handler: only undo ChatCut edits using custom undo service
  const handleUndo = async () => {
    const remainingEdits = editHistory.length - chatCutUndosCount;
    
    if (remainingEdits <= 0) {
      writeToConsole("ℹ️ No ChatCut edits to undo.");
      return;
    }
    
    // Get the edit to undo (most recent one that hasn't been undone)
    const editIndex = editHistory.length - chatCutUndosCount - 1;
    const historyEntry = editHistory[editIndex];
    
    if (!historyEntry) {
      writeToConsole("❌ Could not find edit history entry to undo.");
      return;
    }
    
    writeToConsole(`🔄 Attempting to undo ChatCut edit (${historyEntry.actionName})...`);
    
    try {
      const result = await executeUndo(historyEntry);
      if (result.successful > 0) {
        // Update undo count after successful undo
        setChatCutUndosCount(prev => prev + 1);
        writeToConsole(`↩️ Undo completed! Reversed ${result.successful} clip(s).`);
        if (result.failed > 0) {
          writeToConsole(`⚠️ Failed to undo ${result.failed} clip(s).`);
        }
      } else {
        writeToConsole("❌ Undo failed - could not reverse the edit.");
      }
    } catch (err) {
      writeToConsole(`❌ Undo failed with error: ${err.message || err}`);
    }
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
        // Skip Motion and Opacity effects
        if (p.isBuiltIn) {
          continue;
        }
        
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
        setIsProcessing(false);
        return;
      }

      const sequence = await project.getActiveSequence();
      if (!sequence) {
        writeToConsole("❌ No active sequence. Please open a sequence in Premiere Pro.");
        setIsProcessing(false);
        return;
      }

      const selection = await sequence.getSelection();
      if (!selection) {
        writeToConsole("❌ Could not get selection. Please select clips on the timeline.");
        setIsProcessing(false);
        return;
      }

      // For Colab mode and AI video mode, skip AI preview and go straight to video clips
      // Colab handles all processing itself (tracking, effects, etc.)
      // AI video mode processes with processMedia instead of processPrompt
      let aiResponse;
      let isAudioAction = false;

      if (!colabMode && editingMode !== "ai_video") {
        // First, check what type of action this might be by processing the prompt
        // This helps us determine if we need video or audio clips
        try {
          setIsProcessing(true);
          showLoadingIndicator();
          aiResponse = await processPrompt(text, contextParams);
          console.log("[SelectClips] AI preview:", aiResponse);
        } catch (err) {
          // If AI fails, default to video clips
          console.warn("[SelectClips] Could not preview AI response, defaulting to video clips");
        } finally {
          // Keep processing true if we continue to editClips, but hide loading for now as editClips might show it again if needed
          // Actually editClips will show it if aiResponse is null, but here aiResponse might be populated.
          // If we have aiResponse, editClips won't show loading.
          // So we should hide it here if we are done with this step.
          hideLoadingIndicator();
          // We don't set isProcessing(false) yet because editClips might need it, 
          // but editClips handles its own processing state logic.
          // If we set it to false here, it might flicker.
          // However, if selectClips returns early (e.g. no clips), we need to make sure it's false.
          // For now, let's just hide the indicator.
        }

        const actionType = aiResponse && aiResponse.action;
        isAudioAction = actionType === 'adjustVolume' || actionType === 'applyAudioFilter';
      }
      
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
          setIsProcessing(false);
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
          setIsProcessing(false);
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
      setIsProcessing(false);
    }
  }

  async function editClips(ppro, project, trackItems, text, precomputedAiResponse = null, contextParams = null) {
    let aiResponse = null; // Declare outside try block for error handling
    try {
      // Check if we have selected clips
      if (!trackItems || trackItems.length === 0) {
        writeToConsole("❌ No clips selected. Please select at least one clip on the timeline.");
        console.error("[Edit] No trackItems provided");
        return;
      }
      
      // Use precomputed AI response if available, otherwise process the prompt
      aiResponse = precomputedAiResponse;
      
      if (!aiResponse) {
        // Show loading indicator for non-Colab modes
        if (editingMode !== 'object_tracking' && !colabMode) {
          setIsProcessing(true);
          showLoadingIndicator();
        }
        
        // Determine which backend call to use based on mode
        // Object tracking mode automatically enables Colab (set in Footer component)
        if (colabMode || editingMode === 'object_tracking') {
          // Colab object tracking mode with SSE streaming
          if (!colabUrl || !colabUrl.trim()) {
            hideLoadingIndicator();
            writeToConsole("❌ No Colab URL set. Please paste your ngrok URL from Colab.");
            return;
          }

          // Get timing info for server-side trimming (prevents uploading full source files)
          const timingInfo = await getClipTimingInfo(trackItems[0]);
          if (!timingInfo) {
            hideLoadingIndicator();
            writeToConsole("❌ Could not get clip timing info. Please select a valid clip.");
            return;
          }

          const filePath = timingInfo.filePath;
          const clipDuration = timingInfo.duration;

          console.log(`[Colab] Trimmed clip: ${clipDuration.toFixed(2)}s (${timingInfo.inPoint.toFixed(2)}s - ${timingInfo.outPoint.toFixed(2)}s)`);

          // Start progress tracking (loading bar shows all progress info)
          setProcessingProgress(0);
          setProcessingMessage("Starting...");
          setProcessingStage("upload");

          try {
            const colabResponse = await processWithColabStream(
              filePath,
              text,
              colabUrl,
              // Progress callback - update progress bar only (no chat spam)
              (stage, progress, message, data) => {
                setProcessingProgress(progress);
                setProcessingMessage(message);
                setProcessingStage(stage);
              },
              // Trim info for server-side FFmpeg trimming
              { trim_start: timingInfo.inPoint, trim_end: timingInfo.outPoint }
            );

            // Clear progress bar
            setProcessingProgress(null);
            setProcessingMessage("");
            setProcessingStage("");

            if (colabResponse.error) {
              hideLoadingIndicator();
              writeToConsole(`❌ Colab error: ${colabResponse.message}`);
              return;
            }

            // Use shared helper for clip replacement (same as Runway)
            await replaceClipWithProcessed(trackItems, colabResponse, writeToConsole);
          } catch (err) {
            // Clear progress bar on error
            setProcessingProgress(null);
            setProcessingMessage("");
            setProcessingStage("");
            hideLoadingIndicator();
            writeToConsole(`❌ Colab processing failed: ${err.message}`);
          }
          return; // Don't continue to standard AI processing

        } else if (editingMode === "ai_video") {
          const duration = await trackItems[0].getDuration();
          console.log("Clip duration (seconds):", duration.seconds);
          if (duration.seconds > 5){
            hideLoadingIndicator();
            writeToConsole("❌ Clip too long for generative AI processing. Please trim clip to 5 seconds or less.");
            return;
          }
          const filePaths = await getSelectedMediaFilePaths(project);

          if (filePaths.length === 0) {
            hideLoadingIndicator();
            writeToConsole("❌ No media files selected. Please select a clip.");
            return;
          }

          if (filePaths.length > 1) {
            writeToConsole("⚠️ Multiple clips selected. Processing first clip only.");
          }

          const filePath = filePaths[0];
          aiResponse = await processMedia(filePath, text);

          // Use shared helper for clip replacement (same as Colab)
          if (aiResponse.output_path && aiResponse.original_path) {
            await replaceClipWithProcessed(trackItems, aiResponse, writeToConsole);
          }
        } else {
          // Regular native edits mode (editingMode === "none")
          aiResponse = await processPrompt(text, contextParams);
          
        }
      }
      
      // Hide loading indicator
      hideLoadingIndicator();
      
      // Clear loading state for non-Colab modes
      if (editingMode !== 'object_tracking' && !colabMode) {
        setIsProcessing(false);
      }
      
      // Log AI response for debugging
      console.log("[Edit] AI Response:", aiResponse);
      
      // Check if this is a successful AI video processing response (has output_path but no action)
      if (aiResponse.output_path && aiResponse.original_path && !aiResponse.action && !aiResponse.actions) {
        // Show success message with typing animation
        writeToConsole("✅ Successfully generated AI video");
        return;
      }
      
      // Show AI message only when successful (with typing animation)
      // Support single-action responses (legacy) and multi-action responses (new)
      if (aiResponse.action) {
        // Only show the AI message, not the extraction details
        if (aiResponse.message) {
          writeToConsole(aiResponse.message);
        }
      } else if (aiResponse.actions && Array.isArray(aiResponse.actions)) {
        // Only show the AI message if available
        if (aiResponse.message) {
          writeToConsole(aiResponse.message);
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
          writeToConsole(`${aiResponse.message}`); // Don't type error messages
        } else {
          writeToConsole(`❌ AI couldn't understand: ${aiResponse.message || "Try: 'zoom in by 120%', 'zoom out', etc."}`);
          if (aiResponse.error) {
            writeToConsole(`⚠️ Error: ${aiResponse.error}`);
          }
        }
        return;
      }
      
      // Capture previous state before making the edit (for undo)
      let previousState = null;
      try {
        const actionName = aiResponse.action || (aiResponse.actions && aiResponse.actions[0] && aiResponse.actions[0].action);
        if (actionName) {
          previousState = await capturePreviousState(trackItems, actionName);
        }
      } catch (err) {
        console.error("[Edit] Error capturing previous state (non-blocking):", err);
      }
      
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
          setEditHistory(prev => [...prev, historyEntry]);
          // Success - no need to show message, AI message was already shown
        } else {
          writeToConsole(`❌ Failed to apply actions. Check console for errors.`);
        }
      } else {
        // Single-action (legacy) - with separate audio/video error handling
        dispatchResult = await dispatchAction(aiResponse.action, trackItems, aiResponse.parameters || {});
        const result = dispatchResult;
        
        // Report results with separate handling for audio vs video
        if (result.successful > 0) {
          // Store edit in history for undo
          const historyEntry = {
            actionName: aiResponse.action,
            trackItems: trackItems,
            previousState: previousState,
            parameters: aiResponse.parameters || {}
          };
          setEditHistory(prev => [...prev, historyEntry]);
          // Success - no need to show message, AI message was already shown
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
      
      // Hide loading indicator on error
      hideLoadingIndicator();
      
      // Clear loading state on error
      setIsProcessing(false);
    }
  }

  return (
      <div className="plugin-container">
        <Header />
        <Content message={message} />
          <Footer
            writeToConsole={writeToConsole}
          clearConsole={clearConsole}
          onSend={onSend}
          onUndo={handleUndo}
          canUndo={editHistory.length > chatCutUndosCount}
          editingMode={editingMode}
          setEditingMode={setEditingMode}
          colabMode={colabMode}
          setColabMode={setColabMode}
          colabUrl={colabUrl}
          setColabUrl={setColabUrl}
          fetchAvailableEffects={fetchAvailableEffects}
          processingProgress={processingProgress}
          processingMessage={processingMessage}
          processingStage={processingStage}
          isProcessing={isProcessing}
        />
    </div>
  );
};
