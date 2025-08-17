import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { config } from '../config';

// Database connection configuration
const connectionString = config.database.url;

// Create the connection
const queryClient = postgres(connectionString, {
  max: 10, // Maximum number of connections in the pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
});

// Create Drizzle instance
export const db = drizzle(queryClient, { schema });

// Export the query client for direct queries if needed
export { queryClient };

// Health check function
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await queryClient`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  await queryClient.end();
}
