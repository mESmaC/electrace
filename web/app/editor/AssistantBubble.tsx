"use client";
import { useEffect, useRef, useState } from "react";
import { useAssistant, sendMessage, clearChat } from "@/lib/assistant";

/** Floating AI assistant — a robot bubble that opens a chat panel. The conversation is shared
 *  across every bubble and persists (localStorage); the working context window is session-only. */
export default function AssistantBubble() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const { messages } = useAssistant();
  const scroller = useRef<HTMLDivElement>(null);

  // Type assistant replies out instead of popping the whole message at once. Only genuinely-new
  // assistant messages animate — not the history when you reopen the panel, not your own messages.
  const seen = useRef<Set<string> | null>(null);
  const [typing, setTyping] = useState<{ id: string; n: number } | null>(null);
  useEffect(() => {
    if (seen.current === null) { seen.current = new Set(messages.map((m) => m.id)); return; } // first load = history
    const last = messages[messages.length - 1];
    if (last && last.role === "assistant" && !seen.current.has(last.id)) { seen.current.add(last.id); setTyping({ id: last.id, n: 0 }); }
    else messages.forEach((m) => seen.current!.add(m.id));
  }, [messages]);
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
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    sendMessage(text).finally(() => setBusy(false));
  };

  return (
    <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2">
      {open && (
        <div className="flex h-96 w-80 flex-col overflow-hidden rounded-xl border border-[#54607a] bg-[#454e62] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-[#54607a] px-3 py-2">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-[#8b6cff] to-[#4c8dff] text-[13px]">🤖</span>
            <span className="text-[12px] font-semibold text-white">AI Assistant</span>
            {messages.length > 0 && <button onClick={clearChat} className="ml-auto text-[10px] text-[#9aa3b5] hover:text-white" title="Clear history">clear</button>}
            <button onClick={() => setOpen(false)} className={`${messages.length > 0 ? "" : "ml-auto"} text-[#9aa3b5] hover:text-white`} title="Close">✕</button>
          </div>

          <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto p-3 text-[12px]">
            {messages.length === 0 ? (
              <div className="rounded-lg rounded-tl-sm bg-[#4e586f] p-2.5 leading-relaxed text-white">
                Hi — I&apos;ll help wire a chip from its part number, add the support parts a block needs, and explain what&apos;s on a net.
                <span className="mt-1 block text-[10px] text-[#9aa3b5]">I can see your current design / PCB context.</span>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] whitespace-pre-wrap rounded-lg p-2.5 leading-relaxed ${m.role === "user" ? "rounded-br-sm bg-[#4c8dff] text-white" : "rounded-tl-sm bg-[#4e586f] text-white"}`}>{shown(m)}{typing?.id === m.id && <span className="ml-px inline-block w-1.5 animate-pulse">▍</span>}</div>
                </div>
              ))
            )}
            {busy && !typing && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-lg rounded-tl-sm bg-[#4e586f] px-3 py-2.5 text-[#9aa3b5]">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9aa3b5] [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9aa3b5] [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9aa3b5]" />
                </div>
              </div>
            )}
          </div>

          <form onSubmit={submit} className="flex gap-1.5 border-t border-[#54607a] p-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your design…" disabled={busy}
              className="flex-1 rounded-md border border-[#54607a] bg-[#3c4658] px-2.5 py-2 text-[12px] text-white outline-none placeholder:text-[#677494] focus:border-[#4c8dff] disabled:opacity-60" />
            <button type="submit" disabled={!input.trim() || busy} title="Send"
              className="grid w-9 place-items-center rounded-md bg-[#4c8dff] text-white disabled:opacity-40">→</button>
          </form>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} title="AI assistant"
        className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[#8b6cff] to-[#4c8dff] text-[22px] ring-2 ring-[#a98bff55] transition hover:brightness-110"
        style={{ boxShadow: "0 6px 22px rgba(124,108,255,.55)" }}>
        🤖
      </button>
    </div>
  );
}
