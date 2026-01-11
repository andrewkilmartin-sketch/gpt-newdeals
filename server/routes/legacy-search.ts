import { Express } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { fetchAwinProducts, isAwinConfigured } from '../services/awin';

const STREAMING_SERVICES = ['Netflix', 'Prime Video', 'Disney+', 'Apple TV+', 'Sky', 'NOW', 'MUBI'];

const searchQuerySchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  location: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(10),
  age: z.string().optional(),
  energy: z.string().optional(),
  setting: z.string().optional()
});

function getCategoryFromTags(tags: string[]): string {
  const catTags = ['CAR', 'RAINY', 'BUSY', 'CHORES', 'BED', 'MORNING', 'HOMEWORK', 'FEELINGS', 'CRAFT', 'BUILD', 'LEGO'];
  for (const t of tags) {
    const upper = t.toUpperCase();
    for (const cat of catTags) {
      if (upper.includes(cat)) return cat.toLowerCase();
    }
  }
  return 'general';
}

function getAgeRange(ageBands: string[]): string {
  if (!ageBands || ageBands.length === 0) return 'all ages';
  return ageBands.join(', ');
}

function decodeTag(tag: string): string {
  const tagMap: Record<string, string> = {
    'ELOW': 'Low Energy', 'EMED': 'Medium Energy', 'EHIGH': 'High Energy',
    'INDOOR': 'Indoor', 'OUTDOOR': 'Outdoor', 'CAR': 'Car Activity',
    'RAINY': 'Rainy Day', 'BUSY': 'Keep Busy', 'CHORES': 'Chores',
    'BED': 'Bedtime', 'MORNING': 'Morning', 'HOMEWORK': 'Homework',
    'FEELINGS': 'Big Feelings', 'CRAFT': 'Craft', 'BUILD': 'Building', 'LEGO': 'LEGO'
  };
  return tagMap[tag.toUpperCase()] || tag;
}

export function registerLegacySearchRoutes(app: Express): void {
  app.get("/shopping/awin-link", async (req, res) => {
    try {
      const query = searchQuerySchema.parse({
        query: req.query.query,
        category: req.query.category,
        limit: req.query.limit
      });
      
      let deals: Awaited<ReturnType<typeof fetchAwinProducts>> = [];
      let dataSource = "awin";
      
      if (isAwinConfigured()) {
        deals = await fetchAwinProducts(query.query, query.category, query.limit);
      }
      
      if (deals.length === 0) {
        console.log(`Shopping search returned 0 results for query="${query.query}" category="${query.category}"`);
      }
      
      const message = deals.length > 0
        ? deals.map(d => 
            `${d.title} - £${d.salePrice || d.originalPrice}\n${d.merchant}\n${d.affiliateLink}`
          ).join('\n\n')
        : `No products found for "${query.query || 'all'}". Try a different search term.`;
      
      res.json({
        success: true,
        endpoint: "/shopping/awin-link",
        description: "Shopping deals and affiliate links",
        count: deals.length,
        dataSource: dataSource,
        message: message,
        filters: {
          query: query.query || null,
          category: query.category || null,
          limit: query.limit
        },
        results: deals
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/cinema/search", async (req, res) => {
    try {
      const query = searchQuerySchema.parse({
        query: req.query.query,
        category: req.query.genre || req.query.category,
        limit: req.query.limit
      });
      
      const familyOnly = req.query.family !== 'false';
      
      const movies = await storage.searchCinemaMovies(
        query.query,
        familyOnly,
        query.limit
      );
      
      res.json({
        success: true,
        endpoint: "/cinema/search",
        description: "UK cinema movies - now playing and upcoming releases",
        count: movies.length,
        dataSource: "database",
        lastUpdated: "2026-01-04",
        filters: {
          query: query.query || null,
          genre: query.category || null,
          familyFriendly: familyOnly,
          limit: query.limit
        },
        results: movies
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/attractions/search", async (req, res) => {
    try {
      const query = searchQuerySchema.parse({
        query: req.query.query,
        category: req.query.category,
        location: req.query.location,
        limit: req.query.limit
      });
      
      const attractions = await storage.getAttractions(query);
      
      res.json({
        success: true,
        endpoint: "/attractions/search",
        description: "Local attractions and days out",
        count: attractions.length,
        filters: {
          query: query.query || null,
          category: query.category || null,
          location: query.location || null,
          limit: query.limit
        },
        results: attractions
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/attractions/free", async (req, res) => {
    try {
      const query = searchQuerySchema.parse({
        query: req.query.query,
        category: req.query.category,
        location: req.query.location,
        limit: req.query.limit
      });
      
      const attractions = await storage.searchFreeAttractions(
        query.query || '',
        query.location,
        query.category,
        query.limit
      );
      
      res.json({
        success: true,
        endpoint: "/attractions/free",
        description: "Free attractions and activities (no entry fee or price not available)",
        count: attractions.length,
        totalAvailable: 3694,
        dataSource: "database",
        filters: {
          query: query.query || null,
          category: query.category || null,
          location: query.location || null,
          limit: query.limit
        },
        results: attractions
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/recommendations/search", async (req, res) => {
    try {
      const query = searchQuerySchema.parse({
        query: req.query.query,
        category: req.query.category,
        limit: req.query.limit
      });
      
      const recommendations = await storage.searchRecommendations(
        query.query,
        query.category,
        query.limit
      );
      
      res.json({
        success: true,
        endpoint: "/recommendations/search",
        description: "Community-sourced venue recommendations with mention counts",
        count: recommendations.length,
        totalAvailable: 179,
        dataSource: "database",
        filters: {
          query: query.query || null,
          category: query.category || null,
          limit: query.limit
        },
        results: recommendations
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/events/search", async (req, res) => {
    try {
      const query = searchQuerySchema.parse({
        query: req.query.query,
        category: req.query.category,
        location: req.query.city || req.query.location,
        limit: req.query.limit
      });
      
      const family = req.query.family === 'true';
      
      const events = await storage.searchEvents(
        query.query,
        query.location,
        query.category,
        query.limit,
        family
      );
      
      res.json({
        success: true,
        endpoint: "/events/search",
        description: "Family events, shows, and live entertainment",
        count: events.length,
        totalAvailable: 798,
        dataSource: "database",
        filters: {
          query: query.query || null,
          city: query.location || null,
          category: query.category || null,
          limit: query.limit
        },
        results: events
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/restaurants/search", async (req, res) => {
    try {
      const query = searchQuerySchema.parse({
        query: req.query.query,
        category: req.query.category,
        location: req.query.city || req.query.location,
        limit: req.query.limit
      });
      
      const chain = req.query.chain as string | undefined;
      
      const restaurants = await storage.searchRestaurants(
        query.query,
        query.location,
        chain,
        query.limit
      );
      
      res.json({
        success: true,
        endpoint: "/restaurants/search",
        description: "Family-friendly restaurants with kids menus and facilities",
        count: restaurants.length,
        totalAvailable: 838,
        dataSource: "database",
        filters: {
          query: query.query || null,
          city: query.location || null,
          chain: chain || null,
          limit: query.limit
        },
        results: restaurants
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/nightin/search", async (req, res) => {
    try {
      const query = searchQuerySchema.parse({
        query: req.query.query,
        category: req.query.genre || req.query.category,
        limit: req.query.limit
      });
      
      const streamingService = req.query.service as string | undefined;
      const mood = req.query.mood as string | undefined;
      const familyOnly = req.query.family !== 'false';
      
      const movies = await storage.searchNightinMovies(
        query.query,
        streamingService,
        mood,
        familyOnly,
        query.limit
      );
      
      res.json({
        success: true,
        endpoint: "/nightin/search",
        description: "Movies to watch at home - streaming on Netflix, Prime Video, Disney+, Apple TV+, Sky/NOW and more",
        count: movies.length,
        totalAvailable: 500,
        dataSource: "database",
        lastUpdated: "2026-01-04",
        filters: {
          query: query.query || null,
          genre: query.category || null,
          service: streamingService || null,
          mood: mood || null,
          familyFriendly: familyOnly,
          limit: query.limit
        },
        availableServices: STREAMING_SERVICES,
        results: movies
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/hintsandtips/search", async (req, res) => {
    try {
      const query = searchQuerySchema.parse({
        query: req.query.query,
        category: req.query.category,
        limit: req.query.limit
      });
      
      const tips = await storage.getHintsAndTips(query);
      
      res.json({
        success: true,
        endpoint: "/hintsandtips/search",
        description: "Money-saving hints and tips",
        count: tips.length,
        filters: {
          query: query.query || null,
          category: query.category || null,
          limit: query.limit
        },
        results: tips
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/activities/search", async (req, res) => {
    try {
      const query = searchQuerySchema.parse({
        query: req.query.query,
        category: req.query.category,
        age: req.query.age,
        energy: req.query.energy,
        setting: req.query.setting,
        limit: req.query.limit
      });
      
      let dbActivities = await storage.searchActivities(
        query.query,
        query.age,
        50
      );
      
      if (query.category) {
        const catUpper = query.category.toUpperCase().replace(/ /g, "_");
        dbActivities = dbActivities.filter(act => 
          act.tags.some((tag: string) => tag.toUpperCase().includes(catUpper))
        );
      }
      
      if (query.energy) {
        const energyTag = `E${query.energy.toUpperCase()}`;
        dbActivities = dbActivities.filter(act => 
          act.tags.includes(energyTag)
        );
      }
      
      if (query.setting) {
        const settingTag = query.setting.toUpperCase();
        dbActivities = dbActivities.filter(act => 
          act.tags.some((tag: string) => tag.toUpperCase().includes(settingTag))
        );
      }
      
      const results = dbActivities.slice(0, query.limit).map(act => ({
        id: act.id,
        title: act.title,
        summary: act.summary,
        tags: act.tags,
        age_bands: act.ageBands,
        constraints: {
          supervision: act.supervisionLevel,
          noise: act.noiseLevel
        },
        steps: act.steps,
        variations: act.variations,
        category: getCategoryFromTags(act.tags),
        ageRange: getAgeRange(act.ageBands),
        decodedTags: act.tags.map((t: string) => decodeTag(t))
      }));
      
      res.json({
        success: true,
        endpoint: "/activities/search",
        description: "Family activities from the Sunny Playbook",
        count: results.length,
        totalAvailable: 500,
        dataSource: "database",
        filters: {
          query: query.query || null,
          category: query.category || null,
          age: query.age || null,
          energy: query.energy || null,
          setting: query.setting || null,
          limit: query.limit
        },
        results: results
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}
