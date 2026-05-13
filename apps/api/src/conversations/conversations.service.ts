import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument } from '@textyess/models';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name) private readonly convModel: Model<ConversationDocument>,
  ) {}

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
