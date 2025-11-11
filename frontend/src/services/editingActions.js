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

    log("Filter applied: " + filterName, "green");
    return true;
  } catch (err) {
    log("Error applying filter: " + err, "red");
    return false;
  }
}

// ============ DEMO ============
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
