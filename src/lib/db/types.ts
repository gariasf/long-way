// Database adapter types
// Entity types are re-exported from schemas.ts

export type {
  Trip,
  Stop,
  StopRow,
  Message,
  Conversation,
  StopType,
  TransportType,
  DurationUnit,
  CreateStopRequest,
  UpdateStopRequest,
} from '../schemas';

export { rowToStop, stopToRow } from '../schemas';

// Database adapter interface
export interface DbAdapter {
  /**
   * Execute a query and return all matching rows
   */
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;

  /**
   * Execute a query and return the first row or null
   */
  queryOne<T>(sql: string, params?: unknown[]): Promise<T | null>;

  /**
   * Execute a statement (INSERT/UPDATE/DELETE) and return affected row count
   */
  execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }>;

  /**
   * Execute multiple statements in a transaction
   */
  transaction<T>(fn: (adapter: DbAdapter) => Promise<T>): Promise<T>;

  /**
   * Close the database connection
   */
  close(): Promise<void>;

  /**
   * Initialize the database schema
   */
  initSchema(): Promise<void>;

  /**
   * Get the dialect for SQL generation
   */
  readonly dialect: 'sqlite' | 'postgres';
}

// Conversation row as stored in database
export interface ConversationRow {
  id: string;
  trip_id: string;
  messages: string; // JSON string
  created_at: string;
  updated_at: string;
}
