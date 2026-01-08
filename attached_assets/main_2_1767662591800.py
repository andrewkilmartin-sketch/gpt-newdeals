"""
Sunny AI Family Product Search
Simple AI-powered search for 115k affiliate products
No hallucinations - only returns products that exist in YOUR database
"""

import os
import json
import sqlite3
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from openai import OpenAI

# Initialize FastAPI
app = FastAPI(title="Sunny AI Family Search", version="1.0.0")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Database path
DB_PATH = "products.db"


class SearchRequest(BaseModel):
    query: str
    limit: Optional[int] = 8


class Product(BaseModel):
    id: str
    name: str
    description: str
    price: float
    currency: str
    merchant: str
    merchantId: str
    category: str
    brand: str
    affiliateLink: str
    imageUrl: str
    inStock: bool


def get_db_connection():
    """Get SQLite database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def extract_search_terms(query: str) -> dict:
    """
    Use GPT-4o-mini to understand the search intent
    Returns structured search parameters - NO product fabrication
    """
    system_prompt = """You are a search query analyzer for a UK family products database.
Your job is to extract search parameters from natural language queries.

IMPORTANT: You are NOT generating products. You are ONLY extracting search terms.

Return a JSON object with these optional fields:
- keywords: list of search terms to match against product names/descriptions
- brand: specific brand if mentioned (Disney, LEGO, Peppa Pig, Marvel, etc.)
- category: product category if clear (toys, clothing, books, games, etc.)
- max_price: maximum price in GBP if mentioned
- min_price: minimum price in GBP if mentioned
- age_group: if mentioned (baby, toddler, kids, teens, family)
- merchant: specific retailer if mentioned (Boots, M&S, Zavvi, etc.)

Examples:
"Disney toys under £20" -> {"keywords": ["disney", "toys"], "brand": "Disney", "max_price": 20}
"LEGO for 8 year old" -> {"keywords": ["lego"], "brand": "LEGO", "age_group": "kids"}
"gifts from Boots" -> {"keywords": ["gifts"], "merchant": "Boots"}
"outdoor games for family" -> {"keywords": ["outdoor", "games", "family"], "category": "games"}

Return ONLY valid JSON, no explanation."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query}
            ],
            temperature=0.1,
            max_tokens=200
        )
        
        result = response.choices[0].message.content.strip()
        # Clean up any markdown formatting
        if result.startswith("```"):
            result = result.split("```")[1]
            if result.startswith("json"):
                result = result[4:]
        result = result.strip()
        
        return json.loads(result)
    except Exception as e:
        print(f"OpenAI error: {e}")
        # Fallback: use raw query as keywords
        return {"keywords": query.lower().split()}


def search_products(search_params: dict, limit: int = 8) -> list:
    """
    Search the REAL product database
    Returns only products that actually exist - no fabrication
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Build dynamic SQL query
    conditions = []
    params = []
    
    # Keyword search across name and description
    keywords = search_params.get("keywords", [])
    if keywords:
        keyword_conditions = []
        for kw in keywords:
            keyword_conditions.append("(LOWER(name) LIKE ? OR LOWER(description) LIKE ?)")
            params.extend([f"%{kw.lower()}%", f"%{kw.lower()}%"])
        if keyword_conditions:
            conditions.append(f"({' OR '.join(keyword_conditions)})")
    
    # Brand filter
    if search_params.get("brand"):
        conditions.append("LOWER(brand) LIKE ?")
        params.append(f"%{search_params['brand'].lower()}%")
    
    # Category filter
    if search_params.get("category"):
        conditions.append("LOWER(category) LIKE ?")
        params.append(f"%{search_params['category'].lower()}%")
    
    # Merchant filter
    if search_params.get("merchant"):
        conditions.append("LOWER(merchant) LIKE ?")
        params.append(f"%{search_params['merchant'].lower()}%")
    
    # Price filters
    if search_params.get("max_price"):
        conditions.append("price <= ?")
        params.append(float(search_params["max_price"]))
    
    if search_params.get("min_price"):
        conditions.append("price >= ?")
        params.append(float(search_params["min_price"]))
    
    # Stock filter - only show in-stock items
    conditions.append("in_stock = 1")
    
    # Build final query
    where_clause = " AND ".join(conditions) if conditions else "1=1"
    
    query = f"""
        SELECT id, name, description, price, currency, merchant, merchant_id,
               category, brand, affiliate_link, image_url, in_stock
        FROM products
        WHERE {where_clause}
        ORDER BY 
            CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 0 ELSE 1 END,
            price ASC
        LIMIT ?
    """
    params.append(limit)
    
    try:
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        products = []
        for row in rows:
            products.append({
                "id": str(row["id"]),
                "name": row["name"],
                "description": row["description"][:200] + "..." if row["description"] and len(row["description"]) > 200 else row["description"],
                "price": float(row["price"]) if row["price"] else 0,
                "currency": row["currency"] or "GBP",
                "merchant": row["merchant"],
                "merchantId": str(row["merchant_id"]),
                "category": row["category"],
                "brand": row["brand"],
                "affiliateLink": row["affiliate_link"],
                "imageUrl": row["image_url"],
                "inStock": bool(row["in_stock"])
            })
        
        return products
    except Exception as e:
        print(f"Database error: {e}")
        return []
    finally:
        conn.close()


@app.get("/", response_class=HTMLResponse)
async def home():
    """Serve the search interface"""
    return """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sunny - Family Product Search</title>
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Nunito', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        header {
            text-align: center;
            padding: 40px 20px;
            color: white;
        }
        
        .logo {
            font-size: 3rem;
            font-weight: 800;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        
        .logo span {
            color: #ffd93d;
        }
        
        .tagline {
            font-size: 1.2rem;
            opacity: 0.9;
        }
        
        .search-box {
            background: white;
            border-radius: 50px;
            padding: 8px;
            display: flex;
            max-width: 600px;
            margin: 30px auto;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        
        .search-box input {
            flex: 1;
            border: none;
            padding: 15px 25px;
            font-size: 1.1rem;
            font-family: 'Nunito', sans-serif;
            outline: none;
            border-radius: 50px;
        }
        
        .search-box button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 15px 35px;
            font-size: 1.1rem;
            font-weight: 700;
            border-radius: 50px;
            cursor: pointer;
            font-family: 'Nunito', sans-serif;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .search-box button:hover {
            transform: scale(1.05);
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
        }
        
        .search-box button:disabled {
            opacity: 0.7;
            cursor: not-allowed;
            transform: none;
        }
        
        .suggestions {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 20px;
        }
        
        .suggestion {
            background: rgba(255,255,255,0.2);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9rem;
            cursor: pointer;
            transition: background 0.2s;
            border: none;
            font-family: 'Nunito', sans-serif;
        }
        
        .suggestion:hover {
            background: rgba(255,255,255,0.3);
        }
        
        .results {
            margin-top: 40px;
        }
        
        .results-header {
            color: white;
            text-align: center;
            margin-bottom: 20px;
            font-size: 1.2rem;
        }
        
        .products-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 20px;
        }
        
        .product-card {
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 5px 20px rgba(0,0,0,0.15);
            transition: transform 0.3s, box-shadow 0.3s;
            cursor: pointer;
            text-decoration: none;
            color: inherit;
            display: block;
        }
        
        .product-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.2);
        }
        
        .product-image {
            width: 100%;
            height: 200px;
            object-fit: contain;
            background: #f8f9fa;
            padding: 10px;
        }
        
        .product-info {
            padding: 20px;
        }
        
        .product-merchant {
            color: #667eea;
            font-size: 0.85rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .product-name {
            font-size: 1rem;
            font-weight: 700;
            margin: 8px 0;
            color: #333;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        
        .product-price {
            font-size: 1.4rem;
            font-weight: 800;
            color: #2d3748;
        }
        
        .product-brand {
            display: inline-block;
            background: #f0f0f0;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 0.8rem;
            color: #666;
            margin-top: 8px;
        }
        
        .loading {
            text-align: center;
            color: white;
            padding: 40px;
            font-size: 1.2rem;
        }
        
        .loading::after {
            content: '';
            animation: dots 1.5s infinite;
        }
        
        @keyframes dots {
            0%, 20% { content: '.'; }
            40% { content: '..'; }
            60%, 100% { content: '...'; }
        }
        
        .no-results {
            text-align: center;
            color: white;
            padding: 40px;
            font-size: 1.1rem;
        }
        
        .error {
            background: #fee;
            color: #c00;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            margin: 20px 0;
        }
        
        @media (max-width: 600px) {
            .logo { font-size: 2rem; }
            .search-box { flex-direction: column; border-radius: 20px; }
            .search-box input { text-align: center; }
            .search-box button { margin-top: 10px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="logo">☀️ <span>Sunny</span></div>
            <p class="tagline">Find the best deals for your family</p>
            
            <div class="search-box">
                <input type="text" id="searchInput" placeholder="What are you looking for?" autocomplete="off">
                <button id="searchBtn" onclick="search()">Search</button>
            </div>
            
            <div class="suggestions">
                <button class="suggestion" onclick="quickSearch('Disney toys under £20')">Disney toys under £20</button>
                <button class="suggestion" onclick="quickSearch('LEGO sets')">LEGO sets</button>
                <button class="suggestion" onclick="quickSearch('outdoor games for kids')">Outdoor games</button>
                <button class="suggestion" onclick="quickSearch('baby gifts')">Baby gifts</button>
                <button class="suggestion" onclick="quickSearch('Marvel')">Marvel</button>
            </div>
        </header>
        
        <div class="results" id="results"></div>
    </div>
    
    <script>
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        const resultsDiv = document.getElementById('results');
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') search();
        });
        
        function quickSearch(query) {
            searchInput.value = query;
            search();
        }
        
        async function search() {
            const query = searchInput.value.trim();
            if (!query) return;
            
            searchBtn.disabled = true;
            resultsDiv.innerHTML = '<div class="loading">Finding the best deals for you</div>';
            
            try {
                const response = await fetch('/api/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query, limit: 8 })
                });
                
                if (!response.ok) throw new Error('Search failed');
                
                const data = await response.json();
                displayResults(data.products, query);
            } catch (error) {
                resultsDiv.innerHTML = '<div class="error">Sorry, something went wrong. Please try again.</div>';
                console.error(error);
            } finally {
                searchBtn.disabled = false;
            }
        }
        
        function displayResults(products, query) {
            if (!products || products.length === 0) {
                resultsDiv.innerHTML = `<div class="no-results">No products found for "${query}". Try different keywords!</div>`;
                return;
            }
            
            let html = `<div class="results-header">Found ${products.length} products</div>`;
            html += '<div class="products-grid">';
            
            products.forEach(product => {
                const imageUrl = product.imageUrl || 'https://via.placeholder.com/280x200?text=No+Image';
                const price = product.price ? `£${product.price.toFixed(2)}` : 'See price';
                
                html += `
                    <a href="${product.affiliateLink}" target="_blank" rel="noopener" class="product-card">
                        <img src="${imageUrl}" alt="${product.name}" class="product-image" onerror="this.src='https://via.placeholder.com/280x200?text=No+Image'">
                        <div class="product-info">
                            <div class="product-merchant">${product.merchant}</div>
                            <div class="product-name">${product.name}</div>
                            <div class="product-price">${price}</div>
                            ${product.brand ? `<span class="product-brand">${product.brand}</span>` : ''}
                        </div>
                    </a>
                `;
            });
            
            html += '</div>';
            resultsDiv.innerHTML = html;
        }
    </script>
</body>
</html>
"""


@app.post("/api/search")
async def search_products_api(request: SearchRequest):
    """
    AI-powered product search endpoint
    1. Uses GPT-4o-mini to understand the query
    2. Searches the REAL product database
    3. Returns only products that actually exist
    """
    if not request.query or len(request.query.strip()) < 2:
        raise HTTPException(status_code=400, detail="Query too short")
    
    # Step 1: AI understands the search intent
    search_params = extract_search_terms(request.query)
    
    # Step 2: Search the REAL database
    products = search_products(search_params, request.limit or 8)
    
    return {
        "query": request.query,
        "searchParams": search_params,
        "products": products,
        "count": len(products)
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Sunny AI Search"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
