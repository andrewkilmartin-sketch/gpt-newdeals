"""
Sunny AI Search - FastAPI App
=============================
Clean API + Frontend using the global intent scoring system.
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Optional

from search_engine import search_api, get_db_connection, load_taxonomy

app = FastAPI(title="Sunny AI Family Search", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SearchRequest(BaseModel):
    query: str
    limit: Optional[int] = 8


@app.get("/", response_class=HTMLResponse)
async def home():
    return """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sunny - Family Product Search</title>
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Nunito', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container { max-width: 1200px; margin: 0 auto; }
        
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
        
        .logo span { color: #ffd93d; }
        .tagline { font-size: 1.2rem; opacity: 0.9; }
        
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
        
        .suggestion:hover { background: rgba(255,255,255,0.3); }
        
        .results { margin-top: 40px; }
        
        .results-header {
            color: white;
            text-align: center;
            margin-bottom: 10px;
            font-size: 1.2rem;
        }
        
        .intent-debug {
            color: rgba(255,255,255,0.7);
            text-align: center;
            font-size: 0.85rem;
            margin-bottom: 20px;
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
        
        .product-info { padding: 20px; }
        
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
        
        .product-meta {
            display: flex;
            gap: 8px;
            margin-top: 8px;
            flex-wrap: wrap;
        }
        
        .product-tag {
            display: inline-block;
            background: #f0f0f0;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 0.75rem;
            color: #666;
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
                <button class="suggestion" onclick="quickSearch('Disney trainers for toddler under £20')">Disney trainers £20</button>
                <button class="suggestion" onclick="quickSearch('Peppa Pig wellies')">Peppa Pig wellies</button>
                <button class="suggestion" onclick="quickSearch('LEGO birthday gift')">LEGO gifts</button>
                <button class="suggestion" onclick="quickSearch('outdoor toys for kids')">Outdoor toys</button>
                <button class="suggestion" onclick="quickSearch('Marvel t-shirt')">Marvel t-shirts</button>
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
            resultsDiv.innerHTML = '<div class="loading">Finding the best deals</div>';
            
            try {
                const response = await fetch('/api/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query, limit: 10 })
                });
                
                if (!response.ok) throw new Error('Search failed');
                
                const data = await response.json();
                displayResults(data, query);
            } catch (error) {
                resultsDiv.innerHTML = '<div class="error">Sorry, something went wrong. Please try again.</div>';
                console.error(error);
            } finally {
                searchBtn.disabled = false;
            }
        }
        
        function displayResults(data, query) {
            const products = data.products || [];
            const intent = data.intent || {};
            
            if (products.length === 0) {
                resultsDiv.innerHTML = `<div class="no-results">No products found for "${query}". Try different keywords!</div>`;
                return;
            }
            
            // Build intent summary
            let intentParts = [];
            if (intent.franchises?.length) intentParts.push(`Franchise: ${intent.franchises.join(', ')}`);
            if (intent.categories?.length) intentParts.push(`Category: ${intent.categories.join(', ')}`);
            if (intent.price_range?.max) intentParts.push(`Under £${intent.price_range.max}`);
            if (intent.age_group) intentParts.push(`Age: ${intent.age_group}`);
            
            let html = `<div class="results-header">Found ${products.length} products</div>`;
            if (intentParts.length) {
                html += `<div class="intent-debug">🎯 ${intentParts.join(' • ')}</div>`;
            }
            html += '<div class="products-grid">';
            
            products.forEach(product => {
                const imageUrl = product.imageUrl || 'https://via.placeholder.com/280x200?text=No+Image';
                const price = product.price ? `£${product.price.toFixed(2)}` : 'See price';
                
                html += `
                    <a href="${product.affiliateLink}" target="_blank" rel="noopener" class="product-card">
                        <img src="${imageUrl}" alt="${product.name}" class="product-image" 
                             onerror="this.src='https://via.placeholder.com/280x200?text=No+Image'">
                        <div class="product-info">
                            <div class="product-merchant">${product.merchant || 'Shop'}</div>
                            <div class="product-name">${product.name}</div>
                            <div class="product-price">${price}</div>
                            <div class="product-meta">
                                ${product.brand ? `<span class="product-tag">${product.brand}</span>` : ''}
                                ${product.category ? `<span class="product-tag">${product.category}</span>` : ''}
                            </div>
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
async def search(request: SearchRequest):
    """
    AI-powered product search.
    Uses taxonomy-driven intent extraction + relevance scoring.
    All products from real database - zero hallucination.
    """
    if not request.query or len(request.query.strip()) < 2:
        raise HTTPException(status_code=400, detail="Query too short")
    
    try:
        result = search_api(request.query, request.limit or 8)
        return result
    except Exception as e:
        print(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
async def health():
    return {"status": "healthy", "version": "2.0.0"}


@app.get("/api/taxonomy/stats")
async def taxonomy_stats():
    """Check taxonomy coverage"""
    conn = get_db_connection()
    taxonomy = load_taxonomy(conn)
    conn.close()
    
    categories = {}
    for match in taxonomy.values():
        cat = match.category
        if cat not in categories:
            categories[cat] = 0
        categories[cat] += 1
    
    return {
        "total_keywords": len(taxonomy),
        "categories": categories
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
