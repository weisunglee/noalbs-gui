// One-shot flag: when set, ConfigTab scrolls to the Bot credentials section.
let pending = false;
export function requestFocusEnv(): void { pending = true; }
export function consumeFocusEnv(): boolean { const p = pending; pending = false; return p; }
