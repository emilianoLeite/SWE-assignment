export type Channel = 'whatsapp' | 'email' | 'voice' | 'onsite';
export type ConversationStatus =
  | 'ai_controlled'
  | 'to_manage'
  | 'managed'
  | 'blocked'
  | 'human_controlled';
export type SentBy = 'customer' | 'ai' | 'operator';
export type MessageType = 'text' | 'button' | 'media';
export type ConversationType = 'inbound' | 'outbound';
export type VoiceOutcome = 'Successful' | 'No answer' | 'Failed';
export type CustomerKind = 'anonymous' | 'identified';

export interface TranscriptLine {
  speaker: 'ai' | 'customer';
  text: string;
}

export interface ChannelData {
  // email
  subject?: string;
  // voice
  duration?: string;
  outcome?: VoiceOutcome;
  transcript?: TranscriptLine[];
}

export interface LastOrder {
  id: string;
  placedAt: Date;
}

export interface IOperator {
  _id: string;
  name: string;
  email: string;
}

export interface ICustomer {
  _id: string;
  brandId: string;
  kind: CustomerKind;
  name: string;
  email?: string;
  phone?: string;
  lifetimeSpend: number;
  tags: string[];
  notes?: string;
  visitorId?: string;
  lastOrder?: LastOrder | null;
  lastActivityAt: Date;
  mergedInto?: string | null;
  createdAt: Date;
}

export interface IConversation {
  _id: string;
  brandId: string;
  customerId: string;
  channel: Channel;
  status: ConversationStatus;
  type: ConversationType;
  assigneeId?: string | null;
  aiActive: boolean;
  campaign?: string | null;
  lastActivityAt: Date;
  channelData: ChannelData;
  createdAt: Date;
}

export interface Attachment {
  filename: string;
  size: number; // bytes
  mimeType: string;
}

export interface IMessage {
  _id: string;
  conversationId: string;
  sentBy: SentBy;
  content: string;
  type: MessageType;
  sentAt: Date;
  attachments?: Attachment[];
}

// ─── Wire types ───────────────────────────────────────────────────────────────
// What the API serves over JSON. Dates are ISO strings because that's what
// crosses the wire after Nest serializes. Use these in both the API response
// contracts and the web consumers so the two can't drift apart.

export interface CustomerListItem {
  _id: string;
  name: string;
  lastActivityAt: string;
  urgencyStatus: ConversationStatus;
  tags: string[];
}

export interface CustomerDetail {
  _id: string;
  name: string;
  email: string;
  phone: string;
  lifetimeSpend: number;
  tags: string[];
  notes: string;
  lastOrder: { id: string; placedAt: string } | null;
  createdAt: string;
  assignee: { _id: string; name: string } | null;
}

export interface TimelineMessage {
  _id: string;
  sentBy: SentBy;
  content: string;
  type: MessageType;
  sentAt: string;
  attachments?: Attachment[];
}

export interface TimelineBlock {
  channel: Channel;
  conversationId: string;
  aiActive: boolean;
  blockStart: string;
  channelData: ChannelData;
  messages: TimelineMessage[];
}

// Paginated timeline response. Cursor is the `blockStart` of the oldest block
// returned in this page — pass it back as `before` to fetch the next page of
// older blocks. `nextCursor` is null when no older blocks remain.
export interface TimelinePage {
  blocks: TimelineBlock[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface CustomerFilters {
  status?: string;
  assigneeId?: string;
  tags?: string[];
  campaign?: string;
  from?: string;
  to?: string;
}
