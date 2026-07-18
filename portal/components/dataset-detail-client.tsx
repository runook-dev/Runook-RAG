"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, Badge } from "@/components/ui";

interface Doc {
  id: string;
  name: string;
  run?: string;
  progress?: number;
  chunk_count?: number;
  token_count?: number;
}

const RUN_TONE: Record<string, "default" | "success" | "warning" | "danger"> = {
  DONE: "success",
  RUNNING: "warning",
  UNSTART: "default",
  FAIL: "danger",
  CANCEL: "danger",
};

export default function DatasetDetailClient({ datasetId }: { datasetId: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/datasets/${datasetId}/documents?page=1&page_size=100`);
      const body = await res.json();
      const list: Doc[] = body?.data?.docs ?? [];
      setDocs(list);
    } catch {
      setError("Could not load documents.");
    } finally {
      setLoading(false);
    }
  }, [datasetId]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while any document is still parsing.
  useEffect(() => {
    const anyRunning = docs.some((d) => d.run === "RUNNING" || d.run === "UNSTART");
    if (!anyRunning) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [docs, load]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("file", f));
      const res = await fetch(`/api/datasets/${datasetId}/documents`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("upload failed");
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch {
      setError("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function parseAll() {
    const ids = docs.filter((d) => d.run !== "DONE" && d.run !== "RUNNING").map((d) => d.id);
    if (ids.length === 0) return;
    setError(null);
    try {
      await fetch(`/api/datasets/${datasetId}/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_ids: ids }),
      });
      await load();
    } catch {
      setError("Could not start parsing.");
    }
  }

  async function remove(id: string) {
    try {
      await fetch(`/api/datasets/${datasetId}/documents`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      await load();
    } catch {
      setError("Could not delete document.");
    }
  }

  const canParse = docs.some((d) => d.run !== "DONE" && d.run !== "RUNNING");

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" multiple onChange={onUpload} className="hidden" />
          <Button disabled={uploading} onClick={() => fileRef.current?.click()} type="button">
            {uploading ? "Uploading…" : "Upload documents"}
          </Button>
          <Button variant="ghost" type="button" onClick={parseAll} disabled={!canParse}>
            Parse pending
          </Button>
          <span className="text-xs text-[var(--muted)]">PDF, Word, PPT, Excel, txt, images, and more.</span>
        </div>
      </Card>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No documents yet. Upload your first file above.</p>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <Card key={d.id} className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{d.name}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {d.chunk_count ?? 0} chunks
                  {d.run === "RUNNING" && typeof d.progress === "number"
                    ? ` · ${Math.round(d.progress * 100)}%`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={RUN_TONE[d.run ?? "UNSTART"] ?? "default"}>{d.run ?? "UNSTART"}</Badge>
                <button
                  onClick={() => remove(d.id)}
                  className="text-xs text-[var(--muted)] hover:text-[var(--danger)]"
                >
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
