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

const CHAT_KEY = "electrace:chat";          // localStorage — persistent
const CTX_KEY = "electrace:assistant-ctx";  // sessionStorage — per browsing session
const EVT = "electrace:assistant";

const ls = () => (typeof window !== "undefined" ? window.localStorage : undefined);
const ss = () => (typeof window !== "undefined" ? window.sessionStorage : undefined);
const read = <T,>(store: Storage | undefined, key: string): T[] => {
  try { return JSON.parse(store?.getItem(key) ?? "[]"); } catch { return []; }
};
const emit = () => { try { window.dispatchEvent(new CustomEvent(EVT)); } catch { /* ignore */ } };

export const getChat = (): ChatMessage[] => read(ls(), CHAT_KEY);
export const getContext = (): ContextItem[] => read(ss(), CTX_KEY);

export function appendChat(role: ChatMessage["role"], text: string): void {
  const arr = getChat();
  arr.push({ id: `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, role, text, t: Date.now() });
  try { ls()?.setItem(CHAT_KEY, JSON.stringify(arr)); } catch { /* ignore */ }
  emit();
}
export function clearChat(): void { try { ls()?.removeItem(CHAT_KEY); } catch { /* ignore */ } emit(); }

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
  try {
    const res = await fetch("/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({} as { reply?: string; error?: string; design?: unknown; blocks?: unknown[]; deletedBlocks?: string[]; blockSchematics?: { id: string; layout: unknown }[] }));
    if (res.ok && data.reply) appendChat("assistant", data.reply);
    else appendChat("assistant", `⚠️ ${data.error ?? "The assistant is unavailable."}`);
    if (res.ok && agentSession && (data.design || data.blocks?.length || data.deletedBlocks?.length || data.blockSchematics?.length)) {
      agentSession.apply({ design: data.design, blocks: data.blocks, deletedBlocks: data.deletedBlocks, blockSchematics: data.blockSchematics });
    }
  } catch {
    appendChat("assistant", "⚠️ Couldn't reach the assistant. Is ANTHROPIC_API_KEY set in web/.env.local (and the dev server restarted)?");
  }
}

/** Subscribe to the conversation + context window (synced across bubbles and tabs). */
export function useAssistant(): { messages: ChatMessage[]; context: ContextItem[] } {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [context, setContext] = useState<ContextItem[]>([]);
  useEffect(() => {
    const sync = () => { setMessages(getChat()); setContext(getContext()); };
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync); // cross-tab history sync
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return { messages, context };
}
