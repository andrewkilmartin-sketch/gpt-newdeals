// CJ Product Import Script - FIXED VERSION
// Based on CTO instructions with corrected CJ GraphQL schema

import { db } from '../db';
import { products } from '@shared/schema';

const CJ_API_TOKEN = process.env.CJ_API_TOKEN;
const CJ_PUBLISHER_ID = process.env.CJ_PUBLISHER_ID;

// CJ GraphQL endpoint (correct URL)
const CJ_API_URL = 'https://ads.api.cj.com/query';

// Simple GraphQL query for products - using correct field names
async function fetchCJProducts(keywords: string, limit: number = 100, offset: number = 0) {
  const query = `
    query {
      products(
        companyId: "${CJ_PUBLISHER_ID}"
        partnerStatus: JOINED
        limit: ${limit}
        offset: ${offset}
        ${keywords ? `keywords: "${keywords}"` : ''}
      ) {
        totalCount
        count
        resultList {
          catalogId
          title
          description
          link
          imageLink
          price {
            amount
            currency
          }
          brand
          advertiserName
          advertiserId
          advertiserCountry
        }
      }
    }
  `;

  const response = await fetch(CJ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CJ_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('CJ API Error:', response.status, text);
    throw new Error(`CJ API Error: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.errors) {
    console.error('GraphQL Errors:', data.errors);
    throw new Error(data.errors[0]?.message || 'GraphQL Error');
  }

  return data.data.products;
}

// Convert CJ product to our DB format
function convertToDBProduct(cjProduct: any) {
  return {
    id: `cj_${cjProduct.catalogId}`,
    name: cjProduct.title || 'Unknown Product',
    description: cjProduct.description || '',
    merchant: cjProduct.advertiserName || 'Unknown',
    merchantId: cjProduct.advertiserId?.toString() || '',
    category: null,
    brand: cjProduct.brand || '',
    price: parseFloat(cjProduct.price?.amount) || 0,
    affiliateLink: cjProduct.link || '',
    imageUrl: cjProduct.imageLink || '',
    inStock: true,
    source: 'cj',
  };
}

// Main import function
async function importCJProducts() {
  console.log('=== CJ PRODUCT IMPORT STARTED ===');
  console.log('Publisher ID:', CJ_PUBLISHER_ID);
  
  if (!CJ_API_TOKEN || !CJ_PUBLISHER_ID) {
    console.error('Missing CJ_API_TOKEN or CJ_PUBLISHER_ID');
    return;
  }

  // Expanded keywords for comprehensive UK family product catalog
  const keywords = [
    // Popular toys & brands
    'barbie', 'playmobil', 'sylvanian families', 'lego', 'hot wheels',
    'pokemon', 'cocomelon', 'baby shark', 'thomas train', 'paddington',
    'peppa pig', 'paw patrol', 'disney', 'marvel', 'frozen', 'bluey',
    'minecraft', 'fortnite', 'harry potter', 'star wars',
    // Kids shoes
    'dr martens kids', 'clarks kids', 'start rite', 'geox kids',
    'nike kids', 'adidas kids', 'crocs kids', 'converse kids', 'vans kids',
    'school shoes', 'kids trainers', 'kids boots', 'kids sandals',
    // Kids clothing
    'kids clothing', 'boys clothing', 'girls clothing', 'baby clothing',
    'kids jacket', 'kids dress', 'school uniform', 'kids jeans',
    // Baby & toddler
    'baby toys', 'toddler toys', 'baby gear', 'pushchair', 'car seat',
    'baby monitor', 'baby feeding', 'nappies', 'baby clothes',
    // Family home
    'home', 'kitchen', 'garden', 'furniture', 'bedding', 'storage',
    // Electronics & games
    'games', 'console', 'tablet kids', 'headphones kids',
    // General shopping
    'gift', 'christmas', 'birthday', 'present', 'toys',
    'fashion', 'accessories', 'bags', 'watches', 'jewellery',
  ];

  let totalImported = 0;
  let totalErrors = 0;

  for (const keyword of keywords) {
    console.log(`\n--- Importing: "${keyword}" ---`);
    
    let offset = 0;
    const limit = 100;
    let keywordTotal = 0;

    try {
      while (offset < 10000) { // Max 10000 per keyword (CJ offset limit)
        console.log(`  Fetching offset ${offset}...`);
        
        const result = await fetchCJProducts(keyword, limit, offset);
        
        if (!result?.resultList?.length) {
          console.log(`  No more results for "${keyword}"`);
          break;
        }

        console.log(`  Got ${result.resultList.length} products (total available: ${result.totalCount})`);

        // Insert into database
        for (const cjProduct of result.resultList) {
          try {
            const dbProduct = convertToDBProduct(cjProduct);
            
            // Upsert - insert or update on conflict
            await db.insert(products)
              .values(dbProduct)
              .onConflictDoUpdate({
                target: products.id,
                set: {
                  name: dbProduct.name,
                  price: dbProduct.price,
                  inStock: dbProduct.inStock,
                  imageUrl: dbProduct.imageUrl,
                }
              });
            
            keywordTotal++;
            totalImported++;
          } catch (dbError) {
            totalErrors++;
            // Continue on individual product errors
          }
        }

        offset += limit;

        // Rate limit: wait 3 seconds between API calls
        await new Promise(r => setTimeout(r, 3000));
      }

      console.log(`  ✓ Imported ${keywordTotal} products for "${keyword}"`);
      
    } catch (error) {
      console.error(`  ✗ Error importing "${keyword}":`, error);
      totalErrors++;
    }

    // Pause between keywords
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n=== IMPORT COMPLETE ===');
  console.log(`Total imported: ${totalImported}`);
  console.log(`Total errors: ${totalErrors}`);
}

// Run the import
importCJProducts()
  .then(() => {
    console.log('Import finished');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  });
