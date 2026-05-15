"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationSchema = exports.Conversation = void 0;
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let TranscriptLine = class TranscriptLine {
};
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['ai', 'customer'] }),
    __metadata("design:type", String)
], TranscriptLine.prototype, "speaker", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], TranscriptLine.prototype, "text", void 0);
TranscriptLine = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], TranscriptLine);
let ChannelData = class ChannelData {
};
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], ChannelData.prototype, "subject", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], ChannelData.prototype, "duration", void 0);
__decorate([
    (0, mongoose_1.Prop)({ enum: ['Successful', 'No answer', 'Failed'] }),
    __metadata("design:type", String)
], ChannelData.prototype, "outcome", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: [TranscriptLine], default: [] }),
    __metadata("design:type", Array)
], ChannelData.prototype, "transcript", void 0);
ChannelData = __decorate([
    (0, mongoose_1.Schema)({ _id: false })
], ChannelData);
let Conversation = class Conversation {
};
exports.Conversation = Conversation;
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: mongoose_2.Schema.Types.ObjectId }),
    __metadata("design:type", mongoose_2.Schema.Types.ObjectId)
], Conversation.prototype, "brandId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, type: mongoose_2.Schema.Types.ObjectId }),
    __metadata("design:type", mongoose_2.Schema.Types.ObjectId)
], Conversation.prototype, "customerId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['whatsapp', 'email', 'voice', 'onsite'] }),
    __metadata("design:type", String)
], Conversation.prototype, "channel", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        required: true,
        enum: ['ai_controlled', 'to_manage', 'managed', 'blocked', 'human_controlled'],
    }),
    __metadata("design:type", String)
], Conversation.prototype, "status", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: ['inbound', 'outbound'] }),
    __metadata("design:type", String)
], Conversation.prototype, "type", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: mongoose_2.Schema.Types.ObjectId, default: null }),
    __metadata("design:type", Object)
], Conversation.prototype, "assigneeId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], Conversation.prototype, "aiActive", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: String, default: null }),
    __metadata("design:type", Object)
], Conversation.prototype, "campaign", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", Date)
], Conversation.prototype, "lastActivityAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: ChannelData, default: () => ({}) }),
    __metadata("design:type", ChannelData)
], Conversation.prototype, "channelData", void 0);
exports.Conversation = Conversation = __decorate([
    (0, mongoose_1.Schema)({ timestamps: true })
], Conversation);
exports.ConversationSchema = mongoose_1.SchemaFactory.createForClass(Conversation);
exports.ConversationSchema.index({ brandId: 1, lastActivityAt: -1 });
exports.ConversationSchema.index({ brandId: 1, status: 1, lastActivityAt: -1 });
exports.ConversationSchema.index({ brandId: 1, channel: 1, status: 1, lastActivityAt: -1 });
exports.ConversationSchema.index({ brandId: 1, type: 1, lastActivityAt: -1 });
//# sourceMappingURL=conversation.schema.js.map