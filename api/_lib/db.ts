import { MongoClient, type Db } from 'mongodb';

// Ім'я бази не задане в MONGODB_URI (Atlas дає connection string без path) —
// фіксуємо його тут, щоб не покладатись на дефолт драйвера.
const DB_NAME = 'watchlist';

declare global {
  var __mongoClientPromise: Promise<MongoClient> | undefined;
  var __mongoIndexesPromise: Promise<void> | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  const uri = process.env['MONGODB_URI'];
  if (!uri) {
    throw new Error('MONGODB_URI is not configured');
  }
  if (!globalThis.__mongoClientPromise) {
    globalThis.__mongoClientPromise = new MongoClient(uri).connect();
  }
  return globalThis.__mongoClientPromise;
}

function ensureIndexes(db: Db): Promise<void> {
  if (!globalThis.__mongoIndexesPromise) {
    globalThis.__mongoIndexesPromise = Promise.all([
      db.collection('users').createIndex({ email: 1 }, { unique: true }),
      db.collection('items').createIndex({ userId: 1, id: 1 }, { unique: true }),
    ]).then(() => undefined);
  }
  return globalThis.__mongoIndexesPromise;
}

/** MongoClient з кешем з'єднання в globalThis (serverless-паттерн) + ensure indexes при першому виклику. */
export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  const db = client.db(DB_NAME);
  await ensureIndexes(db);
  return db;
}
