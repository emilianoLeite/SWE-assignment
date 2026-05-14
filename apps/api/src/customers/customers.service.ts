import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import {
  Conversation, ConversationDocument,
  Customer, CustomerDocument,
  Message, MessageDocument,
} from '@textyess/models';
import type { Channel, SentBy, MessageType } from '@textyess/models';

const URGENCY_RANK: PipelineStage.AddFields['$addFields'] = {
  $switch: {
    branches: [
      { case: { $eq: ['$$c.status', 'to_manage'] }, then: 1 },
      { case: { $eq: ['$$c.status', 'human_controlled'] }, then: 2 },
      { case: { $eq: ['$$c.status', 'ai_controlled'] }, then: 3 },
      { case: { $eq: ['$$c.status', 'managed'] }, then: 4 },
      { case: { $eq: ['$$c.status', 'blocked'] }, then: 5 },
    ],
    default: 99,
  },
};

const RANK_TO_STATUS: PipelineStage.AddFields['$addFields'] = {
  $switch: {
    branches: [
      { case: { $eq: ['$minUrgencyRank', 1] }, then: 'to_manage' },
      { case: { $eq: ['$minUrgencyRank', 2] }, then: 'human_controlled' },
      { case: { $eq: ['$minUrgencyRank', 3] }, then: 'ai_controlled' },
      { case: { $eq: ['$minUrgencyRank', 4] }, then: 'managed' },
      { case: { $eq: ['$minUrgencyRank', 5] }, then: 'blocked' },
    ],
    default: 'ai_controlled',
  },
};

export interface CustomerListItem {
  _id: string;
  name: string;
  lastActivityAt: Date;
  urgencyStatus: string;
  tags: string[];
}

export interface FindCustomersParams {
  brandId: string;
  status?: string;
  assigneeId?: string;
  tags?: string[];
  campaign?: string;
  from?: string;
  to?: string;
}

export interface TimelineMessage {
  _id: string;
  sentBy: SentBy;
  content: string;
  type: MessageType;
  sentAt: Date;
}

export interface TimelineBlock {
  channel: Channel;
  conversationId: string;
  aiActive: boolean;
  blockStart: Date;
  channelData: {
    subject?: string;
    duration?: string;
    outcome?: string;
    transcript?: Array<{ speaker: 'ai' | 'customer'; text: string }>;
  };
  messages: TimelineMessage[];
}

export interface CustomerDetail {
  _id: string;
  name: string;
  email: string;
  phone: string;
  lifetimeSpend: number;
  tags: string[];
  notes: string;
  lastOrder: { id: string; placedAt: Date } | null;
  createdAt: Date;
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(Conversation.name) private readonly convModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
  ) {}

  async findCustomers(params: FindCustomersParams): Promise<CustomerListItem[]> {
    if (!Types.ObjectId.isValid(params.brandId)) {
      throw new BadRequestException('Invalid brandId');
    }

    const brandOid = new Types.ObjectId(params.brandId);

    // Conversation-level filter to identify qualifying customers
    const convMatch: Record<string, unknown> = { brandId: brandOid };
    if (params.status) convMatch.status = params.status;
    if (params.assigneeId === 'unassigned') {
      convMatch.assigneeId = null;
    } else if (params.assigneeId && Types.ObjectId.isValid(params.assigneeId)) {
      convMatch.assigneeId = new Types.ObjectId(params.assigneeId);
    }
    if (params.campaign) convMatch.campaign = params.campaign;
    if (params.from || params.to) {
      const dateRange: Record<string, Date> = {};
      if (params.from) dateRange.$gte = new Date(params.from);
      if (params.to) dateRange.$lte = new Date(params.to);
      convMatch.lastActivityAt = dateRange;
    }

    const tagsFilter = params.tags?.length
      ? [{ $match: { 'customer.tags': { $in: params.tags } } } as PipelineStage]
      : [];

    const pipeline: PipelineStage[] = [
      { $match: convMatch },
      { $group: { _id: '$customerId' } },

      // Re-fetch ALL conversations for each qualifying customer to compute urgency
      {
        $lookup: {
          from: 'conversations',
          let: { cid: '$_id', bid: brandOid },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$customerId', '$$cid'] },
                    { $eq: ['$brandId', '$$bid'] },
                  ],
                },
              },
            },
          ],
          as: 'allConvs',
        },
      },

      {
        $addFields: {
          minUrgencyRank: {
            $min: { $map: { input: '$allConvs', as: 'c', in: URGENCY_RANK } },
          },
        },
      },
      { $addFields: { urgencyStatus: RANK_TO_STATUS } },

      { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'customer' } },
      { $unwind: '$customer' },

      ...tagsFilter,

      { $sort: { 'customer.lastActivityAt': -1 } },

      {
        $project: {
          _id: '$customer._id',
          name: '$customer.name',
          lastActivityAt: '$customer.lastActivityAt',
          urgencyStatus: 1,
          tags: '$customer.tags',
        },
      },
    ];

    return this.convModel.aggregate<CustomerListItem>(pipeline);
  }

  async getCustomer(customerId: string): Promise<CustomerDetail> {
    if (!Types.ObjectId.isValid(customerId)) {
      throw new BadRequestException('Invalid customerId');
    }
    const doc = await this.customerModel.findById(customerId).lean();
    if (!doc) throw new NotFoundException('Customer not found');
    return {
      _id: (doc._id as Types.ObjectId).toString(),
      name: doc.name,
      email: doc.email,
      phone: doc.phone,
      lifetimeSpend: doc.lifetimeSpend,
      tags: doc.tags,
      notes: doc.notes,
      lastOrder: doc.lastOrder ?? null,
      createdAt: (doc as unknown as { createdAt: Date }).createdAt,
    };
  }

  async getTimeline(customerId: string): Promise<TimelineBlock[]> {
    if (!Types.ObjectId.isValid(customerId)) {
      throw new BadRequestException('Invalid customerId');
    }

    const customerOid = new Types.ObjectId(customerId);

    const conversations = await this.convModel
      .find({ customerId: customerOid })
      .lean();

    if (conversations.length === 0) return [];

    const convIds = conversations.map((c) => c._id);
    const convMap = new Map(conversations.map((c) => [c._id.toString(), c]));

    const messages = await this.messageModel
      .find({ conversationId: { $in: convIds } })
      .sort({ sentAt: 1 })
      .lean();

    interface RawEntry {
      sortKey: Date;
      convId: string;
      channel: Channel;
      aiActive: boolean;
      message?: TimelineMessage;
      isVoice: boolean;
    }

    const entries: RawEntry[] = [];

    for (const conv of conversations) {
      if (conv.channel === 'voice') {
        entries.push({
          sortKey: conv.lastActivityAt,
          convId: conv._id.toString(),
          channel: conv.channel,
          aiActive: conv.aiActive ?? true,
          isVoice: true,
        });
      }
    }

    for (const msg of messages) {
      const conv = convMap.get(msg.conversationId.toString());
      if (!conv || conv.channel === 'voice') continue;
      entries.push({
        sortKey: msg.sentAt,
        convId: conv._id.toString(),
        channel: conv.channel,
        aiActive: conv.aiActive ?? true,
        message: {
          _id: (msg._id as Types.ObjectId).toString(),
          sentBy: msg.sentBy,
          content: msg.content,
          type: msg.type,
          sentAt: msg.sentAt,
        },
        isVoice: false,
      });
    }

    entries.sort((a, b) => a.sortKey.getTime() - b.sortKey.getTime());

    const blocks: TimelineBlock[] = [];

    for (const entry of entries) {
      const last = blocks[blocks.length - 1];
      if (last && last.channel === entry.channel) {
        // Update to the most recent conversation's state
        last.conversationId = entry.convId;
        last.aiActive = entry.aiActive;
        if (!entry.isVoice && entry.message) {
          last.messages.push(entry.message);
        }
      } else {
        const conv = convMap.get(entry.convId)!;
        blocks.push({
          channel: entry.channel,
          conversationId: entry.convId,
          aiActive: entry.aiActive,
          blockStart: entry.sortKey,
          channelData: {
            subject: conv.channelData?.subject,
            duration: conv.channelData?.duration,
            outcome: conv.channelData?.outcome,
            transcript: conv.channelData?.transcript as Array<{ speaker: 'ai' | 'customer'; text: string }> | undefined,
          },
          messages: entry.isVoice ? [] : (entry.message ? [entry.message] : []),
        });
      }
    }

    return blocks;
  }
}
