export type Channel = 'whatsapp' | 'email' | 'voice' | 'onsite';
export type ConversationStatus = 'ai_controlled' | 'to_manage' | 'managed' | 'blocked' | 'human_controlled';
export type SentBy = 'customer' | 'ai' | 'operator';
export type MessageType = 'text' | 'button' | 'media';
export type ConversationType = 'inbound' | 'outbound';
export type VoiceOutcome = 'Successful' | 'No answer' | 'Failed';
export interface TranscriptLine {
    speaker: 'ai' | 'customer';
    text: string;
}
export interface ChannelData {
    subject?: string;
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
    name: string;
    email?: string;
    phone?: string;
    lifetimeSpend: number;
    tags: string[];
    notes?: string;
    visitorId?: string;
    lastOrder?: LastOrder | null;
    lastActivityAt: Date;
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
export interface IMessage {
    _id: string;
    conversationId: string;
    sentBy: SentBy;
    content: string;
    type: MessageType;
    sentAt: Date;
}
//# sourceMappingURL=types.d.ts.map