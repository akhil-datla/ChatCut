import ReactDOM from "react-dom";

const _id = Symbol("_id");
const _root = Symbol("_root");
const _attachment = Symbol("_attachment");
const _Component = Symbol("_Component");
const _menuItems = Symbol("_menuItems");

export class PanelController {
  constructor(Component, { id, menuItems } = {}) {
    this[_id] = null;
    this[_root] = null;
    this[_attachment] = null;
    this[_Component] = null;
    this[_menuItems] = [];

    this[_Component] = Component;
    this[_id] = id;
    this[_menuItems] = menuItems || [];
    this.menuItems = this[_menuItems].map((menuItem) => ({
      id: menuItem.id,
      label: menuItem.label,
      enabled: menuItem.enabled || true,
      checked: menuItem.checked || false,
    }));

    ["create", "show", "hide", "destroy", "invokeMenu"].forEach(
      (fn) => (this[fn] = this[fn].bind(this))
    );
  }

  create() {
    console.log("[PanelController] Creating panel root");
    this[_root] = document.createElement("div");
    this[_root].style.height = "100vh";
    this[_root].style.overflow = "auto";
    this[_root].style.padding = "8px";
    this[_root].style.backgroundColor = "#1e1e1e"; // Add background color for visibility

    try {
      console.log("[PanelController] Rendering React component");
      const component = this[_Component]({ panel: this });
      ReactDOM.render(component, this[_root]);
      console.log("[PanelController] React component rendered successfully");
    } catch (error) {
      console.error("[PanelController] Error rendering React component:", error);
      this[_root].innerHTML = `
        <div style="padding: 20px; color: white;">
          <h2>Error Loading Plugin</h2>
          <p>${error.message || String(error)}</p>
          <p>Check console for details.</p>
        </div>
      `;
    }

    return this[_root];
  }

  show(event) {
    if (!this[_root]) this.create();
    this[_attachment] = event;
    this[_attachment].appendChild(this[_root]);
  }

  hide() {
    if (this[_attachment] && this[_root]) {
      this[_attachment].removeChild(this[_root]);
      this[_attachment] = null;
    }
  }

  destroy() {}

  invokeMenu(id) {
    const menuItem = this[_menuItems].find((c) => c.id === id);
    if (menuItem) {
      const handler = menuItem.oninvoke;
      if (handler) {
        handler();
      }
    }
  }
}
