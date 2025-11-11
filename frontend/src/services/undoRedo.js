// src/services/undoRedo.js
// Simple wrappers to trigger Premiere's native Undo/Redo.
// We need to use ppro.host.executeScript to access app and qe in ExtendScript context.

const ppro = require("premierepro");

export async function doUndo() {
  try {
    console.log("[Undo] doUndo() called");
    console.log("[Undo] Checking ppro.host.executeScript availability:", !!(ppro && ppro.host && ppro.host.executeScript));
    
    // Use ppro.host.executeScript to run undo in ExtendScript context
    // Use single-line format like beginUndoGroup does
    if (ppro && ppro.host && ppro.host.executeScript) {
      console.log("[Undo] Executing undo via ppro.host.executeScript...");
      try {
        // Try single-line format first
        await ppro.host.executeScript("app.enableQE(); qe.executeCommandById(13);");
        console.log("[Undo] Undo command executed successfully");
        return true;
      } catch (scriptError) {
        console.error("[Undo] executeScript failed:", scriptError);
        console.error("[Undo] Error message:", (scriptError && scriptError.message) || scriptError);
        console.error("[Undo] Error stack:", scriptError && scriptError.stack);
        // Try alternative: execute commands separately
        try {
          console.log("[Undo] Trying alternative: separate enableQE and undo calls");
          await ppro.host.executeScript("app.enableQE();");
          await ppro.host.executeScript("qe.executeCommandById(13);");
          console.log("[Undo] Alternative method succeeded");
          return true;
        } catch (altError) {
          console.error("[Undo] Alternative method also failed:", altError);
          return false;
        }
      }
    } else if (typeof app !== "undefined" && typeof qe !== "undefined") {
      // Fallback if app and qe are directly available
      console.log("[Undo] Using direct app/qe access (fallback)");
      app.enableQE && app.enableQE();
      qe.executeCommandById(13);
      return true;
    } else {
      console.error("[Undo] Neither ppro.host.executeScript nor app/qe are available");
      console.error("[Undo] ppro:", !!ppro, "ppro.host:", !!(ppro && ppro.host), "executeScript:", !!(ppro && ppro.host && ppro.host.executeScript));
      return false;
    }
  } catch (e) {
    console.error("[Undo] Undo failed with exception:", e);
    console.error("[Undo] Error details:", e.message, e.stack);
    return false;
  }
}

export async function doRedo() {
  try {
    console.log("[Redo] doRedo() called");
    
    if (ppro && ppro.host && ppro.host.executeScript) {
      console.log("[Redo] Executing redo via ppro.host.executeScript...");
      try {
        await ppro.host.executeScript("app.enableQE(); qe.executeCommandById(14);");
        console.log("[Redo] Redo command executed successfully");
        return true;
      } catch (scriptError) {
        console.error("[Redo] executeScript failed:", scriptError);
        // Try alternative
        try {
          await ppro.host.executeScript("app.enableQE();");
          await ppro.host.executeScript("qe.executeCommandById(14);");
          return true;
        } catch (altError) {
          console.error("[Redo] Alternative method also failed:", altError);
          return false;
        }
      }
    } else if (typeof app !== "undefined" && typeof qe !== "undefined") {
      app.enableQE && app.enableQE();
      qe.executeCommandById(14);
      return true;
    } else {
      console.error("[Redo] Neither ppro.host.executeScript nor app/qe are available");
      return false;
    }
  } catch (e) {
    console.error("[Redo] Redo failed with exception:", e);
    return false;
  }
}
