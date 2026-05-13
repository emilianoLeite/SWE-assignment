import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TextYess — Unified Inbox",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-main antialiased">{children}</body>
    </html>
  );
}
