# Frontend verification

`npm test` checks all five translation catalogs, interpolation integrity, and
system-language negotiation. `npm run build` checks TypeScript and builds Vite.

`npm run test:ui` requires Playwright and a browser installation. It uses mocked
Tauri IPC; it never accesses real NOALBS credentials, configuration, or processes.
Start `npm run dev -- --port 4173` first, or set `UI_STATIC=1` after building to
serve the built assets through Playwright routes without a network server.

Optional environment variables:

- `PLAYWRIGHT_PACKAGE`: path to an existing Playwright package (otherwise resolves `playwright`).
- `BROWSER_CHANNEL`: e.g. `chrome` for an existing Google Chrome installation.
- `UI_OUTPUT`: screenshot output directory.
- `UI_URL`: development server URL (default `http://127.0.0.1:4173`).
- `ERROR_CASES=1`: run the focused backend-error localization regression instead of the full UI suite; covers Config, credentials, Settings, and language changes while an error is visible.
- `AUDIT_CASES=1`: check dashboard status labels, binary-source labels, editor search/replace controls in all five languages, untranslated documents/logs, preference-save and log-clear errors, and localized confirmation buttons.

The UI test verifies language persistence, draft preservation across navigation,
unchanged serialized JSON and OAuth values, unmodified logs, dark mode, and all
five pages in five languages at 320, 375, 414, 768, 1000, and 1440 pixels.
This does not replace a native Tauri integration test for downloads, process
control, or filesystem persistence.
