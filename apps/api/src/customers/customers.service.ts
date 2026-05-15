import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import {
  Conversation, ConversationDocument,
  Customer, CustomerDocument,
  Message, MessageDocument,
  Operator, OperatorDocument,
} from '@textyess/models';
import type {
  Channel,
  CustomerDetail,
  CustomerFilters,
  CustomerListItem,
  TimelineBlock,
  TimelineMessage,
} from '@textyess/models';

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

export type FindCustomersParams = CustomerFilters & { brandId: string };

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(Conversation.name) private readonly convModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Operator.name) private readonly operatorModel: Model<OperatorDocument>,
  ) {}

  async findCustomers(params: FindCustomersParams): Promise<CustomerListItem[]> {
    if (!Types.ObjectId.isValid(params.brandId)) {
      throw new BadRequestException('Invalid brandId');
    }

    const brandOid = new Types.ObjectId(params.brandId);

    // Conversation-level filter to identify qualifying customers.
    // Note: assigneeId is intentionally NOT applied here — it must run after
    // we resolve each customer's single assignee (see below), so the list
    // stays consistent with the "Assigned to" header even if the underlying
    // data violates the one-operator-per-customer rule.
    // The date range is also NOT applied here: see the customer-level
    // dateRangeFilter below.
    const convMatch: Record<string, unknown> = { brandId: brandOid };
    if (params.status) convMatch.status = params.status;
    if (params.campaign) convMatch.campaign = params.campaign;

    // The "Last Activity" filter is meant to match the value shown in the
    // list (customer.lastActivityAt, the latest activity across ALL of the
    // customer's conversations). Filtering on conversation.lastActivityAt
    // would qualify a customer whenever ANY of their conversations falls
    // in the window — even if their displayed lastActivityAt is outside it,
    // making the result visibly inconsistent with the filter (e.g. a
    // customer whose latest message is 07/05 surfacing for a 01–06/05
    // range because an older conversation happens to fall in the window).
    const dateRangeFilter: PipelineStage[] = (() => {
      if (!params.from && !params.to) return [];
      const range: Record<string, Date> = {};
      if (params.from) range.$gte = new Date(params.from);
      if (params.to) range.$lte = new Date(params.to);
      return [{ $match: { 'customer.lastActivityAt': range } }];
    })();

    const tagsFilter = params.tags?.length
      ? [{ $match: { 'customer.tags': { $in: params.tags } } } as PipelineStage]
      : [];

    // The displayed urgencyStatus is the MIN rank across ALL of a customer's
    // conversations, so filtering by status on the conversation-level $match
    // alone is not enough: a customer with both an ai_controlled and a more
    // urgent human_controlled conversation would pass an ai_controlled filter
    // while their badge shows human_controlled. Filter again on the computed
    // urgencyStatus to keep filter and badge consistent.
    const urgencyStatusFilter = params.status
      ? [{ $match: { urgencyStatus: params.status } } as PipelineStage]
      : [];

    // Same shape of bug as status: per the one-operator-per-customer rule,
    // each customer has a single resolved assignee. Filter on that resolved
    // value (not on "any conversation matches") so the operator dropdown and
    // the "Assigned to" header always agree, even when seed/legacy data has
    // mixed assigneeIds across a customer's conversations.
    const assigneeFilter: PipelineStage[] = (() => {
      if (params.assigneeId === 'unassigned') {
        return [{ $match: { resolvedAssigneeId: null } }];
      }
      if (params.assigneeId && Types.ObjectId.isValid(params.assigneeId)) {
        return [{ $match: { resolvedAssigneeId: new Types.ObjectId(params.assigneeId) } }];
      }
      return [];
    })();

    const pipeline: PipelineStage[] = [
      { $match: convMatch },
      { $group: { _id: '$customerId' } },

      // Re-fetch ALL conversations for each qualifying customer to compute
      // urgency and resolve the assignee. Sorted newest-first so the first
      // non-null assigneeId is the most recent.
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
            { $sort: { lastActivityAt: -1 } },
          ],
          as: 'allConvs',
        },
      },

      {
        $addFields: {
          minUrgencyRank: {
            $min: { $map: { input: '$allConvs', as: 'c', in: URGENCY_RANK } },
          },
          resolvedAssigneeId: {
            $let: {
              vars: {
                assigned: {
                  $filter: {
                    input: '$allConvs',
                    as: 'c',
                    cond: { $ne: ['$$c.assigneeId', null] },
                  },
                },
              },
              in: {
                $cond: [
                  { $gt: [{ $size: '$$assigned' }, 0] },
                  { $arrayElemAt: ['$$assigned.assigneeId', 0] },
                  null,
                ],
              },
            },
          },
        },
      },
      { $addFields: { urgencyStatus: RANK_TO_STATUS } },

      ...urgencyStatusFilter,
      ...assigneeFilter,

      { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'customer' } },
      { $unwind: '$customer' },

      ...dateRangeFilter,
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

    const rows = await this.convModel
      .aggregate<Omit<CustomerListItem, 'lastActivityAt'> & { lastActivityAt: Date }>(pipeline);
    return rows.map((r) => ({ ...r, lastActivityAt: r.lastActivityAt.toISOString() }));
  }

  async findTags(brandId: string): Promise<string[]> {
    if (!Types.ObjectId.isValid(brandId)) {
      throw new BadRequestException('Invalid brandId');
    }
    const tags = await this.customerModel.distinct('tags', {
      brandId: new Types.ObjectId(brandId),
    });
    return (tags as string[]).sort();
  }

  async getCustomer(customerId: string): Promise<CustomerDetail> {
    if (!Types.ObjectId.isValid(customerId)) {
      throw new BadRequestException('Invalid customerId');
    }
    const doc = await this.customerModel.findById(customerId).lean();
    if (!doc) throw new NotFoundException('Customer not found');

    // Business rule: all of a Customer's Conversations share the same
    // assigneeId. We pick the assigneeId of the most-recent assigned
    // Conversation — same rule the list filter uses — so the detail header
    // and the operator filter dropdown always agree, even when legacy data
    // breaks the rule. If no Conversation has an assignee, the Customer is
    // unassigned.
    const assignedConv = await this.convModel
      .findOne({ customerId: doc._id, assigneeId: { $ne: null } }, { assigneeId: 1 })
      .sort({ lastActivityAt: -1 })
      .lean();
    let assignee: CustomerDetail['assignee'] = null;
    if (assignedConv?.assigneeId) {
      const op = await this.operatorModel
        .findById(assignedConv.assigneeId, { _id: 1, name: 1 })
        .lean();
      if (op) {
        assignee = { _id: (op._id as Types.ObjectId).toString(), name: op.name };
      }
    }

    return {
      _id: (doc._id as Types.ObjectId).toString(),
      name: doc.name,
      email: doc.email,
      phone: doc.phone,
      lifetimeSpend: doc.lifetimeSpend,
      tags: doc.tags,
      notes: doc.notes,
      lastOrder: doc.lastOrder
        ? { id: doc.lastOrder.id, placedAt: doc.lastOrder.placedAt.toISOString() }
        : null,
      createdAt: (doc as unknown as { createdAt: Date }).createdAt.toISOString(),
      assignee,
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
          sentAt: msg.sentAt.toISOString(),
          attachments: msg.attachments,
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
          blockStart: entry.sortKey.toISOString(),
          channelData: {
            subject: conv.channelData?.subject,
            duration: conv.channelData?.duration,
            outcome: conv.channelData?.outcome,
            transcript: conv.channelData?.transcript,
          },
          messages: entry.isVoice ? [] : (entry.message ? [entry.message] : []),
        });
      }
    }

    return blocks;
  }
}
