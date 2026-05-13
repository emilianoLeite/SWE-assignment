import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Operator, OperatorSchema } from '@textyess/models';
import { OperatorsController } from './operators.controller';
import { OperatorsService } from './operators.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Operator.name, schema: OperatorSchema }]),
  ],
  controllers: [OperatorsController],
  providers: [OperatorsService],
})
export class OperatorsModule {}
