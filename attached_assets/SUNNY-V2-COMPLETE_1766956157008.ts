// ============================================
// SUNNY V2 - COMPLETE PACKAGE
// ============================================
// 
// This file contains EVERYTHING you need.
// Tell Replit: "Here is the complete Sunny v2 upgrade. 
// Please split this into the appropriate files and integrate it."
//
// CONTENTS:
// 1. sunny.ts (backend - replace your current one)
// 2. SunnyChat.tsx (frontend chat UI)
// 3. Instructions for Replit
//
// ============================================




// ============================================
// FILE 1: server/sunny.ts
// ============================================
// Replace your current sunny.ts with this code
// ============================================

/*
import express, { Router, Request, Response } from 'express';
import OpenAI from 'openai';

const router: Router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const API_BASE = 'https://endpoint-weaver--rcxpysgzgc.replit.app';

// ============================================
// KIDS PASS SPONSOR CONFIGURATION
// ============================================

const KIDS_PASS_LINKS: Record<string, { url: string; discount: string; description: string }> = {
  'safari': {
    url: 'https://www.kidspass.co.uk/safari-parks',
    discount: 'up to 40%',
    description: 'safari parks, wildlife parks and zoos'
  },
  'zoo': {
    url: 'https://www.kidspass.co.uk/zoos',
    discount: 'up to 40%',
    description: 'zoos and wildlife attractions'
  },
  'theme-park': {
    url: 'https://www.kidspass.co.uk/theme-parks',
    discount: 'up to 35%',
    description: 'theme parks and adventure parks'
  },
  'cinema': {
    url: 'https://www.kidspass.co.uk/cinema',
    discount: 'up to 40%',
    description: 'cinema tickets at Odeon, Vue, Cineworld and more'
  },
  'indoor': {
    url: 'https://www.kidspass.co.uk/indoor-activities',
    discount: 'up to 50%',
    description: 'soft play, trampoline parks and indoor attractions'
  },
  'outdoor': {
    url: 'https://www.kidspass.co.uk/outdoor-activities',
    discount: 'up to 40%',
    description: 'outdoor attractions and adventures'
  },
  'aquarium': {
    url: 'https://www.kidspass.co.uk/aquariums',
    discount: 'up to 35%',
    description: 'SEA LIFE centres and aquariums'
  },
  'restaurant': {
    url: 'https://www.kidspass.co.uk/restaurants',
    discount: 'up to 50%',
    description: 'family restaurants'
  },
  'default': {
    url: 'https://www.kidspass.co.uk',
    discount: 'up to 50%',
    description: 'thousands of family attractions'
  }
};

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

interface UpsellCategory {
  keywords: string[];
  searchTerms: string[];
  pitch: string;
}

const UPSELL_CATEGORIES: Record<string, UpsellCategory> = {
  'safari': {
    keywords: ['safari', 'zoo', 'wildlife', 'animal'],
    searchTerms: ['binoculars kids', 'safari toys', 'animal figures', 'wildlife book children'],
    pitch: '🦁 Road trip essentials'
  },
  'theme-park': {
    keywords: ['theme park', 'roller coaster', 'alton towers', 'thorpe park', 'legoland'],
    searchTerms: ['sun hat kids', 'water bottle children', 'portable phone charger'],
    pitch: '🎢 Theme park must-haves'
  },
  'cinema': {
    keywords: ['cinema', 'pictures', 'odeon', 'vue', 'cineworld'],
    searchTerms: ['popcorn', 'cinema snacks', 'kids headphones'],
    pitch: '🎬 Cinema treats'
  },
  'movie-night': {
    keywords: ['netflix', 'disney+', 'streaming', 'film at home', 'night in', 'movie night'],
    searchTerms: ['popcorn maker', 'blanket kids', 'pyjamas children', 'snack bowl'],
    pitch: '🍿 Movie night essentials'
  },
  'rainy-day': {
    keywords: ['bored', 'rainy', 'indoor', 'stuck inside'],
    searchTerms: ['craft kit kids', 'board game family', 'puzzle children', 'play dough'],
    pitch: '🎨 Keep them busy'
  },
  'outdoor': {
    keywords: ['outdoor', 'park', 'adventure', 'nature', 'walk'],
    searchTerms: ['wellies kids', 'raincoat children', 'explorer kit', 'bug catcher'],
    pitch: '🌳 Outdoor adventures'
  },
  'beach': {
    keywords: ['beach', 'seaside', 'coast', 'swimming'],
    searchTerms: ['bucket spade', 'swimming float kids', 'beach toys', 'sun cream kids'],
    pitch: '🏖️ Beach day sorted'
  },
  'restaurant': {
    keywords: ['restaurant', 'eating out', 'dinner', 'lunch'],
    searchTerms: ['colouring book kids', 'travel games', 'snack pot'],
    pitch: '🍽️ Keep them entertained'
  }
};

const ENDPOINTS: Record<string, string> = {
  ATTRACTION: '/attractions/search',
  CINEMA: '/cinema/search',
  HOME_MOVIE: '/nightin/search',
  ACTIVITY: '/activities/search',
  SHOPPING: '/shopping/awin-link',
  TIPS: '/hintsandtips/search'
};

function getKidsPassPromo(intents: Intent[], query: string): { show: boolean; promo: typeof KIDS_PASS_LINKS[string]; category: string } | null {
  const queryLower = query.toLowerCase();
  const hasAttractionIntent = intents.some(i => i.type === 'ATTRACTION' || i.type === 'CINEMA');
  if (!hasAttractionIntent) return null;
  
  if (queryLower.includes('safari') || queryLower.includes('wildlife')) {
    return { show: true, promo: KIDS_PASS_LINKS['safari'], category: 'safari' };
  }
  if (queryLower.includes('zoo') || queryLower.includes('animal')) {
    return { show: true, promo: KIDS_PASS_LINKS['zoo'], category: 'zoo' };
  }
  if (queryLower.includes('theme park') || queryLower.includes('roller') || queryLower.includes('alton') || queryLower.includes('thorpe')) {
    return { show: true, promo: KIDS_PASS_LINKS['theme-park'], category: 'theme-park' };
  }
  if (queryLower.includes('cinema') || queryLower.includes('pictures')) {
    return { show: true, promo: KIDS_PASS_LINKS['cinema'], category: 'cinema' };
  }
  if (queryLower.includes('soft play') || queryLower.includes('trampoline') || queryLower.includes('indoor')) {
    return { show: true, promo: KIDS_PASS_LINKS['indoor'], category: 'indoor' };
  }
  if (queryLower.includes('aquarium') || queryLower.includes('sea life') || queryLower.includes('sealife')) {
    return { show: true, promo: KIDS_PASS_LINKS['aquarium'], category: 'aquarium' };
  }
  if (queryLower.includes('restaurant') || queryLower.includes('eat') || queryLower.includes('dinner')) {
    return { show: true, promo: KIDS_PASS_LINKS['restaurant'], category: 'restaurant' };
  }
  if (hasAttractionIntent) {
    return { show: true, promo: KIDS_PASS_LINKS['default'], category: 'default' };
  }
  return null;
}

function detectUpsellCategory(query: string, intents: Intent[]): UpsellCategory | null {
  const queryLower = query.toLowerCase();
  for (const [category, config] of Object.entries(UPSELL_CATEGORIES)) {
    if (config.keywords.some(kw => queryLower.includes(kw))) {
      return config;
    }
  }
  const intentTypes = intents.map(i => i.type);
  if (intentTypes.includes('HOME_MOVIE')) return UPSELL_CATEGORIES['movie-night'];
  if (intentTypes.includes('ACTIVITY')) return UPSELL_CATEGORIES['rainy-day'];
  if (intentTypes.includes('ATTRACTION')) return UPSELL_CATEGORIES['outdoor'];
  return null;
}

async function fetchSmartUpsells(category: UpsellCategory | null): Promise<any[]> {
  if (!category) return [];
  try {
    const searchTerm = category.searchTerms[Math.floor(Math.random() * category.searchTerms.length)];
    const response = await fetch(`${API_BASE}/shopping/awin-link?query=${encodeURIComponent(searchTerm)}&limit=3`);
    const data = await response.json();
    return (data.results || []).map((item: any) => ({ ...item, pitch: category.pitch }));
  } catch {
    return [];
  }
}

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

async function fetchData(intent: Intent): Promise<any> {
  const endpoint = ENDPOINTS[intent.type];
  if (!endpoint) return null;

  const params = new URLSearchParams();
  const p = intent.parameters;
  
  switch (intent.type) {
    case 'HOME_MOVIE':
      const serviceMap: Record<string, string> = {
        'netflix': 'Netflix', 'prime video': 'Prime Video', 'amazon prime': 'Prime Video',
        'prime': 'Prime Video', 'disney+': 'Disney+', 'disney plus': 'Disney+', 'disneyplus': 'Disney+',
        'apple tv': 'Apple TV+', 'apple tv+': 'Apple TV+', 'appletv': 'Apple TV+',
        'sky': 'Sky', 'now': 'NOW', 'now tv': 'NOW', 'nowtv': 'NOW', 'mubi': 'MUBI'
      };
      const moodMap: Record<string, string> = {
        'scary': 'Scary', 'romantic': 'Romantic', 'fun': 'Fun', 'funny': 'Fun',
        'intense': 'Intense', 'heartwarming': 'Heartwarming', 'epic': 'Epic',
        'dark': 'Dark', 'thrilling': 'Thrilling', 'tense': 'Tense', 'moving': 'Moving', 
        'inspiring': 'Inspiring', 'family': 'Heartwarming', 'kids': 'Fun'
      };
      const genreMap: Record<string, string> = {
        'action': 'Action', 'comedy': 'Comedy', 'drama': 'Drama', 'thriller': 'Thriller',
        'horror': 'Horror', 'romance': 'Romance', 'animation': 'Animation', 'animated': 'Animation',
        'documentary': 'Documentary', 'crime': 'Crime', 'sci-fi': 'Sci-Fi', 'scifi': 'Sci-Fi',
        'fantasy': 'Fantasy', 'family': 'Family', 'kids': 'Family'
      };
      const findMapping = (text: string, map: Record<string, string>): string | null => {
        const lower = text.toLowerCase();
        for (const [key, value] of Object.entries(map)) {
          if (lower.includes(key)) return value;
        }
        return null;
      };
      if (p.query) {
        const foundMood = findMapping(p.query, moodMap);
        const foundGenre = findMapping(p.query, genreMap);
        const foundService = findMapping(p.query, serviceMap);
        if (foundMood) params.append('mood', foundMood);
        if (foundGenre) params.append('genre', foundGenre);
        if (foundService) params.append('service', foundService);
      }
      if (p.category) {
        const foundService = findMapping(p.category, serviceMap);
        const foundMood = findMapping(p.category, moodMap);
        const foundGenre = findMapping(p.category, genreMap);
        if (foundService) params.append('service', foundService);
        else if (foundMood) params.append('mood', foundMood);
        else if (foundGenre) params.append('genre', foundGenre);
      }
      break;
    case 'ACTIVITY':
      if (p.query) {
        const qLower = p.query.toLowerCase();
        if (qLower.includes('indoor')) params.append('setting', 'INDOOR');
        else if (qLower.includes('outdoor')) params.append('setting', 'OUTDOOR');
        else if (qLower.includes('car')) params.append('setting', 'CAR');
        const ageMatch = qLower.match(/(\d+)\s*(year|yr)/);
        if (ageMatch) params.append('age', ageMatch[1]);
        if (qLower.includes('quiet') || qLower.includes('calm')) params.append('energy', 'LOW');
        else if (qLower.includes('active') || qLower.includes('energetic')) params.append('energy', 'HIGH');
      }
      break;
    case 'ATTRACTION':
      if (p.query) params.append('query', p.query);
      if (p.category) params.append('category', p.category);
      break;
    case 'CINEMA':
      if (p.query) params.append('query', p.query);
      if (p.category) params.append('genre', p.category);
      break;
    default:
      if (p.query) params.append('query', p.query);
      if (p.category) params.append('category', p.category);
      break;
  }
  params.append('limit', String(p.limit || 5));

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

async function generateResponse(
  userMessage: string, 
  results: any[], 
  kidsPassPromo: any,
  upsells: any[],
  upsellCategory: UpsellCategory | null,
  showFoodDeals: boolean
): Promise<string> {
  const hasResults = results.some(r => r.results && r.results.length > 0);
  
  if (!hasResults && !kidsPassPromo) {
    return "I couldn't find anything matching that. Could you try being more specific? I can help with days out, cinema, films at home, activities, and shopping deals! 🌞";
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are Sunny, a warm family concierge for Kids Pass (UK).

YOUR RESPONSE STRUCTURE (follow this order):

${kidsPassPromo ? `
1. KIDS PASS PROMO (ALWAYS FIRST for attractions/cinema):
   Start with: "💎 **Kids Pass members save ${kidsPassPromo.promo.discount}** on ${kidsPassPromo.promo.description}! [Join here](${kidsPassPromo.promo.url})"
   Then add a line break.
` : ''}

2. MAIN RECOMMENDATIONS:
   List the attractions/films from <data>
   Include prices, ratings, key details
   Be warm and helpful

${upsells.length > 0 ? `
3. CONTEXTUAL UPSELLS (weave in naturally):
   "${upsellCategory?.pitch || 'You might also like'}:"
   Mention 1-2 products from <upsells> with prices
   Keep it helpful, not salesy
` : ''}

${showFoodDeals ? `
4. FOOD DEALS (for movie nights):
   "🍕 Make it a proper movie night - Uber Eats has £10 off your first order!"
` : ''}

5. FOLLOW-UP:
   End with a helpful question or suggestion

CRITICAL RULES:
1. ONLY mention items from <data> and <upsells> - NEVER invent
2. Keep Kids Pass promo at the TOP for attractions/cinema
3. Be warm and friendly, use 1-2 emojis
4. Keep it concise - families are busy

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

router.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'Sunny v2.0 Monetization Engine is ready! 🌞💰',
    features: ['Kids Pass Sponsor', 'Smart Upsells', 'Multi-intent', 'Food Deals'],
    timestamp: new Date().toISOString() 
  });
});

router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    console.log(`[Sunny v2] User: "${message}"`);

    const classification = await classifyIntent(message);
    console.log(`[Sunny v2] Intents: ${classification.intents.map(i => i.type).join(', ')}`);

    if (classification.intents.length === 1 && classification.intents[0].type === 'GREETING') {
      return res.json({
        success: true,
        response: "Hey there! 👋 I'm Sunny, your family concierge.\n\nI can help you find:\n🎢 Days out (with Kids Pass savings!)\n🎬 Cinema trips\n🍿 Films to watch at home\n🎨 Activities for the kids\n🛒 Great deals on family products\n\nWhat are you looking for today?",
        debug: { intents: classification.intents, version: 'v2.0' }
      });
    }

    const kidsPassPromo = getKidsPassPromo(classification.intents, message);
    console.log(`[Sunny v2] Kids Pass promo: ${kidsPassPromo ? kidsPassPromo.category : 'none'}`);

    const results = await Promise.all(
      classification.intents
        .filter(i => ENDPOINTS[i.type])
        .map(intent => fetchData(intent))
    );
    console.log(`[Sunny v2] Data: ${results.map(r => `${r?.type}:${r?.count}`).join(', ')}`);

    const upsellCategory = detectUpsellCategory(message, classification.intents);
    const upsells = await fetchSmartUpsells(upsellCategory);
    console.log(`[Sunny v2] Upsells: ${upsells.length}`);

    const showFoodDeals = classification.intents.some(i => i.type === 'HOME_MOVIE');

    const response = await generateResponse(message, results, kidsPassPromo, upsells, upsellCategory, showFoodDeals);

    res.json({
      success: true,
      response,
      debug: {
        version: 'v2.0',
        intents: classification.intents,
        resultCounts: results.map(r => ({ type: r?.type, count: r?.count })),
        kidsPassPromo: kidsPassPromo ? { category: kidsPassPromo.category, url: kidsPassPromo.promo.url } : null,
        upsellCategory: upsellCategory?.pitch || null,
        upsellCount: upsells.length,
        showFoodDeals
      }
    });

  } catch (error) {
    console.error('[Sunny v2] Error:', error);
    res.status(500).json({ 
      success: false, 
      response: "Sorry, I'm having a bit of trouble right now. Could you try again?"
    });
  }
});

export default router;
*/




// ============================================
// FILE 2: client/src/components/SunnyChat.tsx
// ============================================
// Add this as a new component in your React frontend
// ============================================

/*
import React, { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  { emoji: '🦁', label: 'Safari parks', prompt: 'Safari parks near me' },
  { emoji: '🎬', label: 'Cinema', prompt: "What's on at the cinema?" },
  { emoji: '🍿', label: 'Movie night', prompt: 'Family film for tonight on Netflix' },
  { emoji: '🎨', label: 'Activities', prompt: 'My kids are bored, what can we do indoors?' },
  { emoji: '🎢', label: 'Theme parks', prompt: 'Theme parks near London' },
  { emoji: '🍽️', label: 'Restaurants', prompt: 'Kid-friendly restaurants near me' },
];

export default function SunnyChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    setShowWelcome(false);
    setIsLoading(true);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      const response = await fetch('/sunny/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry, I'm having trouble connecting. Please try again!",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
    setIsLoading(false);
  };

  const formatContent = (content: string) => {
    let formatted = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" style="color:#F97316;text-decoration:underline;">$1</a>');
    formatted = formatted.replace(/\n/g, '<br>');
    return formatted;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#FFF7ED', fontFamily: 'system-ui, sans-serif' }}>
      
      <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #F97316, #FB923C)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '32px' }}>☀️</span>
          <div>
            <div style={{ fontSize: '20px', fontWeight: '700' }}>Sunny</div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>Family Concierge</div>
          </div>
        </div>
        <div style={{ fontSize: '11px', backgroundColor: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '12px' }}>
          Powered by Kids Pass
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {showWelcome && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '40px 20px', flex: 1, justifyContent: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>☀️</div>
            <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#1F2937', margin: '0 0 12px' }}>Hey there! I'm Sunny</h2>
            <p style={{ fontSize: '16px', color: '#6B7280', lineHeight: 1.6, maxWidth: '400px', margin: '0 0 32px' }}>
              Your family concierge. I can help you find days out, cinema trips, films to watch at home, activities for the kids — and I'll always find you the best Kids Pass deals!
            </p>
            <div style={{ width: '100%', maxWidth: '500px' }}>
              <p style={{ fontSize: '14px', color: '#9CA3AF', marginBottom: '12px' }}>Try asking me:</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                {QUICK_PROMPTS.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => sendMessage(item.prompt)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}
                  >
                    <span style={{ fontSize: '18px' }}>{item.emoji}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {message.role === 'assistant' && (
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>☀️</div>
            )}
            <div
              style={{
                maxWidth: '80%',
                padding: '12px 16px',
                borderRadius: '18px',
                fontSize: '15px',
                lineHeight: 1.5,
                ...(message.role === 'user' 
                  ? { backgroundColor: '#F97316', color: 'white', borderBottomRightRadius: '4px' }
                  : { backgroundColor: 'white', color: '#1F2937', borderBottomLeftRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
                )
              }}
              dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
            />
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>☀️</div>
            <div style={{ backgroundColor: 'white', padding: '12px 16px', borderRadius: '18px', borderBottomLeftRadius: '4px' }}>
              <span>Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '16px 20px 24px', backgroundColor: 'white', borderTop: '1px solid #E5E7EB' }}>
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about days out, films, activities..."
            disabled={isLoading}
            style={{ flex: 1, padding: '14px 18px', fontSize: '16px', border: '2px solid #E5E7EB', borderRadius: '24px', outline: 'none' }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            style={{ padding: '14px 24px', backgroundColor: '#F97316', color: 'white', border: 'none', borderRadius: '24px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', opacity: isLoading || !input.trim() ? 0.5 : 1 }}
          >
            Send
          </button>
        </form>
        <p style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center', marginTop: '12px' }}>
          Sunny helps you find family activities with Kids Pass savings
        </p>
      </div>
    </div>
  );
}
*/




// ============================================
// INSTRUCTIONS FOR REPLIT
// ============================================
// 
// Tell Replit this:
//
// "Please upgrade Sunny to v2 with these changes:
//
// 1. Replace server/sunny.ts with the new version from FILE 1 above
//    - Adds Kids Pass sponsor integration (always shown first)
//    - Adds smart contextual upsells (safari = binoculars, movie night = blankets)
//    - Adds food delivery deals for movie nights
//
// 2. Add the SunnyChat.tsx component from FILE 2 above
//    - Beautiful orange-themed chat UI
//    - Quick prompt buttons
//    - Mobile-friendly design
//
// 3. Use SunnyChat as the main chat interface
//
// The key features:
// - Kids Pass promo ALWAYS appears first for attraction/cinema queries
// - Links go to specific Kids Pass landing pages (safari-parks, cinema, etc.)
// - Upsells are now contextual (safari gets safari products, not random stuff)
// - Movie night queries get food delivery deals"
//
// ============================================
