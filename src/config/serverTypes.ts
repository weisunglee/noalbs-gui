import type { StreamServerKind } from "../bindings/StreamServerKind";

export type FieldKind = "text" | "auth";

export type FieldDef = {
  key: string;       // property name on the variant (e.g. "statsUrl")
  label: string;
  kind: FieldKind;   // "text" = string|null input; "auth" = optional ServerAuth sub-form
  optional: boolean; // optional fields may be null
};

export type ServerTypeDef = {
  type: StreamServerKind["type"]; // the discriminant tag
  label: string;
  fields: FieldDef[];
  /** A fresh variant value with empty/required fields, used on add or type-switch. */
  makeDefault: () => StreamServerKind;
};

const t = (key: string, label: string, optional = false): FieldDef => ({ key, label, kind: "text", optional });
const auth = (): FieldDef => ({ key: "auth", label: "Auth", kind: "auth", optional: true });

export const SERVER_TYPES: ServerTypeDef[] = [
  { type: "Nginx", label: "NGINX",
    fields: [t("statsUrl", "Stats URL"), t("application", "Application"), t("key", "Key")],
    makeDefault: () => ({ type: "Nginx", statsUrl: "", application: "publish", key: "live" }) },
  { type: "NodeMediaServer", label: "Node Media Server",
    fields: [t("statsUrl", "Stats URL"), t("application", "Application"), t("key", "Key"), auth()],
    makeDefault: () => ({ type: "NodeMediaServer", statsUrl: "", application: "publish", key: "live", auth: null }) },
  { type: "Nimble", label: "Nimble",
    fields: [t("statsUrl", "Stats URL"), t("id", "Listener ID (IP:Port)"), t("application", "Application"), t("key", "Key")],
    makeDefault: () => ({ type: "Nimble", statsUrl: "", id: "", application: "live", key: "srt" }) },
  { type: "SrtLiveServer", label: "SRT Live Server (SLS)",
    fields: [t("statsUrl", "Stats URL"), t("publisher", "Publisher / StreamID"), t("apiKey", "API key", true)],
    makeDefault: () => ({ type: "SrtLiveServer", statsUrl: "", publisher: "", apiKey: null }) },
  { type: "Belabox", label: "BELABOX cloud",
    fields: [t("statsUrl", "Stats URL"), t("publisher", "Publisher")],
    makeDefault: () => ({ type: "Belabox", statsUrl: "", publisher: "" }) },
  { type: "Mediamtx", label: "MediaMTX",
    fields: [t("statsUrl", "Stats URL"), auth()],
    makeDefault: () => ({ type: "Mediamtx", statsUrl: "", auth: null }) },
  { type: "Rist", label: "RIST",
    fields: [t("statsUrl", "Stats URL")],
    makeDefault: () => ({ type: "Rist", statsUrl: "" }) },
  { type: "Xiu", label: "Xiu",
    fields: [t("statsUrl", "Stats URL"), t("application", "Application"), t("key", "Key")],
    makeDefault: () => ({ type: "Xiu", statsUrl: "", application: "live", key: "source" }) },
  { type: "OpenIRL", label: "OpenIRL",
    fields: [t("statsUrl", "Stats URL")],
    makeDefault: () => ({ type: "OpenIRL", statsUrl: "" }) },
  { type: "Irlhosting", label: "IRLHosting",
    fields: [t("statsUrl", "Stats URL"), t("application", "Application", true), t("key", "Key", true), t("publisher", "Publisher", true)],
    makeDefault: () => ({ type: "Irlhosting", statsUrl: "", application: null, key: null, publisher: null }) },
];

export function serverTypeDef(type: StreamServerKind["type"]): ServerTypeDef {
  const def = SERVER_TYPES.find((s) => s.type === type);
  if (!def) throw new Error(`unknown server type: ${type}`);
  return def;
}

/** A fresh entry for the "Add server" action. */
export function makeDefaultEntry(): import("../bindings/StreamServerEntry").StreamServerEntry {
  return {
    streamServer: SERVER_TYPES[0].makeDefault(),
    name: "new server",
    priority: 0,
    overrideScenes: null,
    dependsOn: null,
    enabled: true,
  };
}
