"use client";

// Variant C — Accordion feed
// Full-width list of customers. Click a row to expand it inline —
// reveals a compact cross-channel timeline and a reply box.
// No split panels — everything lives in a single scrollable column.

import { useState } from "react";
import { ChevronDown, ChevronRight, Filter, Search, Bot } from "lucide-react";
import { CUSTOMERS, type Customer, type Channel } from "./seed-data";
import {
  StatusBadge,
  ChannelPill,
  CustomerAvatar,
  ReplyBox,
  CHANNEL_CONFIG,
  timeAgo,
  formatTime,
} from "./shared";

// ─── Compact message row (no full bubbles — just sender label + text) ─────────

function MiniMessage({ sentBy, content, sentAt }: { sentBy: string; content: string; sentAt: string }) {
  const isCustomer = sentBy === "customer";
  return (
    <div className={`flex gap-2 items-start py-1 ${isCustomer ? "" : "flex-row-reverse"}`}>
      <span
        className={`text-[10px] font-semibold shrink-0 mt-0.5 ${
          isCustomer ? "text-neutral-500" : sentBy === "operator" ? "text-primary-600" : "text-primary-400"
        }`}
      >
        {isCustomer ? "Customer" : sentBy === "operator" ? "Operator" : "AI"}
      </span>
      <div
        className={`flex-1 text-xs text-neutral-700 leading-relaxed px-2.5 py-1.5 rounded-xl ${
          isCustomer
            ? "bg-neutral-100 rounded-tl-sm"
            : sentBy === "operator"
            ? "bg-primary-100 rounded-tr-sm"
            : "bg-primary-50 rounded-tr-sm"
        }`}
      >
        {content}
        <span className="text-[9px] text-neutral-400 ml-1.5">{formatTime(sentAt)}</span>
      </div>
    </div>
  );
}

// ─── Inline timeline for expanded customer ────────────────────────────────────

function InlineTimeline({ customer }: { customer: Customer }) {
  // Merge all messages across all convs, sorted by sentAt
  type Entry = {
    channel: Channel;
    sentBy: string;
    content: string;
    sentAt: string;
    meta?: { subject?: string; duration?: string; outcome?: string };
    transcriptLines?: { speaker: string; text: string }[];
    isVoice?: boolean;
    convId: string;
  };

  const entries: Entry[] = [];

  for (const conv of customer.conversations) {
    if (conv.channel === "voice") {
      entries.push({
        channel: "voice",
        sentBy: "ai",
        content: "",
        sentAt: conv.lastActivityAt,
        meta: { duration: conv.channelData.duration, outcome: conv.channelData.outcome },
        transcriptLines: conv.channelData.transcript ?? [],
        isVoice: true,
        convId: conv.id,
      });
    } else {
      for (const msg of conv.messages) {
        entries.push({
          channel: conv.channel,
          sentBy: msg.sentBy,
          content: msg.content,
          sentAt: msg.sentAt,
          meta: { subject: conv.channelData.subject },
          convId: conv.id,
        });
      }
    }
  }

  entries.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

  // Group consecutive same-channel into blocks
  const blocks: { channel: Channel; entries: Entry[]; meta?: Entry["meta"] }[] = [];
  for (const entry of entries) {
    const last = blocks[blocks.length - 1];
    if (last && last.channel === entry.channel) {
      last.entries.push(entry);
    } else {
      blocks.push({ channel: entry.channel, entries: [entry], meta: entry.meta });
    }
  }

  return (
    <div className="space-y-3 py-3 px-4">
      {blocks.map((block, i) => {
        const cfg = CHANNEL_CONFIG[block.channel];
        return (
          <div key={i} className={`rounded-xl border border-neutral-200 overflow-hidden`}>
            {/* Block header */}
            <div className={`flex items-center gap-2 px-3 py-2 ${cfg.headerBg} ${cfg.headerText} text-xs font-semibold`}>
              <span>{cfg.icon}</span>
              <span>{cfg.label}</span>
              {block.channel === "email" && block.meta?.subject && (
                <span className="opacity-75 font-normal truncate max-w-[240px]">— {block.meta.subject}</span>
              )}
              {block.channel === "voice" && block.meta?.duration && (
                <span className="opacity-75 font-normal">· {block.meta.duration} · {block.meta.outcome}</span>
              )}
            </div>
            {/* Messages */}
            <div className={`px-3 py-2 ${cfg.blockBg}`}>
              {block.channel === "voice" ? (
                <div className="space-y-1.5">
                  {block.entries[0]?.transcriptLines?.map((line, j) => (
                    <MiniMessage
                      key={j}
                      sentBy={line.speaker}
                      content={line.text}
                      sentAt={block.entries[0].sentAt}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {block.entries.map((e, j) => (
                    <MiniMessage key={j} sentBy={e.sentBy} content={e.content} sentAt={e.sentAt} />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Accordion row ────────────────────────────────────────────────────────────

function AccordionRow({
  customer,
  index,
  isOpen,
  onToggle,
}: {
  customer: Customer;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [replyChannel, setReplyChannel] = useState<Channel>("whatsapp");

  const replyChannels = (["whatsapp", "email"] as Channel[]).map((ch) => {
    const conv = customer.conversations.find((c) => c.channel === ch);
    if (!conv) return { channel: ch, disabled: true, reason: "No conversation" };
    return { channel: ch, disabled: conv.aiActive, reason: conv.aiActive ? "AI active" : undefined };
  });

  const lastMsg = customer.conversations
    .flatMap((c) => c.messages)
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())[0];

  const channels = [...new Set(customer.conversations.map((c) => c.channel))];

  return (
    <div className={`border border-neutral-200 rounded-xl overflow-hidden mb-2 transition-shadow ${isOpen ? "shadow-card" : ""}`}>
      {/* Row header — always visible */}
      <button
        onClick={onToggle}
        className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
          isOpen ? "bg-primary-50" : "bg-white hover:bg-neutral-50"
        }`}
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-primary-500 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
        )}

        <CustomerAvatar name={customer.name} index={index} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-neutral-900">{customer.name}</span>
            <StatusBadge status={customer.urgencyStatus} size="xs" />
            {/* Channel pills */}
            <div className="flex gap-1">
              {channels.map((ch) => (
                <ChannelPill key={ch} channel={ch} />
              ))}
            </div>
          </div>
          {!isOpen && lastMsg && (
            <p className="text-xs text-neutral-500 truncate mt-0.5">{lastMsg.content}</p>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-neutral-400">{timeAgo(customer.lastActivityAt)}</span>
          <span className="text-xs text-neutral-400">€{customer.lifetimeSpend.toLocaleString()} LTV</span>
        </div>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="animate-fade-in border-t border-neutral-100">
          {/* Customer info strip */}
          <div className="px-4 py-2 bg-neutral-50 border-b border-neutral-100 flex items-center gap-4 text-xs text-neutral-500">
            <span>{customer.email}</span>
            <span>·</span>
            <span>{customer.phone}</span>
            {customer.lastOrder && (
              <>
                <span>·</span>
                <span>Last order <strong className="text-neutral-700">{customer.lastOrder.id}</strong> · €{customer.lastOrder.amount}</span>
              </>
            )}
            <div className="flex gap-1 ml-auto">
              {customer.tags.map((t) => (
                <span key={t} className="px-1.5 py-0.5 bg-white border border-neutral-200 rounded-full text-[10px] text-neutral-600">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <InlineTimeline customer={customer} />

          <div className="px-4 pb-4">
            <ReplyBox
              availableChannels={replyChannels}
              selectedChannel={replyChannel}
              onChannelChange={setReplyChannel}
              placeholder="Reply to this customer…"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Variant C root ───────────────────────────────────────────────────────────

export default function VariantC() {
  const [openId, setOpenId] = useState<string>(CUSTOMERS[0].id);

  const toggle = (id: string) => setOpenId((prev) => (prev === id ? "" : id));

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-neutral-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-neutral-900">All Conversations</h1>
          <p className="text-xs text-neutral-500 mt-0.5">{CUSTOMERS.length} customers</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              placeholder="Search customers…"
              className="text-xs pl-7 pr-3 py-1.5 border border-neutral-200 rounded-lg bg-neutral-50 w-48 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
          {["Status", "Assignee", "Tags", "Campaign"].map((f) => (
            <button
              key={f}
              className="text-xs px-2.5 py-1.5 border border-neutral-200 rounded-lg text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700 transition-colors flex items-center gap-1"
            >
              <Filter className="w-3 h-3" />
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Accordion list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin-neutral">
        {CUSTOMERS.map((customer, i) => (
          <AccordionRow
            key={customer.id}
            customer={customer}
            index={i}
            isOpen={openId === customer.id}
            onToggle={() => toggle(customer.id)}
          />
        ))}
      </div>
    </div>
  );
}
