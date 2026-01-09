const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function importZavvi() {
  const csv = fs.readFileSync('/tmp/datafeed_511345.csv', 'utf-8');
  const lines = csv.split('\n').slice(1); // Skip header
  
  console.log(`Processing ${lines.length} lines...`);
  
  let imported = 0, skipped = 0, errors = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Parse CSV with proper quote handling
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const [
      affiliateLink, name, productId, merchantProductId, imageUrl, 
      description, category, price, merchant, merchantId
    ] = values;
    
    if (!productId || !name) continue;
    
    // Get brand from column 22 (index 21)
    const brand = values[21] || '';
    
    try {
      await pool.query(`
        INSERT INTO products (id, name, description, merchant, merchant_id, category, brand, price, affiliate_link, image_url, in_stock, source)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO NOTHING
      `, [
        productId,
        name.replace(/^"|"$/g, ''),
        (description || '').replace(/^"|"$/g, '').slice(0, 500),
        merchant.replace(/^"|"$/g, ''),
        parseInt(merchantId) || null,
        category.replace(/^"|"$/g, ''),
        brand.replace(/^"|"$/g, ''),
        parseFloat(price) || 0,
        affiliateLink,
        imageUrl,
        true,
        'awin'
      ]);
      imported++;
    } catch (e) {
      if (e.code === '23505') skipped++;
      else { errors++; if (errors < 5) console.error('Error:', e.message); }
    }
    
    if ((i + 1) % 2000 === 0) {
      console.log(`Progress: ${i + 1}/${lines.length} | Imported: ${imported} | Skipped: ${skipped}`);
    }
  }
  
  console.log(`\n=== IMPORT COMPLETE ===`);
  console.log(`Total imported: ${imported}`);
  console.log(`Skipped (duplicates): ${skipped}`);
  console.log(`Errors: ${errors}`);
  
  await pool.end();
}

importZavvi().catch(console.error);
