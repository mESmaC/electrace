// Shared assistant state for the floating AI bubble (one conversation across every bubble).
//
// Two layers, by design:
//  · chat history  → localStorage  → PERSISTS across reloads/sessions.
//  · context window → sessionStorage → EPHEMERAL: cleared when the tab/site is closed.
// An agent call sends the context window + the chat history; if the context window is empty,
// it sends just the history. (A token cap on the context window is a TODO.)
import { useEffect, useState } from "react";

export interface ChatMessage { id: string; role: "user" | "assistant"; text: string; t: number }
export interface ContextItem { kind: string; text: string }

/** One conversation in the assistant — its own message history, switchable like chats in any chat app. */
export interface Conversation { id: string; title: string; messages: ChatMessage[]; updatedAt: number }

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
export interface Progress { status: string; tool?: string; tools: string[]; narration?: string; tokensIn?: number; tokensOut?: number }
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

export function appendChat(role: ChatMessage["role"], text: string): void {
  const cs = ensureChats(); const id = activeId();
  const conv = cs.find((c) => c.id === id); if (!conv) return;
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
  const history = getChat().map((m) => ({ role: m.role, text: m.text })); // prior turns, before this message
  const context = getContext();
  appendChat("user", t);
  const body: Record<string, unknown> = { context, history, message: t };
  if (agentSession) { body.design = agentSession.getDesign(); body.blocks = agentSession.getBlocks(); }
  const prog: Progress = { status: "Thinking…", tools: [] };
  setProgress(prog);
  try {
    const res = await fetch("/api/assistant", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({} as { error?: string }));
      appendChat("assistant", `⚠️ ${data.error ?? "The assistant is unavailable."}`);
      return;
    }
    // Read the NDJSON progress stream: status/tool/usage/narration events, then a final "done".
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", done: DoneMsg | null = null, errored = false;
    for (;;) {
      const { value, done: rdDone } = await reader.read();
      if (rdDone) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line) continue;
        let ev: { type: string; [k: string]: unknown };
        try { ev = JSON.parse(line); } catch { continue; }
        if (ev.type === "status") { prog.status = String(ev.text); setProgress({ ...prog }); }
        else if (ev.type === "tool") { const name = String(ev.name); prog.tool = name; prog.status = `Running ${name}…`; if (!prog.tools.includes(name)) prog.tools.push(name); setProgress({ ...prog }); }
        else if (ev.type === "narration") { prog.narration = String(ev.text); setProgress({ ...prog }); }
        else if (ev.type === "usage") { prog.tokensIn = Number(ev.in) || prog.tokensIn; prog.tokensOut = Number(ev.out) || prog.tokensOut; setProgress({ ...prog }); }
        else if (ev.type === "error") { appendChat("assistant", `⚠️ ${ev.error ?? "model error"}`); errored = true; }
        else if (ev.type === "done") done = ev as unknown as DoneMsg;
      }
    }
    if (done) {
      appendChat("assistant", done.reply || "(done)");
      if (agentSession && (done.design || done.blocks?.length || done.deletedBlocks?.length || done.blockSchematics?.length)) {
        agentSession.apply({ design: done.design, blocks: done.blocks, deletedBlocks: done.deletedBlocks, blockSchematics: done.blockSchematics });
      }
    } else if (!errored) {
      appendChat("assistant", "⚠️ The assistant stopped unexpectedly.");
    }
  } catch {
    appendChat("assistant", "⚠️ Couldn't reach the assistant. Is ANTHROPIC_API_KEY set in web/.env.local (and the dev server restarted)?");
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
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync); // cross-tab history sync
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return { messages, context, conversations, activeId, progress };
}
