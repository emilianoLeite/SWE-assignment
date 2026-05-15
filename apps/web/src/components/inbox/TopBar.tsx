"use client";

import { Mic, Zap, MessageCircle, Send } from "lucide-react";

export default function TopBar() {
  return (
    <div className="h-7 bg-[#141210] flex items-center shrink-0 border-b border-white/5">
      {/* Logo — aligns exactly with the sidebar width */}
      <div className="w-[224px] shrink-0 flex items-center gap-2 px-3">
        <div className="w-3.5 h-3.5 bg-primary-500 rounded-[3px] flex items-center justify-center shrink-0">
          <span className="text-white text-[7px] font-black leading-none">ty</span>
        </div>
        <span className="text-white/90 text-[11px] font-semibold tracking-tight">text yrss</span>
      </div>

      {/* Stats */}
      <div className="flex items-center text-[10px] divide-x divide-white/10">
        <div className="flex items-center gap-1.5 px-3 text-white/40">
          <MessageCircle className="w-2.5 h-2.5 text-primary-400 shrink-0" />
          <span><span className="text-white/80 font-medium">1429</span> AI replies</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 text-white/40">
          <Send className="w-2.5 h-2.5 text-primary-400 shrink-0" />
          <span><span className="text-white/80 font-medium">735</span> outbound messages</span>
        </div>
        <div className="px-3 text-white/40">
          Join Limit: <span className="text-white/80 font-medium">2000</span>
        </div>
        <div className="flex items-center gap-1 px-3 text-white/40">
          <Mic className="w-2.5 h-2.5 text-primary-400 shrink-0" />
          <span><span className="text-white/80 font-medium">56</span> voce min</span>
        </div>
      </div>

      {/* Right — subscription info */}
      <div className="ml-auto flex items-center gap-1.5 px-3 text-[10px] text-white/30">
        <Zap className="w-2.5 h-2.5 text-warning-500 shrink-0" />
        <span>text-recurring-charge fin...</span>
      </div>
    </div>
  );
}
