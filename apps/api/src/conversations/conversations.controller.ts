import { BadRequestException, Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get('campaigns')
  getCampaigns(@Query('brandId') brandId?: string) {
    if (!brandId) throw new BadRequestException('brandId is required');
    return this.conversationsService.getCampaigns(brandId);
  }

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
