"""
Sunny AI Search - Global Intent Scoring Architecture
=====================================================
No more if-else branches. One algorithm handles ALL queries.

Components:
1. Taxonomy table (database-driven keyword → category mapping)
2. Unified intent extractor (one function, consistent logic)
3. Weight matrix (category × intent → relevance score)
4. pgvector similarity search (semantic matching)
"""

import os
import json
import re
from typing import Optional, List, Dict, Tuple
from dataclasses import dataclass
from openai import OpenAI
import psycopg2
from psycopg2.extras import RealDictCursor

# ============================================================
# CONFIGURATION
# ============================================================

DATABASE_URL = os.getenv("DATABASE_URL")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

client = OpenAI(api_key=OPENAI_API_KEY)


# ============================================================
# 1. TAXONOMY SYSTEM (Database-Driven)
# ============================================================

TAXONOMY_SCHEMA = """
-- Run this once to create the taxonomy table
CREATE TABLE IF NOT EXISTS taxonomy (
    id SERIAL PRIMARY KEY,
    keyword VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(50),
    weight FLOAT DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_keyword ON taxonomy(LOWER(keyword));
CREATE INDEX IF NOT EXISTS idx_taxonomy_category ON taxonomy(category);

-- Example inserts (add hundreds of these via CSV import)
INSERT INTO taxonomy (keyword, category, subcategory, weight) VALUES
-- Footwear
('trainers', 'Footwear', 'Sports', 1.0),
('sneakers', 'Footwear', 'Sports', 1.0),
('wellies', 'Footwear', 'Outdoor', 1.0),
('wellington boots', 'Footwear', 'Outdoor', 1.0),
('boots', 'Footwear', 'General', 0.8),
('shoes', 'Footwear', 'General', 0.7),
('slippers', 'Footwear', 'Indoor', 1.0),
('sandals', 'Footwear', 'Summer', 1.0),

-- Toys
('lego', 'Toys', 'Building', 1.0),
('action figure', 'Toys', 'Figures', 1.0),
('doll', 'Toys', 'Dolls', 1.0),
('plush', 'Toys', 'Soft Toys', 1.0),
('teddy', 'Toys', 'Soft Toys', 1.0),
('board game', 'Toys', 'Games', 1.0),
('puzzle', 'Toys', 'Games', 0.9),

-- Clothing
('t-shirt', 'Clothing', 'Tops', 1.0),
('dress', 'Clothing', 'Dresses', 1.0),
('jacket', 'Clothing', 'Outerwear', 1.0),
('coat', 'Clothing', 'Outerwear', 1.0),
('pyjamas', 'Clothing', 'Sleepwear', 1.0),
('pajamas', 'Clothing', 'Sleepwear', 1.0),

-- Franchises (these boost but don't define category)
('disney', 'Franchise', 'Disney', 1.2),
('marvel', 'Franchise', 'Marvel', 1.2),
('peppa pig', 'Franchise', 'Peppa Pig', 1.2),
('paw patrol', 'Franchise', 'Paw Patrol', 1.2),
('frozen', 'Franchise', 'Disney', 1.2),
('spider-man', 'Franchise', 'Marvel', 1.2),
('spiderman', 'Franchise', 'Marvel', 1.2),
('harry potter', 'Franchise', 'Harry Potter', 1.2),
('pokemon', 'Franchise', 'Pokemon', 1.2),
('bluey', 'Franchise', 'Bluey', 1.2),

-- Age groups
('baby', 'AgeGroup', '0-2', 1.0),
('toddler', 'AgeGroup', '2-4', 1.0),
('kids', 'AgeGroup', '4-12', 0.8),
('children', 'AgeGroup', '4-12', 0.8),
('teen', 'AgeGroup', '12-18', 1.0),

-- Intent modifiers
('gift', 'Intent', 'Gift', 1.1),
('present', 'Intent', 'Gift', 1.1),
('birthday', 'Intent', 'Gift', 1.1),
('christmas', 'Intent', 'Gift', 1.1),
('cheap', 'Intent', 'Budget', 1.0),
('budget', 'Intent', 'Budget', 1.0),
('premium', 'Intent', 'Premium', 1.0),
('luxury', 'Intent', 'Premium', 1.0);
"""


@dataclass
class TaxonomyMatch:
    keyword: str
    category: str
    subcategory: Optional[str]
    weight: float


def get_db_connection():
    """Get PostgreSQL connection"""
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def load_taxonomy(conn) -> Dict[str, TaxonomyMatch]:
    """Load taxonomy into memory for fast lookup"""
    cursor = conn.cursor()
    cursor.execute("SELECT keyword, category, subcategory, weight FROM taxonomy")
    rows = cursor.fetchall()
    
    taxonomy = {}
    for row in rows:
        taxonomy[row['keyword'].lower()] = TaxonomyMatch(
            keyword=row['keyword'],
            category=row['category'],
            subcategory=row['subcategory'],
            weight=row['weight']
        )
    return taxonomy


# ============================================================
# 2. UNIFIED INTENT EXTRACTOR
# ============================================================

@dataclass
class SearchIntent:
    """Structured representation of user's search intent"""
    raw_query: str
    keywords: List[str]
    categories: List[str]
    franchises: List[str]
    age_group: Optional[str]
    intent_type: Optional[str]  # gift, budget, premium
    min_price: Optional[float]
    max_price: Optional[float]
    weights: Dict[str, float]  # category → weight multiplier


def extract_intent(query: str, taxonomy: Dict[str, TaxonomyMatch]) -> SearchIntent:
    """
    ONE function to extract ALL intent. No scattered if-else.
    Consults taxonomy, applies consistent weights.
    """
    query_lower = query.lower()
    words = re.findall(r'\b\w+\b', query_lower)
    
    # Extract price constraints
    min_price, max_price = extract_price_range(query_lower)
    
    # Match against taxonomy
    matched_categories = []
    matched_franchises = []
    matched_age = None
    matched_intent = None
    weights = {}
    keywords = []
    
    # Check single words
    for word in words:
        if word in taxonomy:
            match = taxonomy[word]
            apply_taxonomy_match(match, matched_categories, matched_franchises, 
                               weights, keywords)
            if match.category == 'AgeGroup':
                matched_age = match.subcategory
            if match.category == 'Intent':
                matched_intent = match.subcategory
    
    # Check bigrams (two-word phrases)
    for i in range(len(words) - 1):
        bigram = f"{words[i]} {words[i+1]}"
        if bigram in taxonomy:
            match = taxonomy[bigram]
            apply_taxonomy_match(match, matched_categories, matched_franchises,
                               weights, keywords)
    
    # Check trigrams
    for i in range(len(words) - 2):
        trigram = f"{words[i]} {words[i+1]} {words[i+2]}"
        if trigram in taxonomy:
            match = taxonomy[trigram]
            apply_taxonomy_match(match, matched_categories, matched_franchises,
                               weights, keywords)
    
    # Add remaining words as keywords (excluding stop words)
    stop_words = {'a', 'an', 'the', 'for', 'and', 'or', 'in', 'on', 'at', 'to', 
                  'is', 'are', 'was', 'were', 'i', 'me', 'my', 'want', 'need',
                  'looking', 'find', 'get', 'buy', 'under', 'over', 'below', 'above'}
    for word in words:
        if word not in stop_words and word not in [k.lower() for k in keywords]:
            keywords.append(word)
    
    return SearchIntent(
        raw_query=query,
        keywords=keywords,
        categories=list(set(matched_categories)),
        franchises=list(set(matched_franchises)),
        age_group=matched_age,
        intent_type=matched_intent,
        min_price=min_price,
        max_price=max_price,
        weights=weights
    )


def apply_taxonomy_match(match: TaxonomyMatch, categories: List, 
                         franchises: List, weights: Dict, keywords: List):
    """Apply a taxonomy match to the appropriate lists"""
    if match.category == 'Franchise':
        franchises.append(match.subcategory)
        keywords.append(match.keyword)
    elif match.category not in ('AgeGroup', 'Intent'):
        categories.append(match.category)
        keywords.append(match.keyword)
    
    # Apply weight
    weights[match.keyword] = match.weight


def extract_price_range(query: str) -> Tuple[Optional[float], Optional[float]]:
    """Extract price constraints from query"""
    min_price = None
    max_price = None
    
    # "under £20", "below £50"
    under_match = re.search(r'(?:under|below|less than|max|up to)\s*£?\s*(\d+)', query)
    if under_match:
        max_price = float(under_match.group(1))
    
    # "over £10", "above £5", "at least £15"
    over_match = re.search(r'(?:over|above|more than|min|at least)\s*£?\s*(\d+)', query)
    if over_match:
        min_price = float(over_match.group(1))
    
    # "£10-£20", "£10 to £20"
    range_match = re.search(r'£?\s*(\d+)\s*(?:-|to)\s*£?\s*(\d+)', query)
    if range_match:
        min_price = float(range_match.group(1))
        max_price = float(range_match.group(2))
    
    return min_price, max_price


# ============================================================
# 3. WEIGHT MATRIX & SCORING
# ============================================================

# Category × Intent weight adjustments
INTENT_CATEGORY_WEIGHTS = {
    # (intent_type, category) → weight multiplier
    ('Gift', 'Toys'): 1.3,
    ('Gift', 'Games'): 1.2,
    ('Gift', 'Clothing'): 1.1,
    ('Budget', 'Toys'): 1.0,
    ('Budget', 'Clothing'): 1.1,
    ('Premium', 'Toys'): 0.9,  # Premium toys are rarer
    ('Premium', 'Clothing'): 1.2,
}


def calculate_relevance_score(product: Dict, intent: SearchIntent) -> float:
    """
    ONE scoring function. Consistent weights. No if-else branching.
    """
    score = 0.0
    name_lower = product['name'].lower()
    desc_lower = (product.get('description') or '').lower()
    search_tags = (product.get('search_tags') or '').lower()
    combined_text = f"{name_lower} {desc_lower} {search_tags}"
    
    # 1. Keyword matches (base score)
    for keyword in intent.keywords:
        weight = intent.weights.get(keyword, 1.0)
        if keyword in name_lower:
            score += 10.0 * weight  # Name match = high value
        elif keyword in combined_text:
            score += 5.0 * weight   # Description/tags match = medium value
    
    # 2. Category match bonus
    product_category = (product.get('category') or '').lower()
    for cat in intent.categories:
        if cat.lower() in product_category:
            score += 15.0
    
    # 3. Franchise match bonus (BIG boost when franchise specified)
    product_brand = (product.get('brand') or '').lower()
    for franchise in intent.franchises:
        if franchise.lower() in product_brand or franchise.lower() in name_lower:
            score += 20.0
    
    # 4. Intent × Category weight matrix
    if intent.intent_type:
        for cat in intent.categories:
            key = (intent.intent_type, cat)
            if key in INTENT_CATEGORY_WEIGHTS:
                score *= INTENT_CATEGORY_WEIGHTS[key]
    
    # 5. Price relevance (products closer to budget = better)
    price = product.get('price') or 0
    if intent.max_price and price > 0:
        if price <= intent.max_price:
            # Prefer products that use more of the budget (better value perception)
            budget_usage = price / intent.max_price
            score += 5.0 * budget_usage
        else:
            score -= 50.0  # Heavy penalty for over budget
    
    if intent.min_price and price > 0:
        if price < intent.min_price:
            score -= 50.0  # Heavy penalty for under minimum
    
    # 6. Image availability bonus (users want to see products)
    if product.get('image_url'):
        score += 3.0
    
    # 7. In-stock bonus
    if product.get('in_stock'):
        score += 5.0
    
    return score


# ============================================================
# 4. SEARCH EXECUTION (PostgreSQL + pgvector)
# ============================================================

def search_products(intent: SearchIntent, limit: int = 10) -> List[Dict]:
    """
    Execute search against PostgreSQL.
    Uses taxonomy-driven filtering + relevance scoring.
    ZERO hallucination - all data from database.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Build WHERE clause dynamically
    conditions = ["in_stock = true"]
    params = []
    
    # Price filters
    if intent.max_price:
        conditions.append("price <= %s")
        params.append(intent.max_price)
    
    if intent.min_price:
        conditions.append("price >= %s")
        params.append(intent.min_price)
    
    # Keyword search (name, description, search_tags)
    if intent.keywords:
        keyword_conditions = []
        for kw in intent.keywords:
            keyword_conditions.append(
                "(LOWER(name) LIKE %s OR LOWER(description) LIKE %s OR LOWER(search_tags) LIKE %s)"
            )
            pattern = f"%{kw}%"
            params.extend([pattern, pattern, pattern])
        
        if keyword_conditions:
            conditions.append(f"({' OR '.join(keyword_conditions)})")
    
    # Category filter
    if intent.categories:
        cat_conditions = []
        for cat in intent.categories:
            cat_conditions.append("LOWER(category) LIKE %s")
            params.append(f"%{cat.lower()}%")
        conditions.append(f"({' OR '.join(cat_conditions)})")
    
    # Franchise/brand filter
    if intent.franchises:
        franchise_conditions = []
        for franchise in intent.franchises:
            franchise_conditions.append(
                "(LOWER(brand) LIKE %s OR LOWER(name) LIKE %s)"
            )
            pattern = f"%{franchise.lower()}%"
            params.extend([pattern, pattern])
        conditions.append(f"({' OR '.join(franchise_conditions)})")
    
    where_clause = " AND ".join(conditions)
    
    # Fetch candidates (get more than needed for re-ranking)
    query = f"""
        SELECT id, name, description, price, currency, merchant, merchant_id,
               category, brand, affiliate_link, image_url, in_stock, search_tags
        FROM products
        WHERE {where_clause}
        LIMIT %s
    """
    params.append(limit * 5)  # Fetch 5x for re-ranking
    
    cursor.execute(query, params)
    candidates = cursor.fetchall()
    conn.close()
    
    # Score and rank
    scored_products = []
    for product in candidates:
        score = calculate_relevance_score(dict(product), intent)
        scored_products.append((score, dict(product)))
    
    # Sort by score descending
    scored_products.sort(key=lambda x: x[0], reverse=True)
    
    # Return top N
    return [p[1] for p in scored_products[:limit]]


# ============================================================
# 5. SEARCH TAGS GENERATOR (Run once on all products)
# ============================================================

def generate_search_tags(product: Dict) -> str:
    """
    Generate searchable tags from product description.
    Run this ONCE on all 115k products, store in search_tags column.
    """
    name = product.get('name', '')
    description = product.get('description', '')
    
    if not description or len(description) < 20:
        return ''
    
    prompt = f"""Extract searchable keywords from this product. Return ONLY a comma-separated list of:
- Age groups (baby, toddler, kids, teens)
- Use cases (outdoor, indoor, educational, creative)
- Key features (waterproof, wooden, electronic)
- Gift occasions (birthday, christmas)
- Any franchise/character names

Product: {name}
Description: {description[:500]}

Keywords only, no explanation:"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=100
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error generating tags: {e}")
        return ''


def batch_generate_search_tags(batch_size: int = 100):
    """
    Process all products without search_tags.
    Run this as a one-time job.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get products needing tags
    cursor.execute("""
        SELECT id, name, description 
        FROM products 
        WHERE search_tags IS NULL OR search_tags = ''
        LIMIT %s
    """, (batch_size,))
    
    products = cursor.fetchall()
    
    for product in products:
        tags = generate_search_tags(dict(product))
        cursor.execute(
            "UPDATE products SET search_tags = %s WHERE id = %s",
            (tags, product['id'])
        )
        print(f"Tagged: {product['name'][:50]}... → {tags[:50]}...")
    
    conn.commit()
    conn.close()
    print(f"Processed {len(products)} products")


# ============================================================
# 6. API ENDPOINT
# ============================================================

def search_api(query: str, limit: int = 8) -> Dict:
    """
    Main API entry point.
    Returns structured response with products.
    """
    conn = get_db_connection()
    taxonomy = load_taxonomy(conn)
    conn.close()
    
    # Extract intent using taxonomy
    intent = extract_intent(query, taxonomy)
    
    # Search products
    products = search_products(intent, limit)
    
    # Format response
    return {
        "query": query,
        "intent": {
            "keywords": intent.keywords,
            "categories": intent.categories,
            "franchises": intent.franchises,
            "age_group": intent.age_group,
            "intent_type": intent.intent_type,
            "price_range": {
                "min": intent.min_price,
                "max": intent.max_price
            }
        },
        "products": [
            {
                "id": p['id'],
                "name": p['name'],
                "description": (p.get('description') or '')[:200],
                "price": p['price'],
                "currency": p.get('currency', 'GBP'),
                "merchant": p['merchant'],
                "brand": p.get('brand'),
                "category": p.get('category'),
                "affiliateLink": p['affiliate_link'],
                "imageUrl": p.get('image_url'),
                "inStock": p.get('in_stock', True)
            }
            for p in products
        ],
        "count": len(products)
    }


# ============================================================
# USAGE EXAMPLE
# ============================================================

if __name__ == "__main__":
    # Test the search
    test_queries = [
        "Disney trainers for toddler under £20",
        "Peppa Pig wellies",
        "LEGO birthday gift",
        "outdoor toys for kids",
        "Marvel t-shirt age 5",
        "cheap baby gifts"
    ]
    
    for query in test_queries:
        print(f"\n{'='*60}")
        print(f"Query: {query}")
        print('='*60)
        
        result = search_api(query)
        print(f"Intent: {result['intent']}")
        print(f"Found: {result['count']} products")
        
        for p in result['products'][:3]:
            print(f"  - {p['name'][:50]} | £{p['price']} | {p['merchant']}")
