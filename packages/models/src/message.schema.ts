import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import type { SentBy, MessageType } from './types';

export type MessageDocument = HydratedDocument<Message>;

@Schema({ timestamps: false })
export class Message {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId })
  conversationId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, enum: ['customer', 'ai', 'operator'] })
  sentBy: SentBy;

  @Prop({ required: true })
  content: string;

  @Prop({ enum: ['text', 'button', 'media'], default: 'text' })
  type: MessageType;

  @Prop({ required: true })
  sentAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({ conversationId: 1, sentAt: 1 });
