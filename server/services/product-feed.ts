import { createReadStream, existsSync } from 'fs';
import { createInterface } from 'readline';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import MiniSearch from 'minisearch';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  merchant: string;
  merchantId: number;
  category: string;
  brand: string;
  affiliateLink: string;
  imageUrl: string;
  inStock: boolean;
}

interface IndexedProduct extends Product {
  searchText: string;
}

let productsCache: Product[] = [];
let productIndex: MiniSearch<IndexedProduct> | null = null;
let isLoaded = false;
let isLoading = false;
let loadedFromPath = '';
let loadError = '';

// Export diagnostic info for health checks
export function getProductDiagnostics() {
  return {
    productCount: productsCache.length,
    isLoaded,
    isLoading,
    loadedFromPath,
    loadError,
    pathsChecked: [
      resolve(process.cwd(), 'server/data/products.csv'),
      resolve(process.cwd(), 'dist/data/products.csv'),
      resolve(process.cwd(), 'data/products.csv'),
    ]
  };
}

// Base synonym definitions - will be expanded bidirectionally
const BASE_SYNONYMS: Record<string, string[]> = {
  'pyjamas': ['sleepsuit', 'pajamas', 'nightwear', 'pjs', 'onesie', 'babygrow', 'sleepwear', 'nightsuit'],
  'trainers': ['sneakers', 'shoes', 'running shoes', 'footwear', 'kicks'],
  'toys': ['toy', 'playset', 'plaything', 'game'],
  'car': ['cars', 'vehicle', 'automobile', 'motor'],
  'rc': ['remote control', 'radio control', 'remote-control'],
  'kids': ['children', 'child', 'childrens', "children's", 'boys', 'girls', 'baby', 'toddler', 'infant'],
  'lego': ['building blocks', 'bricks', 'construction'],
  'barbie': ['doll', 'dolls', 'mattel'],
  'marvel': ['avengers', 'spider-man', 'spiderman', 'hulk', 'iron man', 'captain america', 'thor', 'mcu', 'superhero'],
  'disney': ['pixar', 'frozen', 'princess', 'mickey'],
  'gift': ['gifts', 'present', 'presents'],
  'clothes': ['clothing', 'wear', 'apparel', 'outfit'],
  't-shirt': ['tshirt', 'tee', 'top', 'shirt'],
};

// Build bidirectional synonym map - every synonym points to every other synonym in its group
function buildBidirectionalSynonyms(): Record<string, Set<string>> {
  const biMap: Record<string, Set<string>> = {};
  
  for (const [key, values] of Object.entries(BASE_SYNONYMS)) {
    // Create a group containing the key and all its values
    const group = [key, ...values];
    
    // For each word in the group, map it to all OTHER words in the group
    for (const word of group) {
      if (!biMap[word]) {
        biMap[word] = new Set();
      }
      for (const otherWord of group) {
        if (otherWord !== word) {
          biMap[word].add(otherWord);
        }
      }
    }
  }
  
  return biMap;
}

// Pre-computed bidirectional synonyms (built once at module load)
const BIDIRECTIONAL_SYNONYMS = buildBidirectionalSynonyms();

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
  if (!priceStr) return 0;
  const cleaned = priceStr.replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}

// Known brands to extract from product names
const KNOWN_BRANDS = [
  'Disney', 'LEGO', 'Barbie', 'Mattel', 'Hasbro', 'Fisher-Price', 'Peppa Pig',
  'Paw Patrol', 'Marvel', 'Star Wars', 'Pokemon', 'Nintendo', 'Nerf', 'Hot Wheels',
  'Play-Doh', 'My Little Pony', 'Frozen', 'Thomas', 'Bluey', 'CoComelon',
  'Nike', 'Adidas', 'Clarks', 'M&S', 'Next', 'John Lewis', 'Boots',
  'Tommee Tippee', 'Pampers', 'Huggies', 'Chicco', 'Joie', 'Silver Cross'
];

function extractBrand(name: string, merchant: string): string {
  const nameLower = name.toLowerCase();
  for (const brand of KNOWN_BRANDS) {
    if (nameLower.includes(brand.toLowerCase())) {
      return brand;
    }
  }
  // If no known brand found, use first word if it looks like a brand (capitalized)
  const firstWord = name.split(' ')[0];
  if (firstWord && firstWord.length > 2 && firstWord[0] === firstWord[0].toUpperCase()) {
    return firstWord;
  }
  return merchant; // Fall back to merchant name
}

function getQuerySynonyms(word: string): string[] {
  const synonymSet = BIDIRECTIONAL_SYNONYMS[word.toLowerCase()];
  return synonymSet ? Array.from(synonymSet) : [];
}

export async function loadProductFeed(): Promise<Product[]> {
  if (isLoaded) {
    return productsCache;
  }
  
  if (isLoading) {
    while (isLoading) {
      await new Promise(r => setTimeout(r, 100));
    }
    return productsCache;
  }
  
  isLoading = true;
  console.log('Loading product datafeed...');
  const startTime = Date.now();
  
  // Try multiple paths for dev vs production
  const possiblePaths = [
    resolve(process.cwd(), 'server/data/products.csv'),  // Development
    resolve(process.cwd(), 'dist/data/products.csv'),    // Production (copied during build)
    resolve(process.cwd(), 'data/products.csv'),         // Alternative production path
  ];
  
  let filePath = '';
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      filePath = path;
      console.log(`Found products.csv at: ${path}`);
      break;
    }
  }
  
  if (!filePath) {
    console.error('ERROR: products.csv not found in any expected location!');
    console.error('Tried paths:', possiblePaths);
    loadError = 'products.csv not found in any location';
    isLoading = false;
    return [];
  }
  
  loadedFromPath = filePath;
  
  try {
    const products: IndexedProduct[] = [];
    const stream = createReadStream(filePath, { encoding: 'utf8' });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    
    let isHeader = true;
    let lineCount = 0;
    
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
        const id = cols[2] || '';
        const imageUrl = cols[4] || cols[12] || ''; // merchant_image_url or aw_image_url
        const description = cols[5] || '';
        const merchantCategory = cols[6] || '';
        const price = parsePrice(cols[7] || '');
        const merchant = cols[8] || '';
        const merchantId = parseInt(cols[9]) || 0;
        const category = cols[10] || merchantCategory || '';
        // Extract brand from product name (common patterns: "Brand Name Product...")
        const brand = extractBrand(name, merchant);
        // Check number_available (col 31) or assume in stock
        const numAvailable = parseInt(cols[31]) || 0;
        const inStock = numAvailable > 0 || !cols[31]; // If no stock info, assume available
        
        if (!affiliateLink || !name || !affiliateLink.includes('awin')) {
          continue;
        }
        
        const searchText = `${name} ${description} ${brand} ${category} ${merchant}`.toLowerCase();
        
        products.push({
          id,
          name,
          description,
          price,
          currency: 'GBP',
          merchant,
          merchantId,
          category,
          brand,
          affiliateLink,
          imageUrl,
          inStock,
          searchText
        });
        
      } catch (err) {
        continue;
      }
      
      if (lineCount % 10000 === 0) {
        console.log(`Processed ${lineCount} products...`);
      }
    }
    
    console.log(`Building search index for ${products.length} products...`);
    
    productIndex = new MiniSearch<IndexedProduct>({
      fields: ['name', 'description', 'brand', 'category', 'merchant', 'searchText'],
      storeFields: ['id', 'name', 'description', 'price', 'currency', 'merchant', 'merchantId', 'category', 'brand', 'affiliateLink', 'imageUrl', 'inStock'],
      searchOptions: {
        boost: { name: 3, brand: 2, category: 1.5 },
        fuzzy: 0.2,
        prefix: true,
      },
      idField: 'id'
    });
    
    productIndex.addAll(products);
    
    productsCache = products;
    isLoaded = true;
    isLoading = false;
    
    console.log(`Product feed loaded and indexed: ${products.length} products in ${Date.now() - startTime}ms`);
    return products;
    
  } catch (error) {
    console.error('Error loading product feed:', error);
    isLoading = false;
    return [];
  }
}

export function searchProducts(
  query?: string,
  category?: string,
  limit: number = 10
): Product[] {
  if (!isLoaded || !productIndex || productsCache.length === 0) {
    console.log('Product index not ready');
    return [];
  }
  
  if (!query && !category) {
    return productsCache.slice(0, limit);
  }
  
  let results: Product[] = [];
  
  if (query) {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
    console.log(`Searching for: "${query}" (terms: ${queryTerms.join(', ')})`);
    
    // Step 1: Search with original terms (AND logic - all terms must match)
    let searchResults = productIndex.search(query, {
      combineWith: 'AND',
      fuzzy: 0.2,
      prefix: true,
      boost: { name: 3, brand: 2, category: 1.5 }
    });
    
    console.log(`AND search found ${searchResults.length} results`);
    
    // Step 2: If no results, try with synonyms for each term
    if (searchResults.length === 0 && queryTerms.length > 0) {
      console.log('No AND results, trying synonym expansion...');
      
      // Build expanded queries: keep original structure but add synonym alternatives
      const synonymQueries: string[] = [];
      
      for (const term of queryTerms) {
        const synonyms = getQuerySynonyms(term);
        if (synonyms.length > 0) {
          // Try replacing each term with its synonyms one at a time
          for (const syn of synonyms.slice(0, 3)) { // Limit to top 3 synonyms
            const expandedTerms = queryTerms.map(t => t === term ? syn : t);
            synonymQueries.push(expandedTerms.join(' '));
          }
        }
      }
      
      // Search each synonym query and collect unique results
      const seenIds = new Set<string>();
      const synonymResults: typeof searchResults = [];
      
      for (const synQuery of synonymQueries) {
        console.log(`  Trying synonym query: "${synQuery}"`);
        const synSearchResults = productIndex.search(synQuery, {
          combineWith: 'AND',
          fuzzy: 0.2,
          prefix: true,
          boost: { name: 3, brand: 2, category: 1.5 }
        });
        
        for (const r of synSearchResults) {
          if (!seenIds.has(r.id as string)) {
            seenIds.add(r.id as string);
            // Slightly lower score for synonym matches
            synonymResults.push({ ...r, score: (r.score || 0) * 0.9 });
          }
        }
      }
      
      console.log(`Synonym expansion found ${synonymResults.length} results`);
      searchResults = synonymResults;
    }
    
    // Step 3: If still no results, try OR with original terms (more relaxed)
    if (searchResults.length === 0) {
      console.log('No synonym results, trying OR search...');
      searchResults = productIndex.search(query, {
        combineWith: 'OR',
        fuzzy: 0.2,
        prefix: true,
        boost: { name: 3, brand: 2, category: 1.5 }
      });
      
      // Filter OR results to require at least half the terms
      if (queryTerms.length > 1) {
        searchResults = searchResults.filter(result => {
          const text = `${result.name} ${result.description} ${result.brand} ${result.category}`.toLowerCase();
          const matchCount = queryTerms.filter(term => text.includes(term)).length;
          return matchCount >= Math.ceil(queryTerms.length / 2);
        });
      }
      console.log(`Filtered OR search found ${searchResults.length} results`);
    }
    
    results = searchResults.map(result => ({
      id: result.id as string,
      name: result.name as string,
      description: result.description as string,
      price: result.price as number,
      currency: result.currency as string,
      merchant: result.merchant as string,
      merchantId: result.merchantId as number,
      category: result.category as string,
      brand: result.brand as string,
      affiliateLink: result.affiliateLink as string,
      imageUrl: result.imageUrl as string,
      inStock: result.inStock as boolean,
    }));
  } else {
    results = productsCache;
  }
  
  if (category) {
    const catLower = category.toLowerCase();
    results = results.filter(product => {
      const productCat = `${product.category} ${product.merchant}`.toLowerCase();
      return productCat.includes(catLower);
    });
  }
  
  const inStockFirst = results.sort((a, b) => {
    if (a.inStock && !b.inStock) return -1;
    if (!a.inStock && b.inStock) return 1;
    return 0;
  });
  
  return inStockFirst.slice(0, limit);
}

export function isProductFeedLoaded(): boolean {
  return isLoaded;
}

export function getProductCount(): number {
  return productsCache.length;
}
