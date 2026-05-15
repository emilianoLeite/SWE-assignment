import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import type { Channel, ConversationStatus, ConversationType, VoiceOutcome } from './types';
export type ConversationDocument = HydratedDocument<Conversation>;
declare class TranscriptLine {
    speaker: 'ai' | 'customer';
    text: string;
}
declare class ChannelData {
    subject: string;
    duration: string;
    outcome: VoiceOutcome;
    transcript: TranscriptLine[];
}
export declare class Conversation {
    brandId: MongooseSchema.Types.ObjectId;
    customerId: MongooseSchema.Types.ObjectId;
    channel: Channel;
    status: ConversationStatus;
    type: ConversationType;
    assigneeId: MongooseSchema.Types.ObjectId | null;
    aiActive: boolean;
    campaign: string | null;
    lastActivityAt: Date;
    channelData: ChannelData;
}
export declare const ConversationSchema: MongooseSchema<Conversation, import("mongoose").Model<Conversation, any, any, any, import("mongoose").Document<unknown, any, Conversation, any, {}> & Conversation & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Conversation, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<Conversation>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Conversation> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
export {};
//# sourceMappingURL=conversation.schema.d.ts.map