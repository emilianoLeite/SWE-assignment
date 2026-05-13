import { Controller, Get } from '@nestjs/common';
import { OperatorsService } from './operators.service';

@Controller('operators')
export class OperatorsController {
  constructor(private readonly operatorsService: OperatorsService) {}

  @Get()
  getOperators() {
    return this.operatorsService.findAll();
  }
}
