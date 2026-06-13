import type { Config } from "../../bindings/Config";
import type { Chat } from "../../bindings/Chat";
import type { ChatPlatform } from "../../bindings/ChatPlatform";
import type { CommandInfo } from "../../bindings/CommandInfo";
import { LANGUAGES, PERMISSIONS, COMMAND_NAMES } from "../chatMeta";
import { StringListEditor } from "../StringListEditor";

const DEFAULT_CHAT: Chat = {
  platform: "Twitch",
  username: "",
  admins: [],
  ignoreUsers: [],
  language: "EN",
  prefix: "!",
  enablePublicCommands: false,
  enableModCommands: true,
  enableAutoStopStreamOnHostOrRaid: true,
  announceRaidOnAutoStop: true,
  commands: null,
};

export function ChatSection({ config, onChange }: { config: Config; onChange: (c: Config) => void }) {
  const chat = config.chat;
  const setChat = (c: Chat | null) => onChange({ ...config, chat: c });

  if (!chat) {
    return (
      <fieldset>
        <legend>Chat</legend>
        <p className="note">Chat is not configured.</p>
        <button type="button" onClick={() => setChat({ ...DEFAULT_CHAT })}>Enable chat</button>
      </fieldset>
    );
  }
  const set = (patch: Partial<Chat>) => setChat({ ...chat, ...patch });

  const isKick = typeof chat.platform === "object" && "Kick" in chat.platform;
  const setPlatform = (kind: "Twitch" | "Kick") => {
    if (kind === "Twitch") set({ platform: "Twitch" as ChatPlatform });
    else set({ platform: { Kick: { channelId: null, chatroomId: null, useIrlproxy: null } } as ChatPlatform });
  };
  const kick = isKick ? (chat.platform as { Kick: { channelId: number | null; chatroomId: number | null; useIrlproxy: boolean | null } }).Kick : null;
  const setKick = (patch: Partial<NonNullable<typeof kick>>) =>
    set({ platform: { Kick: { ...(kick as object), ...patch } } as ChatPlatform });

  const commands: Record<string, CommandInfo | undefined> = chat.commands ?? {};
  const setCommands = (next: Record<string, CommandInfo | undefined>) => set({ commands: next as Record<string, CommandInfo> });
  const addCommand = (name: string) =>
    setCommands({ ...commands, [name]: { permission: null, userPermissions: null, alias: null } });
  const updateCommand = (name: string, info: CommandInfo) => setCommands({ ...commands, [name]: info });
  const removeCommand = (name: string) => {
    const next: Record<string, CommandInfo | undefined> = { ...commands };
    delete next[name];
    setCommands(next);
  };
  const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

  return (
    <fieldset>
      <legend>Chat</legend>
      <label>Platform
        <select value={isKick ? "Kick" : "Twitch"} onChange={(e) => setPlatform(e.target.value as "Twitch" | "Kick")}>
          <option value="Twitch">Twitch</option>
          <option value="Kick">Kick</option>
        </select>
      </label>
      {isKick && kick && (
        <div className="subfield">
          <label>Channel ID <input type="number" value={kick.channelId ?? ""} onChange={(e) => setKick({ channelId: numOrNull(e.target.value) })} /></label>
          <label>Chatroom ID <input type="number" value={kick.chatroomId ?? ""} onChange={(e) => setKick({ chatroomId: numOrNull(e.target.value) })} /></label>
          <label><input type="checkbox" checked={kick.useIrlproxy ?? false} onChange={(e) => setKick({ useIrlproxy: e.target.checked })} /> Use IRL proxy</label>
        </div>
      )}

      <label>Username <input value={chat.username} onChange={(e) => set({ username: e.target.value })} /></label>
      <label>Language
        <select value={chat.language} onChange={(e) => set({ language: e.target.value })}>
          {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </label>
      <label>Prefix <input value={chat.prefix} onChange={(e) => set({ prefix: e.target.value })} /></label>

      <StringListEditor label="Admins" items={chat.admins} onChange={(v) => set({ admins: v })} />
      <StringListEditor label="Ignore users" items={chat.ignoreUsers} onChange={(v) => set({ ignoreUsers: v })} />

      <label><input type="checkbox" checked={chat.enablePublicCommands} onChange={(e) => set({ enablePublicCommands: e.target.checked })} /> Enable public commands</label>
      <label><input type="checkbox" checked={chat.enableModCommands} onChange={(e) => set({ enableModCommands: e.target.checked })} /> Enable mod commands</label>
      <label><input type="checkbox" checked={chat.enableAutoStopStreamOnHostOrRaid} onChange={(e) => set({ enableAutoStopStreamOnHostOrRaid: e.target.checked })} /> Auto-stop on host/raid</label>
      <label><input type="checkbox" checked={chat.announceRaidOnAutoStop} onChange={(e) => set({ announceRaidOnAutoStop: e.target.checked })} /> Announce raid on auto-stop</label>

      <fieldset>
        <legend>Command overrides</legend>
        {Object.entries(commands).map(([name, info]) => {
          if (!info) return null;
          return (
            <div key={name} className="server-entry">
              <div className="row">
                <strong>{name}</strong>
                <label>Permission
                  <select value={info.permission ?? ""} onChange={(e) => updateCommand(name, { ...info, permission: e.target.value === "" ? null : e.target.value })}>
                    <option value="">(default)</option>
                    {PERMISSIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <button type="button" onClick={() => removeCommand(name)}>remove</button>
              </div>
              <StringListEditor label="User permissions" items={info.userPermissions ?? []} onChange={(v) => updateCommand(name, { ...info, userPermissions: v.length ? v : null })} />
              <StringListEditor label="Aliases" items={info.alias ?? []} onChange={(v) => updateCommand(name, { ...info, alias: v.length ? v : null })} />
            </div>
          );
        })}
        <AddCommand existing={Object.keys(commands)} onAdd={addCommand} />
      </fieldset>
    </fieldset>
  );
}

function AddCommand({ existing, onAdd }: { existing: string[]; onAdd: (name: string) => void }) {
  const available = COMMAND_NAMES.filter((c) => !existing.includes(c));
  if (available.length === 0) return null;
  return (
    <div className="row">
      <select defaultValue="" onChange={(e) => { if (e.target.value) { onAdd(e.target.value); e.target.value = ""; } }}>
        <option value="">+ add command override…</option>
        {available.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}
