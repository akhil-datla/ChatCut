/**
 * Premiere Pro API Service
 * Wrapper for UXP API calls to Premiere Pro
 */

const isPromiseLike = (value) =>
  value !== null &&
  typeof value === "object" &&
  typeof value.then === "function";

const TICKS_PER_SECOND = 254016000000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveMaybePromise = async (value) =>
  isPromiseLike(value) ? await value : value;

const toNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : null;
  }
  return null;
};

const normaliseTimePoint = async (timePoint) => {
  const resolved = await resolveMaybePromise(timePoint);
  if (resolved === null || resolved === undefined) {
    return { ticks: null, seconds: null };
  }

  const directNumber = toNumber(resolved);
  if (directNumber !== null) {
    return {
      ticks: directNumber,
      seconds: directNumber / TICKS_PER_SECOND
    };
  }

  if (typeof resolved === "object") {
    let ticks = toNumber(resolved.ticks);
    let seconds = typeof resolved.seconds === "number" && Number.isFinite(resolved.seconds)
      ? resolved.seconds
      : null;

    if (!ticks && typeof resolved.getTicks === "function") {
      ticks = toNumber(await resolveMaybePromise(resolved.getTicks()));
    }

    if (!seconds && typeof resolved.getSeconds === "function") {
      const maybeSeconds = await resolveMaybePromise(resolved.getSeconds());
      if (typeof maybeSeconds === "number" && Number.isFinite(maybeSeconds)) {
        seconds = maybeSeconds;
      }
    }

    if (!ticks && typeof resolved.value === "number" && Number.isFinite(resolved.value)) {
      ticks = resolved.value;
    }

    if (!ticks && seconds !== null) {
      ticks = Math.round(seconds * TICKS_PER_SECOND);
    }

    if (!seconds && ticks !== null) {
      seconds = ticks / TICKS_PER_SECOND;
    }

    return { ticks, seconds };
  }

  return { ticks: null, seconds: null };
};

class PremiereAPI {
  constructor() {
    try {
      this.app = require("premierepro");
    } catch (error) {
      console.error("[PremiereAPI] Failed to load Premiere Pro API:", error);
      this.app = null;
    }
  }

  /**
   * Get the active project
   * @returns {Project} Active project object
   */
  async getActiveProject() {
    try {
      if (!this.app) {
        throw new Error("Premiere Pro API not available");
      }

      const Project = this.app.Project;
      if (!Project || typeof Project.getActiveProject !== "function") {
        throw new Error("Premiere Pro Project API not available");
      }

      const projectResult = Project.getActiveProject();
      const project = await resolveMaybePromise(projectResult);

      if (!project) {
        throw new Error("No active project found. Please open a project in Premiere Pro.");
      }

      return project;
    } catch (error) {
      console.error("[PremiereAPI] Error getting active project:", error);
      throw error;
    }
  }

  /**
   * Get the active sequence
   * @returns {Sequence} Active sequence object
   */
  async getActiveSequence(options = {}) {
    try {
      const project = await this.getActiveProject();
      const { retries = 3, delayMs = 200 } = options;

      const tryResolveSequence = async () => {
        if (!project) {
          return null;
        }

        if (typeof project.getActiveSequence === "function") {
          const sequenceResult = project.getActiveSequence();
          const sequence = await resolveMaybePromise(sequenceResult);
          if (sequence) {
            return sequence;
          }
        }

        if ("activeSequence" in project) {
          const sequence = await resolveMaybePromise(project.activeSequence);
          if (sequence) {
            return sequence;
          }
        }

        if (typeof project.getSequences === "function") {
          try {
            const sequencesResult = project.getSequences();
            const sequences = await resolveMaybePromise(sequencesResult);
            if (Array.isArray(sequences) && sequences.length > 0) {
              return sequences[0];
            }
          } catch (fallbackError) {
            console.warn("[PremiereAPI] Could not resolve sequences list:", fallbackError);
          }
        }

        if (Array.isArray(project.sequences) && project.sequences.length > 0) {
          return project.sequences[0];
        }

        return null;
      };

      for (let attempt = 0; attempt <= retries; attempt += 1) {
        const sequence = await tryResolveSequence();
        if (sequence) {
          return sequence;
        }

        if (attempt < retries) {
          await sleep(delayMs);
        }
      }

      throw new Error("No active sequence found. Please open a sequence in Premiere Pro.");
    } catch (error) {
      console.error("[PremiereAPI] Error getting active sequence:", error);
      throw error;
    }
  }

  /**
   * Get current timeline selection
   * @returns {Object} Selection info with start/end times
   */
  async getSelection() {
    try {
      const sequence = await this.getActiveSequence();

      if (!sequence || typeof sequence.getInPoint !== "function" || typeof sequence.getOutPoint !== "function") {
        throw new Error("Active sequence does not support in/out point retrieval.");
      }

      const [inPoint, outPoint] = await Promise.all([
        resolveMaybePromise(sequence.getInPoint()),
        resolveMaybePromise(sequence.getOutPoint())
      ]);

      const start = await normaliseTimePoint(inPoint);
      const end = await normaliseTimePoint(outPoint);

      const startTicks = start.ticks ?? (start.seconds !== null ? Math.round(start.seconds * TICKS_PER_SECOND) : null);
      const endTicks = end.ticks ?? (end.seconds !== null ? Math.round(end.seconds * TICKS_PER_SECOND) : null);

      if (startTicks === null || endTicks === null) {
        console.warn("[PremiereAPI] In/out points not set or unavailable; treating selection as empty.");
        return {
          startTime: startTicks,
          endTime: endTicks,
          duration: 0,
          hasSelection: false
        };
      }

      const durationSeconds = Math.max(0, (end.seconds ?? endTicks / TICKS_PER_SECOND) - (start.seconds ?? startTicks / TICKS_PER_SECOND));

      return {
        startTime: startTicks,
        endTime: endTicks,
        duration: durationSeconds,
        hasSelection: durationSeconds > 0
      };
    } catch (error) {
      console.error("[PremiereAPI] Error getting selection:", error);
      throw error;
    }
  }

  /**
   * Get player position (playhead)
   * @returns {Object} Player position info
   */
  async getPlayerPosition() {
    try {
      const sequence = await this.getActiveSequence();

      if (!sequence || typeof sequence.getPlayerPosition !== "function") {
        throw new Error("Active sequence does not support player position retrieval.");
      }

      const position = await resolveMaybePromise(sequence.getPlayerPosition());

      return {
        ticks: position.ticks,
        seconds: position.seconds
      };
    } catch (error) {
      console.error("[PremiereAPI] Error getting player position:", error);
      throw error;
    }
  }

  /**
   * Apply an effect to the selected clip(s)
   * @param {string} effectName - Name of the effect to apply
   * @param {Object} parameters - Effect parameters
   * @returns {boolean} Success status
   */
  async applyEffect(effectName, parameters = {}) {
    try {
      console.log(`[PremiereAPI] Applying effect: ${effectName}`, parameters);

      const sequence = await this.getActiveSequence();
      if (!sequence || typeof sequence.getSelection !== "function") {
        throw new Error("Active sequence does not support clip selection retrieval.");
      }

      const selectionResult = sequence.getSelection();
      const selection = await resolveMaybePromise(selectionResult);

      if (!selection) {
        throw new Error("No clips selected. Please select a clip on the timeline.");
      }

      const ppro = this.app;
      const project = await resolveMaybePromise(ppro.Project.getActiveProject());
      if (!project) {
        throw new Error("No active project available.");
      }

      // Strategy: map certain effect names to keyframe-friendly variants
      let targetDisplayName = effectName || "";
      let paramStrategy = null;
      const lcName = (effectName || "").toLowerCase();
      if (lcName.includes("black") && lcName.includes("white")) {
        // Use Lumetri Color to emulate black & white by keyframing saturation
        targetDisplayName = "Lumetri Color";
        paramStrategy = {
          preferParamName: "saturation",
          outsideValue: 100,
          insideValue: 0,
          min: 0,
          max: 200
        };
      } else if (lcName.includes("blur")) {
        // Gaussian blur: keyframe blurriness
        const amount = typeof parameters?.blurriness === "number" ? parameters.blurriness : 50;
        paramStrategy = {
          preferParamName: "blurriness",
          outsideValue: 0,
          insideValue: amount,
          min: 0,
          max: 1000
        };
      } else if (lcName.includes("zoom") || lcName.includes("transform")) {
        // Prefer the built-in Motion component's Scale parameter for zoom
        paramStrategy = {
          preferParamName: "scale",
          outsideValue: 100,
          insideValue: typeof parameters?.scale === "number" ? parameters.scale : 150,
          min: 0,
          max: 1000
        };
      }

      // Map display name -> match name for video effects
      const [displayNames, matchNames] = await Promise.all([
        resolveMaybePromise(ppro.VideoFilterFactory.getDisplayNames()),
        resolveMaybePromise(ppro.VideoFilterFactory.getMatchNames())
      ]);

      const idx = Array.isArray(displayNames)
        ? displayNames.findIndex((n) => (n || "").toLowerCase() === (targetDisplayName || "").toLowerCase())
        : -1;

      let matchName = idx >= 0 && Array.isArray(matchNames) ? matchNames[idx] : null;

      // Fallback: partial / case-insensitive contains
      if (!matchName && Array.isArray(displayNames) && Array.isArray(matchNames)) {
        for (let i = 0; i < displayNames.length; i += 1) {
          if ((displayNames[i] || "").toLowerCase().includes((targetDisplayName || "").toLowerCase())) {
            matchName = matchNames[i];
            break;
          }
        }
      }

      if (!matchName) {
        throw new Error(`Effect '${effectName}' not found in available video filters.`);
      }

      // Helper: get selection time window (seconds)
      const selInfo = await this.getSelection().catch(() => null);
      const hasWindow = !!(selInfo && typeof selInfo.duration === "number" && selInfo.duration > 0);
      const selStartSec = hasWindow ? (selInfo.startTime ?? 0) / TICKS_PER_SECOND : null;
      const selEndSec = hasWindow ? (selInfo.endTime ?? 0) / TICKS_PER_SECOND : null;

      // Try to use explicit selected clips first
      let trackItems = await resolveMaybePromise(selection.getTrackItems()).catch(() => null);

      const itemsOverlapWindow = async (item) => {
        if (!hasWindow) return true;
        const start = await normaliseTimePoint(
          (typeof item.getStart === "function" ? item.getStart() : (typeof item.getStartTime === "function" ? item.getStartTime() : item.start))
        );
        const end = await normaliseTimePoint(
          (typeof item.getEnd === "function" ? item.getEnd() : (typeof item.getEndTime === "function" ? item.getEndTime() : item.end))
        );
        const s = start.seconds ?? (start.ticks ? start.ticks / TICKS_PER_SECOND : null);
        const e = end.seconds ?? (end.ticks ? end.ticks / TICKS_PER_SECOND : null);
        if (s === null || e === null) return true;
        return s < selEndSec && e > selStartSec;
      };

      // If no explicit selection, scan timeline for overlapping items
      if (!trackItems || trackItems.length === 0) {
        trackItems = [];
        try {
          // Iterate video tracks until null
          for (let ti = 0; ; ti += 1) {
            const vTrack = await resolveMaybePromise(sequence.getVideoTrack(ti));
            if (!vTrack) break;
            const allItems = await resolveMaybePromise(vTrack.getTrackItems(ppro.Constants.TrackItemType.CLIP, false));
            if (Array.isArray(allItems)) {
              for (const it of allItems) {
                if (!hasWindow || (await itemsOverlapWindow(it))) {
                  trackItems.push(it);
                }
              }
            }
          }
        } catch (scanErr) {
          console.warn("[PremiereAPI] Could not scan tracks for items:", scanErr);
        }
      }

      if (!trackItems || trackItems.length === 0) {
        throw new Error("No clips selected. Please select at least one clip in the timeline.");
      }

      // Track any successful change: append OR keyframe on existing component
      let changeCount = 0;

      const executeAction = (proj, action) => new Promise((resolve, reject) => {
        try {
          proj.lockedAccess(() => {
            const ok = proj.executeTransaction((compound) => {
              compound.addAction(action);
            });
            resolve(ok);
          });
        } catch (e) {
          reject(e);
        }
      });

      // Helper: set a parameter statically (no keyframes)
      const setParamStatic = async (p, value) => {
        try {
          if (p && typeof p.createSetValueAction === "function") {
            const act = await resolveMaybePromise(p.createSetValueAction(value));
            await executeAction(project, act);
            return true;
          }
          // Fallback: some hosts expose setValue(value, updateUI)
          if (p && typeof p.setValue === "function") {
            await project.lockedAccess(async () => {
              await resolveMaybePromise(p.setValue(value, true));
            });
            return true;
          }
        } catch (e) {}
        return false;
      };

      // Helper: try to enable Uniform Scale if present (Motion)
      const tryEnableUniformScale = async (component) => {
        try {
          const candidateParamIndexes = Array.from({ length: 24 }, (_, i) => i);
          for (const idx of candidateParamIndexes) {
            const p = await resolveMaybePromise(component.getParam(idx)).catch(() => null);
            if (!p) continue;
            let nm = null;
            try { if (typeof p.getDisplayName === "function") { nm = (await resolveMaybePromise(p.getDisplayName())) || nm; } } catch (e) {}
            try { if (!nm && typeof p.getName === "function") { nm = (await resolveMaybePromise(p.getName())) || nm; } } catch (e) {}
            const low = String(nm || "").toLowerCase();
            if (low.includes("uniform") && low.includes("scale")) {
              // Attempt to set true
              const ok = await setParamStatic(p, true);
              if (ok) {
                console.info("[PremiereAPI] Enabled Uniform Scale");
              }
              break;
            }
          }
        } catch (e) {}
      };

      // Determine selection range (in seconds) to keyframe effect strength
      let selectionRange = null;
      try {
        const range = await this.getSelection();
        if (range && typeof range.duration === "number" && range.duration > 0) {
          selectionRange = {
            start: (range.startTime ?? 0) / TICKS_PER_SECOND,
            end: (range.endTime ?? 0) / TICKS_PER_SECOND
          };
        }
      } catch (_) {
        // ignore; proceed without range
      }

      // Heuristic: choose desired intensity from provided parameters
      const desiredValue = (() => {
        if (typeof parameters?.blurriness === "number") return parameters.blurriness;
        if (typeof parameters?.amount === "number") return parameters.amount;
        if (typeof parameters?.intensity === "number") return parameters.intensity;
        if (typeof parameters?.scale === "number") return parameters.scale;
        return 100; // sensible default strength
      })();

      const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

      // Helper: split item at time (seconds)
      const splitItemAt = async (item, timeSec) => {
        const tick = ppro.TickTime.createWithSeconds(timeSec);
        // Try common split action names
        const tryCreate = async () => {
          if (typeof item.createSplitAction === "function") {
            return await resolveMaybePromise(item.createSplitAction(tick));
          }
          if (typeof item.createCutAction === "function") {
            return await resolveMaybePromise(item.createCutAction(tick));
          }
          if (typeof sequence.createSplitAction === "function") {
            return await resolveMaybePromise(sequence.createSplitAction(item, tick));
          }
          if (typeof sequence.createRazorAction === "function") {
            return await resolveMaybePromise(sequence.createRazorAction(item, tick));
          }
          throw new Error("Split action not supported in this host.");
        };
        const action = await tryCreate();
        await executeAction(project, action);
      };

      // Utility: find a component on the chain by name substring(s)
      const findComponentByName = async (chain, namesLower) => {
        try {
          const count = await resolveMaybePromise(chain.getComponentCount());
          for (let ci = 0; ci < count; ci += 1) {
            try {
              const comp = await resolveMaybePromise(chain.getComponentAtIndex(ci));
              let cname = null;
              try {
                if (typeof comp.getDisplayName === "function") {
                  cname = (await resolveMaybePromise(comp.getDisplayName())) || cname;
                }
              } catch (e) {}
              try {
                if (!cname && typeof comp.getName === "function") {
                  cname = (await resolveMaybePromise(comp.getName())) || cname;
                }
              } catch (e) {}
              cname = (cname || (comp && comp.displayName) || "").toString().toLowerCase();
              if (namesLower.some(n => cname.includes(n))) return comp;
            } catch (e) {}
          }
        } catch (e) {}
        return null;
      };

      for (let i = 0; i < trackItems.length; i += 1) {
        const item = trackItems[i];
        try {
          const chain = await resolveMaybePromise(item.getComponentChain());
          if (!chain) continue;

          let appended = null;
          // For zoom/transform, try existing Motion component first
          const wantsMotion = paramStrategy && paramStrategy.preferParamName === "scale";
          if (wantsMotion) {
            appended = await findComponentByName(chain, ["motion"]);
          }

          if (!appended) {
            // Create a fresh video filter component per clip
            const component = await resolveMaybePromise(ppro.VideoFilterFactory.createComponent(matchName));
            const appendAction = await resolveMaybePromise(chain.createAppendComponentAction(component));
            await executeAction(project, appendAction);
            changeCount += 1; // count the append as a successful change
            const count = await resolveMaybePromise(chain.getComponentCount());
            appended = await resolveMaybePromise(chain.getComponentAtIndex(count - 1));
          }

          // If we have a valid selection window, attempt to keyframe a suitable parameter
          if (hasWindow) {
            try {
              // Use the 'appended' (or found Motion) component for keyframing
              
              // Try to find a parameter by preferred name first; then fall back to first time-varying param
              const candidateParamIndexes = Array.from({ length: 24 }, (_, i) => i);
              let param = null;
              let matchedByName = false;
              // For Motion zoom, try enabling Uniform Scale before scanning for Scale
              if (wantsMotion) {
                await tryEnableUniformScale(appended);
              }
              for (const idx of candidateParamIndexes) {
                const p = await resolveMaybePromise(appended.getParam(idx)).catch(() => null);
                if (!p) continue;
                let pname = null;
                try {
                  if (typeof p.getDisplayName === "function") {
                    pname = (await resolveMaybePromise(p.getDisplayName())) || pname;
                  }
                } catch (e) {}
                try {
                  if (!pname && typeof p.getName === "function") {
                    pname = (await resolveMaybePromise(p.getName())) || pname;
                  }
                } catch (e) {}
                pname = pname || (p && p.name) || null;
                if (paramStrategy && pname) {
                  const low = String(pname).toLowerCase();
                  const want = paramStrategy.preferParamName;
                  const matches = low === want && !low.includes("uniform") && !low.includes("width") && !low.includes("height");
                  if (matches) {
                    const enableTV = await resolveMaybePromise(p.createSetTimeVaryingAction(true));
                    await executeAction(project, enableTV);
                    param = p;
                    matchedByName = true;
                    break;
                  }
                }
              }

              if (!param) {
                for (const idx of candidateParamIndexes) {
                  try {
                    const p = await resolveMaybePromise(appended.getParam(idx));
                    if (!p) continue;
                    const enableTV = await resolveMaybePromise(p.createSetTimeVaryingAction(true));
                    await executeAction(project, enableTV);
                    param = p;
                    break;
                  } catch (e) {}
                }
              }

              if (!param && wantsMotion) {
                // Fallback: append Transform and try its exact 'Scale' param
                try {
                  let transformMatch = null;
                  try {
                    const idxT = Array.isArray(displayNames) ? displayNames.findIndex((n) => (n || "").toLowerCase() === "transform") : -1;
                    if (idxT >= 0 && Array.isArray(matchNames)) {
                      transformMatch = matchNames[idxT];
                    } else if (Array.isArray(displayNames) && Array.isArray(matchNames)) {
                      for (let i2 = 0; i2 < displayNames.length; i2 += 1) {
                        const dn = (displayNames[i2] || "").toLowerCase();
                        if (dn.includes("transform")) { transformMatch = matchNames[i2]; break; }
                      }
                    }
                  } catch (e) {}
                  if (transformMatch) {
                    const compT = await resolveMaybePromise(ppro.VideoFilterFactory.createComponent(transformMatch));
                    const actT = await resolveMaybePromise(chain.createAppendComponentAction(compT));
                    await executeAction(project, actT);
                    changeCount += 1;
                    const countT = await resolveMaybePromise(chain.getComponentCount());
                    const appendedT = await resolveMaybePromise(chain.getComponentAtIndex(countT - 1));
                    for (const idx2 of candidateParamIndexes) {
                      const p2 = await resolveMaybePromise(appendedT.getParam(idx2)).catch(() => null);
                      if (!p2) continue;
                      let nm = null;
                      try { if (typeof p2.getDisplayName === "function") { nm = (await resolveMaybePromise(p2.getDisplayName())) || nm; } } catch (e) {}
                      try { if (!nm && typeof p2.getName === "function") { nm = (await resolveMaybePromise(p2.getName())) || nm; } } catch (e) {}
                      const low2 = String(nm || "").toLowerCase();
                      if (low2 === "scale") {
                        try {
                          const tv = await resolveMaybePromise(p2.createSetTimeVaryingAction(true));
                          await executeAction(project, tv);
                          param = p2;
                          appendedComponent = appendedT;
                          break;
                        } catch (e) {}
                      }
                    }
                  }
                } catch (e) {}
              }

              if (param) {
                const before = Math.max(0, selStartSec - 0.01);
                const start = selStartSec;
                const end = selEndSec;
                const after = end + 0.01;

                const clampVal = (v, min, max) => Math.max(min, Math.min(max, v));
                const outsideVal = paramStrategy ? clampVal(paramStrategy.outsideValue, paramStrategy.min, paramStrategy.max) : 0;
                const insideVal = paramStrategy ? clampVal(paramStrategy.insideValue, paramStrategy.min, paramStrategy.max) : 100;

                // Create keyframes
                const kfBefore = await resolveMaybePromise(param.createKeyframe(outsideVal));
                kfBefore.position = ppro.TickTime.createWithSeconds(before);

                const kfStart = await resolveMaybePromise(param.createKeyframe(insideVal));
                kfStart.position = ppro.TickTime.createWithSeconds(start);

                const kfEnd = await resolveMaybePromise(param.createKeyframe(insideVal));
                kfEnd.position = ppro.TickTime.createWithSeconds(end);

                const kfAfter = await resolveMaybePromise(param.createKeyframe(outsideVal));
                kfAfter.position = ppro.TickTime.createWithSeconds(after);

                // Add keyframes via transaction
                const addKF = async (kf) => {
                  const addAction = await resolveMaybePromise(param.createAddKeyframeAction(kf));
                  await executeAction(project, addAction);
                };

                await addKF(kfBefore);
                await addKF(kfStart);
                await addKF(kfEnd);
                await addKF(kfAfter);
                changeCount += 1; // count keyframing as a successful change
              } else if (hasWindow) {
                // If we couldn't keyframe, try destructive split and re-apply just to middle pieces
                try {
                  await splitItemAt(item, selEndSec);
                  await splitItemAt(item, selStartSec);

                  // Rescan for middle slices overlapping the window and append effect to them
                  for (let ti = 0; ; ti += 1) {
                    const vTrack = await resolveMaybePromise(sequence.getVideoTrack(ti));
                    if (!vTrack) break;
                    const allItems = await resolveMaybePromise(vTrack.getTrackItems(ppro.Constants.TrackItemType.CLIP, false));
                    if (Array.isArray(allItems)) {
                      for (const it of allItems) {
                        if (await itemsOverlapWindow(it)) {
                          try {
                            const ch = await resolveMaybePromise(it.getComponentChain());
                            const comp = await resolveMaybePromise(ppro.VideoFilterFactory.createComponent(matchName));
                            const act = await resolveMaybePromise(ch.createAppendComponentAction(comp));
                            await executeAction(project, act);
                          } catch (_) {}
                        }
                      }
                    }
                  }
                } catch (razorErr) {
                  console.warn("[PremiereAPI] Auto-razor not supported / failed:", razorErr);
                }
              }
            } catch (kfErr) {
              console.warn("[PremiereAPI] Selection keyframing failed:", kfErr);
              // As a last resort, attempt a static set on exact 'Scale'
              try {
                const tryStaticOnComponent = async (component, targetValue) => {
                  let scaleParam = null;
                  for (const idx of Array.from({ length: 24 }, (_, i) => i)) {
                    const p = await resolveMaybePromise(component.getParam(idx)).catch(() => null);
                    if (!p) continue;
                    let nm = null;
                    try { if (typeof p.getDisplayName === "function") { nm = (await resolveMaybePromise(p.getDisplayName())) || nm; } } catch (e) {}
                    try { if (!nm && typeof p.getName === "function") { nm = (await resolveMaybePromise(p.getName())) || nm; } } catch (e) {}
                    const low = String(nm || "").toLowerCase();
                    if (low === "scale") { scaleParam = p; break; }
                  }
                  if (scaleParam) {
                    const ok = await setParamStatic(scaleParam, targetValue);
                    if (ok) { changeCount += 1; return true; }
                  }
                  return false;
                };

                const requested = typeof parameters?.scale === "number" ? parameters.scale : 150;
                let staticDone = false;
                // First try Motion static
                staticDone = await tryStaticOnComponent(appended, requested);
                // If not Motion (or failed) and we appended an effect earlier, try that too
                if (!staticDone) {
                  const countNow = await resolveMaybePromise(chain.getComponentCount());
                  const lastComp = await resolveMaybePromise(chain.getComponentAtIndex(countNow - 1));
                  if (lastComp) {
                    staticDone = await tryStaticOnComponent(lastComp, requested);
                  }
                }

                // Diagnostic dump if still nothing changed
                if (!staticDone) {
                  try {
                    const dumpNames = async (label, comp) => {
                      const names = [];
                      for (const idx of Array.from({ length: 24 }, (_, i) => i)) {
                        const p = await resolveMaybePromise(comp.getParam(idx)).catch(() => null);
                        if (!p) continue;
                        let nm = null;
                        try { if (typeof p.getDisplayName === "function") { nm = (await resolveMaybePromise(p.getDisplayName())) || nm; } } catch (e) {}
                        try { if (!nm && typeof p.getName === "function") { nm = (await resolveMaybePromise(p.getName())) || nm; } } catch (e) {}
                        if (nm) names.push(String(nm));
                      }
                      console.warn(`[PremiereAPI] ${label} params:`, names);
                    };
                    await dumpNames("Motion/active", appended);
                    const countNow2 = await resolveMaybePromise(chain.getComponentCount());
                    const lastComp2 = await resolveMaybePromise(chain.getComponentAtIndex(countNow2 - 1));
                    if (lastComp2 && lastComp2 !== appended) {
                      await dumpNames("Last component", lastComp2);
                    }
                  } catch (e) {}
                }
              } catch (e) {}
            }
          }
        } catch (clipErr) {
          console.warn(`[PremiereAPI] Skipped a track item due to error: ${clipErr}`);
        }
      }

      if (changeCount === 0) {
        throw new Error("Effect could not be applied to any selected clips.");
      }

      console.info(`[PremiereAPI] Applied '${effectName}' with ${changeCount} change(s).`);
      return true;

    } catch (error) {
      console.error("[PremiereAPI] Error applying effect:", error);
      throw error;
    }
  }

  /**
   * Get sequence info
   * @returns {Object} Sequence information
   */
  async getSequenceInfo() {
    try {
      if (!this.app) {
        console.warn("[PremiereAPI] Premiere Pro API not loaded");
        return null;
      }

      const sequence = await this.getActiveSequence();

      if (!sequence) {
        console.warn("[PremiereAPI] activeSequence is null/undefined");
        return null;
      }

      let name = sequence.name ?? sequence.sequenceName ?? null;
      if (!name && typeof sequence.getName === "function") {
        name = await resolveMaybePromise(sequence.getName());
      }
      if (!name) {
        name = "Unknown";
      }

      let frameRate = sequence.framerate ?? sequence.frameRate ?? null;
      if ((frameRate === null || frameRate === undefined) && typeof sequence.getFrameRate === "function") {
        frameRate = await resolveMaybePromise(sequence.getFrameRate());
      }

      const normaliseFrameRate = (value) => {
        if (typeof value === "number") {
          return value;
        }

        if (value && typeof value === "object") {
          if (typeof value.fps === "number") {
            return value.fps;
          }
          if (typeof value.framesPerSecond === "number") {
            return value.framesPerSecond;
          }
          if (typeof value.numerator === "number" && typeof value.denominator === "number" && value.denominator !== 0) {
            return value.numerator / value.denominator;
          }
          if (typeof value.ticks === "number" && typeof value.ticksPerFrame === "number" && value.ticksPerFrame !== 0) {
            return value.ticks / value.ticksPerFrame;
          }
        }

        return null;
      };

      const normalisedFrameRate = normaliseFrameRate(frameRate);

      const endValue = sequence.end ?? (typeof sequence.getEnd === "function" ? await resolveMaybePromise(sequence.getEnd()) : undefined);
      const durationTicks = typeof endValue === "number" ? endValue : endValue?.ticks;
      const endTime = await normaliseTimePoint(endValue);
      const durationSeconds =
        typeof durationTicks === "number"
          ? durationTicks / TICKS_PER_SECOND
          : endTime.seconds;

      const videoTrackInfo = sequence.videoTracks ?? sequence.videoTrackCollection;
      const audioTrackInfo = sequence.audioTracks ?? sequence.audioTrackCollection;

      return {
        name,
        frameRate: normalisedFrameRate,
        duration: durationSeconds,
        videoTracks: videoTrackInfo?.numTracks ?? videoTrackInfo?.length,
        audioTracks: audioTrackInfo?.numTracks ?? audioTrackInfo?.length
      };
    } catch (error) {
      console.error("[PremiereAPI] Error getting sequence info:", error);
      return null;
    }
  }

  /**
   * Test Premiere Pro connection
   * @returns {boolean} True if connected
   */
  async testConnection() {
    try {
      if (!this.app) {
        return false;
      }

      // Try to get active project to verify API works
      const Project = this.app.Project;
      if (!Project || typeof Project.getActiveProject !== "function") {
        return false;
      }

      const projectResult = Project.getActiveProject();
      const project = await resolveMaybePromise(projectResult);
      return project !== null && project !== undefined;
    } catch (error) {
      console.error("[PremiereAPI] Connection test failed:", error);
      return false;
    }
  }
}

// Export singleton instance
export default new PremiereAPI();
