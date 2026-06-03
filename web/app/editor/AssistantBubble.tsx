"use client";
import { useEffect, useRef, useState } from "react";
import { useAssistant, sendMessage, clearChat } from "@/lib/assistant";

/** Floating AI assistant — a robot bubble that opens a chat panel. The conversation is shared
 *  across every bubble and persists (localStorage); the working context window is session-only. */
export default function AssistantBubble() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages } = useAssistant();
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }, [messages, open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
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
                <span className="mt-1 block text-[10px] text-[#9aa3b5]">Not wired to a model yet, but your conversation is saved.</span>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-lg p-2.5 leading-relaxed ${m.role === "user" ? "rounded-br-sm bg-[#4c8dff] text-white" : "rounded-tl-sm bg-[#4e586f] text-white"}`}>{m.text}</div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={submit} className="flex gap-1.5 border-t border-[#54607a] p-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your design…"
              className="flex-1 rounded-md border border-[#54607a] bg-[#3c4658] px-2.5 py-2 text-[12px] text-white outline-none placeholder:text-[#677494] focus:border-[#4c8dff]" />
            <button type="submit" disabled={!input.trim()} title="Send"
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
