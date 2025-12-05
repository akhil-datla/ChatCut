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
  applyTransition, 
  applyBlur,
  modifyEffectParameter,
  modifyEffectParametersBatch,
  getEffectParameters,
  applyAudioFilter,
  adjustVolume
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
   * Parameters: { endScale, startScale, animated, duration, interpolation, startTime }
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
   * Parameters: { endScale, startScale, animated, duration, interpolation, startTime }
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
  },

  applyBlur: async (trackItems, parameters = {}) => {
    const items = Array.isArray(trackItems) ? trackItems : [trackItems];
    const blurAmount = (parameters.blurAmount || parameters.blurriness || 5);
    
    let successful = 0;
    let failed = 0;
    
    for (const item of items) {
      try {
  const result = await applyBlur(item, Number(blurAmount));
        if (result) successful++;
        else failed++;
      } catch (err) {
        console.error(`Error applying blur to clip:`, err);
        failed++;
      }
    }
    
    return { successful, failed };
  },

  /**
   * Modify effect parameter(s) on clip(s)
   * Parameters: { parameterName, value, componentName?, modifications? }
   * 
   * Single parameter: { parameterName: "Horizontal Blocks", value: 20 }
   * Multiple parameters: { modifications: [{parameterName: "...", value: ...}, ...] }
   */
  modifyParameter: async (trackItems, parameters = {}) => {
    const items = Array.isArray(trackItems) ? trackItems : [trackItems];
    
    // Check if this is a batch modification
    if (parameters.modifications && Array.isArray(parameters.modifications)) {
      // Batch modification mode
      let successful = 0;
      let failed = 0;
      
      for (const item of items) {
        try {
          const result = await modifyEffectParametersBatch(item, parameters.modifications);
          successful += result.successful;
          failed += result.failed;
        } catch (err) {
          console.error(`Error modifying parameters on clip:`, err);
          failed += parameters.modifications.length;
        }
      }
      
      return { successful, failed };
    } else {
      // Single parameter modification
      const { 
        parameterName, 
        value, 
        componentName, 
        excludeBuiltIn = true,
        // Animation parameters
        startValue,
        animated,
        duration,
        startTime,
        interpolation
      } = parameters;
      
      if (!parameterName) {
        throw new Error("modifyParameter requires parameterName");
      }
      
      if (value === undefined || value === null) {
        throw new Error("modifyParameter requires value");
      }
      
      let successful = 0;
      let failed = 0;
      
      for (const item of items) {
        try {
          const result = await modifyEffectParameter(item, {
            parameterName,
            value,
            componentName,
            excludeBuiltIn,
            // Pass animation parameters
            startValue,
            animated,
            duration,
            startTime,
            interpolation
          });
          if (result) successful++;
          else failed++;
        } catch (err) {
          console.error(`Error modifying parameter on clip:`, err);
          failed++;
        }
      }
      
      return { successful, failed };
    }
  },

  /**
   * Get effect parameters from clip(s)
   * No parameters required - just returns info about available parameters
   */
  getParameters: async (trackItems, parameters = {}) => {
    const items = Array.isArray(trackItems) ? trackItems : [trackItems];
    const allParameters = [];
    
    for (const item of items) {
      try {
        const params = await getEffectParameters(item);
        allParameters.push({
          clipIndex: items.indexOf(item),
          parameters: params
        });
      } catch (err) {
        console.error(`Error getting parameters from clip:`, err);
      }
    }
    
    return { 
      successful: allParameters.length, 
      failed: items.length - allParameters.length,
      data: allParameters
    };
  },

  /**
   * Apply audio filter/effect to audio clip(s)
   * Parameters: { filterDisplayName }
   */
  applyAudioFilter: async (trackItems, parameters = {}) => {
    const items = Array.isArray(trackItems) ? trackItems : [trackItems];
    const { filterDisplayName } = parameters;
    
    if (!filterDisplayName) {
      throw new Error("applyAudioFilter requires filterDisplayName parameter");
    }
    
    let successful = 0;
    let failed = 0;
    
    for (const item of items) {
      try {
        const result = await applyAudioFilter(item, filterDisplayName);
        if (result) successful++;
        else failed++;
      } catch (err) {
        console.error(`Error applying audio filter to clip:`, err);
        failed++;
      }
    }
    
    return { successful, failed };
  },

  /**
   * Adjust volume of audio clip(s)
   * Parameters: { volumeDb } - Volume in decibels (positive = louder, negative = quieter)
   */
  adjustVolume: async (trackItems, parameters = {}) => {
    const items = Array.isArray(trackItems) ? trackItems : [trackItems];
    const volumeDb = parameters.volumeDb || parameters.volume || 0;
    
    let successful = 0;
    let failed = 0;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        const result = await adjustVolume(item, Number(volumeDb));
        if (result) {
          successful++;
          console.log(`[Dispatcher] Volume adjusted successfully on clip ${i + 1}/${items.length}`);
        } else {
          failed++;
          console.warn(`[Dispatcher] Volume adjustment failed on clip ${i + 1}/${items.length} - no volume parameter found`);
        }
      } catch (err) {
        console.error(`[Dispatcher] Error adjusting volume on clip ${i + 1}/${items.length}:`, err);
        failed++;
      }
    }
    
    return { successful, failed };
  }
}

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

/**
 * Dispatch multiple actions sequentially.
 * actionsArray: [{ action: "applyFilter", parameters: {...} }, ...]
 * Returns aggregated results: { actions: [{action, result}], summary: {successful, failed} }
 */
export async function dispatchActions(actionsArray, trackItems) {
  if (!Array.isArray(actionsArray)) {
    throw new Error('dispatchActions expects an array of actions');
  }

  const actionResults = [];
  let summary = { successful: 0, failed: 0 };

  for (const act of actionsArray) {
    const name = act.action;
    const params = act.parameters || {};
    try {
      const result = await dispatchAction(name, trackItems, params);
      actionResults.push({ action: name, parameters: params, result });
      summary.successful += (result.successful || 0);
      summary.failed += (result.failed || 0);
    } catch (err) {
      console.error(`Error dispatching action ${name}:`, err);
      actionResults.push({ action: name, parameters: params, error: String(err) });
      // if unknown action, count as failed for each clip
      const clipCount = Array.isArray(trackItems) ? trackItems.length : 1;
      summary.failed += clipCount;
    }
  }

  return { actions: actionResults, summary };
}

