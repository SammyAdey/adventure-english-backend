import "../load-env";
import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGO_URI?.trim();
if (!uri) {
  throw new Error(
    "MONGO_URI is not set. Add it to backend/.env or backend/.env.local (e.g. mongodb+srv://...).",
  );
}
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