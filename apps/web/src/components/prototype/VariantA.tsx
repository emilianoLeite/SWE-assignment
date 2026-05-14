"use client";

// Three-column layout: customer list | timeline | customer details panel

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search, Filter, Ban, Copy,
  ExternalLink, Paperclip, Smile, Send, Plus,
} from "lucide-react";
import { StatusBadge, CustomerAvatar, CHANNEL_CONFIG, timeAgo, formatTime } from "./shared";
import type { Channel } from "./shared";

// ─── API types ────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const BRAND_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

interface ApiCustomer {
  _id: string;
  name: string;
  lastActivityAt: string;
  urgencyStatus: "ai_controlled" | "to_manage" | "managed" | "blocked" | "human_controlled";
  tags: string[];
}

interface ApiCustomerDetail {
  _id: string;
  name: string;
  email: string;
  phone: string;
  lifetimeSpend: number;
  tags: string[];
  notes: string | null;
  lastOrder: { id: string; placedAt: string } | null;
  createdAt: string;
}

interface ApiTimelineBlock {
  channel: Channel;
  conversationId: string;
  aiActive: boolean;
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

interface FilterParams {
  status?: string;
  assigneeId?: string;
  tags?: string[];
  campaign?: string;
  from?: string;
  to?: string;
}

function useCustomers(filters: FilterParams = {}) {
  const params = new URLSearchParams({ brandId: BRAND_ID });
  if (filters.status) params.set("status", filters.status);
  if (filters.assigneeId) params.set("assigneeId", filters.assigneeId);
  if (filters.tags?.length) filters.tags.forEach((t) => params.append("tags", t));
  if (filters.campaign) params.set("campaign", filters.campaign);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);

  return useQuery<ApiCustomer[]>({
    queryKey: ["customers", BRAND_ID, filters],
    queryFn: () =>
      fetch(`${API_URL}/customers?${params.toString()}`).then((r) => {
        if (!r.ok) throw new Error("Failed to fetch customers");
        return r.json();
      }),
  });
}

function useOperators() {
  return useQuery<{ _id: string; name: string }[]>({
    queryKey: ["operators"],
    queryFn: () =>
      fetch(`${API_URL}/operators`).then((r) => {
        if (!r.ok) throw new Error("Failed to fetch operators");
        return r.json();
      }),
  });
}

function useCampaigns() {
  return useQuery<string[]>({
    queryKey: ["campaigns", BRAND_ID],
    queryFn: () =>
      fetch(`${API_URL}/conversations/campaigns?brandId=${BRAND_ID}`).then((r) => {
        if (!r.ok) throw new Error("Failed to fetch campaigns");
        return r.json();
      }),
  });
}

function useCustomerDetail(customerId: string) {
  return useQuery<ApiCustomerDetail>({
    queryKey: ["customer", customerId],
    queryFn: () =>
      fetch(`${API_URL}/customers/${customerId}`).then((r) => {
        if (!r.ok) throw new Error("Failed to fetch customer");
        return r.json();
      }),
    enabled: !!customerId,
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
        conversationId: block.conversationId,
        aiActive: block.aiActive,
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
      conversationId: block.conversationId,
      aiActive: block.aiActive,
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
  conversationId: string;
  aiActive: boolean;
  entries: TimelineEntry[];
  emailSubject?: string;
  voiceMeta?: { duration: string; outcome: string };
  blockStart: string;
}

// ─── Filter panel ─────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "ai_controlled", label: "AI controlled" },
  { value: "to_manage", label: "To manage" },
  { value: "managed", label: "Managed" },
  { value: "blocked", label: "Blocked" },
];

function FilterPanel({
  filters,
  onFiltersChange,
  customers,
}: {
  filters: FilterParams;
  onFiltersChange: (f: FilterParams) => void;
  customers: ApiCustomer[] | undefined;
}) {
  const { data: operators } = useOperators();
  const { data: campaigns } = useCampaigns();

  const availableTags = useMemo(() => {
    if (!customers) return [];
    return Array.from(new Set(customers.flatMap((c) => c.tags ?? []))).sort();
  }, [customers]);

  function setFilter<K extends keyof FilterParams>(key: K, value: FilterParams[K] | undefined) {
    const next = { ...filters };
    if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
      delete next[key];
    } else {
      next[key] = value;
    }
    onFiltersChange(next);
  }

  function toggleTag(tag: string) {
    const current = filters.tags ?? [];
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    setFilter("tags", next.length ? next : undefined);
  }

  const activeCount = Object.keys(filters).length;

  return (
    <div className="border-b border-neutral-100 bg-neutral-50 px-3 py-2.5 space-y-2.5">
      {/* Status */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-1.5">Status</p>
        <div className="flex flex-wrap gap-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter("status", filters.status === opt.value ? undefined : opt.value)}
              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors font-medium ${
                filters.status === opt.value
                  ? "bg-primary-500 text-white border-primary-500"
                  : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Assignee */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-1.5">Assignee</p>
        <select
          value={filters.assigneeId ?? ""}
          onChange={(e) => setFilter("assigneeId", e.target.value || undefined)}
          className="w-full text-[12px] border border-neutral-200 rounded-lg px-2.5 py-1.5 bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-200"
        >
          <option value="">All assignees</option>
          <option value="unassigned">Unassigned</option>
          {operators?.map((op) => (
            <option key={op._id} value={op._id}>{op.name}</option>
          ))}
        </select>
      </div>

      {/* Tags */}
      {availableTags.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-1.5">Tags</p>
          <div className="flex flex-wrap gap-1">
            {availableTags.map((tag) => {
              const active = filters.tags?.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors font-medium ${
                    active
                      ? "bg-primary-500 text-white border-primary-500"
                      : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Campaign */}
      {campaigns && campaigns.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-1.5">Campaign</p>
          <select
            value={filters.campaign ?? ""}
            onChange={(e) => setFilter("campaign", e.target.value || undefined)}
            className="w-full text-[12px] border border-neutral-200 rounded-lg px-2.5 py-1.5 bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-200"
          >
            <option value="">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      )}

      {/* Last Activity */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-1.5">Last Activity</p>
        <div className="flex gap-1.5 items-center">
          <input
            type="date"
            value={filters.from ?? ""}
            onChange={(e) => setFilter("from", e.target.value || undefined)}
            className="flex-1 text-[11px] border border-neutral-200 rounded-lg px-2 py-1.5 bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
          <span className="text-[10px] text-neutral-400 shrink-0">to</span>
          <input
            type="date"
            value={filters.to ?? ""}
            onChange={(e) => setFilter("to", e.target.value || undefined)}
            className="flex-1 text-[11px] border border-neutral-200 rounded-lg px-2 py-1.5 bg-white text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
      </div>

      {/* Clear all */}
      {activeCount > 0 && (
        <button
          onClick={() => onFiltersChange({})}
          className="text-[11px] text-destructive-500 hover:text-destructive-700 font-medium"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

// ─── Left panel ───────────────────────────────────────────────────────────────

function CustomerList({
  selectedId,
  onSelect,
  filters,
  onFiltersChange,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
  filters: FilterParams;
  onFiltersChange: (f: FilterParams) => void;
}) {
  const [showFilters, setShowFilters] = useState(false);
  const { data: customers, isLoading, isError } = useCustomers(filters);

  const activeFilterCount = Object.keys(filters).length;

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
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-1 text-xs border rounded-lg px-2.5 py-1.5 transition-colors shrink-0 ${
            activeFilterCount > 0
              ? "bg-primary-50 text-primary-600 border-primary-300 hover:bg-primary-100"
              : "text-neutral-500 hover:text-neutral-700 border-neutral-200 hover:bg-neutral-50"
          }`}
        >
          <Filter className="w-3 h-3" />
          Filter
          {activeFilterCount > 0 && (
            <span className="ml-0.5 w-4 h-4 rounded-full bg-primary-500 text-white text-[9px] flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <FilterPanel filters={filters} onFiltersChange={onFiltersChange} customers={customers} />
      )}

      {/* Customer rows */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="px-4 py-8 text-center text-[13px] text-neutral-400">Loading…</div>
        )}
        {isError && (
          <div className="px-4 py-8 text-center text-[13px] text-destructive-500">Failed to load customers</div>
        )}
        {!isLoading && !isError && customers?.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-neutral-400">No customers match the selected filters</div>
        )}
        {customers?.map((customer, i) => {
          const selected = customer._id === selectedId;
          return (
            <button
              key={customer._id}
              onClick={() => onSelect(customer._id)}
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

function BlockView({ block }: { block: ConversationBlock }) {
  const cfg = CHANNEL_CONFIG[block.channel];
  return (
    <div className="rounded-xl overflow-hidden border border-neutral-200 mb-4 shadow-sm">
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
      <div className={`px-4 py-3 ${cfg.blockBg}`}>
        {block.channel === "voice"
          ? block.entries[0] && <VoiceTranscript entry={block.entries[0]} />
          : block.entries.map((e, i) => <MessageBubble key={i} entry={e} />)}
      </div>
    </div>
  );
}

// ─── Center panel — timeline ──────────────────────────────────────────────────

function useToggleAi(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, aiActive }: { conversationId: string; aiActive: boolean }) =>
      fetch(`${API_URL}/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiActive }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to update conversation");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline", customerId] });
    },
  });
}

function TimelinePanel({ customerId, apiCustomer }: { customerId: string; apiCustomer?: ApiCustomerDetail }) {
  const [replyChannel, setReplyChannel] = useState<Channel>("whatsapp");
  const { data: apiBlocks, isLoading: timelineLoading } = useTimeline(customerId);
  const toggleAi = useToggleAi(customerId);

  const blocks = useMemo(
    () => apiBlocks ? apiBlocksToFrontend(apiBlocks) : [],
    [apiBlocks],
  );

  const replyChannels = useMemo(() => {
    return (["whatsapp", "email"] as Channel[]).map((ch) => {
      const lastBlock = [...(apiBlocks ?? [])]
        .filter((b) => b.channel === ch)
        .at(-1);
      return {
        channel: ch,
        hasConv: !!lastBlock,
        aiActive: lastBlock?.aiActive ?? true,
        conversationId: lastBlock?.conversationId ?? "",
      };
    });
  }, [apiBlocks]);

  const activeChannelState = replyChannels.find((rc) => rc.channel === replyChannel);
  const canReply = !!activeChannelState?.hasConv && !activeChannelState?.aiActive;
  const hasReplyableChannel = replyChannels.some((rc) => rc.hasConv);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f9f8f6] min-w-0">
      {/* Conversation header */}
      <div className="bg-white border-b border-neutral-200 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-semibold text-neutral-900 truncate">
                {apiCustomer?.name ?? ""}
              </span>
              {apiCustomer?.phone && (
                <>
                  <span className="text-neutral-400 text-sm">·</span>
                  <span className="text-[13px] text-neutral-500">{apiCustomer.phone}</span>
                </>
              )}
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
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {timelineLoading && customerId ? (
          <div className="py-12 text-center text-[13px] text-neutral-400">Loading timeline…</div>
        ) : (
          blocks.map((block, i) => <BlockView key={i} block={block} />)
        )}
      </div>

      {/* Reply bar */}
      {hasReplyableChannel && (
        <div className="bg-white border-t border-neutral-200 px-4 py-2.5">
          <div className="flex gap-1 mb-2">
            {replyChannels.map(({ channel, hasConv }) => (
              <button
                key={channel}
                onClick={() => setReplyChannel(channel)}
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

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-neutral-400">
              <button className="hover:text-neutral-600 transition-colors"><Paperclip className="w-4 h-4" /></button>
              <button className="hover:text-neutral-600 transition-colors"><Smile className="w-4 h-4" /></button>
            </div>

            <input
              disabled={!canReply}
              placeholder={canReply ? "Insert here the message you want to send" : "To reply, first disable the AI"}
              className="flex-1 text-[13px] bg-transparent focus:outline-none text-neutral-800 placeholder:text-neutral-400 disabled:cursor-not-allowed"
            />

            <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-neutral-200">
              <span className="text-[11px] text-neutral-500 whitespace-nowrap font-medium">
                AI {activeChannelState?.aiActive ? "active" : "not active"}
              </span>
              <button
                onClick={() => {
                  const state = activeChannelState;
                  if (!state?.conversationId) return;
                  toggleAi.mutate({ conversationId: state.conversationId, aiActive: !state.aiActive });
                }}
                disabled={!activeChannelState?.hasConv || toggleAi.isPending}
                aria-label="Toggle AI"
                className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                  activeChannelState?.aiActive ? "bg-primary-500" : "bg-neutral-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                    activeChannelState?.aiActive ? "left-[18px]" : "left-0.5"
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
      )}
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

function CustomerDetailsPanel({ customer, isLoading }: { customer: ApiCustomerDetail | undefined; isLoading: boolean }) {
  const createdDaysAgo = customer
    ? Math.round((Date.now() - new Date(customer.createdAt).getTime()) / 86_400_000)
    : 0;

  if (isLoading) {
    return (
      <div className="w-60 shrink-0 border-l border-neutral-200 bg-white flex items-center justify-center">
        <span className="text-[13px] text-neutral-400">Loading…</span>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="w-60 shrink-0 border-l border-neutral-200 bg-white flex items-center justify-center">
        <span className="text-[13px] text-neutral-400">Select a customer</span>
      </div>
    );
  }

  return (
    <div className="w-60 shrink-0 border-l border-neutral-200 bg-white flex flex-col overflow-y-auto">
      <div className="px-4 py-2 border-b border-neutral-100 flex justify-end">
        <button className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-primary-500 transition-colors">
          Go to contacts page
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      <div className="px-4 divide-y divide-neutral-100">
        <Field label="Email" value={customer.email ?? "—"} copyable />
        <Field label="Phone number" value={customer.phone ?? "—"} copyable />
        <Field label="Customer for" value={`${createdDaysAgo} days`} />
        <Field
          label="Lifetime spend"
          value={`€${customer.lifetimeSpend.toLocaleString("it-IT", { minimumFractionDigits: 1 })}`}
        />
      </div>

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

      <div className="px-4 py-3 border-t border-neutral-100">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Notes</p>
          <button className="text-[11px] text-primary-500 hover:text-primary-700 transition-colors">Add note</button>
        </div>
        <p className="text-[12px] text-neutral-600 leading-relaxed">
          {customer.notes || <span className="italic text-neutral-400">No notes yet</span>}
        </p>
      </div>

      {customer.lastOrder && (
        <div className="px-4 py-3 border-t border-neutral-100">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 mb-1.5">Last order placed</p>
          <div className="bg-neutral-50 rounded-lg px-3 py-2 border border-neutral-100">
            <p className="text-[12px] font-semibold text-neutral-800">{customer.lastOrder.id}</p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
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

// ─── Root ─────────────────────────────────────────────────────────────────────

function filtersFromSearchParams(sp: ReturnType<typeof useSearchParams>): FilterParams {
  const filters: FilterParams = {};
  const status = sp.get("status");
  if (status) filters.status = status;
  const assigneeId = sp.get("assigneeId");
  if (assigneeId) filters.assigneeId = assigneeId;
  const tags = sp.getAll("tags");
  if (tags.length) filters.tags = tags;
  const campaign = sp.get("campaign");
  if (campaign) filters.campaign = campaign;
  const from = sp.get("from");
  if (from) filters.from = from;
  const to = sp.get("to");
  if (to) filters.to = to;
  return filters;
}

export default function VariantA() {
  const [selectedId, setSelectedId] = useState<string>("");
  const searchParams = useSearchParams();
  const router = useRouter();

  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);

  const handleFiltersChange = useCallback((next: FilterParams) => {
    const sp = new URLSearchParams();
    if (next.status) sp.set("status", next.status);
    if (next.assigneeId) sp.set("assigneeId", next.assigneeId);
    if (next.tags?.length) next.tags.forEach((t) => sp.append("tags", t));
    if (next.campaign) sp.set("campaign", next.campaign);
    if (next.from) sp.set("from", next.from);
    if (next.to) sp.set("to", next.to);
    router.replace(`?${sp.toString()}`);
  }, [router]);

  const { data: apiCustomer, isLoading: detailLoading } = useCustomerDetail(selectedId);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <PageHeader />
      <div className="flex flex-1 overflow-hidden">
        <CustomerList
          selectedId={selectedId}
          onSelect={setSelectedId}
          filters={filters}
          onFiltersChange={handleFiltersChange}
        />
        <TimelinePanel customerId={selectedId} apiCustomer={apiCustomer} />
        <CustomerDetailsPanel customer={apiCustomer} isLoading={!!selectedId && detailLoading} />
      </div>
    </div>
  );
}
