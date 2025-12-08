/**
 * Header - Panel header with branding
 * Undo button moved to Footer for better UX
 */
import React from "react";
import "./Header.css";

export const Header = ({ title = "ChatCut" }) => {
  return (
    <header className="panel-header">
      <div className="header-title">
        <span className="title-text">{title}</span>
        <span className="title-tagline">Edit with words</span>
      </div>
    </header>
  );
};
