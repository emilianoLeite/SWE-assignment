import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OperatorDocument = HydratedDocument<Operator>;

@Schema({ timestamps: true })
export class Operator {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;
}

export const OperatorSchema = SchemaFactory.createForClass(Operator);
