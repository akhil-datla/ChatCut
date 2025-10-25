const ppro = require("premierepro");

// ============ UTILITY ============
function log(msg, color = "white") {
  console.log(`[Edit][${color}] ${msg}`);
}

async function getComponentParam() {
  const project = await ppro.Project.getActiveProject();
  if (!project) {
    log("No active project", "red");
    return null;
  }

  const sequence = await project.getActiveSequence();
  if (!sequence) {
    log("No sequence found", "red");
    return null;
  }

  const videoTrack = await sequence.getVideoTrack(0);
  if (!videoTrack) {
    log("No video track found", "red");
    return null;
  }

  const trackItems = await videoTrack.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
  if (!trackItems || trackItems.length === 0) {
    log("No track items found", "red");
    return null;
  }

  const componentChain = await trackItems[0].getComponentChain();
  try {
    let componentParam;
    await project.lockedAccess(async () => {
      const component = componentChain.getComponentAtIndex(1);
      componentParam = await component.getParam(1);
    });
    return { componentParam, project };
  } catch (err) {
    log(`Error: ${err}`, "red");
    return null;
  }
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

// ============ ZOOM/MOTION ============
export async function applyZoom(seconds, zoomValue, smooth = true, interpolationMode = null) {
  const context = await getComponentParam();
  if (!context) return false;

  const { componentParam, project } = context;

  try {
    let success = false;
    project.lockedAccess(() => {
      success = project.executeTransaction((compound) => {
        const action = componentParam.createSetTimeVaryingAction(true);
        compound.addAction(action);
      });
    });

    if (!success) {
      log("Failed to enable time-varying", "red");
      return false;
    }

    project.lockedAccess(() => {
      success = project.executeTransaction((compound) => {
        const keyframe = componentParam.createKeyframe(zoomValue);
        keyframe.position = ppro.TickTime.createWithSeconds(seconds);
        const action = componentParam.createAddKeyframeAction(keyframe);
        compound.addAction(action);
      });
    });

    if (!success) return false;

    const modeMap = {
      'LINEAR': ppro.Constants.InterpolationMode.LINEAR,
      'BEZIER': ppro.Constants.InterpolationMode.BEZIER,
      'HOLD': ppro.Constants.InterpolationMode.HOLD,
      'EASE_IN': ppro.Constants.InterpolationMode.EASE_IN,
      'EASE_OUT': ppro.Constants.InterpolationMode.EASE_OUT,
    };
    const interpMode = interpolationMode ? modeMap[interpolationMode] : (smooth ? ppro.Constants.InterpolationMode.BEZIER : ppro.Constants.InterpolationMode.HOLD);

    project.lockedAccess(() => {
      success = project.executeTransaction((compound) => {
        const action = componentParam.createSetInterpolationAtKeyframeAction(
          ppro.TickTime.createWithSeconds(seconds),
          interpMode
        );
        compound.addAction(action);
      });
    });

    log(`Zoom applied at ${seconds}s: value=${zoomValue}`, "green");
    return success;
  } catch (err) {
    log(`Error applying zoom: ${err}`, "red");
    return false;
  }
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



// ============ DEMO ============
export async function applyKeyframeDemo() {
  log("Starting keyframe demo...", "blue");
  
  // Apply zoom keyframes at 1s, 6s, and 12s with HOLD interpolation
  await applyZoom(1, 50, false, "HOLD");      // 0.5x zoom at 1s, instant
  await applyZoom(6, 100, false, "HOLD");     // 1.0x zoom at 6s, instant
  await applyZoom(12, 200, false, "HOLD");    // 2.0x zoom at 12s, instant
  
  log("✅ Keyframe demo complete!", "green");
}

export async function applyTransitionDemo() {
  log("Starting transition demo...", "blue");
  
  // Get all selected clips
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
    log("No track items selected", "red");
    return;
  }

  log(`Found ${trackItems.length} selected clip(s)`, "blue");

  try {
    // Log available transitions
    const availableTransitions = await ppro.TransitionFactory.getVideoTransitionMatchNames();
    log(`Available transitions: ${availableTransitions.join(", ")}`, "blue");

    // Apply transition to each selected clip
    for (let i = 0; i < trackItems.length; i++) {
      const clip = trackItems[i];
      log(`Applying transition to clip ${i + 1}/${trackItems.length}...`, "blue");

      const transitionSuccess = await applyTransition(clip, "AE.AE_Impact_Lens_Blur", 1.0, true);
      if (transitionSuccess) {
        log(`✅ Transition applied to clip ${i + 1}`, "green");
      } else {
        log(`⚠️  Transition skipped for clip ${i + 1}`, "yellow");
      }
    }

    log("🎉 Transition demo complete!", "green");
  } catch (err) {
    log(`Error during transition demo: ${err}`, "red");
  }
}

export async function applyFilterDemo() {
  log("Starting filter demo...", "blue");
  
  // Get all selected clips
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
    log("No track items selected", "red");
    return;
  }

  log(`Found ${trackItems.length} selected clip(s)`, "blue");

  try {
    // Log available filters
    const availableFilters = await ppro.VideoFilterFactory.getMatchNames();
    log(`Available filters (${availableFilters.length} total): ${availableFilters.slice(0, 10).join(", ")}${availableFilters.length > 10 ? "..." : ""}`, "blue");

    // Apply filter to each selected clip
    for (let i = 0; i < trackItems.length; i++) {
      const clip = trackItems[i];
      log(`Applying filter to clip ${i + 1}/${trackItems.length}...`, "blue");

      const filterSuccess = await applyFilter(clip, "PR.ADBE Lens Distortion");
      if (filterSuccess) {
        log(`✅ Filter applied to clip ${i + 1}`, "green");
      } else {
        log(`⚠️  Filter skipped for clip ${i + 1}`, "yellow");
      }
    }

    log("🎉 Filter demo complete!", "green");
  } catch (err) {
    log(`Error during filter demo: ${err}`, "red");
  }
}

export async function applyComprehensiveDemo() {
  log("Starting comprehensive demo (zoom + transition + filter)...", "blue");
  
  try {
    await applyKeyframeDemo();
    await applyTransitionDemo();
    await applyFilterDemo();
    log("🎉 All comprehensive tests completed on all selected clips!", "green");
  } catch (err) {
    log(`Error during comprehensive demo: ${err}`, "red");
  }
}
