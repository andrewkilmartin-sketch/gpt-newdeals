import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function dailyClickAnalysis() {
  console.log('=== DAILY CLICK ANALYSIS ===');
  console.log(`Date: ${new Date().toISOString()}\n`);

  try {
    // Total clicks today
    const today = await db.execute(sql.raw(`
      SELECT COUNT(*) as total_clicks,
             COUNT(DISTINCT query) as unique_queries,
             COUNT(DISTINCT session_id) as unique_sessions,
             ROUND(AVG(position)::numeric, 2) as avg_click_position
      FROM click_logs
      WHERE timestamp > NOW() - INTERVAL '24 hours'
    `));
    console.log('=== TODAY\'S STATS (last 24 hours) ===');
    console.log(JSON.stringify((today as any[])[0], null, 2));

    // All-time stats
    const allTime = await db.execute(sql.raw(`
      SELECT COUNT(*) as total_clicks,
             COUNT(DISTINCT query) as unique_queries,
             COUNT(DISTINCT session_id) as unique_sessions,
             ROUND(AVG(position)::numeric, 2) as avg_click_position
      FROM click_logs
    `));
    console.log('\n=== ALL-TIME STATS ===');
    console.log(JSON.stringify((allTime as any[])[0], null, 2));

    // Queries where avg click position > 3 = RANKING ISSUES
    const rankingIssues = await db.execute(sql.raw(`
      SELECT query, ROUND(AVG(position)::numeric, 1) as avg_position, COUNT(*) as clicks
      FROM click_logs
      WHERE position IS NOT NULL
      GROUP BY query
      HAVING AVG(position) > 3 AND COUNT(*) >= 3
      ORDER BY AVG(position) DESC
      LIMIT 20
    `));
    
    console.log('\n=== RANKING ISSUES (users clicking past result #3) ===');
    if ((rankingIssues as any[]).length === 0) {
      console.log('  No ranking issues detected yet (need more data)');
    } else {
      (rankingIssues as any[]).forEach((r: any) => {
        console.log(`  "${r.query}" → avg click position: ${r.avg_position} (${r.clicks} clicks)`);
      });
    }

    // Most popular queries
    const topQueries = await db.execute(sql.raw(`
      SELECT query, COUNT(*) as clicks
      FROM click_logs
      GROUP BY query
      ORDER BY clicks DESC
      LIMIT 20
    `));
    
    console.log('\n=== TOP QUERIES ===');
    (topQueries as any[]).forEach((r: any, i: number) => {
      console.log(`  ${i + 1}. "${r.query}" (${r.clicks} clicks)`);
    });

    // Most clicked products
    const topProducts = await db.execute(sql.raw(`
      SELECT product_name, product_merchant, COUNT(*) as clicks
      FROM click_logs
      GROUP BY product_name, product_merchant
      ORDER BY clicks DESC
      LIMIT 20
    `));
    
    console.log('\n=== TOP PRODUCTS ===');
    (topProducts as any[]).forEach((r: any, i: number) => {
      console.log(`  ${i + 1}. "${r.product_name}" from ${r.product_merchant} (${r.clicks} clicks)`);
    });

    // Device breakdown
    const devices = await db.execute(sql.raw(`
      SELECT device_type, COUNT(*) as clicks,
             ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) as percentage
      FROM click_logs
      GROUP BY device_type
      ORDER BY clicks DESC
    `));
    
    console.log('\n=== DEVICE BREAKDOWN ===');
    (devices as any[]).forEach((r: any) => {
      console.log(`  ${r.device_type}: ${r.clicks} clicks (${r.percentage}%)`);
    });

    console.log('\n=== ANALYSIS COMPLETE ===');
  } catch (error) {
    console.error('Analysis error:', error);
    process.exit(1);
  }
}

dailyClickAnalysis().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
