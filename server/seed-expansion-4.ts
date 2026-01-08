// Seed script to add final 63 activities to reach 500 total
// Run with: npx tsx server/seed-expansion-4.ts

import { db } from './db';
import { activities } from '../shared/schema';
import { expansionActivities4 } from './data/activities-expansion-4';
import { eq } from 'drizzle-orm';

async function seedExpansionActivities4() {
  console.log('Adding final batch of activities to reach 500...');
  console.log(`Source: Web research from National Trust, Woodland Trust, parenting sites`);
  
  let added = 0;
  let skipped = 0;
  
  for (const activity of expansionActivities4) {
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
  
  if (total.length >= 500) {
    console.log(`\n*** TARGET REACHED: ${total.length} activities! ***`);
  } else {
    console.log(`\nNeed ${500 - total.length} more activities to reach 500.`);
  }
  
  process.exit(0);
}

seedExpansionActivities4().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
