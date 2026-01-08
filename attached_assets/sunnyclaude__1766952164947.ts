// ============================================
// SUNNY.TS - Family Concierge Chat Endpoint
// ============================================
// 
// INSTRUCTIONS:
// 1. Download this file
// 2. Drag it into your Replit project (in the same folder as your other .ts files)
// 3. Open your main server file (index.ts or server.ts or app.ts)
// 4. Add this line near the top with other imports:
//    import sunnyRouter from './sunny';
// 5. Add this line where you see other app.use() lines:
//    app.use('/sunny', sunnyRouter);
// 6. Test by visiting: https://your-replit-url/sunny/health
//
// ============================================

import express, { Router, Request, Response } from 'express';
import OpenAI from 'openai';

const router: Router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const API_BASE = 'https://endpoint-weaver--rcxpysgzgc.replit.app';

// Intent types
interface Intent {
  type: string;
  confidence: number;
  parameters: {
    query?: string;
    location?: string;
    category?: string;
    limit?: number;
  };
}

interface Classification {
  intents: Intent[];
}

// Endpoint mapping
const ENDPOINTS: Record<string, string> = {
  ATTRACTION: '/attractions/search',
  CINEMA: '/cinema/search',
  HOME_MOVIE: '/nightin/search',
  ACTIVITY: '/activities/search',
  SHOPPING: '/shopping/awin-link',
  TIPS: '/hintsandtips/search'
};

// STEP 1: Use GPT to understand what user wants
async function classifyIntent(userMessage: string): Promise<Classification> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You classify user messages for a UK family concierge service.

INTENTS (pick ALL that apply):
- ATTRACTION: Days out, theme parks, zoos, safari parks, aquariums, museums
- CINEMA: Films at cinemas, "pictures", "what's showing", Odeon, Vue
- HOME_MOVIE: Streaming, Netflix, Disney+, "night in", "film at home", "watch tonight"
- ACTIVITY: Kids activities, "bored", rainy day, crafts, games
- SHOPPING: Products, toys, clothes, gifts
- TIPS: Money saving, deals, budget advice
- GREETING: Just saying hello (ONLY if no other request)

Extract parameters:
- query: search terms
- location: UK city/area
- category: specific type
- limit: default 5

RULES:
- Multiple intents OK: "safari parks and a film" = [ATTRACTION, HOME_MOVIE]
- "Hey" + request = NOT greeting, extract the request
- UK English: "pictures"=cinema, "telly"=TV

Return JSON only:
{"intents":[{"type":"INTENT_TYPE","confidence":0.9,"parameters":{"query":"...","location":"..."}}]}`
        },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1
    });

    return JSON.parse(response.choices[0].message.content || '{"intents":[]}');
  } catch (error) {
    console.error('Classification error:', error);
    return { intents: [{ type: 'GREETING', confidence: 1, parameters: {} }] };
  }
}

// STEP 2: Fetch data from YOUR endpoints (no hallucination possible)
async function fetchData(intent: Intent): Promise<any> {
  const endpoint = ENDPOINTS[intent.type];
  if (!endpoint) return null;

  const params = new URLSearchParams();
  if (intent.parameters.query) params.append('query', intent.parameters.query);
  if (intent.parameters.location) params.append('location', intent.parameters.location);
  if (intent.parameters.category) params.append('category', intent.parameters.category);
  params.append('limit', String(intent.parameters.limit || 5));

  try {
    const url = `${API_BASE}${endpoint}?${params.toString()}`;
    console.log(`[Sunny] Fetching: ${url}`);
    
    const response = await fetch(url);
    const data = await response.json();
    return { type: intent.type, results: data.results || [], count: data.count || 0 };
  } catch (error) {
    console.error(`[Sunny] Fetch error for ${intent.type}:`, error);
    return { type: intent.type, results: [], count: 0 };
  }
}

// STEP 3: Find upsells via tag matching
async function findUpsells(results: any[]): Promise<any[]> {
  const keywords: string[] = [];
  
  results.forEach(r => {
    if (r.results) {
      r.results.slice(0, 3).forEach((item: any) => {
        const name = item.name || item.title || '';
        keywords.push(...name.toLowerCase().split(' ').filter((w: string) => w.length > 3));
      });
    }
  });

  if (keywords.length === 0) return [];

  try {
    const query = keywords.slice(0, 3).join(' ');
    const response = await fetch(`${API_BASE}/shopping/awin-link?query=${encodeURIComponent(query)}&limit=2`);
    const data = await response.json();
    return data.results || [];
  } catch {
    return [];
  }
}

// STEP 4: GPT makes response sound human (ONLY using your data)
async function generateResponse(userMessage: string, results: any[], upsells: any[]): Promise<string> {
  const hasResults = results.some(r => r.results && r.results.length > 0);
  
  if (!hasResults) {
    return "I couldn't find anything matching that. Could you try being more specific? I can help with days out, cinema, films at home, activities, and shopping deals! 🌞";
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are Sunny, a warm family concierge for Kids Pass (UK).

CRITICAL RULES:
1. ONLY mention items from <data> - NEVER invent anything
2. ONLY use prices, ratings, names exactly as shown
3. Be warm and friendly like a helpful friend
4. Keep it concise - families are busy
5. Use 1-2 emojis max
6. If upsells exist, mention ONE naturally (not salesy)
7. Show Kids Pass savings when available
8. End with a helpful follow-up question

<data>
${JSON.stringify(results, null, 2)}
</data>

<upsells>
${JSON.stringify(upsells, null, 2)}
</upsells>`
        },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7
    });

    return response.choices[0].message.content || "Sorry, I had a moment there. Could you try again?";
  } catch (error) {
    console.error('[Sunny] Response generation error:', error);
    return "Sorry, I'm having a bit of trouble right now. Could you try again?";
  }
}

// ============================================
// ROUTES
// ============================================

// Health check
router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'Sunny is ready! ☀️', timestamp: new Date().toISOString() });
});

// Main chat endpoint
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    console.log(`\n[Sunny] === NEW REQUEST ===`);
    console.log(`[Sunny] User said: "${message}"`);

    // Step 1: Classify
    const classification = await classifyIntent(message);
    console.log(`[Sunny] Intents found: ${classification.intents.map(i => i.type).join(', ')}`);

    // Handle pure greeting
    if (classification.intents.length === 1 && classification.intents[0].type === 'GREETING') {
      return res.json({
        success: true,
        response: "Hey there! 👋 I'm Sunny, your family concierge.\n\nI can help you find days out, cinema trips, films to watch at home, activities for the kids, and shopping deals — always with Kids Pass savings!\n\nWhat are you looking for today?",
        debug: { intents: classification.intents }
      });
    }

    // Step 2: Fetch data
    const results = await Promise.all(
      classification.intents
        .filter(i => ENDPOINTS[i.type])
        .map(intent => fetchData(intent))
    );
    console.log(`[Sunny] Data fetched: ${results.map(r => `${r?.type}:${r?.count}`).join(', ')}`);

    // Step 3: Find upsells
    const upsells = await findUpsells(results);
    console.log(`[Sunny] Upsells found: ${upsells.length}`);

    // Step 4: Generate response
    const response = await generateResponse(message, results, upsells);
    console.log(`[Sunny] Response generated (${response.length} chars)`);

    res.json({
      success: true,
      response,
      debug: {
        intents: classification.intents,
        resultCounts: results.map(r => ({ type: r?.type, count: r?.count })),
        upsellCount: upsells.length
      }
    });

  } catch (error) {
    console.error('[Sunny] Error:', error);
    res.status(500).json({ 
      success: false, 
      response: "Sorry, I'm having a bit of trouble right now. Could you try again?"
    });
  }
});

export default router;
