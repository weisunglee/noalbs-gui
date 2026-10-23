# NOALBS GUI design

Modern minimal desktop workbench. A persistent navigation rail separates live
monitoring, stream configuration, credentials, logs, and application settings.
The compact NOALBS wordmark, teal accent, system typography, restrained borders,
and shared spacing remain consistent throughout. Content has a clear page title
and quiet description; settings use grouped surfaces with generous field spacing.

Light mode uses cool off-white surfaces and dark ink; dark mode uses slate
surfaces. Theme tokens live in src/tokens.css. Status uses text as well as color.
Keyboard focus is visible. Narrow windows use a wrapping top navigation.
No decorative animation, external fonts, invented metrics, or simulated chrome.

UI language is independent of NOALBS chat language. Translate presentation only:
never translate serialized keys, user values, command identifiers, or logs.
Credentials are edited separately from config.json and saved explicitly.
