// Service to communicate with the Python backend
// Note: UXP only allows domain names, not IP addresses for network requests
const BACKEND_URL = "http://localhost:3001";

export async function sendPing(message) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/ping`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("[Backend] Ping response:", data);
    return data;
  } catch (err) {
    console.error("[Backend] Error:", err.message);
    throw err;
  }
}

/**
 * Process user prompt through AI and get structured action
   * 
   * @param {string} prompt - User's natural language request
   * @param {object} contextParams - Optional context parameters (e.g., selected effect settings)
   * @returns {Promise<object>} AI response with action and parameters
   * 
   * Example response:
   * {
   *   action: "zoomIn",
   *   parameters: { endScale: 120, animated: false },
   *   confidence: 1.0,
   *   message: "Zooming in to 120%"
   * }
   */
export async function processPrompt(prompt, contextParams = null) {
    try {
      const body = { prompt };
      if (contextParams) {
        body.context_params = contextParams;
      }
  
      const response = await fetch(`${BACKEND_URL}/api/process-prompt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("[Backend] AI response:", data);
    return data;
  } catch (err) {
    console.error("[Backend] Error processing prompt:", err.message);
    
    // Provide more helpful error messages
    if (err.message.includes("Network request failed") || err.message.includes("Failed to fetch")) {
      throw new Error("Backend server is not running. Please start the backend server on port 3001.");
    }
    
    throw err;
  }
}

/**
 * Process selected media file paths through AI
 * 
 * @param {string[]} filePaths - Array of media file paths from selected Project items
 * @param {string} prompt - User's natural language request
 * @returns {Promise<object>} AI response with action and parameters based on media analysis
 * 
 * Example response:
 * {
 *   action: "applyFilter",
 *   parameters: { filterName: "AE.ADBE Black & White" },
 *   confidence: 1.0,
 *   message: "Applying black and white filter based on media analysis"
 * }
 */
export async function processMedia(filePath, prompt) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/process-media`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filePath, prompt }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("[Backend] AI media analysis response:", data);
    return data;
  } catch (err) {
    console.error("[Backend] Error processing media:", err.message);

    // Provide more helpful error messages
    if (err.message.includes("Network request failed") || err.message.includes("Failed to fetch")) {
      throw new Error("Backend server is not running. Please start the backend server on port 3001.");
    }

    throw err;
  }
}

/**
 * Process video with Colab object tracking effects
 *
 * @param {string} filePath - Path to the video file
 * @param {string} prompt - Natural language command (e.g., "zoom on the person from 1s to 4s")
 * @param {string} colabUrl - ngrok URL from Colab (e.g., "https://abc123.ngrok.io")
 * @param {string} effectType - Optional effect type override (ZoomFollow, Spotlight, etc.)
 * @returns {Promise<object>} Response with output_path for processed video
 *
 * Example response:
 * {
 *   message: "Successfully processed video with Colab",
 *   original_path: "D:\\Videos\\clip.mp4",
 *   output_path: "D:\\ChatCut\\backend\\output\\colab_clip.mp4",
 *   error: null
 * }
 */
export async function processWithColab(filePath, prompt, colabUrl, effectType = null) {
  try {
    console.log("[Colab] Sending request:", { filePath, prompt, colabUrl, effectType });

    const body = {
      file_path: filePath,
      prompt: prompt,
      colab_url: colabUrl,
    };

    if (effectType) {
      body.effect_type = effectType;
    }

    const response = await fetch(`${BACKEND_URL}/api/colab-process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("[Colab] Response:", data);
    return data;
  } catch (err) {
    console.error("[Colab] Error:", err.message);

    if (err.message.includes("Network request failed") || err.message.includes("Failed to fetch")) {
      throw new Error("Backend server is not running. Please start the backend server on port 3001.");
    }

    throw err;
  }
}

/**
 * Process media file with object tracking
 * 
 * @param {string} filePath - Path to media file
 * @param {string} prompt - User's natural language request for object tracking
 * @returns {Promise<object>} Response with tracking data and actions
 */
export async function processObjectTracking(filePath, prompt) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/process-object-tracking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filePath, prompt }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("[Backend] Object tracking response:", data);
    return data;
  } catch (err) {
    console.error("[Backend] Error processing object tracking:", err.message);
    
    if (err.message.includes("Network request failed") || err.message.includes("Failed to fetch")) {
      throw new Error("Backend server is not running. Please start the backend server on port 3001.");
    }
    
    throw err;
  }
}

/**
 * Start a Colab processing job
 *
 * @param {string} filePath - Path to the video file
 * @param {string} prompt - Natural language command
 * @param {string} colabUrl - ngrok URL from Colab
 * @param {object} trimInfo - Optional trim info: { trim_start: number, trim_end: number }
 * @returns {Promise<object>} Response with job_id
 */
async function startColabJob(filePath, prompt, colabUrl, trimInfo = null) {
  const body = {
    file_path: filePath,
    prompt: prompt,
    colab_url: colabUrl,
  };

  // Add trim info for server-side FFmpeg trimming
  if (trimInfo && trimInfo.trim_start !== undefined && trimInfo.trim_end !== undefined) {
    body.trim_start = trimInfo.trim_start;
    body.trim_end = trimInfo.trim_end;
    console.log(`[Colab] Trim info: ${trimInfo.trim_start.toFixed(2)}s - ${trimInfo.trim_end.toFixed(2)}s`);
  }

  const response = await fetch(`${BACKEND_URL}/api/colab-start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Colab] HTTP error ${response.status}:`, errorText);
    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText.substring(0, 200)}`);
  }

  const result = await response.json();
  console.log("[Colab] Start job response:", result);
  return result;
}

/**
 * Poll progress for a Colab job
 *
 * @param {string} jobId - Job ID from startColabJob
 * @param {string} colabUrl - ngrok URL from Colab
 * @param {string} originalFilename - Original filename for output naming
 * @returns {Promise<object>} Progress data
 */
async function pollColabProgress(jobId, colabUrl, originalFilename = "video") {
  const response = await fetch(`${BACKEND_URL}/api/colab-progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      job_id: jobId,
      colab_url: colabUrl,
      original_filename: originalFilename,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * Helper to sleep for a given number of milliseconds
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process video with Colab using progress polling
 * (UXP doesn't support SSE streaming, so we poll for progress instead)
 *
 * @param {string} filePath - Path to the video file
 * @param {string} prompt - Natural language command
 * @param {string} colabUrl - ngrok URL from Colab
 * @param {function} onProgress - Callback for progress events: (stage, progress, message, data) => void
 * @param {object} trimInfo - Optional trim info: { trim_start: number, trim_end: number }
 * @returns {Promise<object>} Final response with output_path
 */
export async function processWithColabStream(filePath, prompt, colabUrl, onProgress = () => {}, trimInfo = null) {
  console.log("[Colab] Starting job with polling:", { filePath, prompt, colabUrl, trimInfo });

  // Extract filename for output naming
  const filename = filePath.split(/[/\\]/).pop() || "video.mp4";

  // Step 1: Start the job (with optional trim info for server-side trimming)
  const trimMsg = trimInfo ? ` (trimming ${trimInfo.trim_start.toFixed(1)}s - ${trimInfo.trim_end.toFixed(1)}s)` : "";
  onProgress("upload", 0, `Uploading video to Colab...${trimMsg}`, {});

  let startResult;
  try {
    startResult = await startColabJob(filePath, prompt, colabUrl, trimInfo);
  } catch (err) {
    console.error("[Colab] Failed to start job:", err);
    throw new Error(`Failed to start job: ${err.message}`);
  }

  if (startResult.error) {
    console.error("[Colab] Start job error:", startResult);
    console.error("[Colab] Full error details:", JSON.stringify(startResult, null, 2));
    const errorMsg = startResult.message || startResult.error || "Unknown error";
    throw new Error(`Colab processing failed: ${errorMsg}`);
  }

  const jobId = startResult.job_id;
  console.log("[Colab] Job started:", jobId);
  onProgress("upload", 5, `Job started: ${jobId}`, startResult);

  // Step 2: Poll for progress every 2 seconds
  const POLL_INTERVAL = 2000; // 2 seconds
  const MAX_POLLS = 300; // 10 minutes max (300 * 2s)
  let pollCount = 0;

  while (pollCount < MAX_POLLS) {
    await sleep(POLL_INTERVAL);
    pollCount++;

    let progress;
    try {
      progress = await pollColabProgress(jobId, colabUrl, filename);
    } catch (err) {
      console.error("[Colab] Poll error:", err);
      // Don't fail immediately on poll errors, try again
      if (pollCount > 3) {
        throw new Error(`Progress polling failed: ${err.message}`);
      }
      continue;
    }

    // Handle different statuses
    if (progress.status === "not_found") {
      throw new Error(`Job ${jobId} not found on Colab server`);
    }

    if (progress.status === "error") {
      console.error("[Colab] Job error:", progress);
      throw new Error(progress.message || progress.error || "Processing failed");
    }

    // Update progress callback
    const stage = progress.stage || "processing";
    const pct = progress.progress || 0;
    const msg = progress.message || "Processing...";
    onProgress(stage, pct, msg, progress);

    // Check for completion
    if (progress.status === "complete") {
      console.log("[Colab] Job complete:", progress);

      // Return with local output path
      return {
        message: progress.message || "Processing complete!",
        output_path: progress.output_path,
        original_path: filePath,
        error: null,
      };
    }
  }

  // Timeout
  throw new Error("Processing timed out after 10 minutes");
}

/**
 * Check if Colab server is healthy/reachable
 * Routes through backend proxy to avoid UXP CORS restrictions
 *
 * @param {string} colabUrl - The ngrok URL for the Colab server
 * @returns {Promise<boolean>} True if server is healthy, false otherwise
 */
export async function checkColabHealth(colabUrl) {
  if (!colabUrl || !colabUrl.trim()) {
    return false;
  }

  try {
    // Route through backend proxy (avoids UXP CORS restrictions)
    const response = await fetch(`${BACKEND_URL}/api/colab-health`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colab_url: colabUrl }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log("[Colab] Health check result:", data);
      return data.healthy === true;
    }

    console.log("[Colab] Health check failed with status:", response.status);
    return false;
  } catch (err) {
    console.log("[Colab] Health check error:", err.message);
    return false;
  }
}
