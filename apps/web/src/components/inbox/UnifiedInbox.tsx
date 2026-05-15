"use client";

// Three-column layout: customer list | timeline | customer details panel

import { useState, useMemo, useCallback, useEffect, useRef, useLayoutEffect } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search, Filter, Ban, Copy,
  ExternalLink, Paperclip, Smile, Send, Plus,
  ChevronDown, X,
} from "lucide-react";
import { StatusBadge, CustomerAvatar, CHANNEL_CONFIG, timeAgo, formatTime, blockHeaderTime, sameLocalDay, formatDayLabel } from "./shared";
import type { Channel } from "./shared";
import type {
  Attachment,
  CustomerDetail as ApiCustomerDetail,
  CustomerFilters,
  CustomerListItem as ApiCustomer,
  TimelineBlock as ApiTimelineBlock,
  TimelinePage as ApiTimelinePage,
} from "@textyess/models";

const TIMELINE_PAGE_SIZE = 3;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const BRAND_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

function useCustomers(filters: CustomerFilters = {}) {
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

function useTags() {
  return useQuery<string[]>({
    queryKey: ["customer-tags", BRAND_ID],
    queryFn: () =>
      fetch(`${API_URL}/customers/tags?brandId=${BRAND_ID}`).then((r) => {
        if (!r.ok) throw new Error("Failed to fetch tags");
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
  return useInfiniteQuery<ApiTimelinePage, Error>({
    queryKey: ["timeline", customerId],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(TIMELINE_PAGE_SIZE) });
      if (pageParam) params.set("before", pageParam as string);
      return fetch(`${API_URL}/customers/${customerId}/timeline?${params.toString()}`).then((r) => {
        if (!r.ok) throw new Error("Failed to fetch timeline");
        return r.json();
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
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
      attachments: msg.attachments,
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
  attachments?: Attachment[];
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
}: {
  filters: CustomerFilters;
  onFiltersChange: (f: CustomerFilters) => void;
}) {
  const { data: operators } = useOperators();
  const { data: campaigns } = useCampaigns();
  // Sourced from a brand-wide endpoint, not the filtered customer list —
  // otherwise selecting a tag would shrink the customer set and the other
  // tag chips would disappear from the panel.
  const { data: availableTags = [] } = useTags();

  function setFilter<K extends keyof CustomerFilters>(key: K, value: CustomerFilters[K] | undefined) {
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
          className="w-full text-[12px] font-semibold px-3 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors shadow-sm"
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
  filters: CustomerFilters;
  onFiltersChange: (f: CustomerFilters) => void;
}) {
  const [showFilters, setShowFilters] = useState(false);
  const { data: customers, isLoading, isError } = useCustomers(filters);

  const activeFilterCount = Object.keys(filters).length;

  return (
    <div className="w-[272px] shrink-0 border-r border-neutral-200 flex flex-col bg-white">
      {/* Search + filter row */}
      <div className="px-3 pt-3 pb-2 flex items-center gap-2 border-b border-neutral-100">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-300" />
          <input
            placeholder="Search messages"
            disabled
            title="Not implemented yet"
            className="w-full text-xs pl-7 pr-2 py-1.5 bg-neutral-100 rounded-lg border-0 focus:outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:opacity-60"
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
        <FilterPanel filters={filters} onFiltersChange={onFiltersChange} />
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType === "application/pdf") return "📄";
  return "📎";
}

function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  return (
    <div className="mt-2 space-y-1">
      {attachments.map((a, i) => (
        <div
          key={i}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-black/5 border border-black/5 text-[12px]"
          title={`${a.filename} · ${formatBytes(a.size)}`}
        >
          <span className="text-sm leading-none shrink-0">{attachmentIcon(a.mimeType)}</span>
          <span className="truncate flex-1 text-neutral-800">{a.filename}</span>
          <span className="text-[10px] text-neutral-500 shrink-0">{formatBytes(a.size)}</span>
        </div>
      ))}
    </div>
  );
}

function MessageBubble({ entry }: { entry: TimelineEntry }) {
  if (entry.isTranscript) return null;
  const isCustomer = entry.sentBy === "customer";
  const isEmail = entry.channel === "email";
  const cfg = CHANNEL_CONFIG[entry.channel];
  const maxWidth = isEmail ? "max-w-[88%]" : "max-w-[68%]";

  return (
    <div className={`flex ${isCustomer ? "justify-start" : "justify-end"} mb-2`}>
      <div
        className={`${maxWidth} rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
          isCustomer
            ? "bg-white border border-neutral-200 text-neutral-800 rounded-tl-sm shadow-sm"
            : `${cfg.bubble} text-neutral-800 rounded-tr-sm`
        }`}
      >
        {!isCustomer && (
          <p className="text-[10px] font-semibold uppercase tracking-wide mb-1 opacity-50">
            {entry.sentBy === "operator" ? "Operator" : "AI"}
          </p>
        )}
        <p className="whitespace-pre-wrap">{entry.content}</p>
        {entry.attachments && entry.attachments.length > 0 && (
          <AttachmentList attachments={entry.attachments} />
        )}
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

function blockKey(block: ConversationBlock): string {
  return `${block.conversationId}:${block.blockStart}`;
}

function BlockView({ block, expanded, onToggle }: { block: ConversationBlock; expanded: boolean; onToggle: () => void }) {
  const cfg = CHANNEL_CONFIG[block.channel];
  return (
    <div className="rounded-xl overflow-hidden border border-neutral-200 mb-4 shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between px-4 py-2 text-left bg-white text-neutral-800 border-b border-neutral-200"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{cfg.icon}</span>
          <span className="text-[13px] font-semibold">{cfg.label}</span>
          {block.channel === "email" && block.emailSubject && (
            <span className="text-[12px] text-neutral-500 truncate max-w-[180px]">— {block.emailSubject}</span>
          )}
          {block.channel === "voice" && block.voiceMeta && (
            <span className="text-[12px] text-neutral-500">· {block.voiceMeta.duration} · {block.voiceMeta.outcome}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-neutral-500">{blockHeaderTime(block.blockStart)}</span>
          <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${expanded ? "" : "-rotate-90"}`} />
        </div>
      </button>
      {expanded && (
        <div className={`px-4 py-3 ${cfg.blockBg}`}>
          {block.channel === "voice"
            ? block.entries[0] && <VoiceTranscript entry={block.entries[0]} />
            : block.entries.map((e, i) => {
                const prev = i === 0 ? block.blockStart : block.entries[i - 1].sentAt;
                const showDay = !sameLocalDay(prev, e.sentAt);
                return (
                  <div key={i}>
                    {showDay && (
                      <div className="flex items-center gap-2 my-3">
                        <div className="flex-1 h-px bg-neutral-300/60" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                          {formatDayLabel(e.sentAt)}
                        </span>
                        <div className="flex-1 h-px bg-neutral-300/60" />
                      </div>
                    )}
                    <MessageBubble entry={e} />
                  </div>
                );
              })}
        </div>
      )}
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

function TimelinePanel({ customerId, apiCustomer, onToggleDetails, onOpenDetails }: { customerId: string; apiCustomer?: ApiCustomerDetail; onToggleDetails: () => void; onOpenDetails: () => void }) {
  const [replyChannel, setReplyChannel] = useState<Channel>("whatsapp");
  const {
    data,
    isLoading: timelineLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useTimeline(customerId);
  const toggleAi = useToggleAi(customerId);

  // useInfiniteQuery returns pages in the order they were fetched.
  // page[0] is the newest 3 blocks; later pages are progressively older.
  // Render with oldest at top → newest at bottom, so reverse the page order
  // and flatten.
  const apiBlocks = useMemo<ApiTimelineBlock[]>(() => {
    if (!data?.pages) return [];
    return data.pages
      .slice()
      .reverse()
      .flatMap((p) => p.blocks);
  }, [data?.pages]);

  const blocks = useMemo(
    () => apiBlocksToFrontend(apiBlocks),
    [apiBlocks],
  );

  // Per-block expanded state, keyed by a stable id derived from the API.
  // Lifted out of BlockView so prepending older pages doesn't remount and
  // reset the toggle. Missing entries default to expanded.
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const toggleBlock = useCallback((id: string) => {
    setExpandedMap((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  }, []);

  const replyChannels = useMemo(() => {
    return (["whatsapp", "email"] as Channel[]).map((ch) => {
      const lastBlock = apiBlocks
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

  // Scroll behaviour for infinite-scroll-up:
  // - on customer change, jump to the bottom (newest message visible)
  // - when older blocks are prepended via fetchNextPage, hold the visible
  //   anchor by adjusting scrollTop by the height delta. Without this, the
  //   user gets yanked to the top every time more is loaded.
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const prevScrollHeight = useRef<number>(0);
  const lastScrolledCustomer = useRef<string>("");

  const fetchOlder = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    if (scrollRef.current) {
      prevScrollHeight.current = scrollRef.current.scrollHeight;
    }
    fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Restore the visible anchor after an older page lands.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (prevScrollHeight.current === 0) return;
    const delta = el.scrollHeight - prevScrollHeight.current;
    if (delta > 0) {
      el.scrollTop = el.scrollTop + delta;
    }
    prevScrollHeight.current = 0;
  }, [apiBlocks.length]);

  // Snap to bottom once the timeline has data for this customer. Tracks the
  // last customer we scrolled for so re-clicking the same customer doesn't
  // yank back to bottom mid-scroll.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !customerId) return;
    if (lastScrolledCustomer.current === customerId) return;
    if (!data?.pages?.length) return;
    el.scrollTop = el.scrollHeight;
    lastScrolledCustomer.current = customerId;
  }, [customerId, data?.pages?.length]);

  // Observe the top sentinel — when it scrolls into view, fetch the next
  // (older) page.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    if (!hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchOlder();
      },
      { root: scrollRef.current, threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, fetchOlder]);

  const activeChannelState = replyChannels.find((rc) => rc.channel === replyChannel);
  const canReply = !!activeChannelState?.hasConv && !activeChannelState?.aiActive;
  const hasReplyableChannel = replyChannels.some((rc) => rc.hasConv);

  // If the selected channel has no conversation for this customer, fall back to
  // the first channel that does — otherwise the selected button shows as "active"
  // while actually being disabled, which is confusing.
  useEffect(() => {
    if (activeChannelState?.hasConv) return;
    const firstAvailable = replyChannels.find((rc) => rc.hasConv);
    if (firstAvailable) setReplyChannel(firstAvailable.channel);
  }, [activeChannelState?.hasConv, replyChannels]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f9f8f6] min-w-0">
      {/* Conversation header */}
      <div className="bg-white border-b border-neutral-200 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={onToggleDetails}
                disabled={!apiCustomer}
                className="text-[15px] font-semibold text-neutral-900 truncate hover:text-primary-600 hover:underline disabled:cursor-default disabled:hover:no-underline disabled:hover:text-neutral-900"
              >
                {apiCustomer?.name ?? ""}
              </button>
              {apiCustomer?.phone && (
                <>
                  <span className="text-neutral-400 text-sm">·</span>
                  <span className="text-[13px] text-neutral-500">{apiCustomer.phone}</span>
                </>
              )}
            </div>
            {apiCustomer && (
              <p className="text-[12px] text-neutral-500 mt-0.5">
                Assigned to:{" "}
                <span className={apiCustomer.assignee ? "text-neutral-700 font-medium" : "italic text-neutral-400"}>
                  {apiCustomer.assignee?.name ?? "Unassigned"}
                </span>
              </p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <button
                onClick={onOpenDetails}
                disabled={!apiCustomer}
                className="flex items-center gap-1 text-[12px] text-neutral-600 border border-neutral-300 rounded-md px-2 py-0.5 hover:bg-neutral-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
        {timelineLoading && customerId ? (
          <div className="py-12 text-center text-[13px] text-neutral-400">Loading timeline…</div>
        ) : (
          <>
            {/* Top sentinel — when visible, triggers a fetch of older blocks. */}
            <div ref={sentinelRef} />
            {hasNextPage && (
              <div className="py-3 text-center text-[12px] text-neutral-400">
                {isFetchingNextPage ? "Loading older messages…" : "Scroll up to load older messages"}
              </div>
            )}
            {blocks.map((block) => {
              const id = blockKey(block);
              return (
                <BlockView
                  key={id}
                  block={block}
                  expanded={expandedMap[id] ?? true}
                  onToggle={() => toggleBlock(id)}
                />
              );
            })}
          </>
        )}
      </div>

      {/* Reply bar */}
      {hasReplyableChannel && (
        <div className="bg-white border-t border-neutral-200 px-4 py-2.5">
          <div className="flex items-center gap-1 mb-2 justify-end">
            <span className="text-[11px] text-neutral-500 mr-1">Reply through:</span>
            {replyChannels
              .filter(({ hasConv }) => hasConv)
              .map(({ channel }) => (
                <button
                  key={channel}
                  onClick={() => setReplyChannel(channel)}
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium border transition-colors ${
                    replyChannel === channel
                      ? "bg-primary-500 text-white border-primary-500"
                      : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300"
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

function CustomerDetailsPanel({ customer, isLoading, onClose }: { customer: ApiCustomerDetail | undefined; isLoading: boolean; onClose: () => void }) {
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
      <div className="px-4 py-2 border-b border-neutral-100 flex justify-between items-center">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close customer details"
          className="text-neutral-400 hover:text-neutral-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
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

function filtersFromSearchParams(sp: ReturnType<typeof useSearchParams>): CustomerFilters {
  const filters: CustomerFilters = {};
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

export default function UnifiedInbox() {
  const [selectedId, setSelectedId] = useState<string>("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);

  const handleFiltersChange = useCallback((next: CustomerFilters) => {
    const sp = new URLSearchParams();
    if (next.status) sp.set("status", next.status);
    if (next.assigneeId) sp.set("assigneeId", next.assigneeId);
    if (next.tags?.length) next.tags.forEach((t) => sp.append("tags", t));
    if (next.campaign) sp.set("campaign", next.campaign);
    if (next.from) sp.set("from", next.from);
    if (next.to) sp.set("to", next.to);
    setSelectedId("");
    setDetailsOpen(false);
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
        <TimelinePanel
          customerId={selectedId}
          apiCustomer={apiCustomer}
          onToggleDetails={() => setDetailsOpen((v) => !v)}
          onOpenDetails={() => setDetailsOpen(true)}
        />
        {detailsOpen && (
          <CustomerDetailsPanel
            customer={apiCustomer}
            isLoading={!!selectedId && detailLoading}
            onClose={() => setDetailsOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
