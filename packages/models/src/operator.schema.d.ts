import { HydratedDocument } from 'mongoose';
export type OperatorDocument = HydratedDocument<Operator>;
export declare class Operator {
    name: string;
    email: string;
}
export declare const OperatorSchema: import("mongoose").Schema<Operator, import("mongoose").Model<Operator, any, any, any, import("mongoose").Document<unknown, any, Operator, any, {}> & Operator & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, Operator, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<Operator>, {}, import("mongoose").DefaultSchemaOptions> & import("mongoose").FlatRecord<Operator> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
//# sourceMappingURL=operator.schema.d.ts.map