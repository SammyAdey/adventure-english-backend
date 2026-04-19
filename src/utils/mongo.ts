import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGO_URI as string; // Store this in .env
const client = new MongoClient(uri);

let db: Db;

export const connectToDatabase = async () => {
  if (!db) {
    await client.connect();
    db = client.db(); // or client.db('your-db-name')
    console.log('✅ Connected to MongoDB');
  }
  return db;
};