import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { Model } from 'mongoose';
import { OperatorsModule } from '../src/operators/operators.module';
import { Operator } from '@textyess/models';

type OpM = Model<Operator>;

describe('GET /operators (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let OperatorModel: OpM;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const module = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        OperatorsModule,
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    OperatorModel = module.get<OpM>(getModelToken(Operator.name));
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  beforeEach(async () => {
    await OperatorModel.deleteMany({});
  });

  it('returns all operators with _id and name', async () => {
    await OperatorModel.insertMany([
      { name: 'Marco Rossi', email: 'marco@textyess.com' },
      { name: 'Giulia Bianchi', email: 'giulia@textyess.com' },
    ]);

    const { body } = await request(app.getHttpServer())
      .get('/operators')
      .expect(200);

    expect(body).toHaveLength(2);
    expect(body[0]).toHaveProperty('_id');
    expect(body[0]).toHaveProperty('name');
    expect(body.map((o: { name: string }) => o.name)).toEqual(
      expect.arrayContaining(['Marco Rossi', 'Giulia Bianchi']),
    );
  });

  it('returns empty array when no operators exist', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/operators')
      .expect(200);

    expect(body).toEqual([]);
  });
});
