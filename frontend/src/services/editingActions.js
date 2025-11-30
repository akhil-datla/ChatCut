// src/services/editingActions.js
/* eslint-disable no-undef */

// Premiere Pro UXP bridge
const ppro = require("premierepro");

import {
  getClipDuration,
  getClipInPoint,
  getMotionScaleParam,
  validateClip,
  logClipInfo,
} from "./clipUtils.js";

// ============ LOGGING ============
function log(msg, color = "white") {
  // Keep logs lightweight—Premiere's console can be noisy
  // Use Premiere's devtools console inside the panel
  try {
    console.log("[Edit][" + color + "] " + msg);
  } catch (_) {}
}

// ============ UTIL ============
function escapeForExtendScript(str) {
  // ensure titles passed into executeScript won't break the string
  return String(str).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// ============ HOST UNDO HELPERS ============
// We must run begin/endUndoGroup in the host scripting context
// so the History panel shows our custom label (otherwise "Edit Project").
async function beginUndoGroup(title) {
  var t = title || "ChatCut Edit";
  try {
    if (ppro && ppro.host && ppro.host.executeScript) {
      await ppro.host.executeScript('app.beginUndoGroup("' + escapeForExtendScript(t) + '")');
    } else if (typeof app !== "undefined" && app.beginUndoGroup) {
      // fallback if running in a context where app is exposed
      app.beginUndoGroup(t);
    } else {
      log("Could not access host undo context (beginUndoGroup).", "yellow");
    }
  } catch (err) {
    log("beginUndoGroup failed: " + err, "yellow");
  }
}

async function endUndoGroup() {
  try {
    if (ppro && ppro.host && ppro.host.executeScript) {
      await ppro.host.executeScript("app.endUndoGroup()");
    } else if (typeof app !== "undefined" && app.endUndoGroup) {
      app.endUndoGroup();
    } else {
      log("Could not access host undo context (endUndoGroup).", "yellow");
    }
  } catch (err) {
    log("endUndoGroup failed: " + err, "yellow");
  }
}

// ============ GENERIC ACTION EXECUTOR ============
async function executeAction(project, action) {
  return new Promise(function (resolve, reject) {
    try {
      project.lockedAccess(function () {
        project.executeTransaction(function (compound) {
          compound.addAction(action);
        });
        resolve();
      });
    } catch (err) {
      log("Error executing action: " + err, "red");
      reject(err);
    }
  });
}

// ============ KEYFRAME HELPERS ============
// Add a keyframe in ONE transaction (enable time-varying, add keyframe, set interpolation).
async function addKeyframe(param, project, seconds, value, interpolation) {
  var interp = interpolation || "BEZIER";
  try {
    var modeMap = {
      LINEAR: ppro.Constants.InterpolationMode.LINEAR,
      BEZIER: ppro.Constants.InterpolationMode.BEZIER,
      HOLD: ppro.Constants.InterpolationMode.HOLD,
      EASE_IN: ppro.Constants.InterpolationMode.EASE_IN,
      EASE_OUT: ppro.Constants.InterpolationMode.EASE_OUT,
    };
    var interpMode = modeMap[interp] || ppro.Constants.InterpolationMode.BEZIER;
    var tt = ppro.TickTime.createWithSeconds(seconds);

    await project.lockedAccess(function () {
      project.executeTransaction(function (compound) {
        // 1) ensure time-varying
        compound.addAction(param.createSetTimeVaryingAction(true));

        // 2) create + add keyframe
        var kf = param.createKeyframe(Number(value));
        kf.position = tt;
        compound.addAction(param.createAddKeyframeAction(kf));

        // 3) set interpolation at that time
        compound.addAction(param.createSetInterpolationAtKeyframeAction(tt, interpMode));
      });
    });

    log("✅ Keyframe @" + seconds.toFixed(2) + "s = " + value, "green");
    return true;
  } catch (err) {
    log("❌ Error adding keyframe: " + (err && err.message ? err.message : err), "red");
    return false;
  }
}

// ============ ZOOM FUNCTIONS ============
// Zoom in on a clip (animated or static).
// If animated=false, we set start & end keyframes to the same endScale for a static look.
export async function zoomIn(trackItem, options) {
  options = options || {};
  var startScale = Object.prototype.hasOwnProperty.call(options, "startScale") ? options.startScale : 100;
  var endScale = Object.prototype.hasOwnProperty.call(options, "endScale") ? options.endScale : 150;
  var startTime = Object.prototype.hasOwnProperty.call(options, "startTime") ? options.startTime : 0;
  var duration = Object.prototype.hasOwnProperty.call(options, "duration") ? options.duration : null;
  var interpolation = options.interpolation || "BEZIER";
  var animated = Object.prototype.hasOwnProperty.call(options, "animated") ? options.animated : false; // default static

  // static: same value at both ends
  var actualStartScale = animated ? startScale : endScale;
  var actualEndScale = endScale;

  try {
    log("Starting zoomIn...", "blue");

    var validation = await validateClip(trackItem);
    if (!validation.valid) {
      log("❌ Cannot zoom: " + validation.reason, "red");
      return false;
    }

    var project = await ppro.Project.getActiveProject();
    if (!project) {
      log("❌ No active project", "red");
      return false;
    }

    var context = await getMotionScaleParam(trackItem, project);
    if (!context) {
      log("❌ Could not get Motion > Scale param", "red");
      return false;
    }
    var componentParam = context.componentParam;

    var clipDuration = await getClipDuration(trackItem);
    var clipStartTime = await getClipInPoint(trackItem);
    if (clipDuration == null || clipStartTime == null) {
      log("❌ Could not get clip timing", "red");
      return false;
    }

    var zoomDuration = duration || clipDuration;
    var absoluteStartTime = clipStartTime + startTime;
    var absoluteEndTime = absoluteStartTime + zoomDuration;

    if (animated) {
      log(
        "Applying gradual zoom: " +
          actualStartScale +
          "% → " +
          actualEndScale +
          "% over " +
          zoomDuration.toFixed(2) +
          "s",
        "blue"
      );
    } else {
      log("Applying static zoom: " + actualEndScale + "% for " + zoomDuration.toFixed(2) + "s", "blue");
    }

    await logClipInfo(trackItem);

    // Group as a single history entry (host context)
    await beginUndoGroup("ChatCut: " + (animated ? "Animated" : "Static") + " Zoom");

    var startOK = await addKeyframe(
      componentParam,
      project,
      absoluteStartTime,
      actualStartScale,
      interpolation
    );
    if (!startOK) {
      await endUndoGroup();
      return false;
    }

    var endOK = await addKeyframe(componentParam, project, absoluteEndTime, actualEndScale, interpolation);
    await endUndoGroup();

    if (!endOK) return false;

    if (animated) {
      log("✅ Gradual zoom " + actualStartScale + "% → " + actualEndScale + "%", "green");
    } else {
      log("✅ Static zoom " + actualEndScale + "%", "green");
    }
    return true;
  } catch (err) {
    try {
      await endUndoGroup();
    } catch (_) {}
    log("❌ Error in zoomIn: " + (err && err.message ? err.message : err), "red");
    return false;
  }
}

export async function zoomOut(trackItem, options) {
  options = options || {};
  var rest = {};
  for (var k in options) if (Object.prototype.hasOwnProperty.call(options, k)) rest[k] = options[k];
  rest.startScale = Object.prototype.hasOwnProperty.call(options, "startScale") ? options.startScale : 150;
  rest.endScale = Object.prototype.hasOwnProperty.call(options, "endScale") ? options.endScale : 100;

  log("Applying zoom out...", "blue");
  return await zoomIn(trackItem, rest);
}

export async function zoomInBatch(trackItems, options) {
  options = options || {};
  log("Applying zoom in to " + trackItems.length + " clip(s)...", "blue");
  var successful = 0;
  var failed = 0;

  for (var i = 0; i < trackItems.length; i++) {
    var ok = await zoomIn(trackItems[i], options);
    if (ok) successful++;
    else failed++;
  }
  log("✅ Batch done: " + successful + " ok / " + failed + " failed", "green");
  return { successful: successful, failed: failed };
}

export async function zoomOutBatch(trackItems, options) {
  options = options || {};
  log("Applying zoom out to " + trackItems.length + " clip(s)...", "blue");
  var successful = 0;
  var failed = 0;

  for (var i = 0; i < trackItems.length; i++) {
    var ok = await zoomOut(trackItems[i], options);
    if (ok) successful++;
    else failed++;
  }
  log("✅ Batch done: " + successful + " ok / " + failed + " failed", "green");
  return { successful: successful, failed: failed };
}

// ============ BLUR ============
export async function applyBlur(trackItem, blurriness) {
  blurriness = typeof blurriness === "number" ? blurriness : 50;
  try {
    var project = await ppro.Project.getActiveProject();
    if (!project) {
      log("No active project", "red");
      return false;
    }
    if (!trackItem) {
      log("No track item provided", "red");
      return false;
    }

    var componentChain = await trackItem.getComponentChain();
    if (!componentChain) {
      log("No component chain", "red");
      return false;
    }

    // Helper: find a param named "Blurriness" across all components
    async function findBlurrinessParam() {
      var compCount = componentChain.getComponentCount();
      for (var ci = 0; ci < compCount; ci++) {
        var comp = componentChain.getComponentAtIndex(ci);
        var paramCount = comp.getParamCount();
        for (var pi = 0; pi < paramCount; pi++) {
          var param = await comp.getParam(pi);
          var displayName = param && param.displayName ? param.displayName : "";
          var name = displayName.trim().toLowerCase();
          if (name === "blurriness") return param;
        }
      }
      return null;
    }

    var blurParam = await findBlurrinessParam();

    // If not found, append Gaussian Blur and try again
    if (!blurParam) {
      var blurComponent = await ppro.VideoFilterFactory.createComponent("AE.ADBE Gaussian Blur 2");
      var appendAction = await componentChain.createAppendComponentAction(blurComponent);
      await executeAction(project, appendAction);
      blurParam = await findBlurrinessParam();
    }

    if (!blurParam) {
      log("Could not find Blurriness parameter", "yellow");
      return false;
    }

    // Set value via keyframe (required by createSetValueAction)
    var kf = blurParam.createKeyframe(Number(blurriness));
    var setAction = blurParam.createSetValueAction(kf, true);
    await executeAction(project, setAction);

    log("✅ Blur (" + blurriness + ") applied", "green");
    return true;
  } catch (err) {
    log("Error applying blur: " + err, "red");
    return false;
  }
}

// ============ TRANSITIONS ============
export async function applyTransition(
  item,
  transitionName,
  durationSeconds,
  applyToStart,
  transitionAlignment
) {
  durationSeconds = typeof durationSeconds === "number" ? durationSeconds : 1.0;
  applyToStart = typeof applyToStart === "boolean" ? applyToStart : true;
  transitionAlignment = typeof transitionAlignment === "number" ? transitionAlignment : 0.5;

  try {
    var matchNameList = await ppro.TransitionFactory.getVideoTransitionMatchNames();
    var matched = matchNameList.find(function (n) {
      return n.toLowerCase() === transitionName.toLowerCase();
    });
    if (!matched) {
      log("Transition not found: " + transitionName, "red");
      return false;
    }

    var videoTransition = await ppro.TransitionFactory.createVideoTransition(matched);
    var opts = new ppro.AddTransitionOptions();
    opts.setApplyToStart(applyToStart);
    var time = await ppro.TickTime.createWithSeconds(durationSeconds);
    opts.setDuration(time);
    opts.setForceSingleSided(false);
    opts.setTransitionAlignment(transitionAlignment);

    var project = await ppro.Project.getActiveProject();
    var action = await item.createAddVideoTransitionAction(videoTransition, opts);
    await executeAction(project, action);

    log("Transition applied: " + matched, "green");
    return true;
  } catch (err) {
    log("Error applying transition: " + err, "red");
    return false;
  }
}

// ============ FILTERS/EFFECTS ============
export async function applyRandomFilter(item) {
  try {
    var matchNames = await ppro.VideoFilterFactory.getMatchNames();
    if (!matchNames || !matchNames.length) {
      log("No video filters available", "red");
      return false;
    }

    var randomName = matchNames[Math.floor(Math.random() * matchNames.length)];
    var component = await ppro.VideoFilterFactory.createComponent(randomName);
    var componentChain = await item.getComponentChain();
    var project = await ppro.Project.getActiveProject();
    var action = await componentChain.createAppendComponentAction(component);
    await executeAction(project, action);

    log("Filter applied: " + randomName, "green");
    return true;
  } catch (err) {
    log("Error applying random filter: " + err, "red");
    return false;
  }
}

export async function applyFilter(item, filterName) {
  try {
    var matchNames = await ppro.VideoFilterFactory.getMatchNames();
    if (matchNames.indexOf(filterName) === -1) {
      log("Filter not found: " + filterName, "red");
      return false;
    }
    var component = await ppro.VideoFilterFactory.createComponent(filterName);
    var componentChain = await item.getComponentChain();
    var project = await ppro.Project.getActiveProject();
    var action = await componentChain.createAppendComponentAction(component);
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
        const name = (param && param.displayName ? param.displayName : "").trim().toLowerCase();
        console.log("  Param:", name);
      }
    }

    log("Filter applied: " + filterName, "green");
    return true;
  } catch (err) {
    log("Error applying filter: " + err, "red");
    return false;
  }
}

// ============ AUDIO EFFECTS ============

/**
 * Apply an audio filter/effect to an audio clip
 * @param {AudioClipTrackItem} audioClip - The audio clip to apply effect to
 * @param {string} filterDisplayName - Display name of the audio filter (e.g., "Parametric EQ", "Reverb")
 * @returns {Promise<boolean>}
 */
export async function applyAudioFilter(audioClip, filterDisplayName) {
  try {
    log(`Applying audio filter: ${filterDisplayName}`, "blue");
    
    const project = await ppro.Project.getActiveProject();
    if (!project) {
      log("No active project", "red");
      return false;
    }

    if (!audioClip) {
      log("No audio clip provided", "red");
      return false;
    }

    // Get available audio filter display names
    const displayNames = await ppro.AudioFilterFactory.getDisplayNames();
    console.log("Available audio filters:", displayNames);
    
    // Normalize the search term (lowercase, remove common words)
    const normalizedSearch = filterDisplayName.toLowerCase().trim();
    
    // Common name mappings (user-friendly names -> actual filter names)
    const nameMappings = {
      'reverb': ['Studio Reverb', 'Convolution Reverb', 'Surround Reverb', 'AUReverb2', 'AUMatrixReverb'],
      'eq': ['Parametric Equalizer', 'Simple Parametric EQ', 'Graphic Equalizer (10 Bands)', 'Graphic Equalizer (20 Bands)', 'Graphic Equalizer (30 Bands)'],
      'equalizer': ['Parametric Equalizer', 'Simple Parametric EQ', 'Graphic Equalizer (10 Bands)', 'Graphic Equalizer (20 Bands)', 'Graphic Equalizer (30 Bands)'],
      'parametric eq': ['Parametric Equalizer', 'Simple Parametric EQ'],
      'noise reduction': ['Adaptive Noise Reduction', 'DeNoise'],
      'denoise': ['Adaptive Noise Reduction', 'DeNoise'],
      'deesser': ['DeEsser'],
      'chorus': ['Chorus/Flanger'],
      'flanger': ['Chorus/Flanger', 'Flanger'],
      'delay': ['Delay', 'Multitap Delay', 'Analog Delay'],
      'distortion': ['Distortion'],
      'compressor': ['Multiband Compressor', 'Single-band Compressor', 'Tube-modeled Compressor'],
      'limiter': ['Hard Limiter'],
      'phaser': ['Phaser'],
      'pitch': ['Pitch Shifter', 'AUPitch', 'AUNewPitch'],
    };
    
    let matchingName = null;
    
    // First, try exact match (case-insensitive)
    matchingName = displayNames.find(name => 
      name.toLowerCase() === normalizedSearch
    );
    
    // If not found, try name mappings
    if (!matchingName && nameMappings[normalizedSearch]) {
      const candidates = nameMappings[normalizedSearch];
      for (const candidate of candidates) {
        const found = displayNames.find(name => name === candidate);
        if (found) {
          matchingName = found;
          break;
        }
      }
    }
    
    // If still not found, try fuzzy matching (contains search term)
    if (!matchingName) {
      matchingName = displayNames.find(name => 
        name.toLowerCase().includes(normalizedSearch) || 
        normalizedSearch.includes(name.toLowerCase().split(' ')[0]) // Match first word
      );
    }
    
    // If still not found, try partial word matching
    if (!matchingName) {
      const searchWords = normalizedSearch.split(/\s+/);
      matchingName = displayNames.find(name => {
        const nameLower = name.toLowerCase();
        return searchWords.some(word => nameLower.includes(word));
      });
    }
    
    if (!matchingName) {
      log(`Audio filter not found: ${filterDisplayName}`, "red");
      log(`Available filters: ${displayNames.join(', ')}`, "yellow");
      log(`💡 Tip: Try using the exact filter name, or a common name like "reverb", "eq", "delay"`, "yellow");
      return false;
    }
    
    log(`Matched "${filterDisplayName}" to "${matchingName}"`, "blue");

    // Create audio filter component
    const audioFilterComponent = await ppro.AudioFilterFactory.createComponentByDisplayName(
      matchingName,
      audioClip
    );

    // Get audio component chain and append the filter
    const audioComponentChain = await audioClip.getComponentChain();
    const action = await audioComponentChain.createAppendComponentAction(audioFilterComponent);
    await executeAction(project, action);

    log(`✅ Audio filter applied: ${matchingName}`, "green");
    return true;
  } catch (err) {
    log(`Error applying audio filter: ${err}`, "red");
    console.error("applyAudioFilter error details:", err);
    return false;
  }
}

/**
 * Adjust volume of an audio clip
 * @param {AudioClipTrackItem} audioClip - The audio clip to adjust
 * @param {number} volumeDb - Volume adjustment in decibels (positive = louder, negative = quieter)
 * @returns {Promise<boolean>}
 */
export async function adjustVolume(audioClip, volumeDb = 0) {
  try {
    log(`Adjusting volume by ${volumeDb}dB`, "blue");
    
    const project = await ppro.Project.getActiveProject();
    if (!project) {
      log("No active project", "red");
      return false;
    }

    if (!audioClip) {
      log("No audio clip provided", "red");
      return false;
    }

    // Get audio component chain
    const audioComponentChain = await audioClip.getComponentChain();
    if (!audioComponentChain) {
      log("No audio component chain", "red");
      return false;
    }

    // Helper to find a Gain/Volume parameter across all components
    const findGainParam = async () => {
      const compCount = await audioComponentChain.getComponentCount();
      for (let ci = 0; ci < compCount; ci++) {
        try {
          const comp = await audioComponentChain.getComponentAtIndex(ci);
          const paramCount = await comp.getParamCount();
          for (let pi = 0; pi < paramCount; pi++) {
            try {
              const param = await comp.getParam(pi);
              const displayName = ((param && param.displayName) || "").trim().toLowerCase();
              // Look for gain/volume parameters (common names: "Gain", "Volume", "Level")
              if (displayName === "gain" || displayName === "volume" || displayName === "level") {
                return param;
              }
            } catch (err) {
              // Continue searching
            }
          }
        } catch (err) {
          // Continue searching
        }
      }
      return null;
    };

    // Try to find existing Gain/Volume parameter
    let gainParam = await findGainParam();

    // If not found, try to add a "Gain" or "Volume" audio filter
    if (!gainParam) {
      try {
        // Get available audio filter display names
        const displayNames = await ppro.AudioFilterFactory.getDisplayNames();
        log(`Available audio filters: ${displayNames.join(', ')}`, "blue");
        
        // Try common names for gain/volume filters (case-insensitive match)
        // Note: "Volume" might not be a filter - try "Channel Volume" or "Gain" instead
        const gainFilterNames = ["Channel Volume", "Gain", "Hard Limiter", "Dynamics", "Volume"];
        let gainFilterName = null;
        
        for (const name of gainFilterNames) {
          const matching = displayNames.find(dn => dn.toLowerCase() === name.toLowerCase());
          if (matching) {
            gainFilterName = matching;
            break;
          }
        }
        
        if (!gainFilterName) {
          log(`Could not find Gain/Volume filter. Available filters: ${displayNames.join(', ')}`, "yellow");
          log("💡 Tip: Audio clips may have built-in volume. Try selecting clips that already have volume/gain effects applied.", "yellow");
          return false;
        }

        // Create and add the gain filter
        log(`Adding audio filter: ${gainFilterName}`, "blue");
        try {
          const gainFilter = await ppro.AudioFilterFactory.createComponentByDisplayName(
            gainFilterName,
            audioClip
          );
          const appendAction = await audioComponentChain.createAppendComponentAction(gainFilter);
          await executeAction(project, appendAction);
        } catch (err) {
          log(`Could not add ${gainFilterName} filter: ${err.message || err}`, "yellow");
          log("💡 Tip: Some audio filters may not be compatible. Try applying 'Channel Volume' manually first.", "yellow");
          return false;
        }
        
        // Search again for the gain parameter
        gainParam = await findGainParam();
      } catch (err) {
        log(`Could not add Gain/Volume filter: ${err}`, "yellow");
        console.error("Error adding gain filter:", err);
      }
    }

    if (!gainParam) {
      log("Could not find or create gain/volume parameter", "red");
      log("💡 Tip: This clip may not have a volume parameter. Try applying 'Channel Volume' or 'Gain' audio filter manually first, or select a different audio clip.", "yellow");
      return false;
    }

    // Get current value (if time-varying is enabled, get value at start)
    let currentValue = 0;
    try {
      const isTimeVarying = await gainParam.isTimeVarying();
      if (isTimeVarying) {
        const startTime = await ppro.TickTime.createWithSeconds(0);
        const valueAtTime = await gainParam.getValueAtTime(startTime);
        // Extract numeric value if it's a Keyframe object
        currentValue = (valueAtTime && typeof valueAtTime.getValue === 'function') 
          ? await valueAtTime.getValue() 
          : Number(valueAtTime) || 0;
      } else {
        const startVal = await gainParam.getStartValue();
        // Extract numeric value if it's a Keyframe object
        currentValue = (startVal && typeof startVal.getValue === 'function') 
          ? await startVal.getValue() 
          : Number(startVal) || 0;
      }
    } catch (err) {
      // If we can't get current value, assume 0
      log(`Could not get current gain value, assuming 0: ${err}`, "yellow");
      currentValue = 0;
    }

    // Calculate new value (add the adjustment to current value)
    const newValue = Number(currentValue) + Number(volumeDb);
    log(`Current gain: ${currentValue}dB, New gain: ${newValue}dB`, "blue");

    // Set value using keyframe pattern (same as video filters)
    try {
      // Try creating keyframe with numeric value
      const keyframe = await gainParam.createKeyframe(Number(newValue));
      const setAction = await gainParam.createSetValueAction(keyframe, true);
      await executeAction(project, setAction);
      
      log(`✅ Volume adjusted: ${currentValue}dB → ${newValue}dB (${volumeDb > 0 ? '+' : ''}${volumeDb}dB)`, "green");
      return true;
    } catch (err) {
      // If keyframe method fails, try direct setValue (some audio params might not support keyframes)
      try {
        log(`Keyframe method failed, trying direct setValue...`, "yellow");
        const setValueAction = await gainParam.createSetValueAction(Number(newValue), false);
        await executeAction(project, setValueAction);
        log(`✅ Volume adjusted (direct): ${currentValue}dB → ${newValue}dB`, "green");
        return true;
      } catch (err2) {
        log(`Error setting volume: ${err2.message || err2}`, "red");
        console.error("Error setting gain value:", err2);
        return false;
      }
    }
  } catch (err) {
    log(`Error adjusting volume: ${err}`, "red");
    console.error("adjustVolume error details:", err);
    return false;
  }
}

// ============ DEMO/TEST FUNCTIONS ============

/**
 * Simple test - zoom in on first selected clip
 */
export async function testZoom() {
  log("🧪 Testing zoom...", "blue");

  var project = await ppro.Project.getActiveProject();
  if (!project) {
    log("No active project", "red");
    return;
  }

  var sequence = await project.getActiveSequence();
  if (!sequence) {
    log("No sequence found", "red");
    return;
  }

  var selection = await sequence.getSelection();
  if (!selection) {
    log("No selection found", "red");
    return;
  }

  var trackItems = await selection.getTrackItems();
  if (!trackItems || !trackItems.length) {
    log("❌ No clips selected. Select a clip and retry.", "red");
    return;
  }

  var result = await zoomInBatch(trackItems, {
    startScale: 100,
    endScale: 150,
    interpolation: "BEZIER",
    animated: true,
  });

  log("🎉 Test complete! " + result.successful + " clips zoomed successfully.", "green");
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
        const paramName = (param && param.displayName ? param.displayName : "").trim();
        
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
