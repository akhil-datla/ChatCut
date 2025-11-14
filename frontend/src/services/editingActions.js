const ppro = require("premierepro");
import { 
  getClipDuration, 
  getClipInPoint, 
  getMotionScaleParam,
  validateClip,
  logClipInfo 
} from './clipUtils.js';

// ============ UTILITY ============
function log(msg, color = "white") {
  console.log(`[Edit][${color}] ${msg}`);
}

async function executeAction(project, action) {
  return new Promise((resolve, reject) => {
    try {
      project.lockedAccess(() => {
        project.executeTransaction((compound) => {
          compound.addAction(action);
        });
        resolve();
      });
    } catch (err) {
      log(`Error executing action: ${err}`, "red");
      reject(err);
    }
  });
}

// ============ KEYFRAME HELPERS ============

/**
 * Create a keyframe at a specific time with interpolation
 * @param {ComponentParam} param - The parameter to add keyframe to
 * @param {Project} project - Premiere Pro project
 * @param {number} seconds - Time in seconds
 * @param {number} value - Keyframe value
 * @param {string} interpolation - 'LINEAR', 'BEZIER', 'HOLD', 'EASE_IN', 'EASE_OUT'
 * @returns {Promise<boolean>}
 */
async function addKeyframe(param, project, seconds, value, interpolation = 'BEZIER') {
  try {
    log(`Creating keyframe at ${seconds.toFixed(2)}s with value ${value}`, "blue");

    // Enable time-varying if not already enabled
    await project.lockedAccess(async () => {
      project.executeTransaction((compound) => {
        const action = param.createSetTimeVaryingAction(true);
        compound.addAction(action);
      });
    });
    log(`✓ Time-varying enabled`, "green");

    // Add the keyframe
    await project.lockedAccess(async () => {
      project.executeTransaction((compound) => {
        const keyframe = param.createKeyframe(value);
        keyframe.position = ppro.TickTime.createWithSeconds(seconds);
        const action = param.createAddKeyframeAction(keyframe);
        compound.addAction(action);
      });
    });
    log(`✓ Keyframe added at ${seconds.toFixed(2)}s`, "green");

    // Set interpolation mode
    const modeMap = {
      'LINEAR': ppro.Constants.InterpolationMode.LINEAR,
      'BEZIER': ppro.Constants.InterpolationMode.BEZIER,
      'HOLD': ppro.Constants.InterpolationMode.HOLD,
      'EASE_IN': ppro.Constants.InterpolationMode.EASE_IN,
      'EASE_OUT': ppro.Constants.InterpolationMode.EASE_OUT,
    };
    const interpMode = modeMap[interpolation] || ppro.Constants.InterpolationMode.BEZIER;

    await project.lockedAccess(async () => {
      project.executeTransaction((compound) => {
        const action = param.createSetInterpolationAtKeyframeAction(
          ppro.TickTime.createWithSeconds(seconds),
          interpMode
        );
        compound.addAction(action);
      });
    });
    log(`✓ Interpolation set to ${interpolation}`, "green");

    log(`✅ Keyframe successfully created at ${seconds.toFixed(2)}s: value=${value}`, "green");
    return true;
  } catch (err) {
    log(`❌ Error adding keyframe: ${err.message || err}`, "red");
    console.error("Keyframe creation error details:", err);
    return false;
  }
}

// ============ ZOOM FUNCTIONS ============

/**
 * Zoom in on a clip - creates animation from start scale to end scale (or static zoom)
 * @param {TrackItem} trackItem - The clip to zoom
 * @param {Object} options - Zoom options
 * @param {number} options.startScale - Starting scale percentage (default: 100)
 * @param {number} options.endScale - Ending scale percentage (default: 150)
 * @param {number} options.startTime - Start time in seconds relative to clip (default: 0)
 * @param {number} options.duration - Duration of zoom in seconds (default: entire clip)
 * @param {string} options.interpolation - 'LINEAR', 'BEZIER', 'HOLD', 'EASE_IN', 'EASE_OUT' (default: 'BEZIER')
 * @param {boolean} options.animated - If true, creates gradual zoom (100%→150%). If false, creates static zoom (150%→150%) (default: true)
 * @returns {Promise<boolean>}
 */
export async function zoomIn(trackItem, options = {}) {
  const {
    startScale = 100,
    endScale = 150,
    startTime = 0,
    duration = null,
    interpolation = 'BEZIER',
    animated = false  // Default to static zoom (unless user explicitly asks for gradual)
  } = options;
  
  // For static zoom, use the endScale for both start and end
  const actualStartScale = animated ? startScale : endScale;
  const actualEndScale = endScale;

  try {
    log(`Starting zoomIn function...`, "blue");
    
    // Validate clip
    const validation = await validateClip(trackItem);
    if (!validation.valid) {
      log(`❌ Cannot zoom: ${validation.reason}`, "red");
      return false;
    }
    log(`✓ Clip validation passed`, "green");

    // Get project
    const project = await ppro.Project.getActiveProject();
    if (!project) {
      log("❌ No active project", "red");
      return false;
    }
    log(`✓ Project found`, "green");

    // Get Motion Scale parameter
    log(`Looking for Motion Scale parameter...`, "blue");
    const context = await getMotionScaleParam(trackItem, project);
    if (!context) {
      log("❌ Could not get Motion Scale parameter", "red");
      return false;
    }
    log(`✓ Motion Scale parameter found`, "green");

    const { componentParam } = context;

    // Calculate timing
    const clipDuration = await getClipDuration(trackItem);
    const clipStartTime = await getClipInPoint(trackItem);
    
    if (clipDuration === null || clipStartTime === null) {
      log(`❌ Could not get clip timing information`, "red");
      return false;
    }
    
    const zoomDuration = duration || clipDuration;
    const absoluteStartTime = clipStartTime + startTime;
    const absoluteEndTime = absoluteStartTime + zoomDuration;

    // Log different messages for animated vs static zoom
    if (animated) {
      log(`Applying gradual zoom: ${actualStartScale}% → ${actualEndScale}% over ${zoomDuration.toFixed(2)}s`, "blue");
    } else {
      log(`Applying static zoom: ${actualEndScale}% throughout entire clip`, "blue");
    }
    log(`Clip starts at: ${clipStartTime.toFixed(2)}s, duration: ${clipDuration.toFixed(2)}s`, "blue");
    log(`Keyframes at: ${absoluteStartTime.toFixed(2)}s and ${absoluteEndTime.toFixed(2)}s`, "blue");
    await logClipInfo(trackItem);

    // Create start keyframe
    log(`Creating start keyframe at ${absoluteStartTime.toFixed(2)}s with value ${actualStartScale}`, "blue");
    const startSuccess = await addKeyframe(
      componentParam, 
      project, 
      absoluteStartTime, 
      actualStartScale, 
      interpolation
    );

    if (!startSuccess) {
      log("❌ Failed to create start keyframe", "red");
      return false;
    }

    // Create end keyframe
    log(`Creating end keyframe at ${absoluteEndTime.toFixed(2)}s with value ${actualEndScale}`, "blue");
    const endSuccess = await addKeyframe(
      componentParam, 
      project, 
      absoluteEndTime, 
      actualEndScale, 
      interpolation
    );

    if (!endSuccess) {
      log("❌ Failed to create end keyframe", "red");
      return false;
    }

    if (animated) {
      log(`✅ Gradual zoom applied successfully! Scale ${actualStartScale}% → ${actualEndScale}%`, "green");
    } else {
      log(`✅ Static zoom applied successfully! Scale ${actualEndScale}% throughout clip`, "green");
    }
    return true;
  } catch (err) {
    log(`❌ Error in zoomIn: ${err.message || err}`, "red");
    console.error("zoomIn error details:", err);
    return false;
  }
}

/**
 * Zoom out on a clip - creates animation from larger scale to smaller scale
 * @param {TrackItem} trackItem - The clip to zoom
 * @param {Object} options - Zoom options (same as zoomIn)
 * @returns {Promise<boolean>}
 */
export async function zoomOut(trackItem, options = {}) {
  const {
    startScale = 150,
    endScale = 100,
    ...otherOptions
  } = options;

  log("Applying zoom out...", "blue");
  return await zoomIn(trackItem, { startScale, endScale, ...otherOptions });
}

/**
 * Apply zoom in to multiple clips
 * @param {TrackItem[]} trackItems - Array of clips
 * @param {Object} options - Zoom options
 * @returns {Promise<{successful: number, failed: number}>}
 */
export async function zoomInBatch(trackItems, options = {}) {
  log(`Applying zoom in to ${trackItems.length} clip(s)...`, "blue");
  
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < trackItems.length; i++) {
    const clip = trackItems[i];
    log(`Processing clip ${i + 1}/${trackItems.length}...`, "blue");
    
    const result = await zoomIn(clip, options);
    if (result) {
      successful++;
    } else {
      failed++;
    }
  }

  log(`✅ Batch complete: ${successful} successful, ${failed} failed`, "green");
  return { successful, failed };
}

/**
 * Apply zoom out to multiple clips
 * @param {TrackItem[]} trackItems - Array of clips
 * @param {Object} options - Zoom options
 * @returns {Promise<{successful: number, failed: number}>}
 */
export async function zoomOutBatch(trackItems, options = {}) {
  log(`Applying zoom out to ${trackItems.length} clip(s)...`, "blue");
  
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < trackItems.length; i++) {
    const clip = trackItems[i];
    log(`Processing clip ${i + 1}/${trackItems.length}...`, "blue");
    
    const result = await zoomOut(clip, options);
    if (result) {
      successful++;
    } else {
      failed++;
    }
  }

  log(`✅ Batch complete: ${successful} successful, ${failed} failed`, "green");
  return { successful, failed };
}

// ============ BLUR ============
/**
 * Apply blur effect to a single track item
 * @param {TrackItem} trackItem - The clip to apply blur to
 * @param {number} blurriness - Blur amount (default: 50)
 * @returns {Promise<boolean>}
 */
export async function applyBlur(trackItem, blurriness = 50) {
  try {
    const project = await ppro.Project.getActiveProject();
    if (!project) {
      log("No active project", "red");
      return false;
    }

    if (!trackItem) {
      log("No track item provided", "red");
      return false;
    }

    const componentChain = await trackItem.getComponentChain();
    if (!componentChain) {
      log("No component chain", "red");
      return false;
    }

    // Helper to find a param named "Blurriness" across all components
    const findBlurrinessParam = async () => {
      const compCount = componentChain.getComponentCount();
      for (let ci = 0; ci < compCount; ci++) {
        const comp = componentChain.getComponentAtIndex(ci);
        const paramCount = comp.getParamCount();
        for (let pi = 0; pi < paramCount; pi++) {
          const param = await comp.getParam(pi);
          const name = (param?.displayName || "").trim().toLowerCase();
          if (name === "blurriness") {
            return param;
          }
        }
      }
      return null;
    };

    // Try to find existing "Blurriness"
    let blurParam = await findBlurrinessParam();

    // If not found, append Gaussian Blur and try again
    if (!blurParam) {
      const blurComponent = await ppro.VideoFilterFactory.createComponent("AE.ADBE Gaussian Blur 2");
      const appendAction = await componentChain.createAppendComponentAction(blurComponent);
      await executeAction(project, appendAction);
      blurParam = await findBlurrinessParam();
    }

    if (!blurParam) {
      log("Could not find Blurriness parameter", "yellow");
      return false;
    }

    // Set value via keyframe (required by createSetValueAction)
    const keyframe = blurParam.createKeyframe(Number(blurriness));
    const setAction = blurParam.createSetValueAction(keyframe, true);
    await executeAction(project, setAction);

    log(`✅ Blur effect (${blurriness}) applied`, "green");
    return true;

  } catch (err) {
    log(`Error applying blur: ${err}`, "red");
    return false;
  }
}

// ============ TRANSITIONS ============
export async function applyTransition(item, transitionName, durationSeconds = 1.0, applyToStart = true, transitionAllignment = 0.5) {
  try {
    const matchNameList = await ppro.TransitionFactory.getVideoTransitionMatchNames();
    console.log("Available transitions:", matchNameList);
    const matched = matchNameList.find(n => n.toLowerCase() === transitionName.toLowerCase());

    if (!matched) {
      log(`Transition not found: ${transitionName}`, "red");
      return false;
    }

    const videoTransition = await ppro.TransitionFactory.createVideoTransition(matched);
    const opts = new ppro.AddTransitionOptions();
    console.log("AddTransitionOptions created:", opts);
    opts.setApplyToStart(applyToStart);
    const time = await ppro.TickTime.createWithSeconds(durationSeconds);
    opts.setDuration(time);
    opts.setForceSingleSided(false);
    opts.setTransitionAlignment(transitionAllignment);

    const project = await ppro.Project.getActiveProject();
    const action = await item.createAddVideoTransitionAction(videoTransition, opts);
    await executeAction(project, action);

    log(`Transition applied: ${matched}`, "green");
    return true;
  } catch (err) {
    log(`Error applying transition: ${err}`, "red");
    return false;
  }
}

// ============ FILTERS/EFFECTS ============
export async function applyRandomFilter(item) {
  try {
    const matchNames = await ppro.VideoFilterFactory.getMatchNames();
    console.log("Available video filters:", matchNames);
    if (!matchNames || matchNames.length === 0) {
      log("No video filters available", "red");
      return false;
    }

    const randomName = matchNames[Math.floor(Math.random() * matchNames.length)];
    const component = await ppro.VideoFilterFactory.createComponent(randomName);
    const componentChain = await item.getComponentChain();
    const project = await ppro.Project.getActiveProject();
    const action = await componentChain.createAppendComponentAction(component);
    await executeAction(project, action);

    log(`Filter applied: ${randomName}`, "green");
    return true;
  } catch (err) {
    log(`Error applying filter: ${err}`, "red");
    return false;
  }
}

export async function applyFilter(item, filterName) {
  try {
    const matchNames = await ppro.VideoFilterFactory.getMatchNames();
    console.log("Available video filters:", matchNames);
    if (!matchNames.includes(filterName)) {
      log(`Filter not found: ${filterName}`, "red");
      return false;
    }
    const component = await ppro.VideoFilterFactory.createComponent(filterName);
    const componentChain = await item.getComponentChain();
    const project = await ppro.Project.getActiveProject();
    const action = await componentChain.createAppendComponentAction(component);
    await executeAction(project, action);
    const compCount = componentChain.getComponentCount();
    console.log("Component count after adding filter:", compCount);
    for (let ci = 0; ci < compCount; ci++) {
      const comp = await componentChain.getComponentAtIndex(ci);
      const name = await comp.getMatchName();
      const dispName = await comp.getDisplayName();
      console.log(`Component ${ci}: ${name} (${dispName})`);
      const paramCount = comp.getParamCount();
      for (let pi = 0; pi < paramCount; pi++) {
        const param = await comp.getParam(pi);
        console.log(" Param details:", param);
        const name = (param?.displayName || "").trim().toLowerCase();
        console.log("  Param:", name);
      }
    }

    log(`Filter applied: ${filterName}`, "green");
    return true;
  } catch (err) {
    log(`Error applying filter: ${err}`, "red");
    return false;
  }
}

// ============ DEMO/TEST FUNCTIONS ============

/**
 * Simple test - zoom in on first selected clip
 */
export async function testZoom() {
  log("🧪 Testing zoom functionality...", "blue");
  
  const project = await ppro.Project.getActiveProject();
  if (!project) {
    log("No active project", "red");
    return;
  }

  const sequence = await project.getActiveSequence();
  if (!sequence) {
    log("No sequence found", "red");
    return;
  }

  const selection = await sequence.getSelection();
  if (!selection) {
    log("No selection found", "red");
    return;
  }

  const trackItems = await selection.getTrackItems();
  if (!trackItems || trackItems.length === 0) {
    log("❌ No clips selected. Please select a clip on the timeline.", "red");
    return;
  }

  log(`Found ${trackItems.length} selected clip(s)`, "blue");

  // Test zoom in on all selected clips
  const result = await zoomInBatch(trackItems, {
    startScale: 100,
    endScale: 150,
    interpolation: 'BEZIER'
  });

  log(`🎉 Test complete! ${result.successful} clips zoomed successfully.`, "green");
}

// ============ PARAMETER MODIFICATION ============

/**
 * Get all modifiable parameters from a clip's effects
 * @param {TrackItem} trackItem - The clip to inspect
 * @returns {Promise<Array>} Array of parameter info objects
 */
export async function getEffectParameters(trackItem) {
  try {
    if (!trackItem) {
      log("No track item provided", "red");
      return [];
    }

    const componentChain = await trackItem.getComponentChain();
    if (!componentChain) {
      log("No component chain", "red");
      return [];
    }

    const parameters = [];
    const compCount = componentChain.getComponentCount();
    
    for (let ci = 0; ci < compCount; ci++) {
      const comp = await componentChain.getComponentAtIndex(ci);
      const matchName = await comp.getMatchName();
      const displayName = await comp.getDisplayName();
      
      // Skip built-in components (Opacity, Motion) unless user explicitly wants them
      const isBuiltIn = matchName.includes("ADBE Opacity") || matchName.includes("ADBE Motion");
      
      const paramCount = comp.getParamCount();
      for (let pi = 0; pi < paramCount; pi++) {
        const param = await comp.getParam(pi);
        const paramName = (param?.displayName || "").trim();
        
        // Skip empty params
        if (!paramName) continue;
        
        parameters.push({
          componentIndex: ci,
          paramIndex: pi,
          componentMatchName: matchName,
          componentDisplayName: displayName,
          paramDisplayName: paramName,
          param: param,
          isBuiltIn: isBuiltIn
        });
      }
    }
    
    log(`Found ${parameters.length} parameters across ${compCount} components`, "blue");
    return parameters;
  } catch (err) {
    log(`Error getting effect parameters: ${err}`, "red");
    return [];
  }
}

/**
 * Modify a specific effect parameter on a clip
 * @param {TrackItem} trackItem - The clip to modify
 * @param {Object} options - Modification options
 * @param {string} options.parameterName - Name of the parameter to modify (case-insensitive, fuzzy matched)
 * @param {number} options.value - New value for the parameter
 * @param {string} options.componentName - (Optional) Name of the component/effect containing the parameter
 * @param {boolean} options.excludeBuiltIn - Whether to exclude built-in effects like Motion/Opacity (default: true)
 * @returns {Promise<boolean>}
 */
export async function modifyEffectParameter(trackItem, options = {}) {
  try {
    const {
      parameterName,
      value,
      componentName = null,
      excludeBuiltIn = true
    } = options;

    if (!parameterName) {
      log("Parameter name is required", "red");
      return false;
    }

    if (value === undefined || value === null) {
      log("Parameter value is required", "red");
      return false;
    }

    log(`Looking for parameter "${parameterName}" to set to ${value}`, "blue");

    // Get all parameters
    const allParams = await getEffectParameters(trackItem);
    
    if (allParams.length === 0) {
      log("No parameters found on this clip", "red");
      return false;
    }

    // Filter parameters
    let candidates = allParams;
    
    // Exclude built-in if requested
    if (excludeBuiltIn) {
      candidates = candidates.filter(p => !p.isBuiltIn);
      log(`Filtered to ${candidates.length} non-built-in parameters`, "blue");
    }
    
    // Filter by component name if specified
    if (componentName) {
      const componentLower = componentName.toLowerCase();
      candidates = candidates.filter(p => 
        p.componentDisplayName.toLowerCase().includes(componentLower) ||
        p.componentMatchName.toLowerCase().includes(componentLower)
      );
      log(`Filtered to ${candidates.length} parameters in component "${componentName}"`, "blue");
    }
    
    // Find matching parameter (fuzzy match)
    const paramLower = parameterName.toLowerCase();
    const match = candidates.find(p => 
      p.paramDisplayName.toLowerCase() === paramLower ||
      p.paramDisplayName.toLowerCase().includes(paramLower) ||
      paramLower.includes(p.paramDisplayName.toLowerCase())
    );

    if (!match) {
      log(`❌ Parameter "${parameterName}" not found`, "red");
      log(`Available parameters: ${candidates.map(p => p.paramDisplayName).join(', ')}`, "yellow");
      return false;
    }

    log(`✓ Found parameter: "${match.paramDisplayName}" in ${match.componentDisplayName}`, "green");

    // Get project for executing action
    const project = await ppro.Project.getActiveProject();
    if (!project) {
      log("No active project", "red");
      return false;
    }

    // Set the value
    const param = match.param;
    const keyframe = param.createKeyframe(Number(value));
    const setAction = param.createSetValueAction(keyframe, true);
    await executeAction(project, setAction);

    log(`✅ Parameter "${match.paramDisplayName}" set to ${value}`, "green");
    return true;

  } catch (err) {
    log(`❌ Error modifying parameter: ${err}`, "red");
    console.error("Parameter modification error details:", err);
    return false;
  }
}

/**
 * Modify multiple parameters on a clip in batch
 * @param {TrackItem} trackItem - The clip to modify
 * @param {Array<Object>} modifications - Array of {parameterName, value, componentName?} objects
 * @param {boolean} excludeBuiltIn - Whether to exclude built-in effects (default: true)
 * @returns {Promise<{successful: number, failed: number}>}
 */
export async function modifyEffectParametersBatch(trackItem, modifications, excludeBuiltIn = true) {
  log(`Modifying ${modifications.length} parameter(s) on clip...`, "blue");
  
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < modifications.length; i++) {
    const mod = modifications[i];
    log(`Processing modification ${i + 1}/${modifications.length}: ${mod.parameterName} = ${mod.value}`, "blue");
    
    const result = await modifyEffectParameter(trackItem, {
      ...mod,
      excludeBuiltIn
    });
    
    if (result) {
      successful++;
    } else {
      failed++;
    }
  }

  log(`✅ Batch complete: ${successful} successful, ${failed} failed`, "green");
  return { successful, failed };
}
