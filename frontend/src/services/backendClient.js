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


