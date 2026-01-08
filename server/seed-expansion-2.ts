// Seed script to add more activities to reach 500 total
// Run with: npx tsx server/seed-expansion-2.ts

import { db } from './db';
import { activities } from '../shared/schema';
import { expansionActivities2 } from './data/activities-expansion-2';
import { eq } from 'drizzle-orm';

async function seedExpansionActivities2() {
  console.log('Adding second batch of expansion activities to database...');
  console.log(`Source: Web research from National Trust, Woodland Trust, Science Buddies, parenting sites`);
  
  let added = 0;
  let skipped = 0;
  
  for (const activity of expansionActivities2) {
    try {
      // Check if activity already exists
      const existing = await db.select().from(activities).where(
        eq(activities.id, activity.id)
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
  
  if (total.length < 500) {
    console.log(`\nNeed ${500 - total.length} more activities to reach 500.`);
  } else {
    console.log(`\nTarget of 500 activities reached!`);
  }
  
  process.exit(0);
}

seedExpansionActivities2().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
