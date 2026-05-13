import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { Types, Model } from 'mongoose';
import { ConversationsModule } from '../src/conversations/conversations.module';
import { Conversation } from '@textyess/models';

const BRAND = new Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa');
const OTHER_BRAND = new Types.ObjectId('bbbbbbbbbbbbbbbbbbbbbbbb');
const CUSTOMER = new Types.ObjectId('cccccccccccccccccccccccc');

type ConvM = Model<Conversation>;

describe('PATCH /conversations/:id (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let ConvModel: ConvM;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        ConversationsModule,
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    ConvModel = module.get<ConvM>(getModelToken(Conversation.name));
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await ConvModel.deleteMany({});
  });

  it('toggles aiActive from true to false', async () => {
    const conv = await ConvModel.create({
      brandId: BRAND,
      customerId: CUSTOMER,
      channel: 'whatsapp',
      status: 'ai_controlled',
      type: 'inbound',
      aiActive: true,
      lastActivityAt: new Date(),
    });

    const { body } = await request(app.getHttpServer())
      .patch(`/conversations/${conv._id}`)
      .send({ aiActive: false })
      .expect(200);

    expect(body.aiActive).toBe(false);
    expect(body._id).toBe(conv._id.toString());
  });

  it('toggles aiActive from false to true', async () => {
    const conv = await ConvModel.create({
      brandId: BRAND,
      customerId: CUSTOMER,
      channel: 'email',
      status: 'to_manage',
      type: 'inbound',
      aiActive: false,
      lastActivityAt: new Date(),
    });

    const { body } = await request(app.getHttpServer())
      .patch(`/conversations/${conv._id}`)
      .send({ aiActive: true })
      .expect(200);

    expect(body.aiActive).toBe(true);
  });

  it('returns 400 for voice channel', async () => {
    const conv = await ConvModel.create({
      brandId: BRAND,
      customerId: CUSTOMER,
      channel: 'voice',
      status: 'managed',
      type: 'inbound',
      lastActivityAt: new Date(),
    });

    await request(app.getHttpServer())
      .patch(`/conversations/${conv._id}`)
      .send({ aiActive: false })
      .expect(400);
  });

  it('returns 400 for onsite channel', async () => {
    const conv = await ConvModel.create({
      brandId: BRAND,
      customerId: CUSTOMER,
      channel: 'onsite',
      status: 'managed',
      type: 'inbound',
      lastActivityAt: new Date(),
    });

    await request(app.getHttpServer())
      .patch(`/conversations/${conv._id}`)
      .send({ aiActive: false })
      .expect(400);
  });

  it('returns 404 for unknown conversation', async () => {
    await request(app.getHttpServer())
      .patch(`/conversations/${new Types.ObjectId()}`)
      .send({ aiActive: false })
      .expect(404);
  });

  it('returns 400 for invalid id', async () => {
    await request(app.getHttpServer())
      .patch('/conversations/not-an-id')
      .send({ aiActive: false })
      .expect(400);
  });
});

describe('GET /conversations/campaigns (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let ConvModel: ConvM;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        ConversationsModule,
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    ConvModel = module.get<ConvM>(getModelToken(Conversation.name));
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await ConvModel.deleteMany({});
  });

  it('returns distinct non-null campaign values for a brand', async () => {
    await ConvModel.insertMany([
      { brandId: BRAND, customerId: CUSTOMER, channel: 'whatsapp', status: 'managed', type: 'inbound', campaign: 'summer-sale', lastActivityAt: new Date() },
      { brandId: BRAND, customerId: CUSTOMER, channel: 'email', status: 'managed', type: 'inbound', campaign: 'summer-sale', lastActivityAt: new Date() },
      { brandId: BRAND, customerId: CUSTOMER, channel: 'onsite', status: 'managed', type: 'outbound', campaign: 'newsletter-q1', lastActivityAt: new Date() },
      { brandId: BRAND, customerId: CUSTOMER, channel: 'whatsapp', status: 'managed', type: 'inbound', campaign: null, lastActivityAt: new Date() },
    ]);

    const { body } = await request(app.getHttpServer())
      .get('/conversations/campaigns')
      .query({ brandId: BRAND.toString() })
      .expect(200);

    expect(body).toHaveLength(2);
    expect(body).toEqual(expect.arrayContaining(['summer-sale', 'newsletter-q1']));
  });

  it('excludes campaigns from other brands', async () => {
    await ConvModel.insertMany([
      { brandId: BRAND, customerId: CUSTOMER, channel: 'whatsapp', status: 'managed', type: 'inbound', campaign: 'ours', lastActivityAt: new Date() },
      { brandId: OTHER_BRAND, customerId: CUSTOMER, channel: 'whatsapp', status: 'managed', type: 'inbound', campaign: 'theirs', lastActivityAt: new Date() },
    ]);

    const { body } = await request(app.getHttpServer())
      .get('/conversations/campaigns')
      .query({ brandId: BRAND.toString() })
      .expect(200);

    expect(body).toEqual(['ours']);
  });

  it('returns 400 when brandId is missing', async () => {
    await request(app.getHttpServer())
      .get('/conversations/campaigns')
      .expect(400);
  });
});
