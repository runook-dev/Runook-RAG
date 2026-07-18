import ChatClient from "@/components/chat-client";

export default function ChatPage() {
  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-[var(--border)] p-6">
        <h1 className="text-2xl font-semibold">Chat</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Ask questions grounded in your knowledge bases.</p>
      </div>
      <ChatClient />
    </div>
  );
}
