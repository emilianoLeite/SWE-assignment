"use client";

import TopBar from "@/components/prototype/TopBar";
import Sidebar from "@/components/prototype/Sidebar";
import VariantA from "@/components/prototype/VariantA";

export default function InboxShell() {
  return (
    <div className="flex flex-col h-screen overflow-hidden font-main">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden bg-background">
          <VariantA />
        </main>
      </div>
    </div>
  );
}
