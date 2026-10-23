# UI and localization requirements

Accepted scope from the October 23, 2026 user walkthrough:

- Redesign the desktop app as a coherent workbench with responsive navigation,
  grouped configuration fields, and light, dark, and system themes.
- Keep a persistent theme selector in the sidebar and retain the saved theme.
- Provide English, Traditional Chinese, Simplified Chinese, Japanese, and Korean
  for application labels, controls, confirmations, editor controls, and error
  summaries. Remember the selected interface language.
- Separate Twitch bot credentials (.env) from the config.json editor into their
  own page with an independent save action.
- Preserve existing NOALBS behavior. Never translate serialized configuration
  keys or values, scene names, credentials, command identifiers, or log content.
- Keep configuration and credential drafts when navigating between pages or
  changing language. Keep raw JSON editing available.
- Keep raw error details available separately from localized summaries.
- Publish the approved changes through a reviewed PR; release the next patch,
  v0.1.7, after merging. The current release workflow is triggered by a version tag.

Verification: frontend build, catalog/source checks, mocked IPC UI tests for all
five locales and six widths, error paths, JSON/log preservation, and native
desktop launch. OS file-picker chrome may follow the operating system language.
