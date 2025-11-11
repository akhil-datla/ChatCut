import React from "react";

import { Container } from "../components/container.jsx";

export const App = () => {
  console.log("[App] Rendering App component");
  
  try {
    return (
      <>
        <Container />
      </>
    );
  } catch (error) {
    console.error("[App] Error rendering:", error);
    return (
      <div style={{ padding: "20px", color: "white" }}>
        <h2>Error Loading ChatCut</h2>
        <p>{error.message || String(error)}</p>
        <p>Check console for details.</p>
      </div>
    );
  }
};

