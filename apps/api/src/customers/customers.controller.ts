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

  @Get(':id/timeline')
  getTimeline(@Param('id') id: string) {
    return this.customersService.getTimeline(id);
  }

  @Get(':id')
  getCustomer(@Param('id') id: string) {
    return this.customersService.getCustomer(id);
  }
}
