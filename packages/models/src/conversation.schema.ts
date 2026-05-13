import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import type { Channel, ConversationStatus, ConversationType, VoiceOutcome } from './types';

export type ConversationDocument = HydratedDocument<Conversation>;

@Schema({ _id: false })
class TranscriptLine {
  @Prop({ required: true, enum: ['ai', 'customer'] })
  speaker: 'ai' | 'customer';

  @Prop({ required: true })
  text: string;
}

@Schema({ _id: false })
class ChannelData {
  @Prop()
  subject: string;

  @Prop()
  duration: string;

  @Prop({ enum: ['Successful', 'No answer', 'Failed'] })
  outcome: VoiceOutcome;

  @Prop({ type: [TranscriptLine], default: [] })
  transcript: TranscriptLine[];
}

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId })
  brandId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId })
  customerId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, enum: ['whatsapp', 'email', 'voice', 'onsite'] })
  channel: Channel;

  @Prop({
    required: true,
    enum: ['ai_controlled', 'to_manage', 'managed', 'blocked', 'human_controlled'],
  })
  status: ConversationStatus;

  @Prop({ required: true, enum: ['inbound', 'outbound'] })
  type: ConversationType;

  @Prop({ type: MongooseSchema.Types.ObjectId, default: null })
  assigneeId: MongooseSchema.Types.ObjectId | null;

  @Prop({ default: true })
  aiActive: boolean;

  @Prop({ type: String, default: null })
  campaign: string | null;

  @Prop({ required: true })
  lastActivityAt: Date;

  @Prop({ type: ChannelData, default: () => ({}) })
  channelData: ChannelData;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

ConversationSchema.index({ brandId: 1, lastActivityAt: -1 });
ConversationSchema.index({ brandId: 1, status: 1, lastActivityAt: -1 });
ConversationSchema.index({ brandId: 1, channel: 1, status: 1, lastActivityAt: -1 });
ConversationSchema.index({ brandId: 1, type: 1, lastActivityAt: -1 });
