import React from "react";

import "./styles.css";
import { PanelController } from "./controllers/PanelController.jsx";
import { App } from "./panels/App.jsx";

import { entrypoints } from "uxp";

const appsController = new PanelController(() => <App />, {
  id: "panel",
  menuItems: [
    {
      id: "reload1",
      label: "Reload Plugin",
      enabled: true,
      checked: false,
      oninvoke: () => location.reload(),
    },
    {
      id: "dialog1",
      label: "About this Plugin",
      enabled: true,
      checked: false,
      oninvoke: () => {
        console.log("ChatCut - Edit videos with words, not clicks!");
        alert("ChatCut\n\nEdit videos with words, not clicks!\n\nVersion 1.0.0");
      },
    },
  ],
});

console.log("[Index] Setting up entrypoints");

entrypoints.setup({
  plugin: {
    create(plugin) {
      console.log("[Index] Plugin created", plugin);
    },
    destroy() {
      console.log("[Index] Plugin destroyed");
    },
  },
  panels: {
    apps: appsController,
  },
});

console.log("[Index] Entrypoints setup complete");
