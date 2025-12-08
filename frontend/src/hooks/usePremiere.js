/**
 * usePremiere - Hook for Premiere Pro API interactions
 * Provides access to project, sequence, and clip operations
 */
import { useCallback, useRef } from "react";
import { getEffectParameters } from "../services/editingActions";

// Lazy load Premiere Pro API
let ppro = null;
try {
  ppro = require("premierepro");
  console.log("[usePremiere] Premiere Pro API loaded");
} catch (err) {
  console.warn("[usePremiere] Premiere Pro API not available:", err.message);
  // Mock for development outside Premiere
  ppro = {
    Project: {
      getActiveProject: async () => null
    },
    Constants: {
      TrackItemType: { CLIP: 1 }
    },
    TickTime: {
      createWithSeconds: async (s) => ({ seconds: s })
    }
  };
}

export const usePremiere = () => {
  const pproRef = useRef(ppro);

  /**
   * Get the active project
   */
  const getProject = useCallback(async () => {
    try {
      return await pproRef.current.Project.getActiveProject();
    } catch (err) {
      console.error("[usePremiere] Error getting project:", err);
      return null;
    }
  }, []);

  /**
   * Get the active sequence
   */
  const getSequence = useCallback(async () => {
    try {
      const project = await getProject();
      if (!project) return null;
      return await project.getActiveSequence();
    } catch (err) {
      console.error("[usePremiere] Error getting sequence:", err);
      return null;
    }
  }, [getProject]);

  /**
   * Get selected track items (clips)
   * @param {boolean} includeAudio - Include audio clips (default: false = video only)
   */
  const getSelectedClips = useCallback(async (includeAudio = false) => {
    try {
      const sequence = await getSequence();
      if (!sequence) return [];

      const selection = await sequence.getSelection();
      if (!selection) return [];

      const trackItems = await selection.getTrackItems(
        pproRef.current.Constants.TrackItemType.CLIP,
        includeAudio
      );

      return trackItems || [];
    } catch (err) {
      console.error("[usePremiere] Error getting selected clips:", err);
      return [];
    }
  }, [getSequence]);

  /**
   * Get video clips from selection (filters out audio-only)
   */
  const getSelectedVideoClips = useCallback(async () => {
    const trackItems = await getSelectedClips(false);
    const videoClips = [];

    for (const clip of trackItems) {
      try {
        const componentChain = await clip.getComponentChain();
        const componentCount = await componentChain.getComponentCount();
        
        // Check if clip has video components
        for (let j = 0; j < componentCount; j++) {
          const component = await componentChain.getComponentAtIndex(j);
          const matchName = await component.getMatchName();
          if (matchName.includes("Motion") || matchName.includes("ADBE") || matchName.includes("Video")) {
            videoClips.push(clip);
            break;
          }
        }
      } catch (err) {
        // Skip clips that can't be analyzed
      }
    }

    return videoClips;
  }, [getSelectedClips]);

  /**
   * Fetch effect parameters from selected clips
   * Used for context menu
   */
  const fetchAvailableEffects = useCallback(async () => {
    try {
      const project = await getProject();
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
          value = await p.param.getValue();
        } catch (e) {
          try {
            const time = await pproRef.current.TickTime.createWithSeconds(0);
            value = await p.param.getValueAtTime(time);
          } catch (e2) {
            value = "unknown";
          }
        }
        
        // Handle Keyframe objects
        if (value && typeof value === "object" && typeof value.getValue === "function") {
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
      console.error("[usePremiere] Error fetching effects:", err);
      return [];
    }
  }, [getProject]);

  /**
   * Check if there's an active project and sequence
   */
  const isReady = useCallback(async () => {
    const project = await getProject();
    if (!project) return false;
    const sequence = await project.getActiveSequence();
    return !!sequence;
  }, [getProject]);

  return {
    ppro: pproRef.current,
    getProject,
    getSequence,
    getSelectedClips,
    getSelectedVideoClips,
    fetchAvailableEffects,
    isReady
  };
};


