/**
 * Backend API Service
 * Handles communication with the FastAPI backend
 */

const BACKEND_URL = "http://localhost:3001";

class BackendAPI {
  /**
   * Test connection to backend
   * @returns {Promise<boolean>} True if connected
   */
  async testConnection() {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      const data = await response.json();
      return data.status === "healthy";
    } catch (error) {
      console.error("[BackendAPI] Connection test failed:", error);
      return false;
    }
  }

  /**
   * Send ping to backend
   * @param {string} message - Message to send
   * @returns {Promise<Object>} Response from backend
   */
  async ping(message) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/ping`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("[BackendAPI] Ping failed:", error);
      throw error;
    }
  }

  /**
   * Process a prompt and get effect instructions
   * @param {string} prompt - User's natural language prompt
   * @param {number} startTime - Timeline start time in ticks
   * @param {number} endTime - Timeline end time in ticks
   * @returns {Promise<Object>} Effect response
   */
  async processPrompt(prompt, startTime = null, endTime = null) {
    try {
      console.log("[BackendAPI] Processing prompt:", prompt);

      const requestBody = {
        prompt: prompt
      };

      if (startTime !== null && endTime !== null) {
        requestBody.start_time = startTime;
        requestBody.end_time = endTime;
      }

      const response = await fetch(`${BACKEND_URL}/api/process-prompt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("[BackendAPI] Effect response:", data);

      return data;

    } catch (error) {
      console.error("[BackendAPI] Process prompt failed:", error);
      throw error;
    }
  }

  /**
   * Get backend health status
   * @returns {Promise<Object>} Health status
   */
  async getHealth() {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      return await response.json();
    } catch (error) {
      console.error("[BackendAPI] Health check failed:", error);
      throw error;
    }
  }
}

// Export singleton instance
export default new BackendAPI();
