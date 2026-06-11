"use client";
import { useEffect, useRef, useState } from "react";
import { marked } from "marked";
import { useAssistant, sendMessage, clearChat, newConversation, switchConversation, deleteConversation } from "@/lib/assistant";

// Markdown styling for assistant replies (tables, lists, code, etc.), scoped to the chat bubble via
// arbitrary child variants — no global stylesheet or typography plugin needed.
const MD = [
  "[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_a]:text-[var(--color-link)] [&_a]:underline",
  "[&_strong]:font-semibold [&_em]:italic",
  "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5",
  "[&_h1]:text-[13px] [&_h1]:font-bold [&_h1]:mt-2 [&_h2]:text-[12.5px] [&_h2]:font-bold [&_h2]:mt-2 [&_h3]:font-semibold [&_h3]:mt-1.5",
  "[&_code]:rounded [&_code]:bg-[var(--color-bg)] [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[11px]",
  "[&_pre]:my-1 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-[var(--color-bg)] [&_pre]:p-2 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_table]:my-1.5 [&_table]:block [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-[11px]",
  "[&_th]:border [&_th]:border-[var(--color-border)] [&_th]:bg-[var(--color-bg2)] [&_th]:px-1.5 [&_th]:py-0.5 [&_th]:text-left [&_td]:border [&_td]:border-[var(--color-border)] [&_td]:px-1.5 [&_td]:py-0.5",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-[var(--color-border)] [&_blockquote]:pl-2 [&_blockquote]:text-[var(--color-dim)] [&_hr]:my-2 [&_hr]:border-[var(--color-border)]",
].join(" ");
// Model output is influenced by design content, so treat it as untrusted: escape raw HTML before
// parsing. Markdown formatting still renders; literal <tags> display as text instead of executing.
const renderMd = (text: string) =>
  marked.parse(text.replace(/</g, "&lt;"), { async: false, gfm: true, breaks: true }) as string;

/** Sparky — the floating assistant. Collapsed it's a sparkle bubble; opening slides a side pane in over
 *  the canvas (collapsible back into the bubble). Conversations are switchable like any chat app. */
export default function AssistantBubble() {
  const [open, setOpen] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // Sparky is a Pro feature. null = still checking; false = locked (show upgrade prompt). The server
  // enforces it regardless — this only drives the UI. On error we stay permissive (server still gates).
  const [pro, setPro] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/me").then((r) => r.json()).then((d) => { if (alive) setPro(!!d.pro); }).catch(() => { if (alive) setPro(true); });
    return () => { alive = false; };
  }, []);
  const { messages, conversations, activeId, progress } = useAssistant();
  // a run in flight anywhere (module-level — survives bubble remounts, unlike local state)
  const running = !!progress;
  const runningHere = progress?.convId === activeId;
  const scroller = useRef<HTMLDivElement>(null);

  // Type assistant replies out instead of popping the whole message at once. Only genuinely-new
  // assistant messages animate — not history when you reopen, not your own messages, and not the
  // messages that appear when you switch conversations.
  const seen = useRef<Set<string> | null>(null);
  const shownConv = useRef<string | null>(null);
  const [typing, setTyping] = useState<{ id: string; n: number } | null>(null);
  useEffect(() => {
    if (seen.current === null || shownConv.current !== activeId) { // first load OR conversation switch = history
      shownConv.current = activeId;
      seen.current = new Set(messages.map((m) => m.id));
      setTyping(null);
      return;
    }
    const last = messages[messages.length - 1];
    if (last && last.role === "assistant" && !seen.current.has(last.id)) { seen.current.add(last.id); setTyping({ id: last.id, n: 0 }); }
    else messages.forEach((m) => seen.current!.add(m.id));
  }, [messages, activeId]);
  useEffect(() => {
    if (!typing) return;
    const msg = messages.find((m) => m.id === typing.id);
    if (!msg || typing.n >= msg.text.length) { setTyping(null); return; }
    const step = Math.max(1, Math.round(msg.text.length / 140)); // scale so long replies type in ~2s, not forever
    const id = setTimeout(() => setTyping((t) => (t ? { ...t, n: Math.min(msg.text.length, t.n + step) } : t)), 16);
    return () => clearTimeout(id);
  }, [typing, messages]);
  const shown = (m: { id: string; text: string }) => (typing?.id === m.id ? m.text.slice(0, typing.n) : m.text);

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }, [messages, open, busy, typing]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy || running || pro === false) return;
    setInput("");
    setBusy(true);
    sendMessage(text).finally(() => setBusy(false));
  };

  const iconBtn = "grid h-7 w-7 place-items-center rounded-md text-[var(--color-faint)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]";

  return (
    <>
      {/* Side pane — slides in over the canvas, collapses back to the bubble */}
      <div
        className={`absolute inset-y-0 right-0 z-30 flex w-[400px] max-w-[90vw] transform flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full pointer-events-none"}`}
        aria-hidden={!open}
      >
        <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] px-3 py-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-[#8b6cff] to-[#4c8dff] text-[13px]">✨</span>
          <span className="text-[12px] font-semibold text-[var(--color-text)]">Sparky</span>
          <div className="ml-auto flex items-center gap-0.5">
            <button onClick={() => setHistOpen((o) => !o)} className={`${iconBtn} ${histOpen ? "bg-[var(--color-surface-2)] text-[var(--color-text)]" : ""}`} title="Chats">☰</button>
            <button onClick={() => { newConversation(); setHistOpen(false); setInput(""); }} className={iconBtn} title="New chat">＋</button>
            <button onClick={() => setOpen(false)} className={iconBtn} title="Collapse to bubble">⟩</button>
          </div>
        </div>

        {/* Conversation switcher */}
        {histOpen && (
          <div className="max-h-52 overflow-y-auto border-b border-[var(--color-border)] bg-[var(--color-bg2)] py-1 text-[11.5px]">
            {conversations.length === 0 && <div className="px-3 py-2 text-[var(--color-border-strong)]">No chats yet.</div>}
            {conversations.map((c) => (
              <div key={c.id} onClick={() => { switchConversation(c.id); setHistOpen(false); }}
                className={`group flex cursor-pointer items-center gap-2 px-3 py-1.5 ${c.id === activeId ? "bg-[#4c8dff]/15 text-[var(--color-text)]" : "text-[var(--color-dim)] hover:bg-[var(--color-surface-2)]"}`}>
                <span className="text-[10px] text-[var(--color-border-strong)]">💬</span>
                <span className="flex-1 truncate">{c.title || "New chat"}</span>
                <button onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                  className="text-[var(--color-border-strong)] opacity-0 hover:text-[var(--color-text)] group-hover:opacity-100" title="Delete chat">✕</button>
              </div>
            ))}
          </div>
        )}

        <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto p-3 text-[12px]">
          {messages.length === 0 ? (
            <div className="rounded-lg rounded-tl-sm bg-[var(--color-surface-2)] p-2.5 leading-relaxed text-[var(--color-text)]">
Hi, I&apos;m Sparky ✨ — I&apos;ll help wire a chip from its part number, add the support parts a block needs, and explain what&apos;s on a net.
              <span className="mt-1 block text-[10px] text-[var(--color-faint)]">I can see your current design / PCB context.</span>
            </div>
          ) : (
            messages.map((m) => {
              const isTyping = typing?.id === m.id;
              const asMarkdown = m.role === "assistant" && !isTyping && m.text.length > 0;
              return (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`${m.role === "user" ? "max-w-[85%]" : "max-w-[94%]"} rounded-lg p-2.5 leading-relaxed ${m.role === "user" ? "rounded-br-sm bg-[#4c8dff] text-white" : "rounded-tl-sm bg-[var(--color-surface-2)] text-[var(--color-text)]"} ${asMarkdown ? MD : "whitespace-pre-wrap"}`}>
                    {asMarkdown
                      ? <div dangerouslySetInnerHTML={{ __html: renderMd(m.text) }} />
                      : <>{shown(m)}{isTyping && <span className="ml-px inline-block w-1.5 animate-pulse">▍</span>}</>}
                  </div>
                </div>
              );
            })
          )}
          {running && !runningHere && (
            <div className="flex justify-start">
              <button onClick={() => progress && switchConversation(progress.convId)}
                className="max-w-[94%] rounded-lg rounded-tl-sm bg-[var(--color-surface-2)] px-3 py-2 text-left text-[11px] text-[var(--color-dim)] hover:text-[var(--color-text)]"
                title="Sparky is answering in the chat where you asked — click to jump there">
                ✨ Working in another chat… <span className="text-[var(--color-link)]">go to it →</span>
              </button>
            </div>
          )}
          {(busy || running) && runningHere && !typing && (
            <div className="flex justify-start">
              <div className="max-w-[94%] rounded-lg rounded-tl-sm bg-[var(--color-surface-2)] px-3 py-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="flex shrink-0 gap-0.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-link)] [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-link)] [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-link)]" />
                  </span>
                  <span className="font-medium text-[var(--color-text)]">{progress?.status ?? "Thinking…"}</span>
                </div>
                {progress && progress.tools.length > 0 && (
                  <div className="mt-1 font-mono text-[10px] text-[var(--color-faint)]">{progress.tools.length} step{progress.tools.length > 1 ? "s" : ""} · {progress.tools.slice(-4).join(" → ")}</div>
                )}
                {progress?.narration && <div className="mt-1 max-h-12 overflow-hidden text-[var(--color-dim)]">{progress.narration}</div>}
              </div>
            </div>
          )}
        </div>

        {pro === false ? (
          <div className="border-t border-[var(--color-border)] p-3 text-center">
            <div className="text-[12px] font-semibold text-[var(--color-text)]">✨ Sparky is a Pro feature</div>
            <p className="mx-auto mt-1 max-w-[280px] text-[11px] leading-relaxed text-[var(--color-dim)]">Upgrade to let Sparky build, wire, and explain your designs.</p>
            <a href="/pricing" className="mt-2 inline-block rounded-md bg-[#4c8dff] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:brightness-110">See plans →</a>
          </div>
        ) : (
          <form onSubmit={submit} className="flex items-center gap-1.5 border-t border-[var(--color-border)] p-2">
            {messages.length > 0 && <button type="button" onClick={clearChat} className="shrink-0 rounded-md px-1.5 py-1 text-[10px] text-[var(--color-faint)] hover:text-[var(--color-text)]" title="Clear this chat">clear</button>}
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={running && !runningHere ? "Sparky is working in another chat…" : "Ask about your design…"} disabled={busy || running}
              className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-2 text-[12px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-border-strong)] focus:border-[#4c8dff] disabled:opacity-60" />
            <button type="submit" disabled={!input.trim() || busy || running} title="Send"
              className="grid w-9 place-items-center rounded-md bg-[#4c8dff] py-2 text-white disabled:opacity-40">→</button>
          </form>
        )}
      </div>

      {/* Collapsed bubble — hidden while the pane is open */}
      <button onClick={() => setOpen(true)} title="Sparky — your design assistant"
        className={`absolute bottom-4 right-4 z-20 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[#8b6cff] to-[#4c8dff] text-[22px] ring-2 ring-[#a98bff55] transition-all duration-200 hover:brightness-110 ${open ? "pointer-events-none scale-0 opacity-0" : "scale-100 opacity-100"}`}
        style={{ boxShadow: "0 6px 22px rgba(124,108,255,.55)" }}>
        ✨
      </button>
    </>
  );
}
