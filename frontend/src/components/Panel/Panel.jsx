/**
 * Panel - Main ChatCut panel component
 * Orchestrates all UI and business logic
 */
import React, { useState, useCallback } from "react";
import { Header } from "../Header";
import { ChatArea } from "../ChatArea";
// Footer component removed - using footer.jsx instead
// import { Footer } from "../Footer";
import { EDIT_MODES } from "../Footer/ModeSelector";
import { useChat, useEditHistory, usePremiere } from "../../hooks";
import { processPrompt, processMedia } from "../../services/backendClient";
import { dispatchAction, dispatchActions } from "../../services/actionDispatcher";
import { capturePreviousState } from "../../services/undoService";
import { getSelectedMediaFilePaths, replaceClipMedia } from "../../services/clipUtils";
import "./Panel.css";

export const Panel = () => {
  // State
  const [mode, setMode] = useState(EDIT_MODES.NATIVE);
  const [selectedContexts, setSelectedContexts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Hooks
  const { messages, addUserMessage, addBotMessage } = useChat();
  const { canUndo, recordEdit, undo } = useEditHistory();
  const { ppro, getProject, getSequence, getSelectedVideoClips, fetchAvailableEffects } = usePremiere();

  /**
   * Handle sending a message
   */
  const handleSend = useCallback(async (text) => {
    if (!text.trim() || isLoading) return;

    addUserMessage(text);
    setIsLoading(true);

    try {
      // Validate project/sequence
      const project = await getProject();
      if (!project) {
        addBotMessage("❌ No active project. Please open a project in Premiere Pro.");
        setIsLoading(false);
        return;
      }

      const sequence = await getSequence();
      if (!sequence) {
        addBotMessage("❌ No active sequence. Please open a sequence.");
        setIsLoading(false);
        return;
      }

      // Get selected clips
      const trackItems = await getSelectedVideoClips();
      if (trackItems.length === 0) {
        addBotMessage("❌ No video clips selected. Please select clips on the timeline.");
        setIsLoading(false);
        return;
      }

      addBotMessage(`Found ${trackItems.length} selected clip(s)`);

      // Handle different modes
      let aiResponse;

      if (mode === EDIT_MODES.AI_GENERATION) {
        // AI Generation mode - send media to backend
        const duration = await trackItems[0].getDuration();
        if (duration.seconds > 5) {
          addBotMessage("❌ Clip too long for AI processing. Please trim to 5 seconds or less.");
          setIsLoading(false);
          return;
        }

        const filePaths = await getSelectedMediaFilePaths(project);
        if (filePaths.length === 0) {
          addBotMessage("❌ No media files selected.");
          setIsLoading(false);
          return;
        }

        addBotMessage(`📹 Sending media to AI: ${filePaths[0].split('/').pop()}`);
        aiResponse = await processMedia(filePaths[0], text);

        // Replace clip with processed video if we got one back
        if (aiResponse.output_path && aiResponse.original_path) {
          addBotMessage("🎬 Replacing clip with processed video...");
          for (const trackItem of trackItems) {
            try {
              const projectItem = await trackItem.getProjectItem();
              const clipProjectItem = ppro.ClipProjectItem.cast(projectItem);
              if (clipProjectItem) {
                const mediaPath = await clipProjectItem.getMediaFilePath();
                if (mediaPath === aiResponse.original_path) {
                  const success = await replaceClipMedia(trackItem, aiResponse.output_path);
                  addBotMessage(success ? "✅ Replaced clip with processed video!" : "⚠️ Failed to replace clip");
                  break;
                }
              }
            } catch (err) {
              console.error("[Panel] Error replacing clip:", err);
            }
          }
        }
      } else {
        // Native edits mode - process prompt
        const contextParams = selectedContexts.length > 0
          ? selectedContexts.reduce((acc, ctx) => ({ ...acc, [ctx.name]: ctx.params }), {})
          : null;

        addBotMessage(`🤖 Processing: "${text}"`);
        aiResponse = await processPrompt(text, contextParams);
      }

      // Handle AI response
      console.log("[Panel] AI Response:", aiResponse);

      // Check for non-action responses
      if (aiResponse.error === "SMALL_TALK") {
        addBotMessage(aiResponse.message || "Hi! How can I help edit your video?");
        setIsLoading(false);
        return;
      }

      if (aiResponse.error === "NEEDS_SELECTION" || aiResponse.error === "NEEDS_SPECIFICATION") {
        addBotMessage(`🤔 ${aiResponse.message}`);
        setIsLoading(false);
        return;
      }

      if (!aiResponse.action && !aiResponse.actions) {
        addBotMessage(`❌ ${aiResponse.message || "Couldn't understand request. Try: 'zoom in by 120%', 'add blur', etc."}`);
        setIsLoading(false);
        return;
      }

      // Show what we're about to do
      if (aiResponse.actions && Array.isArray(aiResponse.actions)) {
        addBotMessage(`✨ Applying ${aiResponse.actions.length} action(s)...`);
      } else {
        addBotMessage(`✨ Applying: ${aiResponse.action}`);
      }

      // Capture state for undo
      const previousState = await capturePreviousState(
        trackItems,
        aiResponse.action || aiResponse.actions?.[0]?.action
      );

      // Execute the action(s)
      let result;
      if (aiResponse.actions && Array.isArray(aiResponse.actions)) {
        result = await dispatchActions(aiResponse.actions, trackItems);
        result = result.summary;
      } else {
        result = await dispatchAction(aiResponse.action, trackItems, aiResponse.parameters || {});
      }

      // Record for undo and report results
      if (result.successful > 0) {
        recordEdit({
          actionName: aiResponse.action || aiResponse.actions?.[0]?.action,
          trackItems,
          previousState,
          parameters: aiResponse.parameters || aiResponse.actions?.[0]?.parameters || {}
        });

        addBotMessage(`✅ Applied to ${result.successful} clip(s)!`);
        if (result.failed > 0) {
          addBotMessage(`⚠️ Failed on ${result.failed} clip(s)`);
        }
      } else {
        addBotMessage("❌ Failed to apply edit. Check console for details.");
      }

    } catch (err) {
      console.error("[Panel] Error:", err);
      addBotMessage(`❌ Error: ${err.message || err}`);
      
      if (err.message?.includes("Backend server") || err.message?.includes("Network")) {
        addBotMessage("💡 Make sure the backend server is running on port 3001");
      }
    }

    setIsLoading(false);
  }, [
    mode, selectedContexts, isLoading,
    addUserMessage, addBotMessage,
    getProject, getSequence, getSelectedVideoClips,
    ppro, recordEdit
  ]);

  /**
   * Handle undo - disabled for now, ready to enable when backend is ready
   */
  const handleUndo = useCallback(async () => {
    // Undo is disabled for now per requirements
    addBotMessage("ℹ️ Undo functionality is currently being developed.");
    return;
    
    // Uncomment below when backend is ready:
    // const result = await undo();
    // addBotMessage(result.message);
  }, [addBotMessage]);

  return (
    <div className="chatcut-panel">
      <Header />
      
      <ChatArea messages={messages} />
      
      {/* Footer component removed - Panel.jsx is not currently used in the app */}
      {/* <Footer
        mode={mode}
        onModeChange={setMode}
        selectedContexts={selectedContexts}
        onContextsChange={setSelectedContexts}
        fetchAvailableEffects={fetchAvailableEffects}
        onSend={handleSend}
        onUndo={handleUndo}
        canUndo={false}  // Set to {canUndo} when backend undo is ready
        isLoading={isLoading}
      /> */}
    </div>
  );
};
