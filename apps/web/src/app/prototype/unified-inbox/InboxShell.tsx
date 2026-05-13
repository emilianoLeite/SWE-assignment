"use client";

import { useSearchParams } from "next/navigation";
import TopBar from "@/components/prototype/TopBar";
import Sidebar from "@/components/prototype/Sidebar";
import PrototypeSwitcher from "@/components/prototype/PrototypeSwitcher";
import VariantA from "@/components/prototype/VariantA";
import VariantB from "@/components/prototype/VariantB";
import VariantC from "@/components/prototype/VariantC";

const VARIANTS = [
  { key: "A", name: "Two-panel timeline" },
  { key: "B", name: "Three-panel drill-down" },
  { key: "C", name: "Accordion feed" },
];

export default function InboxShell() {
  const searchParams = useSearchParams();
  const variant = searchParams.get("variant") ?? "A";

  return (
    <div className="flex flex-col h-screen overflow-hidden font-main">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden bg-background">
          {variant === "A" && <VariantA />}
          {variant === "B" && <VariantB />}
          {variant === "C" && <VariantC />}
        </main>
      </div>
      <PrototypeSwitcher variants={VARIANTS} current={variant} />
    </div>
  );
}
