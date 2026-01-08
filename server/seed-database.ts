import { db } from './db';
import { attractions, cinemaMovies, nightinMovies, activities, products } from '../shared/schema';
import { attractionsData } from './data/attractions';
import { UK_CINEMA_MOVIES } from './data/cinema';
import { ALL_NIGHTIN_MOVIES } from './data/nightin-movies';
import { familyPlaybook } from './data/family-playbook';
import { createReadStream, existsSync } from 'fs';
import { createInterface } from 'readline';
import { resolve } from 'path';

async function seedAttractions() {
  console.log('Seeding attractions...');
  const count = await db.select().from(attractions).limit(1);
  if (count.length > 0) {
    console.log('Attractions already seeded, skipping');
    return;
  }
  
  for (const attr of attractionsData) {
    await db.insert(attractions).values({
      id: attr.id,
      name: attr.name,
      description: attr.description,
      category: attr.category,
      location: attr.location,
      address: attr.address,
      openingHours: attr.openingHours,
      ticketPrice: attr.ticketPrice,
      familyFriendly: attr.familyFriendly,
      rating: attr.rating,
      website: attr.website || null,
      highlights: attr.highlights,
    });
  }
  console.log(`Seeded ${attractionsData.length} attractions`);
}

async function seedCinema() {
  console.log('Seeding cinema movies...');
  const count = await db.select().from(cinemaMovies).limit(1);
  if (count.length > 0) {
    console.log('Cinema already seeded, skipping');
    return;
  }
  
  for (const movie of UK_CINEMA_MOVIES) {
    await db.insert(cinemaMovies).values({
      id: movie.id,
      title: movie.title,
      synopsis: movie.synopsis,
      poster: movie.poster,
      backdrop: movie.backdrop,
      releaseDate: movie.releaseDate,
      rating: movie.rating,
      bbfcRating: movie.bbfcRating,
      genres: movie.genres,
      runtime: movie.runtime,
      cast: movie.cast,
      director: movie.director,
      tagline: movie.tagline,
      status: movie.status,
      trailerUrl: movie.trailerUrl,
    });
  }
  console.log(`Seeded ${UK_CINEMA_MOVIES.length} cinema movies`);
}

async function seedNightinMovies() {
  console.log('Seeding night-in movies...');
  const count = await db.select().from(nightinMovies).limit(1);
  if (count.length > 0) {
    console.log('Night-in movies already seeded, skipping');
    return;
  }
  
  for (const movie of ALL_NIGHTIN_MOVIES) {
    const isFamilyFriendly = ['U', 'PG', '12', '12A'].includes(movie.rating);
    await db.insert(nightinMovies).values({
      id: movie.id,
      title: movie.title,
      year: movie.year,
      synopsis: movie.synopsis,
      genres: movie.genres,
      rating: movie.rating,
      imdbScore: movie.imdbScore,
      runtime: movie.runtime,
      streamingServices: movie.streamingServices,
      mood: movie.mood,
      cast: movie.cast,
      director: movie.director,
      familyFriendly: isFamilyFriendly,
      poster: null,
    });
  }
  console.log(`Seeded ${ALL_NIGHTIN_MOVIES.length} night-in movies`);
}

async function seedActivities() {
  console.log('Seeding activities...');
  const count = await db.select().from(activities).limit(1);
  if (count.length > 0) {
    console.log('Activities already seeded, skipping');
    return;
  }
  
  for (const activity of familyPlaybook.chunks) {
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
  }
  console.log(`Seeded ${familyPlaybook.chunks.length} activities`);
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parsePrice(priceStr: string): number {
  const cleaned = priceStr.replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}

function extractBrand(name: string, merchant: string): string {
  const commonBrands = ['LEGO', 'Disney', 'Marvel', 'Barbie', 'Hot Wheels', 'Nerf', 'Nintendo', 'PlayStation', 'Xbox', 'Pokemon'];
  const nameLower = name.toLowerCase();
  for (const brand of commonBrands) {
    if (nameLower.includes(brand.toLowerCase())) return brand;
  }
  return merchant;
}

async function seedProducts() {
  console.log('Seeding products from CSV...');
  const count = await db.select().from(products).limit(1);
  if (count.length > 0) {
    console.log('Products already seeded, skipping');
    return;
  }
  
  const possiblePaths = [
    resolve(process.cwd(), 'server/data/products.csv'),
    resolve(process.cwd(), 'dist/data/products.csv'),
    resolve(process.cwd(), 'data/products.csv'),
  ];
  
  let filePath = '';
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      filePath = path;
      break;
    }
  }
  
  if (!filePath) {
    console.error('ERROR: products.csv not found!');
    return;
  }
  
  console.log(`Reading products from: ${filePath}`);
  
  const stream = createReadStream(filePath, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  
  let isHeader = true;
  let lineCount = 0;
  let batchCount = 0;
  const BATCH_SIZE = 500;
  let batch: any[] = [];
  
  for await (const line of rl) {
    if (isHeader) {
      isHeader = false;
      continue;
    }
    
    lineCount++;
    
    try {
      const cols = parseCSVLine(line);
      
      const affiliateLink = cols[0] || '';
      const name = cols[1] || '';
      const id = cols[2] || `prod-${lineCount}`;
      const imageUrl = cols[4] || cols[12] || '';
      const description = cols[5] || '';
      const merchantCategory = cols[6] || '';
      const price = parsePrice(cols[7] || '');
      const merchant = cols[8] || '';
      const merchantId = parseInt(cols[9]) || 0;
      const category = cols[10] || merchantCategory || '';
      const brand = extractBrand(name, merchant);
      const numAvailable = parseInt(cols[31]) || 0;
      const inStock = numAvailable > 0 || !cols[31];
      
      if (!name || !affiliateLink || !merchant) continue;
      
      batch.push({
        id,
        name,
        description: description || null,
        merchant,
        merchantId,
        category: category || null,
        brand: brand || null,
        price,
        affiliateLink,
        imageUrl: imageUrl || null,
        inStock,
      });
      
      if (batch.length >= BATCH_SIZE) {
        await db.insert(products).values(batch);
        batchCount++;
        if (batchCount % 20 === 0) {
          console.log(`Inserted ${batchCount * BATCH_SIZE} products...`);
        }
        batch = [];
      }
    } catch (err) {
      // Skip invalid lines
    }
  }
  
  if (batch.length > 0) {
    await db.insert(products).values(batch);
  }
  
  console.log(`Seeded ${lineCount} products`);
}

export async function seedDatabase() {
  console.log('=== Starting database seed ===');
  
  try {
    await seedAttractions();
    await seedCinema();
    await seedNightinMovies();
    await seedActivities();
    await seedProducts();
    
    console.log('=== Database seed complete ===');
  } catch (error) {
    console.error('Seed error:', error);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
