"use client";

export type Channel = "whatsapp" | "email" | "voice" | "onsite";
export type Status = "ai_controlled" | "to_manage" | "managed" | "blocked" | "human_controlled";

// ─── Time helper ────────────────────────────────────────────────────────────

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

// ─── Status config ───────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<Status, { label: string; dot: string; bg: string; text: string; border: string }> = {
  to_manage: {
    label: "To manage",
    dot: "bg-warning-500",
    bg: "bg-warning-100",
    text: "text-warning-700",
    border: "border-warning-200",
  },
  ai_controlled: {
    label: "AI controlled",
    dot: "bg-primary-500",
    bg: "bg-primary-50",
    text: "text-primary-600",
    border: "border-primary-100",
  },
  managed: {
    label: "Managed",
    dot: "bg-success-600",
    bg: "bg-success-100",
    text: "text-success-700",
    border: "border-success-100",
  },
  blocked: {
    label: "Blocked",
    dot: "bg-destructive-500",
    bg: "bg-destructive-100",
    text: "text-destructive-700",
    border: "border-destructive-200",
  },
  human_controlled: {
    label: "Human controlled",
    dot: "bg-neutral-400",
    bg: "bg-neutral-100",
    text: "text-neutral-600",
    border: "border-neutral-200",
  },
};

// ─── Channel config ──────────────────────────────────────────────────────────

export const CHANNEL_CONFIG: Record<Channel, { label: string; icon: string; headerBg: string; headerText: string; blockBorder: string; blockBg: string; bubble: string }> = {
  whatsapp: {
    label: "WhatsApp",
    icon: "💬",
    headerBg: "bg-[#25D366]",
    headerText: "text-white",
    blockBorder: "border-l-[#25D366]",
    blockBg: "bg-[#f0fdf4]",
    bubble: "bg-[#dcfce7]",
  },
  email: {
    label: "Email",
    icon: "✉️",
    headerBg: "bg-primary-500",
    headerText: "text-white",
    blockBorder: "border-l-primary-400",
    blockBg: "bg-primary-50",
    bubble: "bg-primary-100",
  },
  voice: {
    label: "Voice",
    icon: "📞",
    headerBg: "bg-[#7c3aed]",
    headerText: "text-white",
    blockBorder: "border-l-[#7c3aed]",
    blockBg: "bg-[#faf5ff]",
    bubble: "bg-[#ede9fe]",
  },
  onsite: {
    label: "On-site",
    icon: "🌐",
    headerBg: "bg-warning-500",
    headerText: "text-white",
    blockBorder: "border-l-warning-400",
    blockBg: "bg-warning-100",
    bubble: "bg-warning-200",
  },
};

// ─── StatusBadge ─────────────────────────────────────────────────────────────

export function StatusBadge({ status, size = "sm" }: { status: Status; size?: "xs" | "sm" }) {
  const cfg = STATUS_CONFIG[status];
  const cls = size === "xs"
    ? "px-1.5 py-[2px] text-[10px] gap-1"
    : "px-2 py-0.5 text-[11px] gap-1";
  return (
    <span className={`inline-flex items-center rounded-full font-medium border ${cls} ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── ChannelPill ─────────────────────────────────────────────────────────────

export function ChannelPill({ channel }: { channel: Channel }) {
  const cfg = CHANNEL_CONFIG[channel];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.headerBg} ${cfg.headerText}`}>
      <span>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

// ─── CustomerAvatar ──────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-primary-100 text-primary-700",
  "bg-success-100 text-success-700",
  "bg-warning-100 text-warning-700",
  "bg-[#ede9fe] text-[#6d28d9]",
];

export function CustomerAvatar({ name, index = 0, size = "md" }: { name: string; index?: number; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const sz = size === "sm" ? "w-7 h-7 text-xs" : size === "lg" ? "w-10 h-10 text-sm" : "w-8 h-8 text-xs";
  return (
    <div className={`${sz} ${color} rounded-full flex items-center justify-center font-semibold shrink-0`}>
      {initials}
    </div>
  );
}

// ─── ReplyBox ────────────────────────────────────────────────────────────────

export function ReplyBox({
  availableChannels,
  selectedChannel,
  onChannelChange,
  placeholder = "Type a message…",
}: {
  availableChannels: { channel: Channel; disabled: boolean; reason?: string }[];
  selectedChannel: Channel;
  onChannelChange: (ch: Channel) => void;
  placeholder?: string;
}) {
  const active = availableChannels.find((c) => c.channel === selectedChannel);
  const isDisabled = active?.disabled ?? true;

  return (
    <div className="border-t border-neutral-200 bg-white p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <select
          className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 bg-neutral-50 text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-300"
          value={selectedChannel}
          onChange={(e) => onChannelChange(e.target.value as Channel)}
        >
          {availableChannels.map(({ channel, disabled }) => (
            <option key={channel} value={channel} disabled={disabled}>
              {CHANNEL_CONFIG[channel].icon} {CHANNEL_CONFIG[channel].label}
              {disabled ? " (AI active)" : ""}
            </option>
          ))}
        </select>
        {isDisabled && (
          <span className="text-xs text-neutral-400">
            {active?.reason ?? "Disable AI to reply"}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          disabled={isDisabled}
          placeholder={isDisabled ? "To reply, disable the AI first" : placeholder}
          className="flex-1 text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-300 disabled:opacity-40 disabled:cursor-not-allowed"
        />
        <button
          disabled={isDisabled}
          className="px-3 py-2 bg-primary-500 text-white text-sm rounded-lg font-medium hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
