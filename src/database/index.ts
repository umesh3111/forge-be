import { MongoClient, Db } from "mongodb";
import { getConfig } from "../config/config.service";

class DatabaseConnection {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async connect(): Promise<void> {
    if (this.client) {
      return; // Already connected
    }

    const uri = getConfig("MONGODB_URI");
    if (!uri) {
      throw new Error("MONGODB_URI environment variable is required");
    }

    this.client = new MongoClient(uri);
    await this.client.connect();
    
    const dbName = getConfig("DB_NAME");
    if (!dbName) {
      throw new Error("DB_NAME environment variable is required");
    }
    this.db = this.client.db(dbName);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }

  getDb(): Db {
    if (!this.db) {
      throw new Error("Database not connected. Call connect() first.");
    }
    return this.db;
  }

  getClient(): MongoClient {
    if (!this.client) {
      throw new Error("Database not connected. Call connect() first.");
    }
    return this.client;
  }
}

export const database = new DatabaseConnection();
export const getDb = () => database.getDb();
