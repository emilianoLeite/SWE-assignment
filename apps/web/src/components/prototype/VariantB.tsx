"use client";

// Variant B — Three-panel drill-down
// Panel 1 (narrow): customer list
// Panel 2: that customer's conversations, listed per channel
// Panel 3: messages for the selected conversation

import { useState } from "react";
import { Search, Bot, User } from "lucide-react";
import { CUSTOMERS, OPERATORS, type Customer, type Conversation, type Channel } from "./seed-data";
import {
  StatusBadge,
  ChannelPill,
  CustomerAvatar,
  ReplyBox,
  CHANNEL_CONFIG,
  timeAgo,
  formatTime,
} from "./shared";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAssignee(id: string | null) {
  return OPERATORS.find((o) => o.id === id) ?? null;
}

function lastMessagePreview(conv: Conversation): string {
  if (conv.channel === "voice") {
    return `Call · ${conv.channelData.duration ?? "–"} · ${conv.channelData.outcome ?? "–"}`;
  }
  const msgs = [...conv.messages].sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
  );
  return msgs[0]?.content ?? "No messages";
}

// ─── Panel 1 — Customer list (narrow) ────────────────────────────────────────

function CustomerList({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="w-52 shrink-0 border-r border-neutral-200 flex flex-col bg-white">
      <div className="px-3 py-3 border-b border-neutral-100">
        <h1 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Customers</h1>
        <div className="relative">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            placeholder="Search…"
            className="w-full text-xs pl-6 pr-2 py-1.5 border border-neutral-200 rounded-lg bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin-neutral">
        {CUSTOMERS.map((c, i) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`w-full text-left px-3 py-2.5 border-b border-neutral-100 flex items-center gap-2 transition-colors ${
              c.id === selectedId
                ? "bg-primary-50 border-l-2 border-l-primary-500"
                : "hover:bg-neutral-50"
            }`}
          >
            <CustomerAvatar name={c.name} index={i} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-neutral-800 truncate">{c.name}</div>
              <StatusBadge status={c.urgencyStatus} size="xs" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Panel 2 — Conversation list ─────────────────────────────────────────────

function ConversationList({
  customer,
  selectedConvId,
  onSelect,
}: {
  customer: Customer;
  selectedConvId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="w-72 shrink-0 border-r border-neutral-200 flex flex-col bg-neutral-50">
      {/* Customer summary */}
      <div className="px-4 py-3 border-b border-neutral-200 bg-white">
        <div className="flex items-center gap-2">
          <CustomerAvatar
            name={customer.name}
            index={CUSTOMERS.findIndex((c) => c.id === customer.id)}
            size="md"
          />
          <div>
            <div className="text-sm font-semibold text-neutral-900">{customer.name}</div>
            <div className="text-xs text-neutral-500">{customer.phone}</div>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
          <span>€{customer.lifetimeSpend.toLocaleString()} LTV</span>
          {customer.lastOrder && (
            <>
              <span>·</span>
              <span>Last order {customer.lastOrder.id}</span>
            </>
          )}
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto scrollbar-thin-neutral py-2 px-2">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 px-2 mb-1">
          Conversations ({customer.conversations.length})
        </div>
        {customer.conversations.map((conv) => {
          const cfg = CHANNEL_CONFIG[conv.channel];
          const isSelected = conv.id === selectedConvId;
          return (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full text-left rounded-xl p-3 mb-1.5 border transition-all ${
                isSelected
                  ? "bg-white border-primary-200 shadow-card"
                  : "bg-white border-neutral-200 hover:border-neutral-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <ChannelPill channel={conv.channel} />
                <span className="text-[10px] text-neutral-400">{timeAgo(conv.lastActivityAt)}</span>
              </div>
              {conv.channel === "email" && conv.channelData.subject && (
                <div className="text-xs font-medium text-neutral-700 truncate mb-1">
                  {conv.channelData.subject}
                </div>
              )}
              <p className="text-xs text-neutral-500 truncate">{lastMessagePreview(conv)}</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <StatusBadge status={conv.status} size="xs" />
                {conv.campaign && (
                  <span className="text-[10px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-full border border-neutral-200">
                    {conv.campaign}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Panel 3 — Conversation detail ───────────────────────────────────────────

function ConversationDetail({ conv, customer }: { conv: Conversation; customer: Customer }) {
  const [replyChannel, setReplyChannel] = useState<Channel>(conv.channel as Channel);
  const cfg = CHANNEL_CONFIG[conv.channel];
  const assignee = getAssignee(conv.assigneeId);

  const replyChannels = ["whatsapp", "email"].map((ch) => {
    const c = customer.conversations.find((x) => x.channel === ch);
    if (!c) return { channel: ch as Channel, disabled: true, reason: "No conversation" };
    return {
      channel: ch as Channel,
      disabled: c.aiActive,
      reason: c.aiActive ? "AI active" : undefined,
    };
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className={`px-5 py-3 border-b border-neutral-200 flex items-center justify-between ${cfg.blockBg}`}>
        <div className="flex items-center gap-2.5">
          <ChannelPill channel={conv.channel} />
          {conv.channel === "email" && conv.channelData.subject && (
            <span className="text-sm font-medium text-neutral-700 truncate max-w-sm">
              {conv.channelData.subject}
            </span>
          )}
          {conv.channel === "voice" && conv.channelData.duration && (
            <span className="text-sm text-neutral-600">
              {conv.channelData.duration} · {conv.channelData.outcome}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={conv.status} />
          {assignee && (
            <div className="flex items-center gap-1.5">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${assignee.color}`}>
                {assignee.initials}
              </div>
              <span className="text-xs text-neutral-500">{assignee.name}</span>
            </div>
          )}
          {/* AI toggle indicator */}
          {conv.channel !== "onsite" && conv.channel !== "voice" && (
            <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${conv.aiActive ? "bg-primary-50 border-primary-200 text-primary-700" : "bg-neutral-50 border-neutral-200 text-neutral-500"}`}>
              <Bot className="w-3 h-3" />
              AI {conv.aiActive ? "on" : "off"}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin-neutral">
        {conv.channel === "voice" ? (
          <div className="space-y-2">
            {conv.channelData.transcript?.map((line, i) => (
              <div key={i} className={`flex ${line.speaker === "customer" ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[72%] rounded-2xl px-3 py-2 text-sm ${
                    line.speaker === "customer"
                      ? "bg-neutral-100 text-neutral-800 rounded-tl-sm"
                      : "bg-[#ede9fe] text-neutral-800 rounded-tr-sm"
                  }`}
                >
                  <div className="text-[10px] font-semibold mb-0.5 opacity-60 capitalize">{line.speaker}</div>
                  {line.text}
                </div>
              </div>
            ))}
          </div>
        ) : conv.messages.length === 0 ? (
          <div className="text-center text-neutral-400 text-sm mt-12">No messages</div>
        ) : (
          conv.messages.map((msg) => {
            const isCustomer = msg.sentBy === "customer";
            return (
              <div key={msg.id} className={`flex mb-2 ${isCustomer ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[72%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    isCustomer
                      ? "bg-neutral-100 text-neutral-800 rounded-tl-sm"
                      : msg.sentBy === "operator"
                      ? "bg-primary-100 text-primary-900 rounded-tr-sm"
                      : `${cfg.bubble} text-neutral-800 rounded-tr-sm`
                  }`}
                >
                  {!isCustomer && (
                    <div className="text-[10px] font-semibold mb-0.5 opacity-60">
                      {msg.sentBy === "operator" ? "Operator" : "AI"}
                    </div>
                  )}
                  {msg.content}
                  <div className="text-[10px] opacity-40 mt-0.5 text-right">{formatTime(msg.sentAt)}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reply box — only for whatsapp/email, not voice/onsite */}
      {conv.channel !== "voice" && conv.channel !== "onsite" && (
        <ReplyBox
          availableChannels={replyChannels}
          selectedChannel={replyChannel}
          onChannelChange={setReplyChannel}
        />
      )}
      {(conv.channel === "voice" || conv.channel === "onsite") && (
        <div className="border-t border-neutral-200 px-4 py-3 bg-neutral-50 text-xs text-neutral-400 text-center">
          {conv.channel === "voice" ? "Voice calls are read-only" : "On-site conversations are AI-managed"}
        </div>
      )}
    </div>
  );
}

// ─── Variant B root ───────────────────────────────────────────────────────────

export default function VariantB() {
  const [selectedCustomerId, setSelectedCustomerId] = useState(CUSTOMERS[0].id);
  const customer = CUSTOMERS.find((c) => c.id === selectedCustomerId) ?? CUSTOMERS[0];

  const [selectedConvId, setSelectedConvId] = useState(customer.conversations[0]?.id ?? "");
  const conv = customer.conversations.find((c) => c.id === selectedConvId) ?? customer.conversations[0];

  const handleCustomerSelect = (id: string) => {
    setSelectedCustomerId(id);
    const c = CUSTOMERS.find((x) => x.id === id);
    setSelectedConvId(c?.conversations[0]?.id ?? "");
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      <CustomerList selectedId={selectedCustomerId} onSelect={handleCustomerSelect} />
      {customer && (
        <ConversationList
          customer={customer}
          selectedConvId={selectedConvId}
          onSelect={setSelectedConvId}
        />
      )}
      {conv && customer && <ConversationDetail conv={conv} customer={customer} />}
    </div>
  );
}
