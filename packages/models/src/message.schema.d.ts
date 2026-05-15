import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import type { SentBy, MessageType } from './types';
export type MessageDocument = HydratedDocument<Message>;
export declare class Message {
    conversationId: MongooseSchema.Types.ObjectId;
    sentBy: SentBy;
    content: string;
    type: MessageType;
    sentAt: Date;
}
export declare const MessageSchema: MongooseSchema<Message, import("mongoose").Model<Message, any, any, any, import("mongoose").Document<unknown, any, Message, any, {}> & Message & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Message, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<Message>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Message> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
//# sourceMappingURL=message.schema.d.ts.map