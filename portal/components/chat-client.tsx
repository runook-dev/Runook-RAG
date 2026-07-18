"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setLoading(true);
    try {
      // OpenAI-compatible surface exposed by RAGFlow via the gateway.
      const res = await fetch("/api/rag/chats/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, stream: false }),
      });
      if (res.status === 429) {
        setError("You've reached your monthly usage limit. Contact Runook to upgrade.");
        return;
      }
      if (!res.ok) throw new Error("chat failed");
      const body = await res.json();
      const answer =
        body?.choices?.[0]?.message?.content ??
        body?.data?.answer ??
        body?.answer ??
        "No response from engine.";
      setMessages((m) => [...m, { role: "assistant", content: String(answer) }]);
    } catch {
      setError("Could not reach the RAG engine. It may not be connected yet.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 space-y-4 overflow-auto p-6">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-[var(--muted)]">Start a conversation below.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[75%] rounded-2xl rounded-br-sm bg-[var(--accent)] px-4 py-2 text-sm text-white"
                  : "max-w-[75%] rounded-2xl rounded-bl-sm border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm"
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && <p className="text-sm text-[var(--muted)]">Thinking…</p>}
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-[var(--border)] p-4">
        <Input placeholder="Ask a question…" value={input} onChange={(e) => setInput(e.target.value)} />
        <Button type="submit" disabled={loading}>
          Send
        </Button>
      </form>
    </div>
  );
}
