"use client";

import TopBar from "@/components/inbox/TopBar";
import Sidebar from "@/components/inbox/Sidebar";
import UnifiedInbox from "@/components/inbox/UnifiedInbox";

export default function InboxShell() {
  return (
    <div className="flex flex-col h-screen overflow-hidden font-main">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden bg-background">
          <UnifiedInbox />
        </main>
      </div>
    </div>
  );
}
