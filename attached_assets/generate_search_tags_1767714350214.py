"""
Search Tags Generator
=====================
Run this ONCE to add AI-generated search tags to all 115k products.
This enriches the description into searchable keywords.

Estimated cost: ~$5-10 for 115k products using gpt-4o-mini
Estimated time: ~2-3 hours (with rate limiting)

Usage:
    python generate_search_tags.py --batch-size 100 --delay 0.5
"""

import os
import sys
import time
import argparse
import psycopg2
from psycopg2.extras import RealDictCursor
from openai import OpenAI

DATABASE_URL = os.getenv("DATABASE_URL")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

client = OpenAI(api_key=OPENAI_API_KEY)


def get_db_connection():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def generate_tags(name: str, description: str) -> str:
    """Generate searchable tags from product name and description"""
    
    if not description or len(description.strip()) < 20:
        return ""
    
    prompt = f"""Extract search keywords from this children's/family product. Return ONLY a comma-separated list.

Include:
- Age suitability (baby, toddler, kids 3-5, kids 6-8, teens)
- Gender if specific (boys, girls, unisex)
- Use context (indoor, outdoor, educational, creative, bedtime)
- Material/features (wooden, plastic, electronic, waterproof)
- Gift occasions (birthday, christmas, party)
- Activity type (building, reading, active play, pretend play)
- Any character/franchise names mentioned

Product: {name}
Description: {description[:600]}

Keywords only (comma-separated, no explanation):"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=150
        )
        tags = response.choices[0].message.content.strip()
        # Clean up
        tags = tags.replace('\n', ', ').replace('  ', ' ')
        return tags[:500]  # Limit length
    except Exception as e:
        print(f"  Error: {e}")
        return ""


def process_batch(batch_size: int, delay: float):
    """Process one batch of products"""
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get products without tags
    cursor.execute("""
        SELECT id, name, description 
        FROM products 
        WHERE (search_tags IS NULL OR search_tags = '')
          AND description IS NOT NULL 
          AND LENGTH(description) > 20
        ORDER BY id
        LIMIT %s
    """, (batch_size,))
    
    products = cursor.fetchall()
    
    if not products:
        print("✅ All products have been tagged!")
        return 0
    
    processed = 0
    for product in products:
        tags = generate_tags(product['name'], product['description'])
        
        if tags:
            cursor.execute(
                "UPDATE products SET search_tags = %s WHERE id = %s",
                (tags, product['id'])
            )
            processed += 1
            print(f"✓ {product['name'][:50]}...")
            print(f"  → {tags[:80]}...")
        else:
            # Mark as processed even if no tags (to avoid reprocessing)
            cursor.execute(
                "UPDATE products SET search_tags = '' WHERE id = %s",
                (product['id'],)
            )
        
        time.sleep(delay)  # Rate limiting
    
    conn.commit()
    conn.close()
    
    return processed


def get_stats():
    """Get tagging progress stats"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM products")
    total = cursor.fetchone()['count']
    
    cursor.execute("SELECT COUNT(*) FROM products WHERE search_tags IS NOT NULL AND search_tags != ''")
    tagged = cursor.fetchone()['count']
    
    cursor.execute("SELECT COUNT(*) FROM products WHERE description IS NOT NULL AND LENGTH(description) > 20")
    taggable = cursor.fetchone()['count']
    
    conn.close()
    
    return {
        'total': total,
        'tagged': tagged,
        'taggable': taggable,
        'remaining': taggable - tagged
    }


def main():
    parser = argparse.ArgumentParser(description='Generate search tags for products')
    parser.add_argument('--batch-size', type=int, default=100, help='Products per batch')
    parser.add_argument('--delay', type=float, default=0.3, help='Delay between API calls (seconds)')
    parser.add_argument('--batches', type=int, default=1, help='Number of batches to run (0 = all)')
    parser.add_argument('--stats', action='store_true', help='Show stats only')
    
    args = parser.parse_args()
    
    print("🏷️  Sunny Search Tags Generator")
    print("=" * 50)
    
    stats = get_stats()
    print(f"📊 Total products: {stats['total']:,}")
    print(f"   With descriptions: {stats['taggable']:,}")
    print(f"   Already tagged: {stats['tagged']:,}")
    print(f"   Remaining: {stats['remaining']:,}")
    
    if args.stats:
        return
    
    if stats['remaining'] == 0:
        print("\n✅ All products are tagged!")
        return
    
    print(f"\n🚀 Starting... (batch size: {args.batch_size}, delay: {args.delay}s)")
    
    batches_run = 0
    total_processed = 0
    
    while True:
        processed = process_batch(args.batch_size, args.delay)
        total_processed += processed
        batches_run += 1
        
        if processed == 0:
            break
        
        print(f"\n📦 Batch {batches_run} complete: {processed} products tagged")
        print(f"   Total this session: {total_processed}")
        
        if args.batches > 0 and batches_run >= args.batches:
            print(f"\n⏸️  Stopping after {args.batches} batches")
            break
    
    print(f"\n✅ Session complete: {total_processed} products tagged")
    
    stats = get_stats()
    print(f"📊 Progress: {stats['tagged']:,} / {stats['taggable']:,} ({100*stats['tagged']/stats['taggable']:.1f}%)")


if __name__ == "__main__":
    main()
