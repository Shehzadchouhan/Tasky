import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterEach, afterAll } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_key_for_vitest_supertest_testing_12345';
process.env.JWT_EXPIRES_IN = '7d';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create({
    instance: {
      launchTimeout: 120000,
    },
  });
  const uri = mongod.getUri();
  await mongoose.connect(uri);
}, 120000);

afterEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongod) {
    await mongod.stop();
  }
}, 30000);
