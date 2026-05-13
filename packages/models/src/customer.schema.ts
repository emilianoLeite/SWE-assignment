import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type CustomerDocument = HydratedDocument<Customer>;

@Schema({ _id: false })
class LastOrder {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  placedAt: Date;
}

@Schema({ timestamps: true })
export class Customer {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId })
  brandId: MongooseSchema.Types.ObjectId;

  @Prop()
  name: string;

  @Prop()
  email: string;

  @Prop()
  phone: string;

  @Prop({ default: 0 })
  lifetimeSpend: number;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop()
  notes: string;

  @Prop({ sparse: true })
  visitorId: string;

  @Prop({ type: LastOrder, default: null })
  lastOrder: LastOrder | null;

  @Prop({ required: true })
  lastActivityAt: Date;
}

export const CustomerSchema = SchemaFactory.createForClass(Customer);

CustomerSchema.index({ brandId: 1, lastActivityAt: -1 });
CustomerSchema.index({ brandId: 1, status: 1, lastActivityAt: -1 });
