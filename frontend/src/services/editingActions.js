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
    let success = false;

    // Enable time-varying if not already enabled
    await project.lockedAccess(() => {
      success = project.executeTransaction((compound) => {
        const action = param.createSetTimeVaryingAction(true);
        compound.addAction(action);
      });
    });

    if (!success) {
      log("Failed to enable time-varying", "red");
      return false;
    }

    // Add the keyframe
    await project.lockedAccess(() => {
      success = project.executeTransaction((compound) => {
        const keyframe = param.createKeyframe(value);
        keyframe.position = ppro.TickTime.createWithSeconds(seconds);
        const action = param.createAddKeyframeAction(keyframe);
        compound.addAction(action);
      });
    });

    if (!success) {
      log(`Failed to add keyframe at ${seconds}s`, "red");
      return false;
    }

    // Set interpolation mode
    const modeMap = {
      'LINEAR': ppro.Constants.InterpolationMode.LINEAR,
      'BEZIER': ppro.Constants.InterpolationMode.BEZIER,
      'HOLD': ppro.Constants.InterpolationMode.HOLD,
      'EASE_IN': ppro.Constants.InterpolationMode.EASE_IN,
      'EASE_OUT': ppro.Constants.InterpolationMode.EASE_OUT,
    };
    const interpMode = modeMap[interpolation] || ppro.Constants.InterpolationMode.BEZIER;

    await project.lockedAccess(() => {
      success = project.executeTransaction((compound) => {
        const action = param.createSetInterpolationAtKeyframeAction(
          ppro.TickTime.createWithSeconds(seconds),
          interpMode
        );
        compound.addAction(action);
      });
    });

    log(`✓ Keyframe added at ${seconds.toFixed(2)}s: value=${value}`, "green");
    return success;
  } catch (err) {
    log(`Error adding keyframe: ${err}`, "red");
    return false;
  }
}

// ============ ZOOM FUNCTIONS ============

/**
 * Zoom in on a clip - creates animation from start scale to end scale
 * @param {TrackItem} trackItem - The clip to zoom
 * @param {Object} options - Zoom options
 * @param {number} options.startScale - Starting scale percentage (default: 100)
 * @param {number} options.endScale - Ending scale percentage (default: 150)
 * @param {number} options.startTime - Start time in seconds relative to clip (default: 0)
 * @param {number} options.duration - Duration of zoom in seconds (default: entire clip)
 * @param {string} options.interpolation - 'LINEAR', 'BEZIER', 'HOLD', 'EASE_IN', 'EASE_OUT' (default: 'BEZIER')
 * @returns {Promise<boolean>}
 */
export async function zoomIn(trackItem, options = {}) {
  const {
    startScale = 100,
    endScale = 150,
    startTime = 0,
    duration = null,
    interpolation = 'BEZIER'
  } = options;

  try {
    // Validate clip
    const validation = await validateClip(trackItem);
    if (!validation.valid) {
      log(`Cannot zoom: ${validation.reason}`, "red");
      return false;
    }

    // Get project
    const project = await ppro.Project.getActiveProject();
    if (!project) {
      log("No active project", "red");
      return false;
    }

    // Get Motion Scale parameter
    const context = await getMotionScaleParam(trackItem, project);
    if (!context) {
      log("Could not get Motion Scale parameter", "red");
      return false;
    }

    const { componentParam } = context;

    // Calculate timing
    const clipDuration = await getClipDuration(trackItem);
    const clipStartTime = await getClipInPoint(trackItem);
    
    const zoomDuration = duration || clipDuration;
    const absoluteStartTime = clipStartTime + startTime;
    const absoluteEndTime = absoluteStartTime + zoomDuration;

    log(`Zooming in: ${startScale}% → ${endScale}% over ${zoomDuration.toFixed(2)}s`, "blue");
    await logClipInfo(trackItem);

    // Create start keyframe
    const startSuccess = await addKeyframe(
      componentParam, 
      project, 
      absoluteStartTime, 
      startScale, 
      interpolation
    );

    if (!startSuccess) {
      log("Failed to create start keyframe", "red");
      return false;
    }

    // Create end keyframe
    const endSuccess = await addKeyframe(
      componentParam, 
      project, 
      absoluteEndTime, 
      endScale, 
      interpolation
    );

    if (!endSuccess) {
      log("Failed to create end keyframe", "red");
      return false;
    }

    log(`✅ Zoom in applied successfully!`, "green");
    return true;
  } catch (err) {
    log(`Error in zoomIn: ${err}`, "red");
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

// ============ TRANSITIONS ============
export async function applyTransition(item, transitionName, durationSeconds = 1.0, applyToStart = true) {
  try {
    const matchNameList = await ppro.TransitionFactory.getVideoTransitionMatchNames();
    const matched = matchNameList.find(n => n.toLowerCase() === transitionName.toLowerCase());

    if (!matched) {
      log(`Transition not found: ${transitionName}`, "red");
      return false;
    }

    const videoTransition = await ppro.TransitionFactory.createVideoTransition(matched);
    const opts = new ppro.AddTransitionOptions();
    opts.setApplyToStart(applyToStart);
    const time = await ppro.TickTime.createWithSeconds(durationSeconds);
    opts.setDuration(time);
    opts.setForceSingleSided(false);
    opts.setTransitionAlignment(0.5);

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
    const component = await ppro.VideoFilterFactory.createComponent(filterName);
    const componentChain = await item.getComponentChain();
    const project = await ppro.Project.getActiveProject();
    const action = await componentChain.createAppendComponentAction(component);
    await executeAction(project, action);

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
