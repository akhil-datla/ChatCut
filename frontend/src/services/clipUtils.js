const ppro = require("premierepro");

/**
 * Utility functions for working with Premiere Pro clips (TrackItems)
 */

// ============ LOGGING ============
function log(msg, color = "white") {
  console.log(`[ClipUtils][${color}] ${msg}`);
}

// ============ CLIP INFORMATION ============

/**
 * Get the duration of a clip in seconds
 * @param {TrackItem} trackItem - Premiere Pro TrackItem
 * @returns {Promise<number>} Duration in seconds
 */
export async function getClipDuration(trackItem) {
  try {
    const inPoint = await trackItem.getInPoint();
    const outPoint = await trackItem.getOutPoint();
    // TickTime objects have a .seconds property directly
    const durationSeconds = outPoint.seconds - inPoint.seconds;
    return durationSeconds;
  } catch (err) {
    log(`Error getting clip duration: ${err}`, "red");
    return null;
  }
}

/**
 * Get the in point (start time) of a clip on the timeline in seconds
 * @param {TrackItem} trackItem - Premiere Pro TrackItem
 * @returns {Promise<number>} Start time in seconds
 */
export async function getClipInPoint(trackItem) {
  try {
    const startTime = await trackItem.getStartTime();
    return startTime.seconds;
  } catch (err) {
    log(`Error getting clip in point: ${err}`, "red");
    return null;
  }
}

/**
 * Get the out point (end time) of a clip on the timeline in seconds
 * @param {TrackItem} trackItem - Premiere Pro TrackItem
 * @returns {Promise<number>} End time in seconds
 */
export async function getClipOutPoint(trackItem) {
  try {
    const endTime = await trackItem.getEndTime();
    return endTime.seconds;
  } catch (err) {
    log(`Error getting clip out point: ${err}`, "red");
    return null;
  }
}

/**
 * Convert clip-relative time to sequence time
 * @param {TrackItem} trackItem - Premiere Pro TrackItem
 * @param {number} relativeSeconds - Time relative to clip start (0 = start of clip)
 * @returns {Promise<number>} Absolute sequence time in seconds
 */
export async function clipTimeToSequenceTime(trackItem, relativeSeconds) {
  try {
    const clipStart = await getClipInPoint(trackItem);
    return clipStart + relativeSeconds;
  } catch (err) {
    log(`Error converting clip time to sequence time: ${err}`, "red");
    return null;
  }
}

/**
 * Convert sequence time to clip-relative time
 * @param {TrackItem} trackItem - Premiere Pro TrackItem
 * @param {number} sequenceSeconds - Absolute sequence time
 * @returns {Promise<number>} Time relative to clip start
 */
export async function sequenceTimeToClipTime(trackItem, sequenceSeconds) {
  try {
    const clipStart = await getClipInPoint(trackItem);
    return sequenceSeconds - clipStart;
  } catch (err) {
    log(`Error converting sequence time to clip time: ${err}`, "red");
    return null;
  }
}

// ============ COMPONENT CHAIN UTILITIES ============

/**
 * Find a component (effect) by its match name in a clip's component chain
 * @param {TrackItem} trackItem - Premiere Pro TrackItem
 * @param {string} matchName - Effect match name (e.g., "AE.ADBE Motion")
 * @returns {Promise<Component|null>} The component if found, null otherwise
 */
export async function findComponentByMatchName(trackItem, matchName) {
  try {
    const componentChain = await trackItem.getComponentChain();
    const componentCount = await componentChain.getComponentCount();
    
    log(`Searching for component: ${matchName}`, "blue");
    log(`Component chain has ${componentCount} component(s)`, "blue");
    
    // List all components for debugging
    for (let i = 0; i < componentCount; i++) {
      try {
        const component = await componentChain.getComponentAtIndex(i);
        const componentMatchName = await component.getMatchName();
        const componentDisplayName = await component.getDisplayName();
        log(`  Component ${i}: matchName="${componentMatchName}", displayName="${componentDisplayName}"`, "blue");
        
        if (componentMatchName === matchName) {
          log(`Found component: ${matchName} at index ${i}`, "green");
          return component;
        }
      } catch (err) {
        log(`  Error getting component ${i}: ${err.message || err}`, "yellow");
      }
    }
    
    log(`Component not found: ${matchName}`, "yellow");
    log(`Available components listed above - check match names`, "yellow");
    return null;
  } catch (err) {
    log(`Error finding component ${matchName}: ${err.message || err}`, "red");
    console.error("findComponentByMatchName error details:", err);
    return null;
  }
}

/**
 * Find a parameter by display name within a component
 * Note: ComponentParam doesn't have getDisplayName(), so we'll use index-based lookup for Motion effect
 * @param {Component} component - Premiere Pro Component
 * @param {string} paramName - Parameter display name (e.g., "Scale", "Position")
 * @returns {Promise<ComponentParam|null>} The parameter if found, null otherwise
 */
export async function findParamByName(component, paramName) {
  try {
    const paramCount = await component.getParamCount();
    log(`Component has ${paramCount} parameters`, "blue");
    
    // For Motion effect, Scale is typically at index 1
    // But let's try to find it dynamically by checking common indices
    // Motion effect params are usually: Position (0), Scale (1), Rotation (2)
    
    if (paramName === "Scale" && paramCount > 1) {
      // Try index 1 first (most common location for Scale)
      try {
        const param = await component.getParam(1);
        log(`Found parameter at index 1 (likely Scale)`, "green");
        return param;
      } catch (err) {
        log(`Could not get param at index 1: ${err}`, "yellow");
      }
    }
    
    // Fallback: try common indices
    const commonIndices = [1, 0, 2]; // Scale, Position, Rotation
    for (const index of commonIndices) {
      if (index < paramCount) {
        try {
          const param = await component.getParam(index);
          log(`Trying parameter at index ${index}`, "blue");
          return param;
        } catch (err) {
          log(`Could not get param at index ${index}: ${err}`, "yellow");
        }
      }
    }
    
    log(`Parameter not found: ${paramName}`, "yellow");
    return null;
  } catch (err) {
    log(`Error finding parameter ${paramName}: ${err}`, "red");
    return null;
  }
}

/**
 * Get the Motion effect's Scale parameter for a clip
 * This is the most common operation for zoom effects
 * @param {TrackItem} trackItem - Premiere Pro TrackItem
 * @param {Project} project - Premiere Pro Project (for locked access)
 * @returns {Promise<{componentParam: ComponentParam, project: Project}|null>}
 */
export async function getMotionScaleParam(trackItem, project) {
  try {
    // Check if clip has video track (Motion only exists on video clips)
    const componentChain = await trackItem.getComponentChain();
    const componentCount = await componentChain.getComponentCount();
    
    // Check if this is a video clip by looking for video-related components
    let hasVideoComponent = false;
    let hasAudioOnly = true;
    
    for (let i = 0; i < componentCount; i++) {
      try {
        const component = await componentChain.getComponentAtIndex(i);
        const componentMatchName = await component.getMatchName();
        const componentDisplayName = await component.getDisplayName();
        
        // Video components often contain "Motion", "Video", "Transform", "ADBE" in match name
        // Audio components contain "Volume", "Audio", "Channel"
        if (componentMatchName.includes("Motion") || 
            componentMatchName.includes("ADBE") ||
            componentMatchName.includes("Video") ||
            componentDisplayName.toLowerCase().includes("motion") ||
            componentDisplayName.toLowerCase().includes("transform")) {
          hasVideoComponent = true;
          hasAudioOnly = false;
        }
      } catch (err) {
        // Continue checking other components
      }
    }
    
    if (hasAudioOnly && !hasVideoComponent) {
      log("❌ Clip is audio-only - Motion effect only exists on video clips", "red");
      log("Please select a clip with video content on a video track", "yellow");
      return null;
    }
    
    // Try multiple possible match names for Motion effect
    const possibleMatchNames = [
      "AE.ADBE Motion",           // Common match name
      "ADBE Motion",              // Alternative
      "motion",                    // Lowercase variant
    ];
    
    let motionEffect = null;
    for (const matchName of possibleMatchNames) {
      motionEffect = await findComponentByMatchName(trackItem, matchName);
      if (motionEffect) {
        log(`✓ Found Motion effect with match name: ${matchName}`, "green");
        break;
      }
    }
    
    // If still not found, try by index (Motion is usually first component on video)
    if (!motionEffect) {
      log("Motion effect not found by match name, trying index-based lookup...", "yellow");
      try {
        log(`Trying first ${Math.min(componentCount, 3)} component(s)...`, "blue");
        
        for (let i = 0; i < Math.min(componentCount, 3); i++) {
          try {
            const component = await componentChain.getComponentAtIndex(i);
            const componentDisplayName = await component.getDisplayName();
            log(`  Component ${i}: displayName="${componentDisplayName}"`, "blue");
            
            // Motion effect display name is usually "Motion"
            if (componentDisplayName && componentDisplayName.toLowerCase().includes("motion")) {
              motionEffect = component;
              log(`✓ Found Motion effect at index ${i} by display name`, "green");
              break;
            }
          } catch (err) {
            log(`  Error checking component ${i}: ${err.message || err}`, "yellow");
          }
        }
      } catch (err) {
        log(`Error in index-based lookup: ${err.message || err}`, "red");
      }
    }
    
    if (!motionEffect) {
      log("❌ Motion effect not found on clip", "red");
      log("This clip may not have a video track. Please select a clip with video content.", "yellow");
      return null;
    }

    log(`Motion effect found, getting Scale parameter...`, "blue");
    
    // For Motion effect, Scale is typically at index 1
    // Motion effect parameters: Position (0), Scale (1), Rotation (2), etc.
    
    try {
      const paramCount = await motionEffect.getParamCount();
      log(`Motion effect has ${paramCount} parameters`, "blue");
      
      // Scale is typically at index 1 in Motion effect
      // Get parameter inside lockedAccess to ensure proper access
      let scaleParam = null;
      
      if (paramCount > 1) {
        await project.lockedAccess(async () => {
          scaleParam = await motionEffect.getParam(1);
        });
        log(`✓ Got parameter at index 1 (Scale)`, "green");
      } else {
        log(`Motion effect has only ${paramCount} parameter(s), trying index 0`, "yellow");
        await project.lockedAccess(async () => {
          scaleParam = await motionEffect.getParam(0);
        });
        log(`✓ Got parameter at index 0`, "green");
      }

      if (!scaleParam) {
        log("❌ Scale parameter not found or could not be accessed", "red");
        return null;
      }

      log(`✓ Motion Scale parameter found successfully`, "green");
      return { componentParam: scaleParam, project };
    } catch (err) {
      log(`Error getting Scale parameter: ${err.message || err}`, "red");
      console.error("Error details:", err);
      return null;
    }
  } catch (err) {
    log(`Error getting Motion Scale parameter: ${err.message || err}`, "red");
    console.error("getMotionScaleParam error details:", err);
    return null;
  }
}

// ============ VALIDATION ============

/**
 * Validate that a clip is suitable for editing
 * @param {TrackItem} trackItem - Premiere Pro TrackItem
 * @returns {Promise<{valid: boolean, reason: string}>}
 */
export async function validateClip(trackItem) {
  if (!trackItem) {
    return { valid: false, reason: "No clip provided" };
  }

  try {
    const duration = await getClipDuration(trackItem);
    if (duration === null || duration <= 0) {
      return { valid: false, reason: "Invalid clip duration" };
    }

    if (duration < 0.1) {
      return { valid: false, reason: "Clip too short (< 0.1 seconds)" };
    }

    return { valid: true, reason: "OK" };
  } catch (err) {
    return { valid: false, reason: `Validation error: ${err.message}` };
  }
}

/**
 * Log detailed information about a clip (for debugging)
 * @param {TrackItem} trackItem - Premiere Pro TrackItem
 */
export async function logClipInfo(trackItem) {
  try {
    const name = await trackItem.getName();
    const duration = await getClipDuration(trackItem);
    const startTime = await getClipInPoint(trackItem);
    const endTime = await getClipOutPoint(trackItem);
    
    console.log("=== Clip Info ===");
    console.log(`Name: ${name}`);
    console.log(`Duration: ${duration ? duration.toFixed(2) : 'N/A'}s`);
    console.log(`Start: ${startTime ? startTime.toFixed(2) : 'N/A'}s`);
    console.log(`End: ${endTime ? endTime.toFixed(2) : 'N/A'}s`);
    console.log("================");
  } catch (err) {
    log(`Error logging clip info: ${err}`, "red");
  }
}



/**
 * Return all media file paths from the current Project panel selection.
 * @param {Project} project
 * @param {{ includeSequence?: boolean }} options
 * @returns {Promise<string[]>}
 */
export async function getSelectedMediaFilePaths(project, { includeSequence = false } = {}) {
  const paths = new Set();
  try {
    if (!project) {
      log("getSelectedMediaFilePaths: No project provided", "red");
      return [];
    }
    const sequence = await project.getActiveSequence();
    if (!sequence) {
      log("getSelectedMediaFilePaths: No active sequence", "yellow");
      return [];
    }
    const selection = await sequence.getSelection();
    if (!selection) {
      log("getSelectedMediaFilePaths: No selection in timeline", "yellow");
      return [];
    }
    const items = await selection.getTrackItems(
      ppro.Constants.TrackItemType.CLIP, 
      false  // false means only video clips
    );
    
    if (!items || items.length === 0) {
      log("getSelectedMediaFilePaths: No track items selected", "yellow");
      return [];
    }
    
    log(`getSelectedMediaFilePaths: Processing ${items.length} track item(s)`, "blue");
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        const projectItem = await item.getProjectItem();
        if (!projectItem) {
          log(`getSelectedMediaFilePaths: Item ${i} has no projectItem`, "yellow");
          continue;
        }
        
        const clipProjectItem = ppro.ClipProjectItem.cast(projectItem);
        if (!clipProjectItem) {
          log(`getSelectedMediaFilePaths: Item ${i} is not a ClipProjectItem`, "yellow");
          continue;
        }
        
        // Check if offline
        const isOffline = await clipProjectItem.isOffline();
        if (isOffline) {
          log(`getSelectedMediaFilePaths: Item ${i} is offline, skipping`, "yellow");
          continue;
        }
        
        if (!includeSequence) {
          const contentType = await clipProjectItem.getContentType();
          if (contentType !== ppro.Constants.ContentType.MEDIA) {
            log(`getSelectedMediaFilePaths: Item ${i} is not MEDIA type (${contentType}), skipping`, "yellow");
            continue;
          }
        }
        
        const path = await clipProjectItem.getMediaFilePath();
        if (path) {
          log(`getSelectedMediaFilePaths: Item ${i} path: ${path}`, "green");
          paths.add(path);
        } else {
          log(`getSelectedMediaFilePaths: Item ${i} returned no path`, "yellow");
        }
      } catch (err) {
        log(`getSelectedMediaFilePaths: Error processing item ${i}: ${(err && err.message) || err}`, "red");
      }
    }
    
    log(`getSelectedMediaFilePaths: Found ${paths.size} accessible path(s)`, paths.size > 0 ? "green" : "yellow");
  } catch (err) {
    log(`getSelectedMediaFilePaths error: ${(err && err.message) || err}`, "red");
  }
  return Array.from(paths);
}



