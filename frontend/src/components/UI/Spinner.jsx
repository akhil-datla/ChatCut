/**
 * Spinner - Loading indicator component
 */
import React from "react";

export const Spinner = ({ size = "medium", className = "" }) => {
  const sizeMap = {
    small: 14,
    medium: 20,
    large: 28
  };
  
  const dimension = sizeMap[size] || sizeMap.medium;
  
  return (
    <div 
      className={`spinner ${className}`}
      style={{
        width: dimension,
        height: dimension,
        border: "2px solid var(--spectrum-gray-400)",
        borderTopColor: "var(--accent-color)",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite"
      }}
    />
  );
};

// Add keyframes via style tag (UXP-safe approach)
const styleId = "spinner-keyframes";
if (typeof document !== "undefined" && !document.getElementById(styleId)) {
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}


