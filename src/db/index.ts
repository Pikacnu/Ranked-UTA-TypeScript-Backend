import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';

export * from './schema';

const bundb = new Database(Bun.env.DB_FILE_NAME!);
const drizzledb = drizzle({ client: bundb });

export default drizzledb;
