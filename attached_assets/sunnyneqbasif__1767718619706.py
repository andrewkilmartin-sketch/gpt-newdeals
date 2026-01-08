"""
Sunny Search
============
One file. 115k Awin products. OpenAI picks the best matches.
"""

import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from openai import OpenAI
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
DATABASE_URL = os.getenv("DATABASE_URL")


class SearchRequest(BaseModel):
    query: str


def search(query: str):
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    cursor = conn.cursor()
    
    # Get candidate products using keyword match
    words = [w for w in query.lower().split() if len(w) > 2]
    
    if words:
        conditions = []
        params = []
        for word in words:
            conditions.append("(LOWER(product_name) LIKE %s OR LOWER(description) LIKE %s)")
            params.extend([f"%{word}%", f"%{word}%"])
        
        sql = f"""
            SELECT aw_product_id, product_name, description, search_price, 
                   merchant_name, aw_deep_link, merchant_image_url, aw_image_url
            FROM products 
            WHERE ({" OR ".join(conditions)})
              AND aw_deep_link IS NOT NULL
            LIMIT 50
        """
        cursor.execute(sql, params)
    else:
        cursor.execute("""
            SELECT aw_product_id, product_name, description, search_price,
                   merchant_name, aw_deep_link, merchant_image_url, aw_image_url
            FROM products 
            WHERE aw_deep_link IS NOT NULL
            LIMIT 50
        """)
    
    candidates = cursor.fetchall()
    conn.close()
    
    if not candidates:
        return []
    
    # Send to OpenAI to pick best matches
    products_text = "\n".join([
        f"ID:{p['aw_product_id']} | {p['product_name']} | £{p['search_price']} | {(p['description'] or '')[:150]}"
        for p in candidates
    ])
    
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{
            "role": "system",
            "content": """You help UK families find products. Given a search and product list,
return the IDs of the 8 best matching products as a JSON array.
ONLY use IDs from the list. Never invent IDs.
Format: ["id1", "id2", ...]"""
        }, {
            "role": "user",
            "content": f"Search: {query}\n\nProducts:\n{products_text}"
        }],
        temperature=0.1
    )
    
    # Parse selected IDs
    try:
        result = response.choices[0].message.content.strip()
        if "```" in result:
            result = result.split("```")[1].replace("json", "").strip()
        selected_ids = json.loads(result)
    except:
        selected_ids = [p['aw_product_id'] for p in candidates[:8]]
    
    # Build response
    id_to_product = {str(p['aw_product_id']): p for p in candidates}
    results = []
    
    for pid in selected_ids:
        if str(pid) in id_to_product:
            p = id_to_product[str(pid)]
            results.append({
                "id": p['aw_product_id'],
                "name": p['product_name'],
                "price": float(p['search_price']) if p['search_price'] else 0,
                "merchant": p['merchant_name'],
                "affiliateLink": p['aw_deep_link'],
                "imageUrl": p['merchant_image_url'] or p['aw_image_url']
            })
    
    return results


@app.post("/api/search")
async def api_search(request: SearchRequest):
    products = search(request.query)
    return {"products": products}


@app.get("/", response_class=HTMLResponse)
async def home():
    return """
<!DOCTYPE html>
<html>
<head>
    <title>Sunny</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;padding:20px}
        .container{max-width:1000px;margin:0 auto}
        h1{color:#fff;text-align:center;margin:40px 0;font-size:2.5em}
        h1 span{color:#ffd93d}
        .search{display:flex;max-width:500px;margin:0 auto 40px;background:#fff;border-radius:30px;overflow:hidden;box-shadow:0 5px 20px rgba(0,0,0,.2)}
        input{flex:1;padding:15px 20px;font-size:16px;border:none;outline:none}
        button{padding:15px 30px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;cursor:pointer;font-weight:700}
        .results{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px}
        .product{background:#fff;border-radius:12px;overflow:hidden;text-decoration:none;color:#000;transition:transform .2s,box-shadow .2s}
        .product:hover{transform:translateY(-5px);box-shadow:0 10px 30px rgba(0,0,0,.2)}
        .product img{width:100%;height:160px;object-fit:contain;background:#f8f8f8;padding:10px}
        .info{padding:15px}
        .merchant{color:#667eea;font-size:12px;font-weight:700;text-transform:uppercase}
        .name{font-size:14px;margin:8px 0;font-weight:600;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .price{color:#333;font-size:20px;font-weight:800}
        .loading,.empty{color:#fff;text-align:center;padding:40px;font-size:18px}
    </style>
</head>
<body>
    <div class="container">
        <h1>☀️ <span>Sunny</span></h1>
        <div class="search">
            <input type="text" id="q" placeholder="What are you looking for?">
            <button onclick="search()">Search</button>
        </div>
        <div id="results"></div>
    </div>
    <script>
        document.getElementById('q').addEventListener('keypress',e=>{if(e.key==='Enter')search()});
        
        async function search(){
            const q=document.getElementById('q').value.trim();
            if(!q)return;
            
            document.getElementById('results').innerHTML='<div class="loading">Finding products...</div>';
            
            try{
                const res=await fetch('/api/search',{
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({query:q})
                });
                const data=await res.json();
                
                if(!data.products||data.products.length===0){
                    document.getElementById('results').innerHTML='<div class="empty">No products found. Try different keywords.</div>';
                    return;
                }
                
                document.getElementById('results').innerHTML='<div class="results">'+data.products.map(p=>`
                    <a href="${p.affiliateLink}" target="_blank" class="product">
                        <img src="${p.imageUrl||'https://placehold.co/200x160?text=No+Image'}" onerror="this.src='https://placehold.co/200x160?text=No+Image'">
                        <div class="info">
                            <div class="merchant">${p.merchant||''}</div>
                            <div class="name">${p.name}</div>
                            <div class="price">£${p.price.toFixed(2)}</div>
                        </div>
                    </a>
                `).join('')+'</div>';
            }catch(err){
                document.getElementById('results').innerHTML='<div class="empty">Something went wrong. Please try again.</div>';
            }
        }
    </script>
</body>
</html>
"""

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
