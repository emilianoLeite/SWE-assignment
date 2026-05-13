"use client";

import {
  LayoutDashboard,
  Megaphone,
  Users,
  Zap,
  MessageSquare,
  Phone,
  Mail,
  Globe,
  Bot,
  BarChart2,
  ChevronDown,
  Star,
  Wrench,
  ShieldCheck,
  LucideIcon,
} from "lucide-react";

const TOP_NAV: { icon: LucideIcon; label: string }[] = [
  { icon: LayoutDashboard, label: "Home" },
  { icon: Megaphone, label: "Campaigns" },
  { icon: Users, label: "Contacts" },
  { icon: Zap, label: "Automations" },
];

const CONVERSATION_SUB: { icon: LucideIcon; label: string; active?: boolean; isNew?: boolean }[] = [
  { icon: Star, label: "All Conversations", active: true, isNew: true },
  { icon: MessageSquare, label: "WhatsApp Inbox" },
  { icon: Globe, label: "On-Site Inbox" },
  { icon: Phone, label: "Voice Inbox" },
  { icon: Mail, label: "Email Inbox" },
];

const BOTTOM_NAV: { icon: LucideIcon; label: string }[] = [
  { icon: Bot, label: "Agents" },
  { icon: BarChart2, label: "Analytics" },
  { icon: Wrench, label: "Growth Tool Kit" },
  { icon: ShieldCheck, label: "Admin" },
];

function NavItem({ icon: Icon, label, active = false }: { icon: LucideIcon; label: string; active?: boolean }) {
  return (
    <button
      className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] w-full text-left transition-colors ${
        active
          ? "bg-primary-500/15 text-primary-300"
          : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
      }`}
    >
      <Icon className="w-[15px] h-[15px] shrink-0" />
      <span>{label}</span>
    </button>
  );
}

export default function Sidebar() {
  return (
    <aside className="w-[224px] bg-neutral-900 flex flex-col shrink-0 h-full overflow-hidden">
      <nav className="flex-1 px-2 pt-2 pb-1 overflow-y-auto flex flex-col gap-0.5">
        {TOP_NAV.map(({ icon, label }) => (
          <NavItem key={label} icon={icon} label={label} />
        ))}

        {/* Conversations group */}
        <div className="mt-1.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-600 select-none">
            <ChevronDown className="w-3 h-3" />
            Conversations
          </div>
          <div className="flex flex-col gap-0.5 pl-1">
            {CONVERSATION_SUB.map(({ icon: Icon, label, active, isNew }) => (
              <button
                key={label}
                className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] w-full text-left transition-colors ${
                  active
                    ? "bg-primary-500/15 text-primary-300"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
                }`}
              >
                <Icon className="w-[15px] h-[15px] shrink-0" />
                <span className="flex-1">{label}</span>
                {isNew && (
                  <span className="text-[9px] font-bold bg-primary-500 text-white rounded-full px-1.5 py-0.5 leading-none shrink-0">
                    NEW
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom nav */}
        <div className="mt-auto pt-2 flex flex-col gap-0.5">
          {BOTTOM_NAV.map(({ icon, label }) => (
            <NavItem key={label} icon={icon} label={label} />
          ))}
        </div>
      </nav>

      {/* Operator footer */}
      <div className="px-3 py-2.5 border-t border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary-200 text-primary-800 flex items-center justify-center text-[10px] font-bold shrink-0">
            GM
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-neutral-200 text-[12px] font-medium truncate">Giulia Moretti</div>
            <div className="text-neutral-600 text-[10px] truncate">giulia@textyess.com</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
