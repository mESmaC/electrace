// Shared assistant state for the floating AI bubble (one conversation across every bubble).
//
// Two layers, by design:
//  · chat history  → localStorage  → PERSISTS across reloads/sessions.
//  · context window → sessionStorage → EPHEMERAL: cleared when the tab/site is closed.
// An agent call sends the context window + the chat history; if the context window is empty,
// it sends just the history. (A token cap on the context window is a TODO.)
import { useEffect, useState } from "react";

// Friendly, user-facing labels for what the assistant is doing — so the progress UI never surfaces the
// internal tool/API names.
const TOOL_LABELS: Record<string, string> = {
  list_blocks: "Browsing blocks", get_block: "Reading a block", create_block: "Creating a block",
  update_block: "Updating a block", author_block: "Authoring a block", author_schematic: "Drawing a schematic",
  expose_pins: "Exposing pins", set_value: "Setting a value", delegate: "Dispatching sparks",
  delete_block: "Removing a block", list_instances: "Reading the design", add_block: "Placing a block",
  remove_block: "Removing a block", connect: "Wiring", disconnect: "Unwiring", analyze_design: "Running checks",
  acknowledge: "Marking intended", unacknowledge: "Updating a finding", list_nets: "Reading nets",
  power_budget: "Checking power", list_connectors: "Browsing connectors", add_connector: "Adding a connector",
  electrace_help: "Reading the docs", web_search: "Searching the web",
};
export const toolLabel = (name: string): string => TOOL_LABELS[name] ?? "Working";

export interface ChatMessage { id: string; role: "user" | "assistant"; text: string; t: number }
export interface ContextItem { kind: string; text: string }

/** One conversation in the assistant — its own message history, switchable like chats in any chat app. */
export interface Conversation {
  id: string; title: string; messages: ChatMessage[]; updatedAt: number;
  /** Rolling compaction of turns older than the send window — generated server-side when the
   *  conversation outgrows the cap, so long projects keep their memory at a fraction of the tokens. */
  summary?: string;
  /** How many messages (from the start) the summary covers. */
  summaryUpTo?: number;
}

const CHATS_KEY = "electrace:chats";        // localStorage — all conversations
const ACTIVE_KEY = "electrace:chat:active"; // localStorage — active conversation id
const LEGACY_KEY = "electrace:chat";        // the old single-conversation store (migrated once)
const CTX_KEY = "electrace:assistant-ctx";  // sessionStorage — per browsing session
const EVT = "electrace:assistant";

const ls = () => (typeof window !== "undefined" ? window.localStorage : undefined);
const ss = () => (typeof window !== "undefined" ? window.sessionStorage : undefined);
const read = <T,>(store: Storage | undefined, key: string): T[] => {
  try { return JSON.parse(store?.getItem(key) ?? "[]"); } catch { return []; }
};
const emit = () => { try { window.dispatchEvent(new CustomEvent(EVT)); } catch { /* ignore */ } };

/** Live progress while Sparky works — surfaced so the user sees activity (narration, current tool,
 *  token usage) instead of a chat indicator that looks hung. Null when idle. */
export interface Progress { status: string; convId: string; tool?: string; tools: string[]; narration?: string; tokensIn?: number; tokensOut?: number }
interface DoneMsg { reply?: string; design?: unknown; blocks?: unknown[]; deletedBlocks?: string[]; blockSchematics?: { id: string; layout: unknown }[] }
let liveProgress: Progress | null = null;
export const getProgress = (): Progress | null => liveProgress;
function setProgress(p: Progress | null): void { liveProgress = p; emit(); }

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const titleOf = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 40) || "New chat";
const readChats = (): Conversation[] => read<Conversation>(ls(), CHATS_KEY);
const writeChats = (cs: Conversation[]) => { try { ls()?.setItem(CHATS_KEY, JSON.stringify(cs)); } catch { /* ignore */ } };
const setActive = (id: string) => { try { ls()?.setItem(ACTIVE_KEY, id); } catch { /* ignore */ } };

/** Load conversations, migrating the old single-chat store and guaranteeing at least one exists. */
function ensureChats(): Conversation[] {
  let cs = readChats();
  if (!cs.length) {
    const legacy = read<ChatMessage>(ls(), LEGACY_KEY);
    const firstUser = legacy.find((m) => m.role === "user");
    const conv: Conversation = { id: uid("c"), title: firstUser ? titleOf(firstUser.text) : "", messages: legacy, updatedAt: Date.now() };
    cs = [conv];
    writeChats(cs); setActive(conv.id);
    try { ls()?.removeItem(LEGACY_KEY); } catch { /* ignore */ }
  }
  return cs;
}
function activeId(): string {
  const cs = ensureChats();
  let id = ls()?.getItem(ACTIVE_KEY) ?? "";
  if (!cs.some((c) => c.id === id)) { id = cs[0].id; setActive(id); }
  return id;
}

export const getChat = (): ChatMessage[] => { const id = activeId(); return ensureChats().find((c) => c.id === id)?.messages ?? []; };
export const getContext = (): ContextItem[] => read(ss(), CTX_KEY);

/** All conversations, most-recently-updated first (for the chat switcher). */
export function getConversations(): Conversation[] { return ensureChats().slice().sort((a, b) => b.updatedAt - a.updatedAt); }
export function getActiveId(): string { return activeId(); }

export function appendChat(role: ChatMessage["role"], text: string, convId?: string): void {
  // convId binds a message to the conversation it BELONGS to. Without it, a reply that finishes
  // after the user switched threads (drill-in/out swaps the active chat) lands in the wrong
  // conversation — the "my reply vanished" bug. Default stays active for plain calls.
  const cs = ensureChats(); const id = convId ?? activeId();
  let conv = cs.find((c) => c.id === id);
  if (!conv) {
    // the thread was deleted while its run was in flight — resurrect it instead of dropping
    // the reply (a run costs real tokens; silent loss reads as "Sparky ate my answer")
    conv = { id, title: "(recovered chat)", messages: [], updatedAt: Date.now() };
    cs.unshift(conv);
  }
  conv.messages.push({ id: uid("m"), role, text, t: Date.now() });
  if (!conv.title && role === "user") conv.title = titleOf(text); // name the chat from its first message
  conv.updatedAt = Date.now();
  writeChats(cs); emit();
}

/** Start a fresh conversation and make it active. */
export function newConversation(): string {
  const cs = ensureChats();
  const conv: Conversation = { id: uid("c"), title: "", messages: [], updatedAt: Date.now() };
  cs.unshift(conv); writeChats(cs); setActive(conv.id); emit();
  return conv.id;
}
export function switchConversation(id: string): void { if (ensureChats().some((c) => c.id === id)) { setActive(id); emit(); } }
export function deleteConversation(id: string): void {
  let cs = ensureChats().filter((c) => c.id !== id);
  if (!cs.length) cs = [{ id: uid("c"), title: "", messages: [], updatedAt: Date.now() }];
  writeChats(cs);
  if ((ls()?.getItem(ACTIVE_KEY) ?? "") === id) setActive(cs[0].id);
  emit();
}
/** Clear the ACTIVE conversation's messages (keeps it as an empty chat). */
export function clearChat(): void {
  const cs = ensureChats(); const id = activeId();
  const conv = cs.find((c) => c.id === id);
  if (conv) { conv.messages = []; conv.title = ""; conv.updatedAt = Date.now(); writeChats(cs); }
  emit();
}

/** Add to the ephemeral context window (e.g. the current design/block snapshot). */
export function pushContext(item: ContextItem): void {
  const arr = getContext();
  arr.push(item);
  try { ss()?.setItem(CTX_KEY, JSON.stringify(arr)); } catch { /* ignore */ }
  emit();
}
export function clearContext(): void { try { ss()?.removeItem(CTX_KEY); } catch { /* ignore */ } emit(); }

/** Replace (or remove, if `text` is empty) the single context item of a given kind. Editors use this
 *  to keep one live snapshot of their state — e.g. setContextItem("pcb", …) — without duplicating. */
export function setContextItem(kind: string, text: string): void {
  const arr = getContext().filter((c) => c.kind !== kind);
  if (text) arr.push({ kind, text });
  try { ss()?.setItem(CTX_KEY, JSON.stringify(arr)); } catch { /* ignore */ }
  emit();
}

/** Payload for an agent call: the session context window + the persistent chat history.
 *  When the context window is empty, just the history. (TODO: cap context by token size.) */
export function buildAgentPayload(): { context: ContextItem[]; history: ChatMessage[] } {
  return { context: getContext(), history: getChat() };
}

// The active editor registers an "agent session" so the assistant can read the live design and
// apply changes it makes via tools. Only one session is active at a time (the editor you're in).
export interface AgentSession { getDesign: () => unknown; getBlocks: () => unknown; apply: (result: { design?: unknown; blocks?: unknown[]; deletedBlocks?: string[]; blockSchematics?: { id: string; layout: unknown }[] }) => void }
let agentSession: AgentSession | null = null;
export function registerAgentSession(s: AgentSession): () => void {
  agentSession = s;
  return () => { if (agentSession === s) agentSession = null; };
}

/** Send a user message: append it, call the server route (which holds the API key + tools), append
 *  the model's reply, and apply any design changes it made. Resolves when the turn is complete. */
export async function sendMessage(text: string): Promise<void> {
  const t = text.trim();
  if (!t) return;
  // Context compaction: send only the recent window verbatim; turns older than that are folded into
  // a rolling per-conversation summary (generated server-side the first time they fall out of the
  // window, then reused — the summary only changes on overflow, so it stays prompt-cache-friendly).
  const WINDOW = 12;
  const chats = ensureChats();
  const convObj = chats.find((c) => c.id === getActiveId());
  const allMsgs = convObj?.messages ?? getChat();
  const cut = Math.max(0, allMsgs.length - WINDOW);
  let summary = convObj?.summary ?? "";
  const coveredTo = convObj?.summaryUpTo ?? 0;
  if (cut - coveredTo >= 6) {
    // enough uncovered old turns to be worth a compaction call (one cheap request, amortized)
    try {
      const r = await fetch("/api/assistant", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ summarize: allMsgs.slice(coveredTo, cut).map((m) => ({ role: m.role, text: m.text })), existingSummary: summary }),
      });
      if (r.ok) {
        const d = await r.json();
        if (d?.summary) {
          summary = d.summary;
          if (convObj) { convObj.summary = summary; convObj.summaryUpTo = cut; writeChats(chats); }
        }
      }
    } catch { /* compaction is an optimization — sending without it is always safe */ }
  }
  const history = (() => {
    const recent = allMsgs.slice(-WINDOW).map((m) => ({ role: m.role, text: m.text }));
    let budget = 24_000;
    const kept: typeof recent = [];
    for (let i = recent.length - 1; i >= 0; i--) {
      budget -= recent[i].text.length;
      if (budget < 0 && kept.length) break;
      kept.unshift(recent[i]);
    }
    return kept;
  })();
  const context = getContext();
  const conv = getActiveId(); // bind the whole run to the conversation it started in
  appendChat("user", t, conv);
  const body: Record<string, unknown> = { context, history, message: t, ...(summary ? { summary } : {}) };
  if (agentSession) { body.design = agentSession.getDesign(); body.blocks = agentSession.getBlocks(); }
  const prog: Progress = { status: "Thinking…", convId: conv, tools: [] };
  setProgress(prog);
  try {
    const res = await fetch("/api/assistant", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({} as { error?: string }));
      appendChat("assistant", `⚠️ ${data.error ?? "The assistant is unavailable."}`, conv);
      return;
    }
    // Read the NDJSON progress stream: status/tool/usage/narration events, then a final "done".
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    const out = { done: null as DoneMsg | null, errored: false }; // a holder so the closure's writes survive TS flow analysis
    const handle = (line: string) => {
      if (!line) return;
      let ev: { type: string; [k: string]: unknown };
      try { ev = JSON.parse(line); } catch { return; }
      if (ev.type === "status") { prog.status = String(ev.text); setProgress({ ...prog }); }
      else if (ev.type === "tool") { const name = String(ev.name); const label = toolLabel(name); prog.tool = label; prog.status = `${label}…`; if (!prog.tools.includes(label)) prog.tools.push(label); setProgress({ ...prog }); }
      else if (ev.type === "narration") { prog.narration = String(ev.text); setProgress({ ...prog }); }
      else if (ev.type === "usage") { prog.tokensIn = Number(ev.in) || prog.tokensIn; prog.tokensOut = Number(ev.out) || prog.tokensOut; setProgress({ ...prog }); }
      else if (ev.type === "error") { appendChat("assistant", `⚠️ ${ev.error ?? "model error"}`, conv); out.errored = true; }
      else if (ev.type === "done") out.done = ev as unknown as DoneMsg;
    };
    try {
      for (;;) {
        const { value, done: rdDone } = await reader.read();
        if (value) {
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) { handle(buf.slice(0, nl).trim()); buf = buf.slice(nl + 1); }
        }
        if (rdDone) break;
      }
      handle((buf + dec.decode()).trim()); // flush a final line with no trailing newline — don't drop the `done`
    } finally {
      try { await reader.cancel(); } catch { /* already closed */ }
    }
    if (out.done) {
      const done = out.done;
      appendChat("assistant", done.reply || "(done)", conv);
      if (agentSession && (done.design || done.blocks?.length || done.deletedBlocks?.length || done.blockSchematics?.length)) {
        agentSession.apply({ design: done.design, blocks: done.blocks, deletedBlocks: done.deletedBlocks, blockSchematics: done.blockSchematics });
      }
    } else if (!out.errored) {
      appendChat("assistant", "⚠️ The assistant stopped unexpectedly.", conv);
    }
  } catch {
    appendChat("assistant", "⚠️ Couldn't reach the assistant. Is ANTHROPIC_API_KEY set in web/.env.local (and the dev server restarted)?", conv);
  } finally {
    setProgress(null);
  }
}

/** Subscribe to the conversation + context window (synced across bubbles and tabs). */
export function useAssistant(): { messages: ChatMessage[]; context: ContextItem[]; conversations: Conversation[]; activeId: string; progress: Progress | null } {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [context, setContext] = useState<ContextItem[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [progress, setProgressState] = useState<Progress | null>(null);
  useEffect(() => {
    const sync = () => { setMessages(getChat()); setContext(getContext()); setConversations(getConversations()); setActiveId(getActiveId()); setProgressState(getProgress()); };
    sync();
    // cross-tab sync: only re-read on a conversation-key write, not every electrace:* localStorage change
    // (autosaves, telemetry, etc. would otherwise re-parse every conversation on each keystroke).
    const onStorage = (e: StorageEvent) => { if (!e.key || e.key.startsWith("electrace:chat")) sync(); };
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", onStorage); };
  }, []);
  return { messages, context, conversations, activeId, progress };
}
