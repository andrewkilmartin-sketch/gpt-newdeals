import { db, isDbReady, connectionError } from '../db';
import { sql } from 'drizzle-orm';
import { 
  attractions, 
  cinemaMovies, 
  nightinMovies, 
  activities, 
  products 
} from '../../shared/schema';

interface TableCheck {
  name: string;
  table: any;
  minimumRows: number;
}

const REQUIRED_TABLES: TableCheck[] = [
  { name: 'attractions', table: attractions, minimumRows: 100 },
  { name: 'cinema_movies', table: cinemaMovies, minimumRows: 5 },
  { name: 'nightin_movies', table: nightinMovies, minimumRows: 100 },
  { name: 'activities', table: activities, minimumRows: 50 },
  { name: 'products', table: products, minimumRows: 1000 },
];

export async function verifyDatabaseIntegrity(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';
  
  console.log('\n========================================');
  console.log('DATA INTEGRITY CHECK - STARTUP VALIDATION');
  console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log('========================================\n');
  
  // Check if database is available
  if (!isDbReady() || !db) {
    console.warn(`[DB] Database not ready: ${connectionError || 'Connection not established'}`);
    if (isProduction) {
      console.warn('[DB] Skipping integrity check in production - server will start without database');
      return;
    }
    throw new Error(`Database connection failed: ${connectionError}`);
  }
  
  const failures: string[] = [];
  const results: { table: string; count: number; required: number; status: string }[] = [];
  
  for (const check of REQUIRED_TABLES) {
    try {
      const countResult = await db.select({ count: sql<number>`count(*)` }).from(check.table);
      const count = Number(countResult[0]?.count || 0);
      
      const status = count >= check.minimumRows ? 'PASS' : 'FAIL';
      results.push({ table: check.name, count, required: check.minimumRows, status });
      
      if (count < check.minimumRows) {
        failures.push(`${check.name}: Found ${count} rows, required minimum ${check.minimumRows}`);
      }
    } catch (error) {
      const err = error as Error;
      // In production, database connection errors should not block startup
      if (isProduction) {
        console.warn(`[WARN] ${check.name}: Database query failed - ${err.message}`);
        results.push({ table: check.name, count: 0, required: check.minimumRows, status: 'SKIP' });
      } else {
        failures.push(`${check.name}: Database query failed - ${err.message}`);
        results.push({ table: check.name, count: 0, required: check.minimumRows, status: 'ERROR' });
      }
    }
  }
  
  console.log('Table Integrity Results:');
  console.log('------------------------');
  for (const result of results) {
    const icon = result.status === 'PASS' ? '[OK]' : result.status === 'SKIP' ? '[SKIP]' : '[FAIL]';
    console.log(`${icon} ${result.table}: ${result.count} rows (min: ${result.required})`);
  }
  console.log('');
  
  if (failures.length > 0) {
    // In production, warn but don't block
    if (isProduction) {
      console.warn('\n========================================');
      console.warn('WARNING: DATABASE NEEDS SEEDING');
      console.warn('========================================');
      console.warn('Some tables have insufficient data:');
      failures.forEach(f => console.warn(`  - ${f}`));
      console.warn('\nServer will start but some features may not work.');
      console.warn('========================================\n');
      return;
    }
    
    console.error('\n========================================');
    console.error('CRITICAL: DATA INTEGRITY CHECK FAILED');
    console.error('========================================');
    console.error('The following tables have insufficient data:');
    failures.forEach(f => console.error(`  - ${f}`));
    console.error('\nThis application requires a properly seeded database.');
    console.error('Run: npx tsx server/seed-database.ts');
    console.error('\nApplication startup BLOCKED to prevent fake data usage.');
    console.error('========================================\n');
    
    throw new Error(`DATA INTEGRITY FAILURE: ${failures.length} table(s) failed validation. Application cannot start with insufficient real data.`);
  }
  
  console.log('========================================');
  console.log('DATA INTEGRITY CHECK: ALL TABLES VALID');
  console.log('========================================\n');
}

export function logDataSourceFailure(
  endpoint: string, 
  source: string, 
  error: Error | string,
  query?: Record<string, any>
): void {
  const timestamp = new Date().toISOString();
  const errorMsg = error instanceof Error ? error.message : error;
  
  console.error('\n========================================');
  console.error('DATA SOURCE FAILURE - DO NOT IGNORE');
  console.error('========================================');
  console.error(`Timestamp: ${timestamp}`);
  console.error(`Endpoint: ${endpoint}`);
  console.error(`Source: ${source}`);
  console.error(`Error: ${errorMsg}`);
  if (query) {
    console.error(`Query params: ${JSON.stringify(query)}`);
  }
  console.error('========================================\n');
}

export function assertDatabaseResult<T>(
  source: string,
  results: T[],
  allowEmpty: boolean = false
): T[] {
  console.log(`[DB AUDIT] ${source}: Retrieved ${results.length} rows from PostgreSQL`);
  
  if (!allowEmpty && results.length === 0) {
    console.warn(`[DB AUDIT WARNING] ${source}: Query returned 0 results - this may indicate a data issue`);
  }
  
  return results;
}
