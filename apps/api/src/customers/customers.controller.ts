import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { CustomersService } from './customers.service';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  getCustomers(
    @Query('brandId') brandId?: string,
    @Query('status') status?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('tags') tags?: string | string[],
    @Query('campaign') campaign?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!brandId) throw new BadRequestException('brandId is required');

    const tagsArray = typeof tags === 'string' ? [tags] : tags;

    return this.customersService.findCustomers({
      brandId,
      status,
      assigneeId,
      tags: tagsArray,
      campaign,
      from,
      to,
    });
  }

  // Declared before the `:id` routes so it isn't shadowed by the parameter
  // match — otherwise "tags" would be treated as an :id and rejected as an
  // invalid ObjectId.
  @Get('tags')
  getTags(@Query('brandId') brandId?: string) {
    if (!brandId) throw new BadRequestException('brandId is required');
    return this.customersService.findTags(brandId);
  }

  @Get(':id/timeline')
  getTimeline(@Param('id') id: string) {
    return this.customersService.getTimeline(id);
  }

  @Get(':id')
  getCustomer(@Param('id') id: string) {
    return this.customersService.getCustomer(id);
  }
}
