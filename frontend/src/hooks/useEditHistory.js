/**
 * useEditHistory - Hook for managing undo/redo state
 * Tracks ChatCut edits separately from Premiere's native undo
 */
import { useState, useCallback } from "react";
import { executeUndo } from "../services/undoService";

export const useEditHistory = () => {
  const [history, setHistory] = useState([]);
  const [undoneCount, setUndoneCount] = useState(0);

  // Can undo if there are edits that haven't been undone
  const canUndo = history.length > undoneCount;

  /**
   * Record a new edit to history
   * @param {Object} entry - { actionName, trackItems, previousState, parameters }
   */
  const recordEdit = useCallback((entry) => {
    setHistory(prev => {
      // If we've undone edits, truncate history before adding new edit
      if (undoneCount > 0) {
        const trimmed = prev.slice(0, prev.length - undoneCount);
        return [...trimmed, entry];
      }
      return [...prev, entry];
    });
    setUndoneCount(0);
  }, [undoneCount]);

  /**
   * Undo the last edit
   * @returns {Promise<{success: boolean, message: string, result?: Object}>}
   */
  const undo = useCallback(async () => {
    if (!canUndo) {
      return { 
        success: false, 
        message: "No ChatCut edits to undo." 
      };
    }

    const index = history.length - undoneCount - 1;
    const entry = history[index];

    if (!entry) {
      return { 
        success: false, 
        message: "Could not find edit to undo." 
      };
    }

    try {
      console.log("[useEditHistory] Undoing:", entry.actionName);
      const result = await executeUndo(entry);
      
      if (result.successful > 0) {
        setUndoneCount(prev => prev + 1);
        return { 
          success: true, 
          message: `Undid "${entry.actionName}" on ${result.successful} clip(s).`,
          result 
        };
      }
      
      return { 
        success: false, 
        message: "Undo failed - could not reverse the edit." 
      };
    } catch (err) {
      console.error("[useEditHistory] Undo error:", err);
      return { 
        success: false, 
        message: `Undo failed: ${err.message || err}` 
      };
    }
  }, [history, undoneCount, canUndo]);

  /**
   * Reset history (e.g., on project change)
   */
  const resetHistory = useCallback(() => {
    setHistory([]);
    setUndoneCount(0);
  }, []);

  return {
    history,
    canUndo,
    undoneCount,
    recordEdit,
    undo,
    resetHistory
  };
};


