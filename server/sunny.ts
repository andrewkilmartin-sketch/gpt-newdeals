/**
 * SUNNY AI FAMILY CONCIERGE v4.1
 * CTO-Level Upgrade: Enforced monetisation, proper sponsor strip, structured Kids Pass CTAs
 * 
 * CHANGES FROM v4.0:
 * - Commerce triggers FORCE product searches for relevant queries
 * - Sponsor strip APPENDED to every response (no separate field)
 * - Kids Pass CTAs with ACTUAL LINKS and PERCENTAGES
 * - Stronger system prompt requiring monetisation
 * - Fixed tool_call_id handling for forced searches
 * - Removed emojis per design guidelines
 */

import OpenAI from "openai";
import { db, isDbReady } from "./db";
import { chatLogs } from "@shared/schema";
import { v4 as uuidv4 } from "uuid";
import { Router, Request, Response } from "express";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================================================
// SYSTEM PROMPT - Enforced monetisation rules
// ============================================================================

const SYSTEM_PROMPT = `You are Sunny, a warm and helpful family concierge for UK families.

PERSONALITY:
Like a friend who's done it all with their own kids - genuine, helpful, natural. Keep it brief. No bullet lists unless showing multiple options. Just talk.

CRITICAL DATA RULES:
- ONLY recommend what your tools return - never invent venues, products, or links
- If search returns nothing, say so honestly
- Never fabricate prices, opening times, or availability

═══════════════════════════════════════════════════════════════
MONETISATION RULES - YOU MUST FOLLOW THESE
═══════════════════════════════════════════════════════════════

KIDS PASS - ALWAYS include when recommending PAID attractions:
Format: "Kids Pass saves you [X]% - [LINK]"
Use these EXACT links:
- Zoos/Safari: https://www.kidspass.co.uk/zoos (saves up to 40%)
- Theme Parks: https://www.kidspass.co.uk/theme-parks (saves up to 35%)
- Cinema: https://www.kidspass.co.uk/cinema (saves up to 40%)
- Soft Play/Indoor: https://www.kidspass.co.uk/indoor-activities (saves up to 50%)
- Restaurants: https://www.kidspass.co.uk/restaurants (saves up to 50%)
- Aquariums: https://www.kidspass.co.uk/aquariums (saves up to 40%)

AWIN PRODUCTS - You MUST call search_products for these triggers:
- Zoo/Safari/Animals -> search "animal toys" or "lego animal"
- Theme park/Day out -> search "lego" or "toys"
- Cinema -> search "sweets"
- Movie night/Streaming/Night in -> search "blanket" or "pyjamas"
- Beach -> search "toys" or "games"
- Restaurant -> search "colouring book" or "activity book"
- Rainy day -> search "craft" or "lego"
- Birthday -> search "party" or "birthday"

When you get product results, INCLUDE them naturally:
"Grab some [Product Name] (£X from [Merchant]) - [affiliate link]"

═══════════════════════════════════════════════════════════════

RESPONSE STRUCTURE:
1. Answer their question with real data from tool results ONLY
2. Include Kids Pass link with savings % if paid attractions
3. ONLY include products if search_products returned results - if it returned empty/zero results, DO NOT mention any products at all
4. Ask a follow-up question

CRITICAL - NEVER FABRICATE:
- If search_products returns 0 results, say NOTHING about products - just skip that part entirely
- ONLY mention products that appeared in the tool results you received
- NEVER invent a product name, price, or link - that is FRAUD

IMPORTANT RULES:
- DON'T ask unnecessary clarifying questions. This is a FAMILY concierge - assume all queries are for kids/families. Answer on the FIRST try.
- ONE link per product only. Never show the same link multiple times. Never say "Get it here! Or here! And here!" or "Another option, same design" - that's lazy. Show unique products only, each with exactly one link.
- Be decisive. Make recommendations confidently without asking "what kind?" or "any preferences?" unless genuinely needed.
- BE HONEST about what you find. If someone asks for "RC cars" and you only find LEGO, say "I couldn't find actual remote control cars, but here are some LEGO vehicle sets." Never describe LEGO as RC cars - that's misleading.
- If search returns nothing relevant, say so. Don't force irrelevant products into the response.

LOCATION: If they say "near me" without context, ask "What area are you in?"

Keep responses conversational, under 200 words.`;

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_attractions",
      description: "Search paid UK attractions - theme parks, zoos, safari parks, aquariums, soft play, bowling, museums. Use for any 'days out' or 'things to do' queries.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "What they're looking for: zoo, theme park, soft play, bowling, museum, farm, etc." },
          location: { type: "string", description: "City or area - MUST match user's requested location exactly" },
          limit: { type: "number", description: "Max results, default 5" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_attractions_free",
      description: "Search FREE UK attractions - parks, museums, galleries, beaches. Use when they mention 'free', 'cheap', or 'budget'.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "What they're looking for" },
          location: { type: "string", description: "City or area" },
          limit: { type: "number", description: "Max results, default 5" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_cinema",
      description: "Find films currently showing at UK cinemas. For FAMILIES, always set family=true.",
      parameters: {
        type: "object",
        properties: {
          genre: { type: "string", description: "family, animation, comedy, action" },
          family: { type: "boolean", description: "Set TRUE for families with kids - filters to U/PG only" },
          limit: { type: "number", description: "Max results, default 5" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_streaming",
      description: "Find films to watch at home on Netflix, Disney+, Prime Video. ALWAYS call search_products for blankets/popcorn/pyjamas after this.",
      parameters: {
        type: "object",
        properties: {
          service: { type: "string", description: "Netflix, Disney+, Prime Video, NOW, Sky" },
          mood: { type: "string", description: "Fun, Heartwarming, Adventure, Scary" },
          family: { type: "boolean", description: "Set TRUE for family-friendly films" },
          limit: { type: "number", description: "Max results, default 5" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_activities",
      description: "Find things to do AT HOME - crafts, games, rainy day ideas. NOT for days out.",
      parameters: {
        type: "object",
        properties: {
          setting: { type: "string", description: "INDOOR, OUTDOOR, or CAR" },
          age: { type: "number", description: "Child's age" },
          energy: { type: "string", description: "LOW, MED, or HIGH" },
          limit: { type: "number", description: "Max results, default 5" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Search Awin affiliate products - toys, clothes, gifts, supplies. Call for: movie nights (blankets, pyjamas), zoo trips (animal toys, lego), cinema (sweets), restaurants (colouring books). ONLY recommend products that this search returns - NEVER invent products.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Products we stock: blanket, pyjamas, animal toys, lego, sweets, colouring, craft, party, birthday" },
          limit: { type: "number", description: "Max results, default 3" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_events",
      description: "Find family events, shows, live entertainment. When kids are mentioned, only return family-appropriate shows.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Event type or name" },
          city: { type: "string", description: "City - MUST match user's requested location exactly" },
          family: { type: "boolean", description: "Set TRUE when kids are mentioned - filters to family-friendly only" },
          limit: { type: "number", description: "Max results, default 5" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_restaurants",
      description: "Find family-friendly restaurants with kids menus.",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "City - MUST match user's requested location exactly" },
          chain: { type: "string", description: "Specific chain: Harvester, Beefeater, Toby Carvery" },
          limit: { type: "number", description: "Max results, default 5" }
        },
        required: ["city"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_recommendations",
      description: "Get community-sourced venue recommendations from parent groups.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Venue or category" },
          limit: { type: "number", description: "Max results, default 5" }
        }
      }
    }
  }
];

// ============================================================================
// TOOL EXECUTION
// ============================================================================

const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;

async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const limit = (args.limit as number) || 5;

  try {
    let url: string;

    switch (name) {
      case "search_attractions":
        url = `${BASE_URL}/attractions/search?query=${encodeURIComponent(args.query as string || "")}&location=${encodeURIComponent(args.location as string || "")}&limit=${limit}`;
        break;
        
      case "search_attractions_free":
        url = `${BASE_URL}/attractions/free?query=${encodeURIComponent(args.query as string || "")}&location=${encodeURIComponent(args.location as string || "")}&limit=${limit}`;
        break;
        
      case "search_cinema":
        url = `${BASE_URL}/cinema/search?family=${args.family !== false}&limit=${limit}`;
        if (args.genre) url += `&genre=${encodeURIComponent(args.genre as string)}`;
        break;
        
      case "search_streaming":
        url = `${BASE_URL}/nightin/search?family=${args.family !== false}&limit=${limit}`;
        if (args.service) url += `&service=${encodeURIComponent(args.service as string)}`;
        if (args.mood) url += `&mood=${encodeURIComponent(args.mood as string)}`;
        break;
        
      case "search_activities":
        url = `${BASE_URL}/activities/search?limit=${limit}`;
        if (args.setting) url += `&setting=${encodeURIComponent(args.setting as string)}`;
        if (args.age) url += `&age=${args.age}`;
        if (args.energy) url += `&energy=${encodeURIComponent(args.energy as string)}`;
        break;
        
      case "search_products": {
        const productQuery = (args.query as string || "").toLowerCase();
        url = `${BASE_URL}/shopping/awin-link?query=${encodeURIComponent(productQuery)}&limit=${Math.min(limit * 3, 30)}`;
        
        // Fetch more results and filter for relevance
        const productResponse = await fetch(url);
        const productData = await productResponse.json();
        
        if (productData.results && productData.results.length > 0) {
          // Filter results to only include products that actually match the query
          const queryWords = productQuery.split(/\s+/).filter((w: string) => w.length > 2);
          
          const filteredResults = productData.results.filter((product: any) => {
            const productText = `${product.title || ''} ${product.description || ''} ${product.category || ''}`.toLowerCase();
            
            // Check if at least one query word appears in the product
            const hasMatch = queryWords.some((word: string) => productText.includes(word));
            
            // Reject products that are clearly wrong category (e.g., LEGO for RC cars)
            if (productQuery.includes('rc') || productQuery.includes('remote control')) {
              // Must have remote/rc/control in the product, not just "car"
              const hasRemote = productText.includes('remote') || productText.includes('rc ') || productText.includes('r/c');
              if (!hasRemote) return false;
            }
            
            return hasMatch;
          });
          
          if (filteredResults.length > 0) {
            return {
              ...productData,
              results: filteredResults.slice(0, limit),
              count: filteredResults.slice(0, limit).length,
              filtered: true
            };
          } else {
            // No relevant results found
            return {
              success: true,
              results: [],
              count: 0,
              message: `No ${productQuery} found in our current deals. Try a different search term.`
            };
          }
        }
        return productData;
      }
        
      case "search_events":
        url = `${BASE_URL}/events/search?limit=${limit}`;
        if (args.query) url += `&query=${encodeURIComponent(args.query as string)}`;
        if (args.city) url += `&city=${encodeURIComponent(args.city as string)}`;
        if (args.family) url += `&family=true`;
        break;
        
      case "search_restaurants":
        url = `${BASE_URL}/restaurants/search?limit=${limit}`;
        if (args.city) url += `&city=${encodeURIComponent(args.city as string)}`;
        if (args.chain) url += `&chain=${encodeURIComponent(args.chain as string)}`;
        break;
        
      case "search_recommendations":
        url = `${BASE_URL}/recommendations/search?limit=${limit}`;
        if (args.query) url += `&query=${encodeURIComponent(args.query as string)}`;
        break;
        
      default:
        return { error: `Unknown tool: ${name}` };
    }

    const response = await fetch(url);
    const data = await response.json();
    return data;

  } catch (error) {
    console.error(`Tool ${name} failed:`, error);
    return { error: `Failed to search: ${error}` };
  }
}

// ============================================================================
// COMMERCE TRIGGERS - Force product searches for relevant queries
// ============================================================================

interface CommerceTrigger {
  keywords: string[];
  productSearches: string[];
}

// COMMERCE TRIGGERS - ONLY include products we ACTUALLY STOCK
// Verified against product catalog - no binoculars, no beach towels, etc.
const COMMERCE_TRIGGERS: CommerceTrigger[] = [
  {
    keywords: ["zoo", "safari", "animal", "wildlife", "farm"],
    productSearches: ["animal toys", "lego animal"]  // We have animal toys, NOT binoculars
  },
  {
    keywords: ["theme park", "adventure", "rollercoaster", "day out", "attraction"],
    productSearches: ["lego", "toys"]  // Generic toys, NOT sun hats
  },
  {
    keywords: ["cinema", "film", "movie", "pictures"],
    productSearches: ["sweets", "snacks"]
  },
  {
    keywords: ["streaming", "netflix", "disney", "night in", "movie night", "watch"],
    productSearches: ["blanket", "pyjamas"]
  },
  {
    keywords: ["beach", "seaside", "coast"],
    productSearches: ["toys", "games"]  // Generic, NOT bucket spade
  },
  {
    keywords: ["restaurant", "eat", "dinner", "lunch", "food"],
    productSearches: ["colouring book", "activity book"]
  },
  {
    keywords: ["rainy", "indoor", "bored", "home"],
    productSearches: ["craft", "lego"]
  },
  {
    keywords: ["birthday", "party"],
    productSearches: ["party", "birthday"]
  },
  {
    keywords: ["soft play", "trampoline", "bowling"],
    productSearches: ["snacks", "sweets"]
  }
];

function detectCommerceTriggers(message: string): string[] {
  const lowerMessage = message.toLowerCase();
  const productSearches: string[] = [];

  for (const trigger of COMMERCE_TRIGGERS) {
    if (trigger.keywords.some(keyword => lowerMessage.includes(keyword))) {
      productSearches.push(...trigger.productSearches);
    }
  }

  return Array.from(new Set(productSearches)).slice(0, 3);
}

// ALWAYS trigger commerce for these tool types - guaranteed monetisation
// This ensures products are ALWAYS recommended when relevant tools are called
// Map tools to products we ACTUALLY STOCK - verified against catalog
function detectTriggersFromTools(toolsUsed: { tool: string; args: unknown }[]): string[] {
  const productSearches: string[] = [];
  
  for (const toolUse of toolsUsed) {
    const toolName = toolUse.tool.toLowerCase();
    const args = toolUse.args as Record<string, unknown>;
    const query = ((args.query as string) || '').toLowerCase();
    
    // ATTRACTIONS - Suggest products we ACTUALLY HAVE
    if (toolName.includes('attraction')) {
      if (query.includes('zoo') || query.includes('safari') || query.includes('wildlife') || query.includes('animal') || query.includes('farm')) {
        productSearches.push('animal toys', 'lego animal');  // NO binoculars - we don't sell them
      } else if (query.includes('soft play') || query.includes('trampoline') || query.includes('bowling')) {
        productSearches.push('snacks');  // NO grip socks - we don't sell them
      } else {
        productSearches.push('lego', 'toys');  // Generic toys, NOT sun hats
      }
    }
    
    // CINEMA - sweets/snacks (verified in stock)
    if (toolName.includes('cinema')) {
      productSearches.push('sweets');
    }
    
    // STREAMING/NIGHT IN - blanket/pyjamas (verified in stock)
    if (toolName.includes('streaming') || toolName.includes('nightin')) {
      productSearches.push('blanket', 'pyjamas');
    }
    
    // RESTAURANTS - colouring books (verified in stock)
    if (toolName.includes('restaurant')) {
      productSearches.push('colouring');
    }
    
    // EVENTS - snacks
    if (toolName.includes('event')) {
      productSearches.push('sweets');
    }
    
    // ACTIVITIES (home) - craft/lego
    if (toolName.includes('activities')) {
      productSearches.push('craft', 'lego');
    }
  }
  
  return Array.from(new Set(productSearches));
}

// ============================================================================
// SPONSOR STRIP - Appended to EVERY response
// ============================================================================

interface SponsorDeal {
  merchant: string;
  offer: string;
  link: string;
}

async function getSponsorStrip(): Promise<SponsorDeal[]> {
  try {
    const categories = ["toys", "kids", "family", "clothing", "games"];
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];

    const response = await fetch(`${BASE_URL}/shopping/awin-link?query=${randomCategory}&limit=6`);
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      // Only include products with REAL offer text from the API
      const validDeals = data.results
        .filter((product: any) => {
          // Must have actual offer text in title or discount field
          const title = (product.title || '').toLowerCase();
          const discount = (product.discount || '').toLowerCase();
          
          // Check for real offers: percentage off, BOGOF, code, sale, etc.
          const hasRealOffer = 
            title.includes('% off') || 
            title.includes('off ') ||
            title.includes('buy one') ||
            title.includes('bogof') ||
            title.includes('sale') ||
            title.includes('free ') ||
            discount.includes('code:') ||
            discount.includes('% off');
          
          return hasRealOffer && product.affiliateLink;
        })
        .slice(0, 3)
        .map((product: any) => {
          // Extract the offer from the actual API data
          let offer = product.title || '';
          
          // If title is too long, use discount field or shorten
          if (offer.length > 30) {
            if (product.discount && product.discount !== 'Special offer') {
              offer = product.discount;
            } else {
              // Extract just the discount part (e.g., "15% off" from "15% off all electric scooters")
              const match = offer.match(/(\d+% off|\bBOGOF\b|Buy One Get One|Free \w+)/i);
              offer = match ? match[0] : offer.substring(0, 25) + '...';
            }
          }
          
          return {
            merchant: product.merchant || "Retailer",
            offer,
            link: product.affiliateLink
          };
        });
      
      return validDeals;
    }

    // No hardcoded fallback - return empty if no real deals exist
    return [];

  } catch (error) {
    console.error("Sponsor strip fetch failed:", error);
    return [];
  }
}

function formatSponsorStrip(sponsors: SponsorDeal[]): string {
  if (sponsors.length === 0) return "";

  const deals = sponsors.map(s => `[${s.merchant}](${s.link}): ${s.offer}`).join(" | ");
  return `\n\n---\nToday's deals: ${deals}`;
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface Session {
  id: string;
  messages: ConversationMessage[];
  createdAt: Date;
  lastActivity: Date;
}

const sessions = new Map<string, Session>();

function getOrCreateSession(sessionId?: string): Session {
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    session.lastActivity = new Date();
    return session;
  }

  const newSession: Session = {
    id: sessionId || uuidv4(),
    messages: [{ role: "system", content: SYSTEM_PROMPT }],
    createdAt: new Date(),
    lastActivity: new Date()
  };

  sessions.set(newSession.id, newSession);
  return newSession;
}

setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const entries = Array.from(sessions.entries());
  for (const [id, session] of entries) {
    if (session.lastActivity.getTime() < oneHourAgo) {
      sessions.delete(id);
    }
  }
}, 60 * 60 * 1000);

// ============================================================================
// URL SANITIZATION - Block fake/fabricated links
// ============================================================================

function sanitizeResponse(text: string): string {
  return text
    .replace(/https?:\/\/(www\.)?(example\.com|fake\.com|placeholder\.com)[^\s)"']*/gi, "[link removed]")
    .replace(/https?:\/\/(www\.)?amazon\.(com|co\.uk)[^\s)"']*/gi, "[link removed]")
    .replace(/\[([^\]]+)\]\(https?:\/\/(www\.)?(example|fake|placeholder)\.[^)]+\)/gi, "$1");
}

// ============================================================================
// ANTI-FABRICATION VALIDATION - Request-scoped product tracking
// ============================================================================

interface ValidProduct {
  name: string;
  price: number;
  merchant: string;
  link: string;
}

// Request-scoped context to avoid concurrency issues
interface RequestContext {
  validProducts: ValidProduct[];
  productSearchCount: number;
}

function createRequestContext(): RequestContext {
  return { validProducts: [], productSearchCount: 0 };
}

function addValidProductsToContext(ctx: RequestContext, results: any[]): void {
  for (const product of results) {
    if (product.title && product.affiliateLink) {
      ctx.validProducts.push({
        name: (product.title || '').toLowerCase(),
        price: parseFloat(product.price) || 0,
        merchant: (product.merchant || '').toLowerCase(),
        link: product.affiliateLink
      });
    }
  }
}

// Track that a product search was attempted (regardless of result count)
function incrementProductSearchCount(ctx: RequestContext): void {
  ctx.productSearchCount++;
}

function validateResponseProducts(response: string, ctx: RequestContext): { valid: boolean; fabricatedProducts: string[] } {
  const fabricatedProducts: string[] = [];
  
  // Extract all awin pclick links from response (product links)
  const awinLinkPattern = /https:\/\/www\.awin1\.com\/pclick\.php\?p=(\d+)/g;
  let match: RegExpExecArray | null;
  
  while ((match = awinLinkPattern.exec(response)) !== null) {
    const productId = match[1];
    const fullLink = match[0];
    
    // Check if this link exists in any valid product
    const isValid = ctx.validProducts.some(p => p.link.includes(productId));
    
    if (!isValid) {
      fabricatedProducts.push(fullLink);
    }
  }
  
  // Check for product mentions with prices - flag if we ran product searches but none matched
  // Pattern: **Product Name** ... £XX.XX
  const productPattern = /\*\*([^*]+)\*\*[^£]*£([\d.]+)/g;
  let productMatch: RegExpExecArray | null;
  
  while ((productMatch = productPattern.exec(response)) !== null) {
    const productName = productMatch[1].toLowerCase();
    
    // If we ran product searches but have no valid products, ANY product mention is fabricated
    if (ctx.productSearchCount > 0 && ctx.validProducts.length === 0) {
      fabricatedProducts.push(`Product: ${productMatch[1]}`);
      continue;
    }
    
    // Check if any word from the product name matches our valid products
    if (ctx.validProducts.length > 0) {
      const nameWords = productName.split(/\s+/).filter((w: string) => w.length > 3);
      const hasMatch = ctx.validProducts.some(valid => {
        return nameWords.some((word: string) => valid.name.includes(word));
      });
      
      if (!hasMatch) {
        fabricatedProducts.push(`Product: ${productMatch[1]}`);
      }
    }
  }
  
  return {
    valid: fabricatedProducts.length === 0,
    fabricatedProducts
  };
}

function stripFabricatedProducts(response: string, ctx: RequestContext): string {
  const validation = validateResponseProducts(response, ctx);
  
  if (!validation.valid) {
    console.warn(`[ANTI-FABRICATION] Detected fabricated products: ${validation.fabricatedProducts.join(', ')}`);
    
    for (const fabricated of validation.fabricatedProducts) {
      if (fabricated.startsWith('http')) {
        // Remove the entire markdown link containing this URL
        const escapedUrl = fabricated.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        response = response.replace(new RegExp(`\\[[^\\]]*\\]\\(${escapedUrl}[^)]*\\)[^.]*\\.?`, 'g'), '');
      } else if (fabricated.startsWith('Product:')) {
        // Remove text blurbs mentioning fabricated products (without links)
        const productName = fabricated.replace('Product: ', '').trim();
        // Remove sentence containing the product name in bold: **Product Name** ... £XX.XX ...
        const escapedName = productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        response = response.replace(new RegExp(`\\*\\*${escapedName}\\*\\*[^.]*\\.[^.]*`, 'gi'), '');
        // Also remove any standalone mention
        response = response.replace(new RegExp(`[^.]*\\*\\*${escapedName}\\*\\*[^.]*\\.`, 'gi'), '');
      }
    }
    
    // Clean up any double spaces or empty lines from stripping
    response = response.replace(/\n\n+/g, '\n\n').replace(/  +/g, ' ').trim();
  }
  
  return response;
}

// ============================================================================
// MAIN CHAT HANDLER
// ============================================================================

export async function handleChat(
  message: string,
  sessionId?: string
): Promise<{ success: boolean; response: string; sessionId: string; debug?: unknown }> {

  const session = getOrCreateSession(sessionId);
  const toolsUsed: { tool: string; args: unknown; resultCount?: number }[] = [];
  
  // Request-scoped context for anti-fabrication validation (thread-safe)
  const requestCtx = createRequestContext();

  try {
    session.messages.push({ role: "user", content: message });

    const requiredProductSearches = detectCommerceTriggers(message);

    const firstResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: session.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      tools,
      tool_choice: "auto",
      max_tokens: 1000
    });

    const firstChoice = firstResponse.choices[0];
    let finalResponse: string;

    if (firstChoice.message.tool_calls && firstChoice.message.tool_calls.length > 0) {
      const toolMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        firstChoice.message as OpenAI.Chat.Completions.ChatCompletionMessageParam
      ];
      
      const productSearchesMade: string[] = [];
      let forcedToolIndex = 0;
      
      for (const toolCall of firstChoice.message.tool_calls) {
        const fn = (toolCall as any).function;
        if (!fn) continue;
        
        const args = JSON.parse(fn.arguments);
        const result = await executeTool(fn.name, args);
        
        if (fn.name === "search_products") {
          productSearchesMade.push(args.query);
          // Track that a product search was attempted (for anti-fabrication)
          incrementProductSearchCount(requestCtx);
          // Track valid products for anti-fabrication validation (request-scoped)
          if ((result as any).results && Array.isArray((result as any).results)) {
            addValidProductsToContext(requestCtx, (result as any).results);
          }
        }
        
        toolsUsed.push({
          tool: fn.name,
          args,
          resultCount: Array.isArray((result as any).results) ? (result as any).results.length : undefined
        });
        
        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }
      
      // Detect commerce triggers from TOOLS CALLED (not just user message)
      // This ensures zoo results trigger binoculars even if user said "day out near Chester"
      const toolBasedTriggers = detectTriggersFromTools(toolsUsed);
      // No hard limit - ensure ALL tools get their products (max ~6 unique products)
      const allTriggers = Array.from(new Set([...requiredProductSearches, ...toolBasedTriggers]));
      
      // Force product searches if AI didn't make them - BUT ONLY INCLUDE IF RESULTS EXIST
      const forcedProductResults: any[] = [];
      for (const requiredSearch of allTriggers) {
        if (!productSearchesMade.some(s => s.toLowerCase().includes(requiredSearch.toLowerCase()))) {
          // Track that we attempted a product search (for anti-fabrication)
          incrementProductSearchCount(requestCtx);
          
          const productResult = await executeTool("search_products", { query: requiredSearch, limit: 2 });
          
          const resultCount = Array.isArray((productResult as any).results) ? (productResult as any).results.length : 0;
          
          toolsUsed.push({
            tool: "search_products (forced)",
            args: { query: requiredSearch },
            resultCount
          });
          
          // ONLY add to forced results if we actually got products back
          if (resultCount > 0) {
            addValidProductsToContext(requestCtx, (productResult as any).results);
            forcedProductResults.push({ query: requiredSearch, result: productResult });
          } else {
            console.log(`[COMMERCE] No products found for "${requiredSearch}" - skipping injection`);
          }
        }
      }
      
      // Second OpenAI call with forced products as system context
      const messagesForSecondCall: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        ...session.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        ...toolMessages
      ];
      
      if (forcedProductResults.length > 0) {
        messagesForSecondCall.push({
          role: "system",
          content: `IMPORTANT: Include these relevant products naturally in your response with prices and affiliate links: ${JSON.stringify(forcedProductResults)}`
        });
      }
      
      const secondResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messagesForSecondCall,
        tools,
        tool_choice: "none",
        max_tokens: 1000
      });
      
      finalResponse = secondResponse.choices[0].message.content || "Sorry, I couldn't find anything for that.";
      
    } else {
      if (requiredProductSearches.length > 0) {
        const productResults: any[] = [];
        for (const search of requiredProductSearches) {
          // Track that we attempted a product search (for anti-fabrication)
          incrementProductSearchCount(requestCtx);
          
          const result = await executeTool("search_products", { query: search, limit: 2 });
          const resultCount = Array.isArray((result as any).results) ? (result as any).results.length : 0;
          
          toolsUsed.push({
            tool: "search_products (forced)",
            args: { query: search },
            resultCount
          });
          
          // ONLY add to results if we actually got products back
          if (resultCount > 0) {
            addValidProductsToContext(requestCtx, (result as any).results);
            productResults.push({ query: search, result });
          } else {
            console.log(`[COMMERCE] No products found for "${search}" - skipping injection`);
          }
        }
        
        // Only inject products if we have results
        if (productResults.length > 0) {
          const withProducts = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              ...session.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
              {
                role: "system",
                content: `ONLY IF RELEVANT, include these products naturally in your response. If empty, do NOT mention products: ${JSON.stringify(productResults)}`
              }
            ],
            max_tokens: 1000
          });
          
          finalResponse = withProducts.choices[0].message.content || firstChoice.message.content || "Sorry, I'm not sure how to help with that.";
        } else {
          finalResponse = firstChoice.message.content || "Sorry, I'm not sure how to help with that.";
        }
      } else {
        finalResponse = firstChoice.message.content || "Sorry, I'm not sure how to help with that.";
      }
    }

    finalResponse = sanitizeResponse(finalResponse);
    
    // ANTI-FABRICATION: Validate and strip any products not from tool results (request-scoped)
    finalResponse = stripFabricatedProducts(finalResponse, requestCtx);

    // ALWAYS append sponsor strip
    const sponsors = await getSponsorStrip();
    const sponsorStrip = formatSponsorStrip(sponsors);
    finalResponse = finalResponse + sponsorStrip;

    session.messages.push({ role: "assistant", content: finalResponse });

    if (session.messages.length > 21) {
      session.messages = [
        session.messages[0],
        ...session.messages.slice(-20)
      ];
    }

    // Log to database (gracefully handle if DB not ready)
    if (isDbReady()) {
      try {
        await db.insert(chatLogs).values({
          id: uuidv4(),
          sessionId: session.id,
          userMessage: message,
          sunnyResponse: finalResponse,
          toolsUsed: JSON.stringify(toolsUsed),
          createdAt: new Date()
        });
      } catch (dbError) {
        console.error("Failed to log chat:", dbError);
      }
    }

    return {
      success: true,
      response: finalResponse,
      sessionId: session.id,
      debug: {
        version: "v4.1-monetised",
        toolsUsed,
        commerceTriggersDetected: requiredProductSearches
      }
    };

  } catch (error) {
    console.error("Chat error:", error);
    return {
      success: false,
      response: "Sorry, something went wrong. Give me a sec and try again!",
      sessionId: session.id,
      debug: { error: String(error) }
    };
  }
}

// ============================================================================
// EXPRESS ROUTES
// ============================================================================

export const sunnyRouter = Router();

sunnyRouter.post("/chat", async (req: Request, res: Response) => {
  const { message, sessionId } = req.body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ success: false, error: "Message required" });
  }

  const result = await handleChat(message.trim(), sessionId);
  res.json(result);
});

sunnyRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "Sunny v4.1 - Monetised",
    version: "v4.1-monetised",
    activeSessions: sessions.size,
    timestamp: new Date().toISOString()
  });
});

sunnyRouter.get("/history", async (req: Request, res: Response) => {
  if (!isDbReady()) {
    return res.json({ success: false, error: "Database not available", logs: [] });
  }
  
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const logs = await db.select().from(chatLogs).limit(limit);

    res.json({
      success: true,
      count: logs.length,
      logs: logs.map(log => ({
        ...log,
        sunnyResponse: req.query.full === "true" ? log.sunnyResponse : log.sunnyResponse?.substring(0, 100) + "..."
      }))
    });

  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

sunnyRouter.get("/diagnostics", (_req: Request, res: Response) => {
  res.json({
    version: "v4.1-monetised",
    systemPromptLength: SYSTEM_PROMPT.length,
    toolCount: tools.length,
    commerceTriggers: COMMERCE_TRIGGERS.length,
    activeSessions: sessions.size,
    databaseReady: isDbReady(),
    timestamp: new Date().toISOString()
  });
});

export default sunnyRouter;
