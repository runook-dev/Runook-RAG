"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input } from "@/components/ui";

interface Dataset {
  id: string;
  name: string;
  document_count?: number;
  chunk_count?: number;
}

export default function KnowledgeClient() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rag/datasets");
      if (!res.ok) throw new Error("Failed to load");
      const body = await res.json();
      // RAGFlow returns { data: [...] } or { data: { ... } } depending on version.
      const list = Array.isArray(body?.data) ? body.data : body?.data?.datasets ?? [];
      setDatasets(list);
    } catch {
      setError("Could not load knowledge bases. The engine may not be connected yet.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/rag/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error("create failed");
      setName("");
      await load();
    } catch {
      setError("Could not create knowledge base.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <form onSubmit={create} className="flex gap-2">
          <Input placeholder="New knowledge base name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" disabled={creating}>
            {creating ? "Creating…" : "Create"}
          </Button>
        </form>
      </Card>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : datasets.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No knowledge bases yet. Create your first one above.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {datasets.map((d) => (
            <Card key={d.id}>
              <p className="font-medium">{d.name}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {d.document_count ?? 0} documents · {d.chunk_count ?? 0} chunks
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
