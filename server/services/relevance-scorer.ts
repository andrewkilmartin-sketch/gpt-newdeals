import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// PHASE 1: Expanded blocklist for family platform content safety
// CTO Audit Jan 2026: Found 13 alcohol ads, 5 STI ads for kids queries
const INAPPROPRIATE_TERMS = [
  // Sexual/Adult content
  'bedroom confidence', 'erectile', 'viagra', 'sexual health',
  'reproductive health', 'your status', 'sti test', 'std test',
  'reclaim your confidence', 'regain confidence', 'dating site',
  'singles near', 'sexual performance', 'libido', 'erectile dysfunction',
  'adult toy', 'lingerie', 'sexy', 'erotic', 'intimate moments',
  // Alcohol - CRITICAL: CTO found 13 instances for kids queries
  'alcohol gift', 'shop alcohol', 'wine subscription', 'beer delivery',
  'alcohol delivery', 'gin gift', 'whisky gift', 'vodka gift',
  'wine gift', 'champagne gift', 'prosecco gift', 'spirits gift',
  'cocktail gift', 'beer gift', 'ale gift', 'lager gift',
  'bottle club', 'wine club', 'beer club', 'gin club',
  'save on gin', 'save on wine', 'save on whisky',
  // Gambling/Vice
  'gambling', 'casino', 'betting', 'poker', 'slots',
  // Health supplements (not for kids platform)
  'weight loss pill', 'diet pill', 'slimming tablet',
  'fat burner', 'appetite suppressant',
  // Vaping/Smoking
  'cigarette', 'vape juice', 'cbd oil', 'nicotine', 'e-liquid'
];

// Blocked merchants - entire merchant banned from results
const BLOCKED_MERCHANTS = [
  'bottle club', 'the bottle club', 'wine direct', 'naked wines',
  'virgin wines', 'laithwaites', 'majestic wine', 'beer hawk',
  'brewdog', 'whisky exchange', 'master of malt', 'the drink shop',
  'slimming world', 'weight watchers', 'noom', 'dating direct'
];

const PLATFORM_CONTEXT = `
Sunny is a UK family concierge platform helping parents find:
- Toys and gifts for children (ages 0-16)
- Family days out and attractions
- Kids clothing and shoes
- Family-friendly experiences
- Cinema and entertainment for families
- Party supplies and celebrations

Users are parents/grandparents shopping for children or planning family activities.
`;

interface ScoredResult {
  score: number;
  reason: string;
  flagged: boolean;
}

interface ProductResult {
  name?: string;
  title?: string;
  merchant?: string;
  description?: string;
  price?: number | string;
}

export async function scoreResultRelevance(
  query: string,
  result: ProductResult | null,
  resultIndex: number
): Promise<ScoredResult> {
  if (!result || (!result.name && !result.title)) {
    return {
      score: 0,
      reason: 'EMPTY_SLOT: No result in this position',
      flagged: false
    };
  }

  const resultText = ((result.name || result.title || '') + ' ' + (result.description || '')).toLowerCase();
  const merchantText = (result.merchant || '').toLowerCase();
  
  // Check blocked merchants first
  for (const merchant of BLOCKED_MERCHANTS) {
    if (merchantText.includes(merchant)) {
      return {
        score: 0,
        reason: `BLOCKED_MERCHANT: ${result.merchant}`,
        flagged: true
      };
    }
  }
  
  // Check inappropriate content terms
  for (const term of INAPPROPRIATE_TERMS) {
    if (resultText.includes(term)) {
      return {
        score: 0,
        reason: `INAPPROPRIATE: Contains "${term}"`,
        flagged: true
      };
    }
  }

  const prompt = `You are evaluating search results for a UK family platform called "Sunny" that helps parents find products, activities, and experiences for their children.

${PLATFORM_CONTEXT}

USER'S SEARCH QUERY: "${query}"

RESULT #${resultIndex + 1}:
- Title: ${result.name || result.title || 'N/A'}
- Merchant: ${result.merchant || 'N/A'}
- Description: ${(result.description || '').substring(0, 200)}
- Price: ${result.price || 'N/A'}

SCORING CRITERIA:
5 = PERFECT: Exactly what the user wanted, highly relevant to query and appropriate for families
4 = GOOD: Relevant to the query, makes sense as a result, family-appropriate
3 = ACCEPTABLE: Somewhat related, user might find it useful, not ideal
2 = POOR: Weak connection to query, probably not what user wanted
1 = IRRELEVANT: No meaningful connection to what user searched for
0 = HARMFUL/WRONG: Inappropriate for family platform OR completely wrong category (e.g., car rental for "book tokens")

IMPORTANT CONSIDERATIONS:
- "book tokens" should return book gift vouchers, NOT booking.com/car rental/hotels
- "party bags" should return party supplies, NOT fashion handbags
- "X year old" refers to child's age, NOT warranty periods
- "best toys" should return quality/popular toys, NOT just cheapest
- Results should be FAMILY APPROPRIATE - no adult content, alcohol, gambling, dating

Respond with ONLY a JSON object:
{"score": <0-5>, "reason": "<brief 10-word max explanation>"}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.1
    });

    const content = response.choices[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        score: Math.min(5, Math.max(0, parsed.score)),
        reason: parsed.reason || 'No reason provided',
        flagged: parsed.score <= 1
      };
    }
  } catch (error: any) {
    console.error(`[Relevance Scorer] Error for "${query}" result ${resultIndex}:`, error.message);
  }

  return {
    score: -1,
    reason: 'SCORING_ERROR: API call failed',
    flagged: false
  };
}

export interface AuditResult {
  query: string;
  verdict: string;
  dbCount: number;
  resultCount: number;
  avgScore: string;
  relevancePercent: number;
  flaggedCount: number;
  timeMs: number;
  results: Array<{
    position: number;
    title: string;
    merchant: string;
    price: string;
    score: number;
    reason: string;
    flagged: boolean;
  }>;
  fixAction: string;
}

export async function auditQueryWithScoring(
  query: string,
  searchResults: ProductResult[],
  dbCount: number,
  responseTime: number
): Promise<AuditResult> {
  const paddedResults: (ProductResult | null)[] = [...searchResults];
  while (paddedResults.length < 8) {
    paddedResults.push(null);
  }

  const scoredResults: AuditResult['results'] = [];

  for (let i = 0; i < 8; i++) {
    const result = paddedResults[i];
    const scored = await scoreResultRelevance(query, result, i);
    
    scoredResults.push({
      position: i + 1,
      title: result?.name || result?.title || '',
      merchant: result?.merchant || '',
      price: String(result?.price || ''),
      score: scored.score,
      reason: scored.reason,
      flagged: scored.flagged
    });

    await new Promise(r => setTimeout(r, 50));
  }

  const validScores = scoredResults.filter(r => r.score >= 0 && r.title !== '');
  const avgScore = validScores.length > 0
    ? validScores.reduce((sum, r) => sum + r.score, 0) / validScores.length
    : 0;

  const relevancePercent = Math.round((avgScore / 5) * 100);
  const flaggedCount = scoredResults.filter(r => r.flagged).length;
  const resultCount = scoredResults.filter(r => r.title !== '').length;

  let verdict = 'PASS';
  let fixAction = '';

  if (resultCount === 0 && dbCount > 0) {
    verdict = 'SEARCH_BUG';
    fixAction = 'DB has products but search returned none';
  } else if (resultCount === 0) {
    verdict = 'INVENTORY_GAP';
    fixAction = 'No products in database for this query';
  } else if (flaggedCount > 0) {
    verdict = 'FLAGGED_CONTENT';
    fixAction = `${flaggedCount} results flagged as inappropriate/irrelevant`;
  } else if (avgScore < 2.0) {
    verdict = 'POOR_RELEVANCE';
    fixAction = `Average score ${avgScore.toFixed(1)}/5 - results not matching query`;
  } else if (avgScore < 3.0) {
    verdict = 'WEAK_RELEVANCE';
    fixAction = `Average score ${avgScore.toFixed(1)}/5 - results could be better`;
  } else if (avgScore >= 3.5) {
    verdict = 'PASS';
    fixAction = 'Good relevance score';
  }

  return {
    query,
    verdict,
    dbCount,
    resultCount,
    avgScore: avgScore.toFixed(2),
    relevancePercent,
    flaggedCount,
    timeMs: responseTime,
    results: scoredResults,
    fixAction
  };
}

export async function scoreResults(
  query: string,
  products: Array<{ position: number; title: string; merchant: string; price: string; description?: string }>
): Promise<Array<{ score: number; reason: string; flagged: boolean }>> {
  const results: Array<{ score: number; reason: string; flagged: boolean }> = [];
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const scored = await scoreResultRelevance(
      query,
      { 
        name: product.title, 
        merchant: product.merchant, 
        price: product.price,
        description: product.description 
      },
      i
    );
    
    results.push({
      score: Math.round(scored.score * 100) / 100,
      reason: scored.reason,
      flagged: scored.flagged
    });
    
    await new Promise(r => setTimeout(r, 50));
  }
  
  return results;
}

export function generateCSV(auditResults: AuditResult[]): string {
  const headers = [
    'query', 'verdict', 'dbCount', 'resultCount', 'avgScore', 'relevancePercent', 
    'flaggedCount', 'timeMs',
    'result1_title', 'result1_score', 'result1_reason',
    'result2_title', 'result2_score', 'result2_reason',
    'result3_title', 'result3_score', 'result3_reason',
    'result4_title', 'result4_score', 'result4_reason',
    'result5_title', 'result5_score', 'result5_reason',
    'result6_title', 'result6_score', 'result6_reason',
    'result7_title', 'result7_score', 'result7_reason',
    'result8_title', 'result8_score', 'result8_reason',
    'fixAction'
  ];

  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = auditResults.map(r => {
    const row = [
      r.query, r.verdict, r.dbCount, r.resultCount, r.avgScore, r.relevancePercent,
      r.flaggedCount, r.timeMs
    ];

    for (let i = 0; i < 8; i++) {
      const result = r.results[i] || { title: '', score: 0, reason: '' };
      row.push(result.title, result.score, result.reason);
    }

    row.push(r.fixAction);
    return row.map(escapeCSV).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
