import React, { useState } from "react";
import backendAPI from "../services/backendAPI";
import premiereAPI from "../services/premiereAPI";

export function PromptInput({ selection }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setResult(null);

    try {
      // Process prompt with backend
      const response = await backendAPI.processPrompt(
        prompt,
        selection?.startTime,
        selection?.endTime
      );

      setResult(response);

      // If confidence is high enough, offer to apply the effect
      if (response.confidence >= 0.5) {
        console.log("Effect ready to apply:", response);
      } else {
        setError("AI couldn't confidently interpret the prompt. Try being more specific.");
      }

    } catch (err) {
      setError(err.message);
      console.error("Error processing prompt:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyEffect = async () => {
    if (!result) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await premiereAPI.applyEffect(result.effect_name, result.parameters);
      setSuccessMessage("Effect applied successfully! (Effect execution is currently a placeholder.)");
    } catch (err) {
      setError(`Failed to apply effect: ${err.message}`);
      console.error("Error applying effect:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="prompt-input">
      <h3>AI Prompt</h3>

      <form onSubmit={handleSubmit}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the effect you want... (e.g., 'make this black and white', 'blur this clip', 'zoom in 2x')"
          rows="4"
          disabled={loading}
        />

        <button
          type="submit"
          className="btn-primary"
          disabled={loading || !prompt.trim()}
        >
          {loading ? "Processing..." : "Process Prompt"}
        </button>
      </form>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {successMessage && (
        <div className="success-message">
          <strong>Success:</strong> {successMessage}
        </div>
      )}

      {result && (
        <div className="result-container">
          <div className={`result-card ${result.confidence < 0.5 ? 'low-confidence' : ''}`}>
            <h4>AI Interpretation</h4>

            <div className="result-field">
              <strong>Effect:</strong> {result.effect_name || "None"}
            </div>

            <div className="result-field">
              <strong>Category:</strong> {result.effect_category || "N/A"}
            </div>

            {Object.keys(result.parameters).length > 0 && (
              <div className="result-field">
                <strong>Parameters:</strong>
                <ul>
                  {Object.entries(result.parameters).map(([key, value]) => (
                    <li key={key}>
                      {key}: {value}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="result-field">
              <strong>Confidence:</strong> {(result.confidence * 100).toFixed(0)}%
            </div>

            <div className="result-field description">
              <strong>Description:</strong>
              <p>{result.description}</p>
            </div>

            {result.confidence >= 0.5 && result.effect_name && (
              <button
                onClick={handleApplyEffect}
                className="btn-success"
                disabled={loading}
              >
                Apply Effect to Timeline
              </button>
            )}
          </div>
        </div>
      )}

      <div className="examples">
        <p><strong>Example prompts:</strong></p>
        <ul>
          <li>"make this black and white"</li>
          <li>"blur this clip"</li>
          <li>"zoom in 150%"</li>
          <li>"rotate 45 degrees"</li>
        </ul>
      </div>
    </div>
  );
}
