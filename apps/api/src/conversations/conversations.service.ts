import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument } from '@textyess/models';


@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name) private readonly convModel: Model<ConversationDocument>,
  ) {}

  async getCampaigns(brandId: string): Promise<string[]> {
    if (!Types.ObjectId.isValid(brandId)) {
      throw new BadRequestException('Invalid brandId');
    }
    const brandOid = new Types.ObjectId(brandId);
    return this.convModel.distinct('campaign', {
      brandId: brandOid,
      campaign: { $ne: null },
    });
  }

  async patchAiActive(id: string, aiActive: boolean): Promise<ConversationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid conversationId');
    }

    const doc = await this.convModel.findById(id);
    if (!doc) throw new NotFoundException('Conversation not found');

    if (doc.channel === 'voice' || doc.channel === 'onsite') {
      throw new BadRequestException(
        `Cannot toggle AI on ${doc.channel} conversations`,
      );
    }

    doc.aiActive = aiActive;
    await doc.save();
    return doc;
  }
}
