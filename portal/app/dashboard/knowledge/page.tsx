import KnowledgeClient from "@/components/knowledge-client";

export default function KnowledgePage() {
  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-1 text-2xl font-semibold">Knowledge bases</h1>
      <p className="mb-8 text-sm text-[var(--muted)]">
        Create knowledge bases and upload documents. Runook parses and indexes them for grounded answers.
      </p>
      <KnowledgeClient />
    </div>
  );
}
