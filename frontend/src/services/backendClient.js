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


