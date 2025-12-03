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
      oninvoke: () => aboutController.run(),
    },
  ],
});

entrypoints.setup({
  plugin: {
    create(plugin) {
      /* optional */ console.log("created", plugin);
    },
    destroy() {
      /* optional */ console.log("destroyed");
    },
  },
  panels: {
    apps: appsController,
  },
});
