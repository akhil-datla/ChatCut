Project: ChatCut (UXP extension)

Purpose: brief instructions to help AI agents make small, correct edits to this UXP/React-based Premiere Pro panel.

Key files
- `plugin/manifest.json` — plugin identity, entrypoint (panel id `apps`), host/version and icons. Update `name`/`label` here for branding changes.
- `plugin/index.html` — webview shell. Avoid changing global shims unless necessary.
- `src/index.jsx` — bootstraps the UXP `entrypoints` and registers the panel controller. Look here for menu items and lifecycle hooks.
- `src/panels/App.jsx` — top-level React panel component (renders `Container`).
- `src/components/*` — UI pieces: `header.jsx`, `content.jsx`, `footer.jsx`, `container.jsx`. Prefer local component edits over adding new global state.

Architecture notes
- Small single-panel React app using UXP entrypoints and a `PanelController` wrapper located in `src/controllers/PanelController.jsx`.
- `Container` composes `Header`, `Content`, and `Footer`. `Container` owns a simple message array in state and passes `writeToConsole` and `clearConsole` to `Footer`.
- Avoid introducing global state managers (Redux, Context) for small features; keep state in `Container` unless cross-panel/state sharing is needed.

UI & patterns
- Styling uses local CSS files next to components (`*.css`) and inline style tags in `Container`. Respect existing CSS variables like `--uxp-host-text-color-secondary`.
- Components use Adobe Spectrum web components (`sp-body`, `sp-button`) alongside React. Keep semantic structure: interactive behavior should live on `sp-button` rather than raw divs.
- When rendering lists, prefer stable keys (not array index) when possible — messages currently use default array indexes.

Build & run
- This project is bundled with webpack. The `plugin/index.html` loads `index.js` (built bundle). Typical local dev steps (if available in your environment):
  - npm install
  - npm run build (or the script in `package.json` that produces `index.js`)
  - Load the built plugin folder into Premiere Pro UXP developer mode or use the host tooling you normally use.
- Do not assume a specific `npm` script name; check `package.json` for exact scripts before running commands.

Conventions & gotchas
- Manifest: changing `id` is a breaking change for installed plugins. For branding, prefer updating `name` and entrypoint `label`.
- File locations: panels live under `src/panels`, components under `src/components`. `src/index.jsx` wires entrypoints — change it to add menu items or lifecycle hooks.
- Avoid network or external API calls without explicit permission in `manifest.json` (see `requiredPermissions.webview`).
- Native host requires `require('premierepro')` in async functions — follow the existing pattern in `footer.jsx` for accessing project/sequence.

Task-specific example: Add Chat UI
- Place small, local UI inside `Footer` for the input and `send` button (visual only). The message array in `Container` is the correct place to push new messages.
- For now, Send may log to console; to implement later: call `props.writeToConsole(draft)` from `Footer` and clear `draft`.

When editing
- Run quick local lint/type checks where available. After edits, run the webpack build to ensure `index.js` compiles.
- Prefer minimal, targeted edits. Keep changes to styles local to component CSS files.

If uncertain ask the user for:
- preferred npm script for building/running, and whether they want Send to post to the existing `message` array or to an external service.

End of instructions.
