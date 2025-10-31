/**
 * Action Dispatcher - Maps action names to editing functions
 * 
 * This is the central registry that connects AI-extracted actions
 * to the actual video editing functions. Simple and modular.
 */

import { 
  zoomIn, 
  zoomOut, 
  zoomInBatch, 
  zoomOutBatch,
  applyFilter,
  applyTransition 
} from './editingActions.js';

/**
 * Action Registry - Maps action names to handler functions
 * 
 * Each handler receives:
 * - trackItem(s): Single clip or array of clips
 * - parameters: Object with parameters extracted by AI
 * 
 * Returns: Result from the editing function
 */
const actionRegistry = {
  /**
   * Zoom in on clip(s)
   * Parameters: { endScale, startScale, animated, duration, interpolation }
   */
  zoomIn: async (trackItems, parameters = {}) => {
    const isArray = Array.isArray(trackItems);
    const items = isArray ? trackItems : [trackItems];
    
    // Use batch function for multiple clips, single for one clip
    if (isArray && items.length > 1) {
      return await zoomInBatch(items, parameters);
    } else {
      const result = await zoomIn(items[0], parameters);
      return { successful: result ? 1 : 0, failed: result ? 0 : 1 };
    }
  },

  /**
   * Zoom out on clip(s)
   * Parameters: { endScale, startScale, animated, duration, interpolation }
   */
  zoomOut: async (trackItems, parameters = {}) => {
    const isArray = Array.isArray(trackItems);
    const items = isArray ? trackItems : [trackItems];
    
    if (isArray && items.length > 1) {
      return await zoomOutBatch(items, parameters);
    } else {
      const result = await zoomOut(items[0], parameters);
      return { successful: result ? 1 : 0, failed: result ? 0 : 1 };
    }
  },

  /**
   * Apply filter to clip(s)
   * Parameters: { filterName }
   */
  applyFilter: async (trackItems, parameters = {}) => {
    const items = Array.isArray(trackItems) ? trackItems : [trackItems];
    const { filterName } = parameters;
    
    if (!filterName) {
      throw new Error("applyFilter requires filterName parameter");
    }
    
    let successful = 0;
    let failed = 0;
    
    for (const item of items) {
      try {
        const result = await applyFilter(item, filterName);
        if (result) successful++;
        else failed++;
      } catch (err) {
        console.error(`Error applying filter to clip:`, err);
        failed++;
      }
    }
    
    return { successful, failed };
  },

  /**
   * Apply transition to clip(s)
   * Parameters: { transitionName, duration, applyToStart }
   */
  applyTransition: async (trackItems, parameters = {}) => {
    const items = Array.isArray(trackItems) ? trackItems : [trackItems];
    const { 
      transitionName, 
      duration = 1.0, 
      applyToStart = true 
    } = parameters;
    
    if (!transitionName) {
      throw new Error("applyTransition requires transitionName parameter");
    }
    
    let successful = 0;
    let failed = 0;
    
    for (const item of items) {
      try {
        const result = await applyTransition(item, transitionName, duration, applyToStart);
        if (result) successful++;
        else failed++;
      } catch (err) {
        console.error(`Error applying transition to clip:`, err);
        failed++;
      }
    }
    
    return { successful, failed };
  }
};

/**
 * Dispatch an action to the appropriate handler
 * 
 * @param {string} actionName - The action to execute (e.g., "zoomIn")
 * @param {TrackItem|TrackItem[]} trackItems - Clip(s) to apply action to
 * @param {object} parameters - Parameters extracted by AI
 * @returns {Promise<object>} Result from the action handler
 */
export async function dispatchAction(actionName, trackItems, parameters = {}) {
  if (!actionName) {
    throw new Error("Action name is required");
  }
  
  const handler = actionRegistry[actionName];
  
  if (!handler) {
    throw new Error(`Unknown action: ${actionName}. Available actions: ${Object.keys(actionRegistry).join(', ')}`);
  }
  
  console.log(`[Dispatcher] Executing action: ${actionName}`, { parameters });
  
  try {
    const result = await handler(trackItems, parameters);
    console.log(`[Dispatcher] Action completed: ${actionName}`, result);
    return result;
  } catch (err) {
    console.error(`[Dispatcher] Error executing ${actionName}:`, err);
    throw err;
  }
}

/**
 * Get list of available actions
 */
export function getAvailableActions() {
  return Object.keys(actionRegistry);
}

/**
 * Check if an action exists
 */
export function hasAction(actionName) {
  return actionName in actionRegistry;
}

