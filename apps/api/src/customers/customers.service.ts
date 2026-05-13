import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';
import { Conversation, ConversationDocument, Customer, CustomerDocument } from '@textyess/models';

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

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Conversation.name) private readonly convModel: Model<ConversationDocument>,
  ) {}

  async findCustomers(params: FindCustomersParams): Promise<CustomerListItem[]> {
    if (!Types.ObjectId.isValid(params.brandId)) {
      throw new BadRequestException('Invalid brandId');
    }

    const brandOid = new Types.ObjectId(params.brandId);

    // Conversation-level filter to identify qualifying customers
    const convMatch: Record<string, unknown> = { brandId: brandOid };
    if (params.status) convMatch.status = params.status;
    if (params.assigneeId && Types.ObjectId.isValid(params.assigneeId)) {
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
        },
      },
    ];

    return this.convModel.aggregate<CustomerListItem>(pipeline);
  }
}
