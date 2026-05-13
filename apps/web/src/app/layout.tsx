import type { Metadata } from "next";
import "./globals.css";
import QueryProvider from "@/components/QueryProvider";

export const metadata: Metadata = {
  title: "TextYess — Unified Inbox",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-main antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
