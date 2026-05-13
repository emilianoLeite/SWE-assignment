import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { Types, Model } from 'mongoose';
import { CustomersModule } from '../src/customers/customers.module';
import { Customer } from '@textyess/models';
import { Conversation } from '@textyess/models';

const BRAND = new Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa');
const OTHER_BRAND = new Types.ObjectId('bbbbbbbbbbbbbbbbbbbbbbbb');

type CM = Model<Customer>;
type ConvM = Model<Conversation>;

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
