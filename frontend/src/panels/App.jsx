import React from "react";

import { Container } from "../components/container.jsx";
import logo from "../assets/logo.png";
import "./App.css";

export const App = () => {
  return (
    <div className="app-container">
      <div className="logo-container">
        <div className="logo-wrapper">
          <img src={logo} alt="ChatCut Logo" className="app-logo" />
          <span className="app-title">ChatCut</span>
        </div>
      </div>
      <Container />
    </div>
  );
};

