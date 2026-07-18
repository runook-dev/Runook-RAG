import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Runook RAG",
  description: "Runook RAG — private, grounded AI over your documents.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
