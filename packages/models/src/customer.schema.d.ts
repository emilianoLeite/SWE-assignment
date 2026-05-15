import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
export type CustomerDocument = HydratedDocument<Customer>;
declare class LastOrder {
    id: string;
    placedAt: Date;
}
export declare class Customer {
    brandId: MongooseSchema.Types.ObjectId;
    name: string;
    email: string;
    phone: string;
    lifetimeSpend: number;
    tags: string[];
    notes: string;
    visitorId: string;
    lastOrder: LastOrder | null;
    lastActivityAt: Date;
}
export declare const CustomerSchema: MongooseSchema<Customer, import("mongoose").Model<Customer, any, any, any, import("mongoose").Document<unknown, any, Customer, any, {}> & Customer & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Customer, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<Customer>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Customer> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
export {};
//# sourceMappingURL=customer.schema.d.ts.map