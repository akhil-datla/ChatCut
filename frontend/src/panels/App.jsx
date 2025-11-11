import React from "react";

import { Container } from "../components/container.jsx";
import logo from "../assets/logo.png";

export const App = () => {
  console.log("[App] Rendering App component");
  
  try {
    return (
      <div className="app-container">
        <div className="logo-container">
          <div className="logo-wrapper">
            <img src={logo} alt="ChatCut Logo" className="app-logo" />
            <span className="app-title">ChatCut</span>
          </div>
        </div>
        <Container />
        <style>{`
          .app-container {
            display: flex;
            flex-direction: column;
            height: 100vh;
            background-color: var(--color-bg-dark);
          }
          .logo-container {
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 12px 0;
            flex: 0 0 auto;
          }
          .logo-wrapper {
            display: flex;
            align-items: center;
            gap: 10px; /* Space between logo and text */
          }
          .app-logo {
            width: 32px; /* Adjust size as needed */
            height: 32px;
            object-fit: contain;
            /* Invert logo color or filter if needed for dark mode compatibility */
            /* filter: invert(1); */ 
          }
          .app-title {
            color: var(--color-accent-blue);
            font-weight: bold;
            font-size: 20px;
            letter-spacing: 0.5px;
          }
        `}</style>
      </div>
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

