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
export async function processPrompt(prompt) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/process-prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
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


