import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Runook RAG — Pricing",
  description: "Runook RAG plans and pricing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
