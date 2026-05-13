import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Operator, OperatorDocument } from '@textyess/models';

export interface OperatorItem {
  _id: string;
  name: string;
}

@Injectable()
export class OperatorsService {
  constructor(
    @InjectModel(Operator.name) private readonly operatorModel: Model<OperatorDocument>,
  ) {}

  async findAll(): Promise<OperatorItem[]> {
    const docs = await this.operatorModel.find({}, { _id: 1, name: 1 }).lean();
    return docs.map((d) => ({ _id: d._id.toString(), name: d.name }));
  }
}
