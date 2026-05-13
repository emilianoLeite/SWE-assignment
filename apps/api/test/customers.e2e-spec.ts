import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { Types, Model } from 'mongoose';
import { CustomersModule } from '../src/customers/customers.module';
import { Customer, Conversation, Message } from '@textyess/models';

const BRAND = new Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa');
const OTHER_BRAND = new Types.ObjectId('bbbbbbbbbbbbbbbbbbbbbbbb');

type CM = Model<Customer>;
type ConvM = Model<Conversation>;
type MsgM = Model<Message>;

describe('GET /customers (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let CustomerModel: CM;
  let ConvModel: ConvM;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        CustomersModule,
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    CustomerModel = module.get<CM>(getModelToken(Customer.name));
    ConvModel = module.get<ConvM>(getModelToken(Conversation.name));
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await CustomerModel.deleteMany({});
    await ConvModel.deleteMany({});
  });

  // ── Tracer bullet: basic listing ─────────────────────────────────────────

  it('returns customers sorted by lastActivityAt desc with urgencyStatus', async () => {
    const older = await CustomerModel.create({
      brandId: BRAND, name: 'Older', lastActivityAt: new Date('2024-01-10'),
    });
    const newer = await CustomerModel.create({
      brandId: BRAND, name: 'Newer', lastActivityAt: new Date('2024-01-20'),
    });
    await ConvModel.insertMany([
      { brandId: BRAND, customerId: older._id, channel: 'whatsapp', status: 'managed', type: 'inbound', lastActivityAt: new Date('2024-01-10') },
      { brandId: BRAND, customerId: newer._id, channel: 'email', status: 'to_manage', type: 'inbound', lastActivityAt: new Date('2024-01-20') },
    ]);

    const { body } = await request(app.getHttpServer())
      .get('/customers')
      .query({ brandId: BRAND.toString() })
      .expect(200);

    expect(body).toHaveLength(2);
    expect(body[0].name).toBe('Newer');
    expect(body[1].name).toBe('Older');
    expect(body[0]).toMatchObject({ urgencyStatus: 'to_manage', lastActivityAt: expect.any(String) });
  });

  // ── urgencyStatus reflects the most urgent conversation ──────────────────

  it('picks the most urgent status across all conversations', async () => {
    const c = await CustomerModel.create({
      brandId: BRAND, name: 'Multi', lastActivityAt: new Date('2024-01-15'),
    });
    await ConvModel.insertMany([
      { brandId: BRAND, customerId: c._id, channel: 'whatsapp', status: 'managed', type: 'inbound', lastActivityAt: new Date('2024-01-10') },
      { brandId: BRAND, customerId: c._id, channel: 'email', status: 'to_manage', type: 'inbound', lastActivityAt: new Date('2024-01-15') },
    ]);

    const { body } = await request(app.getHttpServer())
      .get('/customers')
      .query({ brandId: BRAND.toString() })
      .expect(200);

    expect(body[0].urgencyStatus).toBe('to_manage');
  });

  // ── status filter: only customers with at least one matching conversation ─

  it('filters by status at the customer level', async () => {
    const c1 = await CustomerModel.create({
      brandId: BRAND, name: 'ToManage', lastActivityAt: new Date('2024-01-20'),
    });
    const c2 = await CustomerModel.create({
      brandId: BRAND, name: 'Managed', lastActivityAt: new Date('2024-01-15'),
    });
    await ConvModel.insertMany([
      { brandId: BRAND, customerId: c1._id, channel: 'whatsapp', status: 'to_manage', type: 'inbound', lastActivityAt: new Date('2024-01-20') },
      { brandId: BRAND, customerId: c2._id, channel: 'email', status: 'managed', type: 'inbound', lastActivityAt: new Date('2024-01-15') },
    ]);

    const { body } = await request(app.getHttpServer())
      .get('/customers')
      .query({ brandId: BRAND.toString(), status: 'to_manage' })
      .expect(200);

    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('ToManage');
  });

  // ── tags filter ──────────────────────────────────────────────────────────

  it('filters by tags', async () => {
    const vip = await CustomerModel.create({
      brandId: BRAND, name: 'VIP', tags: ['vip'], lastActivityAt: new Date('2024-01-20'),
    });
    const regular = await CustomerModel.create({
      brandId: BRAND, name: 'Regular', tags: [], lastActivityAt: new Date('2024-01-15'),
    });
    await ConvModel.insertMany([
      { brandId: BRAND, customerId: vip._id, channel: 'whatsapp', status: 'managed', type: 'inbound', lastActivityAt: new Date('2024-01-20') },
      { brandId: BRAND, customerId: regular._id, channel: 'email', status: 'managed', type: 'inbound', lastActivityAt: new Date('2024-01-15') },
    ]);

    const { body } = await request(app.getHttpServer())
      .get('/customers')
      .query({ brandId: BRAND.toString(), tags: 'vip' })
      .expect(200);

    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('VIP');
  });

  // ── brand isolation ──────────────────────────────────────────────────────

  it('excludes customers from other brands', async () => {
    const ours = await CustomerModel.create({
      brandId: BRAND, name: 'Ours', lastActivityAt: new Date('2024-01-20'),
    });
    const theirs = await CustomerModel.create({
      brandId: OTHER_BRAND, name: 'Theirs', lastActivityAt: new Date('2024-01-20'),
    });
    await ConvModel.insertMany([
      { brandId: BRAND, customerId: ours._id, channel: 'whatsapp', status: 'managed', type: 'inbound', lastActivityAt: new Date('2024-01-20') },
      { brandId: OTHER_BRAND, customerId: theirs._id, channel: 'email', status: 'managed', type: 'inbound', lastActivityAt: new Date('2024-01-20') },
    ]);

    const { body } = await request(app.getHttpServer())
      .get('/customers')
      .query({ brandId: BRAND.toString() })
      .expect(200);

    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Ours');
  });

  // ── missing brandId → 400 ────────────────────────────────────────────────

  it('returns 400 when brandId is missing', async () => {
    await request(app.getHttpServer()).get('/customers').expect(400);
  });
});

describe('GET /customers/:id/timeline (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let CustomerModel: CM;
  let ConvModel: ConvM;
  let MsgModel: MsgM;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        CustomersModule,
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    CustomerModel = module.get<CM>(getModelToken(Customer.name));
    ConvModel = module.get<ConvM>(getModelToken(Conversation.name));
    MsgModel = module.get<MsgM>(getModelToken(Message.name));
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await CustomerModel.deleteMany({});
    await ConvModel.deleteMany({});
    await MsgModel.deleteMany({});
  });

  // ── RED 1: basic chronological order ────────────────────────────────────

  it('returns timeline blocks in chronological order', async () => {
    const customer = await CustomerModel.create({
      brandId: BRAND, name: 'Giulia', lastActivityAt: new Date('2024-02-10'),
    });

    const conv1 = await ConvModel.create({
      brandId: BRAND, customerId: customer._id, channel: 'whatsapp',
      status: 'managed', type: 'inbound', lastActivityAt: new Date('2024-02-05'),
    });
    const conv2 = await ConvModel.create({
      brandId: BRAND, customerId: customer._id, channel: 'email',
      status: 'managed', type: 'inbound', lastActivityAt: new Date('2024-02-10'),
    });

    await MsgModel.insertMany([
      { conversationId: conv1._id, sentBy: 'customer', content: 'Ciao!', type: 'text', sentAt: new Date('2024-02-05T10:00:00Z') },
      { conversationId: conv2._id, sentBy: 'ai', content: 'Hello via email', type: 'text', sentAt: new Date('2024-02-10T09:00:00Z') },
    ]);

    const { body } = await request(app.getHttpServer())
      .get(`/customers/${customer._id}/timeline`)
      .expect(200);

    expect(body).toHaveLength(2);
    expect(body[0].channel).toBe('whatsapp');
    expect(body[1].channel).toBe('email');
  });

  // ── RED 2: consecutive same-channel messages merged into one block ───────

  it('merges consecutive same-channel messages into one block', async () => {
    const customer = await CustomerModel.create({
      brandId: BRAND, name: 'Marco', lastActivityAt: new Date('2024-03-10'),
    });

    const conv1 = await ConvModel.create({
      brandId: BRAND, customerId: customer._id, channel: 'whatsapp',
      status: 'managed', type: 'inbound', lastActivityAt: new Date('2024-03-05'),
    });
    const conv2 = await ConvModel.create({
      brandId: BRAND, customerId: customer._id, channel: 'whatsapp',
      status: 'managed', type: 'inbound', lastActivityAt: new Date('2024-03-10'),
    });

    await MsgModel.insertMany([
      { conversationId: conv1._id, sentBy: 'customer', content: 'First', type: 'text', sentAt: new Date('2024-03-05T10:00:00Z') },
      { conversationId: conv2._id, sentBy: 'ai', content: 'Second', type: 'text', sentAt: new Date('2024-03-10T09:00:00Z') },
    ]);

    const { body } = await request(app.getHttpServer())
      .get(`/customers/${customer._id}/timeline`)
      .expect(200);

    expect(body).toHaveLength(1);
    expect(body[0].channel).toBe('whatsapp');
    expect(body[0].messages).toHaveLength(2);
    expect(body[0].messages[0].content).toBe('First');
    expect(body[0].messages[1].content).toBe('Second');
  });

  // ── RED 3: voice block has transcript, empty messages ────────────────────

  it('returns voice block with transcript and no messages', async () => {
    const customer = await CustomerModel.create({
      brandId: BRAND, name: 'Sofia', lastActivityAt: new Date('2024-04-01'),
    });

    await ConvModel.create({
      brandId: BRAND, customerId: customer._id, channel: 'voice',
      status: 'managed', type: 'inbound', lastActivityAt: new Date('2024-04-01'),
      channelData: {
        duration: '3:45',
        outcome: 'Successful',
        transcript: [
          { speaker: 'ai', text: 'Buongiorno!' },
          { speaker: 'customer', text: 'Salve.' },
        ],
      },
    });

    const { body } = await request(app.getHttpServer())
      .get(`/customers/${customer._id}/timeline`)
      .expect(200);

    expect(body).toHaveLength(1);
    expect(body[0].channel).toBe('voice');
    expect(body[0].messages).toHaveLength(0);
    expect(body[0].channelData.duration).toBe('3:45');
    expect(body[0].channelData.outcome).toBe('Successful');
    expect(body[0].channelData.transcript).toHaveLength(2);
    expect(body[0].channelData.transcript[0]).toEqual({ speaker: 'ai', text: 'Buongiorno!' });
  });

  // ── RED 4: invalid customerId → 400 ──────────────────────────────────────

  it('returns 400 for invalid customerId', async () => {
    await request(app.getHttpServer())
      .get('/customers/not-an-id/timeline')
      .expect(400);
  });

  // ── RED 5: unknown customerId → empty array ───────────────────────────────

  it('returns empty array for unknown customerId', async () => {
    const { body } = await request(app.getHttpServer())
      .get(`/customers/${new Types.ObjectId()}/timeline`)
      .expect(200);

    expect(body).toEqual([]);
  });
});
