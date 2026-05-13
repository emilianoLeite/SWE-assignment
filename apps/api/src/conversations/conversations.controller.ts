import { BadRequestException, Body, Controller, Param, Patch } from '@nestjs/common';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Patch(':id')
  patchConversation(
    @Param('id') id: string,
    @Body('aiActive') aiActive: unknown,
  ) {
    if (typeof aiActive !== 'boolean') {
      throw new BadRequestException('aiActive must be a boolean');
    }
    return this.conversationsService.patchAiActive(id, aiActive);
  }
}
