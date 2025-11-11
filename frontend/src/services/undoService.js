const ppro = require("premierepro");
import { 
  getMotionScaleParam,
  getClipDuration,
  getClipInPoint
} from './clipUtils.js';

/**
 * Undo Service - Manages edit history and provides undo functionality
 */

// ============ UTILITY ============
function log(msg, color = "white") {
  console.log(`[Undo][${color}] ${msg}`);
}

/**
 * Get current scale value from a clip
 * @param {TrackItem} trackItem - The clip
 * @param {Project} project - Premiere Pro project
 * @returns {Promise<number|null>} Current scale value or null if error
 */
async function getCurrentScale(trackItem, project) {
  try {
    const context = await getMotionScaleParam(trackItem, project);
    if (!context) return null;
    
    const { componentParam } = context;
    const value = await componentParam.getValue();
    return value;
  } catch (err) {
    log(`Error getting current scale: ${err}`, "red");
    return null;
  }
}

/**
 * Get all keyframe values for scale parameter
 * @param {TrackItem} trackItem - The clip
 * @param {Project} project - Premiere Pro project
 * @returns {Promise<{keyframes: Array<{time: number, value: number}>, staticValue: number|null}>} Keyframes and static value
 */
async function getScaleKeyframes(trackItem, project) {
  try {
    const context = await getMotionScaleParam(trackItem, project);
    if (!context) return { keyframes: [], staticValue: null };
    
    const { componentParam } = context;
    const keyframeCount = await componentParam.getKeyframeCount();
    const keyframes = [];
    
    // If there are no keyframes, capture the static value
    if (keyframeCount === 0) {
      const staticValue = await componentParam.getValue();
      return { keyframes: [], staticValue: staticValue };
    }
    
    // Capture all keyframes
    for (let i = 0; i < keyframeCount; i++) {
      try {
        const keyframe = await componentParam.getKeyframe(i);
        const position = keyframe.position;
        const value = keyframe.value;
        keyframes.push({
          time: position.seconds,
          value: value
        });
      } catch (err) {
        log(`Error getting keyframe ${i}: ${err}`, "yellow");
      }
    }
    
    return { 
      keyframes: keyframes.sort((a, b) => a.time - b.time),
      staticValue: null 
    };
  } catch (err) {
    log(`Error getting scale keyframes: ${err}`, "red");
    return { keyframes: [], staticValue: null };
  }
}

/**
 * Restore scale keyframes to previous state
 * @param {TrackItem} trackItem - The clip
 * @param {Project} project - Premiere Pro project
 * @param {Object} previousState - Previous state with keyframes and staticValue
 * @returns {Promise<boolean>}
 */
async function restoreScaleKeyframes(trackItem, project, previousState) {
  try {
    const context = await getMotionScaleParam(trackItem, project);
    if (!context) {
      log("Could not get Motion Scale parameter for undo", "red");
      return false;
    }
    
    const { componentParam } = context;
    const { keyframes = [], staticValue = null } = previousState || {};
    
    // Clear all existing keyframes first
    await project.lockedAccess(async () => {
      project.executeTransaction((compound) => {
        const clearAction = componentParam.createClearKeyframesAction();
        compound.addAction(clearAction);
      });
    });
    
    // If there were no previous keyframes, restore the static value
    if (keyframes.length === 0 && staticValue !== null) {
      await project.lockedAccess(async () => {
        project.executeTransaction((compound) => {
          // Disable time-varying and set static value
          const timeVaryingAction = componentParam.createSetTimeVaryingAction(false);
          compound.addAction(timeVaryingAction);
          
          const action = componentParam.createSetValueAction(
            componentParam.createKeyframe(staticValue),
            false
          );
          compound.addAction(action);
        });
      });
      log(`Restored to static scale: ${staticValue}%`, "green");
      return true;
    }
    
    // If no keyframes and no static value, use default 100%
    if (keyframes.length === 0) {
      await project.lockedAccess(async () => {
        project.executeTransaction((compound) => {
          const timeVaryingAction = componentParam.createSetTimeVaryingAction(false);
          compound.addAction(timeVaryingAction);
          const action = componentParam.createSetValueAction(
            componentParam.createKeyframe(100),
            false
          );
          compound.addAction(action);
        });
      });
      log("Restored to default static scale: 100%", "green");
      return true;
    }
    
    // Restore previous keyframes
    await project.lockedAccess(async () => {
      project.executeTransaction((compound) => {
        // Enable time-varying
        const timeVaryingAction = componentParam.createSetTimeVaryingAction(true);
        compound.addAction(timeVaryingAction);
        
        // Add each keyframe
        for (const kf of keyframes) {
          const keyframe = componentParam.createKeyframe(kf.value);
          keyframe.position = ppro.TickTime.createWithSeconds(kf.time);
          const addAction = componentParam.createAddKeyframeAction(keyframe);
          compound.addAction(addAction);
        }
      });
    });
    
    log(`Restored ${keyframes.length} keyframe(s)`, "green");
    return true;
  } catch (err) {
    log(`Error restoring scale keyframes: ${err}`, "red");
    return false;
  }
}

/**
 * Remove a filter/component from a clip
 * @param {TrackItem} trackItem - The clip
 * @param {Project} project - Premiere Pro project
 * @param {string} matchName - Match name of the component to remove
 * @returns {Promise<boolean>}
 */
async function removeComponent(trackItem, project, matchName) {
  try {
    const componentChain = await trackItem.getComponentChain();
    const componentCount = await componentChain.getComponentCount();
    
    for (let i = 0; i < componentCount; i++) {
      try {
        const component = await componentChain.getComponentAtIndex(i);
        const componentMatchName = await component.getMatchName();
        
        if (componentMatchName === matchName || componentMatchName.includes(matchName)) {
          await project.lockedAccess(async () => {
            project.executeTransaction((compound) => {
              const removeAction = componentChain.createRemoveComponentAction(component);
              compound.addAction(removeAction);
            });
          });
          log(`Removed component: ${matchName}`, "green");
          return true;
        }
      } catch (err) {
        // Continue searching
      }
    }
    
    log(`Component not found for removal: ${matchName}`, "yellow");
    return false;
  } catch (err) {
    log(`Error removing component: ${err}`, "red");
    return false;
  }
}

/**
 * Remove a transition from a clip
 * @param {TrackItem} trackItem - The clip
 * @param {Project} project - Premiere Pro project
 * @returns {Promise<boolean>}
 */
async function removeTransition(trackItem, project) {
  try {
    const transitionCount = await trackItem.getVideoTransitionCount();
    
    if (transitionCount === 0) {
      log("No transitions to remove", "yellow");
      return false;
    }
    
    // Get the last transition (most recently added) before locked access
    const transition = await trackItem.getVideoTransition(transitionCount - 1);
    
    // Remove the last transition (most recently added)
    await project.lockedAccess(async () => {
      project.executeTransaction((compound) => {
        const removeAction = trackItem.createRemoveVideoTransitionAction(transition);
        compound.addAction(removeAction);
      });
    });
    
    log("Removed transition", "green");
    return true;
  } catch (err) {
    log(`Error removing transition: ${err}`, "red");
    return false;
  }
}

// ============ UNDO FUNCTIONS ============

/**
 * Undo a zoom action by restoring previous scale state
 * @param {Object} historyEntry - History entry with previousState
 * @returns {Promise<{successful: number, failed: number}>}
 */
export async function undoZoom(historyEntry) {
  const { trackItems, previousState } = historyEntry;
  const items = Array.isArray(trackItems) ? trackItems : [trackItems];
  const project = await ppro.Project.getActiveProject();
  
  let successful = 0;
  let failed = 0;
  
  for (let i = 0; i < items.length; i++) {
    const trackItem = items[i];
    const clipPreviousState = previousState && previousState[i] 
      ? previousState[i] 
      : { keyframes: [], staticValue: null };
    
    try {
      const result = await restoreScaleKeyframes(trackItem, project, clipPreviousState);
      if (result) {
        successful++;
      } else {
        failed++;
      }
    } catch (err) {
      log(`Error undoing zoom for clip ${i}: ${err}`, "red");
      failed++;
    }
  }
  
  return { successful, failed };
}

/**
 * Undo a filter action by removing the filter
 * @param {Object} historyEntry - History entry with filterName
 * @returns {Promise<{successful: number, failed: number}>}
 */
export async function undoFilter(historyEntry) {
  const { trackItems, parameters } = historyEntry;
  const items = Array.isArray(trackItems) ? trackItems : [trackItems];
  const project = await ppro.Project.getActiveProject();
  const filterName = parameters && parameters.filterName;
  
  if (!filterName) {
    log("No filter name in history entry", "red");
    return { successful: 0, failed: items.length };
  }
  
  let successful = 0;
  let failed = 0;
  
  for (const trackItem of items) {
    try {
      const result = await removeComponent(trackItem, project, filterName);
      if (result) {
        successful++;
      } else {
        failed++;
      }
    } catch (err) {
      log(`Error undoing filter: ${err}`, "red");
      failed++;
    }
  }
  
  return { successful, failed };
}

/**
 * Undo a transition action by removing the transition
 * @param {Object} historyEntry - History entry
 * @returns {Promise<{successful: number, failed: number}>}
 */
export async function undoTransition(historyEntry) {
  const { trackItems } = historyEntry;
  const items = Array.isArray(trackItems) ? trackItems : [trackItems];
  const project = await ppro.Project.getActiveProject();
  
  let successful = 0;
  let failed = 0;
  
  for (const trackItem of items) {
    try {
      const result = await removeTransition(trackItem, project);
      if (result) {
        successful++;
      } else {
        failed++;
      }
    } catch (err) {
      log(`Error undoing transition: ${err}`, "red");
      failed++;
    }
  }
  
  return { successful, failed };
}

/**
 * Undo a blur action by removing the blur filter
 * @param {Object} historyEntry - History entry
 * @returns {Promise<{successful: number, failed: number}>}
 */
export async function undoBlur(historyEntry) {
  const { trackItems } = historyEntry;
  const items = Array.isArray(trackItems) ? trackItems : [trackItems];
  const project = await ppro.Project.getActiveProject();
  
  let successful = 0;
  let failed = 0;
  
  for (const trackItem of items) {
    try {
      // Remove Gaussian Blur component
      const result = await removeComponent(trackItem, project, "Gaussian Blur");
      if (result) {
        successful++;
      } else {
        failed++;
      }
    } catch (err) {
      log(`Error undoing blur: ${err}`, "red");
      failed++;
    }
  }
  
  return { successful, failed };
}

/**
 * Capture the current state before an edit (for undo)
 * @param {TrackItem|TrackItem[]} trackItems - Clip(s) to capture state for
 * @param {string} actionName - Action being performed
 * @returns {Promise<Object>} Previous state object
 */
export async function capturePreviousState(trackItems, actionName) {
  const items = Array.isArray(trackItems) ? trackItems : [trackItems];
  const project = await ppro.Project.getActiveProject();
  const previousState = [];
  
  // For zoom actions, capture scale keyframes
  if (actionName === 'zoomIn' || actionName === 'zoomOut') {
    for (const trackItem of items) {
      try {
        const keyframes = await getScaleKeyframes(trackItem, project);
        previousState.push({ keyframes });
      } catch (err) {
        log(`Error capturing state for zoom: ${err}`, "yellow");
        previousState.push({ keyframes: [] });
      }
    }
  }
  
  // For other actions, we don't need to capture state (we'll just remove what was added)
  
  return previousState;
}

/**
 * Execute undo for a history entry
 * @param {Object} historyEntry - History entry to undo
 * @returns {Promise<{successful: number, failed: number}>}
 */
export async function executeUndo(historyEntry) {
  const { actionName } = historyEntry;
  
  log(`Executing undo for action: ${actionName}`, "blue");
  
  switch (actionName) {
    case 'zoomIn':
    case 'zoomOut':
      return await undoZoom(historyEntry);
    case 'applyFilter':
      return await undoFilter(historyEntry);
    case 'applyTransition':
      return await undoTransition(historyEntry);
    case 'applyBlur':
      return await undoBlur(historyEntry);
    default:
      log(`No undo handler for action: ${actionName}`, "yellow");
      return { successful: 0, failed: 0 };
  }
}

