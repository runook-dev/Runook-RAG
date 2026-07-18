import Link from "next/link";
import DatasetDetailClient from "@/components/dataset-detail-client";

export default async function DatasetDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-4xl p-8">
      <Link href="/dashboard/knowledge" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
        ← Knowledge bases
      </Link>
      <h1 className="mt-3 mb-1 text-2xl font-semibold">Documents</h1>
      <p className="mb-8 text-sm text-[var(--muted)]">
        Upload files, then parse them so they become searchable and answerable in chat.
      </p>
      <DatasetDetailClient datasetId={id} />
    </div>
  );
}
