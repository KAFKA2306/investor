import type { PostgresClient } from "../postgres_client.ts";

export abstract class BaseRepository {
  protected readonly db: PostgresClient;

  constructor(db: PostgresClient) {
    this.db = db;
  }
}
