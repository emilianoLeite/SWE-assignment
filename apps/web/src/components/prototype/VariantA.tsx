"use client";

// Variant A — Three-column: customer list | timeline | customer details panel
// Styled to match the TextYess product mockups.

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Filter, Tag, Ban, UserPlus, Copy,
  ExternalLink, Paperclip, Smile, Send, Plus,
} from "lucide-react";
import { CUSTOMERS, OPERATORS, type Customer, type Channel } from "./seed-data";
import { StatusBadge, CustomerAvatar, CHANNEL_CONFIG, timeAgo, formatTime } from "./shared";

// ─── API types ────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const BRAND_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

interface ApiCustomer {
  _id: string;
  name: string;
  lastActivityAt: string;
  urgencyStatus: "ai_controlled" | "to_manage" | "managed" | "blocked" | "human_controlled";
}

interface ApiTimelineBlock {
  channel: Channel;
  conversationId: string;
  blockStart: string;
  channelData: {
    subject?: string;
    duration?: string;
    outcome?: string;
    transcript?: Array<{ speaker: "ai" | "customer"; text: string }>;
  };
  messages: Array<{
    _id: string;
    sentBy: "customer" | "ai" | "operator";
    content: string;
    type: string;
    sentAt: string;
  }>;
}

function useCustomers() {
  return useQuery<ApiCustomer[]>({
    queryKey: ["customers", BRAND_ID],
    queryFn: () =>
      fetch(`${API_URL}/customers?brandId=${BRAND_ID}`).then((r) => {
        if (!r.ok) throw new Error("Failed to fetch customers");
        return r.json();
      }),
  });
}

function useTimeline(customerId: string) {
  return useQuery<ApiTimelineBlock[]>({
    queryKey: ["timeline", customerId],
    queryFn: () =>
      fetch(`${API_URL}/customers/${customerId}/timeline`).then((r) => {
        if (!r.ok) throw new Error("Failed to fetch timeline");
        return r.json();
      }),
    enabled: !!customerId,
  });
}

function apiBlocksToFrontend(apiBlocks: ApiTimelineBlock[]): ConversationBlock[] {
  return apiBlocks.map((block) => {
    if (block.channel === "voice") {
      return {
        channel: "voice",
        entries: [{
          channel: "voice" as Channel,
          sentBy: "ai" as const,
          content: "",
          sentAt: block.blockStart,
          isTranscript: true,
          transcriptLines: block.channelData.transcript ?? [],
          voiceMeta: {
            duration: block.channelData.duration ?? "0:00",
            outcome: block.channelData.outcome ?? "—",
          },
        }],
        voiceMeta: {
          duration: block.channelData.duration ?? "0:00",
          outcome: block.channelData.outcome ?? "—",
        },
        blockStart: block.blockStart,
      };
    }

    const entries: TimelineEntry[] = block.messages.map((msg) => ({
      channel: block.channel,
      sentBy: msg.sentBy,
      content: msg.content,
      sentAt: msg.sentAt,
      emailSubject: block.channelData.subject,
    }));

    return {
      channel: block.channel,
      entries,
      emailSubject: block.channelData.subject,
      blockStart: block.blockStart,
    };
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimelineEntry {
  channel: Channel;
  sentBy: "customer" | "ai" | "operator";
  content: string;
  sentAt: string;
  isTranscript?: boolean;
  transcriptLines?: { speaker: "ai" | "customer"; text: string }[];
  voiceMeta?: { duration: string; outcome: string };
  emailSubject?: string;
}

interface ConversationBlock {
  channel: Channel;
  entries: TimelineEntry[];
  emailSubject?: string;
  voiceMeta?: { duration: string; outcome: string };
  blockStart: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildTimeline(customer: Customer): ConversationBlock[] {
  const entries: TimelineEntry[] = [];

  for (const conv of customer.conversations) {
    if (conv.channel === "voice") {
      entries.push({
        channel: "voice",
        sentBy: "ai",
        content: "",
        sentAt: conv.lastActivityAt,
        isTranscript: true,
        transcriptLines: conv.channelData.transcript ?? [],
        voiceMeta: { duration: conv.channelData.duration ?? "0:00", outcome: conv.channelData.outcome ?? "—" },
      });
    } else {
      for (const msg of conv.messages) {
        entries.push({
          channel: conv.channel,
          sentBy: msg.sentBy as "customer" | "ai" | "operator",
          content: msg.content,
          sentAt: msg.sentAt,
          emailSubject: conv.channelData.subject,
        });
      }
    }
  }

  entries.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

  const blocks: ConversationBlock[] = [];
  for (const entry of entries) {
    const last = blocks[blocks.length - 1];
    if (last && last.channel === entry.channel) {
      last.entries.push(entry);
    } else {
      blocks.push({
        channel: entry.channel,
        entries: [entry],
        emailSubject: entry.emailSubject,
        voiceMeta: entry.voiceMeta,
        blockStart: entry.sentAt,
      });
    }
  }

  return blocks;
}

function getAssignee(id: string | null) {
  return OPERATORS.find((o) => o.id === id) ?? null;
}

// ─── Left panel ───────────────────────────────────────────────────────────────

function CustomerList({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string, index: number) => void }) {
  const { data: customers, isLoading, isError } = useCustomers();

  return (
    <div className="w-[272px] shrink-0 border-r border-neutral-200 flex flex-col bg-white">
      {/* Search + filter row */}
      <div className="px-3 pt-3 pb-2 flex items-center gap-2 border-b border-neutral-100">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            placeholder="Search messages"
            className="w-full text-xs pl-7 pr-2 py-1.5 bg-neutral-100 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary-200 placeholder:text-neutral-400"
          />
        </div>
        <button className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 border border-neutral-200 rounded-lg px-2.5 py-1.5 hover:bg-neutral-50 transition-colors shrink-0">
          <Filter className="w-3 h-3" />
          Filter
        </button>
      </div>

      {/* Customer rows */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="px-4 py-8 text-center text-[13px] text-neutral-400">Loading…</div>
        )}
        {isError && (
          <div className="px-4 py-8 text-center text-[13px] text-destructive-500">Failed to load customers</div>
        )}
        {customers?.map((customer, i) => {
          const selected = customer._id === selectedId;
          return (
            <button
              key={customer._id}
              onClick={() => onSelect(customer._id, i)}
              className={`w-full text-left px-4 py-3 border-b border-neutral-100 transition-colors flex gap-3 items-start ${
                selected ? "bg-neutral-50 border-l-2 border-l-primary-500" : "hover:bg-neutral-50/70"
              }`}
            >
              <CustomerAvatar name={customer.name} index={i} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1 mb-1">
                  <span className={`text-[13px] font-medium leading-tight truncate ${selected ? "text-primary-600" : "text-neutral-800"}`}>
                    {customer.name}
                  </span>
                  <span className="text-[11px] text-neutral-400 shrink-0 mt-px">{timeAgo(customer.lastActivityAt)}</span>
                </div>
                <StatusBadge status={customer.urgencyStatus} size="xs" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ entry }: { entry: TimelineEntry }) {
  if (entry.isTranscript) return null;
  const isCustomer = entry.sentBy === "customer";
  const cfg = CHANNEL_CONFIG[entry.channel];

  return (
    <div className={`flex ${isCustomer ? "justify-start" : "justify-end"} mb-2`}>
      <div
        className={`max-w-[68%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
          isCustomer
            ? "bg-white border border-neutral-200 text-neutral-800 rounded-tl-sm shadow-sm"
            : entry.sentBy === "operator"
            ? "bg-primary-100 text-primary-900 rounded-tr-sm"
            : `${cfg.bubble} text-neutral-800 rounded-tr-sm`
        }`}
      >
        {!isCustomer && (
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1 opacity-50">
            {entry.sentBy === "operator" ? "Operator" : "AI"}
          </p>
        )}
        <p>{entry.content}</p>
        <p className="text-[10px] opacity-40 mt-1 text-right">{formatTime(entry.sentAt)}</p>
      </div>
    </div>
  );
}

function VoiceTranscript({ entry }: { entry: TimelineEntry }) {
  return (
    <div className="space-y-2">
      {entry.transcriptLines?.map((line, i) => (
        <div key={i} className={`flex ${line.speaker === "customer" ? "justify-start" : "justify-end"}`}>
          <div
            className={`max-w-[68%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
              line.speaker === "customer"
                ? "bg-white border border-neutral-200 text-neutral-800 rounded-tl-sm shadow-sm"
                : "bg-[#ede9fe] text-neutral-800 rounded-tr-sm"
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-1 opacity-50 capitalize">{line.speaker}</p>
            <p>{line.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ConversationBlock({ block }: { block: ConversationBlock }) {
  const cfg = CHANNEL_CONFIG[block.channel];
  return (
    <div className="rounded-xl overflow-hidden border border-neutral-200 mb-4 shadow-sm">
      {/* Block header */}
      <div className={`flex items-center justify-between px-4 py-2 ${cfg.headerBg} ${cfg.headerText}`}>
        <div className="flex items-center gap-2">
          <span className="text-sm">{cfg.icon}</span>
          <span className="text-[13px] font-semibold">{cfg.label}</span>
          {block.channel === "email" && block.emailSubject && (
            <span className="text-[12px] opacity-80 truncate max-w-[180px]">— {block.emailSubject}</span>
          )}
          {block.channel === "voice" && block.voiceMeta && (
            <span className="text-[12px] opacity-80">· {block.voiceMeta.duration} · {block.voiceMeta.outcome}</span>
          )}
        </div>
        <span className="text-[11px] opacity-70">{timeAgo(block.blockStart)}</span>
      </div>
      {/* Messages */}
      <div className={`px-4 py-3 ${cfg.blockBg}`}>
        {block.channel === "voice"
          ? block.entries[0] && <VoiceTranscript entry={block.entries[0]} />
          : block.entries.map((e, i) => <MessageBubble key={i} entry={e} />)}
      </div>
    </div>
  );
}

// ─── Center panel — timeline ──────────────────────────────────────────────────

function TimelinePanel({ customer, index, customerId }: { customer: Customer; index: number; customerId: string }) {
  const [replyChannel, setReplyChannel] = useState<Channel>("whatsapp");
  const { data: apiBlocks, isLoading: timelineLoading } = useTimeline(customerId);
  const blocks = useMemo(
    () => apiBlocks ? apiBlocksToFrontend(apiBlocks) : buildTimeline(customer),
    [apiBlocks, customer],
  );
  const assignee = getAssignee(customer.conversations[0]?.assigneeId ?? null);

  const activeConv = useMemo(
    () =>
      [...customer.conversations]
        .filter((c) => c.channel === replyChannel)
        .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())[0],
    [customer, replyChannel]
  );
  const [aiActive, setAiActive] = useState(activeConv?.aiActive ?? true);
  const canReply = !aiActive && !!activeConv;

  const replyChannels = (["whatsapp", "email"] as Channel[]).map((ch) => {
    const conv = [...customer.conversations]
      .filter((c) => c.channel === ch)
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())[0];
    return { channel: ch, hasConv: !!conv, aiActive: conv?.aiActive ?? true };
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f9f8f6] min-w-0">
      {/* Conversation header */}
      <div className="bg-white border-b border-neutral-200 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-semibold text-neutral-900 truncate">
                {customer.name}
              </span>
              <span className="text-neutral-400 text-sm">·</span>
              <span className="text-[13px] text-neutral-500">{customer.phone}</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <button className="flex items-center gap-1 text-[12px] text-neutral-600 border border-neutral-300 rounded-md px-2 py-0.5 hover:bg-neutral-50 transition-colors font-medium">
                <Plus className="w-3 h-3" />
                MANAGE TAGS
              </button>
              <button className="flex items-center gap-1 text-[12px] text-destructive-600 border border-destructive-200 rounded-md px-2 py-0.5 hover:bg-destructive-100 transition-colors font-medium">
                <Ban className="w-3 h-3" />
                BLOCK
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {assignee ? (
            <div className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${assignee.color}`}>
                {assignee.initials}
              </div>
              <span className="text-[12px] text-neutral-500">{assignee.name}</span>
            </div>
          ) : (
            <button className="flex items-center gap-1.5 text-[12px] text-neutral-500 border border-neutral-200 rounded-lg px-2.5 py-1 hover:bg-neutral-50 transition-colors">
              <UserPlus className="w-3.5 h-3.5" />
              Add assignee
            </button>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {timelineLoading && customerId ? (
          <div className="py-12 text-center text-[13px] text-neutral-400">Loading timeline…</div>
        ) : (
          blocks.map((block, i) => <ConversationBlock key={i} block={block} />)
        )}
      </div>

      {/* Reply bar */}
      <div className="bg-white border-t border-neutral-200 px-4 py-2.5">
        {/* Channel tabs */}
        <div className="flex gap-1 mb-2">
          {replyChannels.map(({ channel, hasConv, aiActive: chAi }) => (
            <button
              key={channel}
              onClick={() => {
                setReplyChannel(channel);
                setAiActive(chAi);
              }}
              disabled={!hasConv}
              className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium border transition-colors ${
                replyChannel === channel
                  ? "bg-primary-500 text-white border-primary-500"
                  : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed"
              }`}
            >
              {CHANNEL_CONFIG[channel].icon} {CHANNEL_CONFIG[channel].label}
            </button>
          ))}
        </div>

        {/* Input row */}
        <div className="flex items-center gap-2">
          {/* Left icons */}
          <div className="flex items-center gap-1.5 text-neutral-400">
            <button className="hover:text-neutral-600 transition-colors"><Paperclip className="w-4 h-4" /></button>
            <button className="hover:text-neutral-600 transition-colors"><Smile className="w-4 h-4" /></button>
          </div>

          <input
            disabled={!canReply}
            placeholder={canReply ? "Insert here the message you want to send" : "To reply own, first disable the AI"}
            className="flex-1 text-[13px] bg-transparent focus:outline-none text-neutral-800 placeholder:text-neutral-400 disabled:cursor-not-allowed"
          />

          {/* AI toggle */}
          <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-neutral-200">
            <span className="text-[11px] text-neutral-500 whitespace-nowrap font-medium">
              AI {aiActive ? "active" : "not active"}
            </span>
            <button
              onClick={() => setAiActive((v) => !v)}
              aria-label="Toggle AI"
              className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none ${
                aiActive ? "bg-primary-500" : "bg-neutral-300"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                  aiActive ? "left-[18px]" : "left-0.5"
                }`}
              />
            </button>
          </div>

          <button
            disabled={!canReply}
            className="w-8 h-8 flex items-center justify-center bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Right panel — customer details ──────────────────────────────────────────

function Field({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div className="py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-0.5">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-neutral-800 leading-tight">{value}</span>
        {copyable && (
          <button className="text-neutral-300 hover:text-neutral-500 transition-colors shrink-0">
            <Copy className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function CustomerDetailsPanel({ customer }: { customer: Customer }) {
  const createdDaysAgo = Math.round((Date.now() - new Date(customer.createdAt).getTime()) / 86_400_000);

  return (
    <div className="w-60 shrink-0 border-l border-neutral-200 bg-white flex flex-col overflow-y-auto">
      {/* Go to contacts */}
      <div className="px-4 py-2 border-b border-neutral-100 flex justify-end">
        <button className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-primary-500 transition-colors">
          Go to contacts page
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* Contact fields */}
      <div className="px-4 divide-y divide-neutral-100">
        <Field label="Email" value={customer.email} copyable />
        <Field label="Phone number" value={customer.phone} copyable />
        <Field label="Customer for" value={`${createdDaysAgo} days`} />
        <Field
          label="Lifetime spend"
          value={`€${customer.lifetimeSpend.toLocaleString("it-IT", { minimumFractionDigits: 1 })}`}
        />
      </div>

      {/* Tags */}
      <div className="px-4 py-3 border-t border-neutral-100">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-2">Tags</p>
        <div className="flex flex-wrap gap-1.5">
          {customer.tags.map((t) => (
            <span
              key={t}
              className="px-2 py-0.5 bg-primary-50 text-primary-700 border border-primary-100 text-[11px] rounded-full font-medium"
            >
              {t}
            </span>
          ))}
        </div>
        <button className="mt-2 text-[11px] text-neutral-400 hover:text-primary-500 transition-colors">
          Edit contact info
        </button>
      </div>

      {/* Notes */}
      <div className="px-4 py-3 border-t border-neutral-100">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Notes</p>
          <button className="text-[11px] text-primary-500 hover:text-primary-700 transition-colors">Add note</button>
        </div>
        <p className="text-[12px] text-neutral-600 leading-relaxed">
          {customer.notes || <span className="italic text-neutral-400">No notes yet</span>}
        </p>
      </div>

      {/* Last order */}
      {customer.lastOrder && (
        <div className="px-4 py-3 border-t border-neutral-100">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-1.5">Last order placed</p>
          <div className="bg-neutral-50 rounded-lg px-3 py-2 border border-neutral-100">
            <p className="text-[12px] font-semibold text-neutral-800">{customer.lastOrder.id}</p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              €{customer.lastOrder.amount} ·{" "}
              {new Date(customer.lastOrder.placedAt).toLocaleDateString("it-IT", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page header ──────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div className="bg-white border-b border-neutral-200 px-6 py-3 flex items-center justify-between shrink-0">
      <h1 className="text-[17px] font-semibold text-neutral-900">All Conversations</h1>
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1.5 text-[13px] text-neutral-600 border border-neutral-200 rounded-lg px-3 py-1.5 hover:bg-neutral-50 transition-colors">
          <Filter className="w-3.5 h-3.5" />
          Filter
        </button>
        <button className="flex items-center gap-1.5 text-[13px] text-white bg-primary-500 border border-primary-500 rounded-lg px-3 py-1.5 hover:bg-primary-600 transition-colors font-medium">
          <Plus className="w-3.5 h-3.5" />
          New Chat
        </button>
      </div>
    </div>
  );
}

// ─── Variant A root ───────────────────────────────────────────────────────────

export default function VariantA() {
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Header/reply-bar and right panel still use seed data until issue #05
  const seedCustomer = CUSTOMERS[selectedIndex % CUSTOMERS.length];

  function handleSelect(id: string, index: number) {
    setSelectedId(id);
    setSelectedIndex(index);
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <PageHeader />
      <div className="flex flex-1 overflow-hidden">
        <CustomerList selectedId={selectedId} onSelect={handleSelect} />
        <TimelinePanel customer={seedCustomer} index={selectedIndex} customerId={selectedId} />
        <CustomerDetailsPanel customer={seedCustomer} />
      </div>
    </div>
  );
}
