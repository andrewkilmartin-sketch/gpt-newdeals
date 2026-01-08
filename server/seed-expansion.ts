// Seed script to add 361 new activities to database
// Run with: npx tsx server/seed-expansion.ts

import { db } from './db';
import { activities } from '../shared/schema';
import { expansionActivities } from './data/activities-expansion';

async function seedExpansionActivities() {
  console.log('Adding expansion activities to database...');
  console.log(`Source: Web research from National Trust, Woodland Trust, Science Buddies, Good Housekeeping, parenting sites`);
  
  let added = 0;
  let skipped = 0;
  
  for (const activity of expansionActivities) {
    try {
      // Check if activity already exists
      const existing = await db.select().from(activities).where(
        (await import('drizzle-orm')).eq(activities.id, activity.id)
      ).limit(1);
      
      if (existing.length > 0) {
        skipped++;
        continue;
      }
      
      await db.insert(activities).values({
        id: activity.id,
        title: activity.title,
        summary: activity.summary,
        tags: activity.tags,
        ageBands: activity.age_bands,
        supervisionLevel: activity.constraints.supervision,
        noiseLevel: activity.constraints.noise,
        steps: activity.steps,
        variations: activity.variations,
      });
      added++;
    } catch (error) {
      console.error(`Error adding activity ${activity.id}:`, error);
    }
  }
  
  console.log(`\nResults:`);
  console.log(`- Added: ${added} new activities`);
  console.log(`- Skipped: ${skipped} existing activities`);
  
  // Get total count
  const total = await db.select().from(activities);
  console.log(`\nTotal activities in database: ${total.length}`);
  
  process.exit(0);
}

seedExpansionActivities().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
