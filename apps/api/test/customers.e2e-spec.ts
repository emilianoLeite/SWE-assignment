import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { Types, Model } from 'mongoose';
import { CustomersModule } from '../src/customers/customers.module';
import { Customer, Conversation, Message, Operator } from '@textyess/models';

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

  // ── status filter must match the displayed urgencyStatus ────────────────
  // Regression: filtering by ai_controlled was returning customers whose
  // displayed badge was human_controlled (a more urgent status), because the
  // pipeline matched on "at least one conversation in this status" while the
  // returned urgencyStatus reflects the MIN across all conversations.

  it('excludes customers whose displayed urgencyStatus does not match the status filter', async () => {
    const davide = await CustomerModel.create({
      brandId: BRAND, name: 'Davide', lastActivityAt: new Date('2024-05-10'),
    });
    await ConvModel.insertMany([
      { brandId: BRAND, customerId: davide._id, channel: 'voice', status: 'human_controlled', type: 'inbound', lastActivityAt: new Date('2024-05-09') },
      { brandId: BRAND, customerId: davide._id, channel: 'email', status: 'ai_controlled', type: 'inbound', lastActivityAt: new Date('2024-05-10') },
    ]);

    const { body } = await request(app.getHttpServer())
      .get('/customers')
      .query({ brandId: BRAND.toString(), status: 'ai_controlled' })
      .expect(200);

    // Davide's overall urgencyStatus is human_controlled (more urgent than
    // ai_controlled), so he must not appear in the ai_controlled bucket.
    expect(body).toHaveLength(0);
  });

  it('includes a customer in the ai_controlled bucket only when all conversations are at most ai_controlled', async () => {
    const aiOnly = await CustomerModel.create({
      brandId: BRAND, name: 'AiOnly', lastActivityAt: new Date('2024-05-10'),
    });
    await ConvModel.insertMany([
      { brandId: BRAND, customerId: aiOnly._id, channel: 'email', status: 'ai_controlled', type: 'inbound', lastActivityAt: new Date('2024-05-10') },
      { brandId: BRAND, customerId: aiOnly._id, channel: 'whatsapp', status: 'managed', type: 'inbound', lastActivityAt: new Date('2024-05-09') },
    ]);

    const { body } = await request(app.getHttpServer())
      .get('/customers')
      .query({ brandId: BRAND.toString(), status: 'ai_controlled' })
      .expect(200);

    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('AiOnly');
    expect(body[0].urgencyStatus).toBe('ai_controlled');
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

  // ── assigneeId filter ────────────────────────────────────────────────────

  it('filters by specific assigneeId', async () => {
    const op = new Types.ObjectId();
    const assigned = await CustomerModel.create({
      brandId: BRAND, name: 'Assigned', lastActivityAt: new Date('2024-02-20'),
    });
    const unassigned = await CustomerModel.create({
      brandId: BRAND, name: 'Unassigned', lastActivityAt: new Date('2024-02-15'),
    });
    await ConvModel.insertMany([
      { brandId: BRAND, customerId: assigned._id, channel: 'whatsapp', status: 'managed', type: 'inbound', assigneeId: op, lastActivityAt: new Date('2024-02-20') },
      { brandId: BRAND, customerId: unassigned._id, channel: 'email', status: 'managed', type: 'inbound', lastActivityAt: new Date('2024-02-15') },
    ]);

    const { body } = await request(app.getHttpServer())
      .get('/customers')
      .query({ brandId: BRAND.toString(), assigneeId: op.toString() })
      .expect(200);

    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Assigned');
  });

  // ── assigneeId filter must match the resolved (displayed) assignee ───────
  // Regression: filtering by an operator returned customers who had any
  // conversation referencing that operator — even when the customer's
  // resolved assignee (the one shown in the UI) was a different operator.
  // After the "one operator per customer" rule, the filter must match the
  // resolved assignee, not any-conversation.

  it('excludes customers whose resolved assignee does not match the assigneeId filter', async () => {
    const marco = new Types.ObjectId();
    const giulia = new Types.ObjectId();
    const anna = await CustomerModel.create({
      brandId: BRAND, name: 'Anna', lastActivityAt: new Date('2024-02-20'),
    });
    // Anna's resolved assignee is Marco (most-recent non-null assigneeId).
    // A legacy/rule-violating older Giulia conversation must not surface her
    // under Giulia's filter.
    await ConvModel.insertMany([
      { brandId: BRAND, customerId: anna._id, channel: 'whatsapp', status: 'managed', type: 'inbound', assigneeId: marco, lastActivityAt: new Date('2024-02-20') },
      { brandId: BRAND, customerId: anna._id, channel: 'email', status: 'managed', type: 'inbound', assigneeId: giulia, lastActivityAt: new Date('2024-02-10') },
    ]);

    const { body } = await request(app.getHttpServer())
      .get('/customers')
      .query({ brandId: BRAND.toString(), assigneeId: giulia.toString() })
      .expect(200);

    expect(body).toHaveLength(0);
  });

  it('returns the customer when filtering by their resolved assignee', async () => {
    const marco = new Types.ObjectId();
    const anna = await CustomerModel.create({
      brandId: BRAND, name: 'Anna', lastActivityAt: new Date('2024-02-20'),
    });
    await ConvModel.insertMany([
      { brandId: BRAND, customerId: anna._id, channel: 'whatsapp', status: 'managed', type: 'inbound', assigneeId: marco, lastActivityAt: new Date('2024-02-20') },
      { brandId: BRAND, customerId: anna._id, channel: 'voice', status: 'managed', type: 'inbound', lastActivityAt: new Date('2024-02-15') },
    ]);

    const { body } = await request(app.getHttpServer())
      .get('/customers')
      .query({ brandId: BRAND.toString(), assigneeId: marco.toString() })
      .expect(200);

    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Anna');
  });

  it('filters for unassigned conversations when assigneeId=unassigned', async () => {
    const op = new Types.ObjectId();
    const assigned = await CustomerModel.create({
      brandId: BRAND, name: 'Assigned', lastActivityAt: new Date('2024-02-20'),
    });
    const unassigned = await CustomerModel.create({
      brandId: BRAND, name: 'Unassigned', lastActivityAt: new Date('2024-02-15'),
    });
    await ConvModel.insertMany([
      { brandId: BRAND, customerId: assigned._id, channel: 'whatsapp', status: 'managed', type: 'inbound', assigneeId: op, lastActivityAt: new Date('2024-02-20') },
      { brandId: BRAND, customerId: unassigned._id, channel: 'email', status: 'managed', type: 'inbound', lastActivityAt: new Date('2024-02-15') },
    ]);

    const { body } = await request(app.getHttpServer())
      .get('/customers')
      .query({ brandId: BRAND.toString(), assigneeId: 'unassigned' })
      .expect(200);

    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Unassigned');
  });

  // ── campaign filter ───────────────────────────────────────────────────────

  it('filters by campaign', async () => {
    const c1 = await CustomerModel.create({
      brandId: BRAND, name: 'SummerCustomer', lastActivityAt: new Date('2024-03-10'),
    });
    const c2 = await CustomerModel.create({
      brandId: BRAND, name: 'OtherCustomer', lastActivityAt: new Date('2024-03-05'),
    });
    await ConvModel.insertMany([
      { brandId: BRAND, customerId: c1._id, channel: 'whatsapp', status: 'managed', type: 'inbound', campaign: 'summer-sale', lastActivityAt: new Date('2024-03-10') },
      { brandId: BRAND, customerId: c2._id, channel: 'email', status: 'managed', type: 'inbound', campaign: 'newsletter', lastActivityAt: new Date('2024-03-05') },
    ]);

    const { body } = await request(app.getHttpServer())
      .get('/customers')
      .query({ brandId: BRAND.toString(), campaign: 'summer-sale' })
      .expect(200);

    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('SummerCustomer');
  });

  // ── date-range filter (from / to) ─────────────────────────────────────────

  it('filters by lastActivityAt date range', async () => {
    const recent = await CustomerModel.create({
      brandId: BRAND, name: 'Recent', lastActivityAt: new Date('2024-06-15'),
    });
    const old = await CustomerModel.create({
      brandId: BRAND, name: 'Old', lastActivityAt: new Date('2024-01-05'),
    });
    await ConvModel.insertMany([
      { brandId: BRAND, customerId: recent._id, channel: 'whatsapp', status: 'managed', type: 'inbound', lastActivityAt: new Date('2024-06-15') },
      { brandId: BRAND, customerId: old._id, channel: 'email', status: 'managed', type: 'inbound', lastActivityAt: new Date('2024-01-05') },
    ]);

    const { body } = await request(app.getHttpServer())
      .get('/customers')
      .query({ brandId: BRAND.toString(), from: '2024-06-01', to: '2024-07-01' })
      .expect(200);

    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Recent');
  });

  // ── date filter must match the displayed lastActivityAt ─────────────────
  // Regression: a customer with an older conversation inside the window was
  // returned even when their customer.lastActivityAt (the value shown in the
  // list) was outside it. The date filter must match the displayed last
  // activity, not "any conversation in this window".

  it('excludes a customer whose displayed lastActivityAt is outside the window, even if an older conversation falls inside it', async () => {
    const roberto = await CustomerModel.create({
      brandId: BRAND, name: 'Roberto', lastActivityAt: new Date('2026-05-07'),
    });
    await ConvModel.insertMany([
      { brandId: BRAND, customerId: roberto._id, channel: 'whatsapp', status: 'blocked', type: 'inbound', lastActivityAt: new Date('2026-05-05') },
      { brandId: BRAND, customerId: roberto._id, channel: 'onsite', status: 'ai_controlled', type: 'outbound', lastActivityAt: new Date('2026-05-07') },
    ]);

    const { body } = await request(app.getHttpServer())
      .get('/customers')
      .query({ brandId: BRAND.toString(), from: '2026-05-01', to: '2026-05-06' })
      .expect(200);

    expect(body).toHaveLength(0);
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

describe('GET /customers/:id (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let CustomerModel: CM;
  let ConvModel: ConvM;
  let OperatorModel: Model<Operator>;

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
    OperatorModel = module.get<Model<Operator>>(getModelToken(Operator.name));
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await CustomerModel.deleteMany({});
    await ConvModel.deleteMany({});
    await OperatorModel.deleteMany({});
  });

  it('returns full customer fields', async () => {
    const c = await CustomerModel.create({
      brandId: BRAND,
      name: 'Lucia',
      email: 'lucia@example.com',
      phone: '+39 333 123456',
      lifetimeSpend: 420.5,
      tags: ['vip', 'loyal'],
      notes: 'Prefers morning calls',
      lastOrder: { id: 'ORD-001', placedAt: new Date('2024-06-01') },
      lastActivityAt: new Date('2024-06-10'),
    });

    const { body } = await request(app.getHttpServer())
      .get(`/customers/${c._id}`)
      .expect(200);

    expect(body).toMatchObject({
      name: 'Lucia',
      email: 'lucia@example.com',
      phone: '+39 333 123456',
      lifetimeSpend: 420.5,
      tags: ['vip', 'loyal'],
      notes: 'Prefers morning calls',
      createdAt: expect.any(String),
    });
    expect(body.lastOrder).toMatchObject({ id: 'ORD-001', placedAt: expect.any(String) });
  });

  // ── assignee resolution (one operator per customer) ──────────────────────

  it('returns the assignee resolved from any of the customer\'s conversations', async () => {
    const marco = await OperatorModel.create({ name: 'Marco Rossi', email: 'marco@x.com' });
    const c = await CustomerModel.create({
      brandId: BRAND, name: 'Anna', lastActivityAt: new Date('2024-06-10'),
    });
    // Business rule: all of a customer's conversations share the same assigneeId.
    await ConvModel.insertMany([
      { brandId: BRAND, customerId: c._id, channel: 'whatsapp', status: 'managed', type: 'inbound', assigneeId: marco._id, lastActivityAt: new Date('2024-06-09') },
      { brandId: BRAND, customerId: c._id, channel: 'email', status: 'managed', type: 'inbound', assigneeId: marco._id, lastActivityAt: new Date('2024-06-10') },
    ]);

    const { body } = await request(app.getHttpServer())
      .get(`/customers/${c._id}`)
      .expect(200);

    expect(body.assignee).toEqual({ _id: marco._id.toString(), name: 'Marco Rossi' });
  });

  it('resolves assignee to the operator on the most recent assigned conversation', async () => {
    // Defends the rule-violation case: if a customer ends up with mixed
    // assigneeIds across conversations, the detail view must pick the same
    // operator the list filter would, i.e. the most-recent assigned one.
    const marco = await OperatorModel.create({ name: 'Marco Rossi', email: 'marco2@x.com' });
    const giulia = await OperatorModel.create({ name: 'Giulia Bianchi', email: 'giulia@x.com' });
    const c = await CustomerModel.create({
      brandId: BRAND, name: 'Anna', lastActivityAt: new Date('2024-06-10'),
    });
    await ConvModel.insertMany([
      { brandId: BRAND, customerId: c._id, channel: 'email', status: 'managed', type: 'inbound', assigneeId: giulia._id, lastActivityAt: new Date('2024-06-01') },
      { brandId: BRAND, customerId: c._id, channel: 'whatsapp', status: 'managed', type: 'inbound', assigneeId: marco._id, lastActivityAt: new Date('2024-06-10') },
    ]);

    const { body } = await request(app.getHttpServer())
      .get(`/customers/${c._id}`)
      .expect(200);

    expect(body.assignee).toEqual({ _id: marco._id.toString(), name: 'Marco Rossi' });
  });

  it('returns assignee: null when all of the customer\'s conversations are unassigned', async () => {
    const c = await CustomerModel.create({
      brandId: BRAND, name: 'Roberto', lastActivityAt: new Date('2024-06-10'),
    });
    await ConvModel.insertMany([
      { brandId: BRAND, customerId: c._id, channel: 'whatsapp', status: 'managed', type: 'inbound', lastActivityAt: new Date('2024-06-10') },
    ]);

    const { body } = await request(app.getHttpServer())
      .get(`/customers/${c._id}`)
      .expect(200);

    expect(body.assignee).toBeNull();
  });

  it('returns assignee: null when the customer has no conversations', async () => {
    const c = await CustomerModel.create({
      brandId: BRAND, name: 'NewCustomer', lastActivityAt: new Date('2024-06-10'),
    });

    const { body } = await request(app.getHttpServer())
      .get(`/customers/${c._id}`)
      .expect(200);

    expect(body.assignee).toBeNull();
  });

  it('returns 404 for unknown customer id', async () => {
    await request(app.getHttpServer())
      .get(`/customers/${new Types.ObjectId()}`)
      .expect(404);
  });

  it('returns 400 for invalid id', async () => {
    await request(app.getHttpServer())
      .get('/customers/not-an-id')
      .expect(400);
  });
});

// The FilterPanel's Tags chip list previously derived its options from the
// currently-loaded (filter-narrowed) customer list. Clicking a tag therefore
// collapsed the list of available tags to only those carried by the matching
// customers — every other tag visibly disappeared. The fix exposes the full
// brand-wide tag set as a dedicated endpoint that the frontend can consume
// independently of any filter state.
describe('GET /customers/tags (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let CustomerModel: CM;

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
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await CustomerModel.deleteMany({});
  });

  it('returns every distinct tag carried by any customer of the brand, sorted', async () => {
    await CustomerModel.create([
      { brandId: BRAND, name: 'A', tags: ['vip', 'loyal'], lastActivityAt: new Date('2024-01-01') },
      { brandId: BRAND, name: 'B', tags: ['vip', 'churn-risk'], lastActivityAt: new Date('2024-01-02') },
      { brandId: BRAND, name: 'C', tags: [], lastActivityAt: new Date('2024-01-03') },
    ]);

    const { body } = await request(app.getHttpServer())
      .get('/customers/tags')
      .query({ brandId: BRAND.toString() })
      .expect(200);

    expect(body).toEqual(['churn-risk', 'loyal', 'vip']);
  });

  it('does not leak tags from other brands', async () => {
    await CustomerModel.create([
      { brandId: BRAND, name: 'Ours', tags: ['ours'], lastActivityAt: new Date('2024-01-01') },
      { brandId: OTHER_BRAND, name: 'Theirs', tags: ['theirs'], lastActivityAt: new Date('2024-01-01') },
    ]);

    const { body } = await request(app.getHttpServer())
      .get('/customers/tags')
      .query({ brandId: BRAND.toString() })
      .expect(200);

    expect(body).toEqual(['ours']);
  });

  it('returns 400 when brandId is missing', async () => {
    await request(app.getHttpServer()).get('/customers/tags').expect(400);
  });
});
