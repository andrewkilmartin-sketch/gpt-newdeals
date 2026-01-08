# GPT Deals & Tips API

## Overview
This project provides a production-grade REST API backend for a custom ChatGPT GPT integration. Its primary purpose is to serve a variety of data, including shopping deals, cinema listings, UK attractions, family activities, nights-in ideas, and money-saving tips. It aims to be the backend for a "Sunny AI Chat Concierge" with Kids Pass sponsor integration, offering a zero-hallucination, database-backed experience with robust search capabilities and price comparison.

## User Preferences
I prefer simple language. I want iterative development. Ask before making major changes. I prefer detailed explanations. Do not make changes to the folder `Z`. Do not make changes to the file `Y`.

---

## CRITICAL: Read Before Making Any Changes

### Known Issues & Fixes (DO NOT REPEAT THESE MISTAKES)

**Issue 1: GPT Reranker Returns Empty Array (Random Results)**
- **Symptom**: Search returns random products instead of relevant ones
- **Root Cause**: The GPT reranker only sees product name/brand/price, NOT the description where context appears
- **Fix**: Reranker MUST include product description (first 80 chars) so GPT can understand product context
- **Location**: `server/routes.ts` line ~2270 - `productsText` variable must include description
- **Test**: Search "school shoes" should return Hush Puppies/Kickers school shoes, NOT trainers

**Issue 2: Drizzle Schema Mismatch (Migration Failures)**
- **Symptom**: Deployment fails with "column does not exist" or migration validation errors
- **Root Cause**: `shared/schema.ts` missing columns that exist in production DB
- **Fix**: Schema MUST include all columns: `embedding` (vector), `search_vector` (tsvector) with custom types
- **Never**: Remove columns from schema, change ID types, or assume schema matches DB

**Issue 3: Production Database Population**
- **Symptom**: Production has 0 products after deploy
- **Root Cause**: Replit has SEPARATE dev/prod databases. Data doesn't copy on deploy.
- **Fix**: Automated bootstrap on production startup fetches products from Awin API
- **Monitor**: Check `/api/debug/bootstrap-status` to see import progress
- **Manual trigger**: POST to `/api/admin/bootstrap-products` to force import
- **Files**: `server/boot/productBootstrap.ts` handles auto-population

**Issue 4: OpenAI Not Working in Production**
- **Symptom**: Search falls back to basic keyword matching, no intelligent reranking
- **Root Cause**: OPENAI_API_KEY not set in production deployment secrets
- **Fix**: Verify key is set via `/api/debug/openai-check` endpoint
- **Test**: Response should show `status: "OPERATIONAL"`

**Issue 5: mustHaveAll Terms Not Applied as SQL Filter (Fixed Jan 2026)**
- **Symptom**: Search for "star wars lego" returns random Lego products, not Star Wars Lego
- **Root Cause**: GPT correctly extracted mustHaveAll: ["lego", "star wars"] but only brand filter was applied to SQL
- **Fix**: Added mustHaveAll as hard SQL WHERE clauses in V1 search (~line 1159)
- **Location**: `server/routes.ts` - search for "CRITICAL: Apply mustHaveAll as hard SQL filters"
- **Test**: Search "star wars lego under £20" should return LEGO Star Wars products specifically
- **Note**: V2 uses full-text search for mustHaveAll but has different product data (Nike x Lego only, no actual Lego sets)

### Pre-Deployment Checklist

Before every deployment:
1. [ ] Schema matches production DB (check vector/tsvector columns)
2. [ ] OPENAI_API_KEY is set in production secrets
3. [ ] AWIN_API_KEY and AWIN_PUBLISHER_ID are set in production secrets
4. [ ] DATABASE_URL points to correct production database
5. [ ] Test `/api/debug/openai-check` and `/api/debug/db-check` endpoints work locally
6. [ ] Test "school shoes" search returns actual school shoes, not random trainers

After deployment:
1. [ ] Check `/api/debug/bootstrap-status` - production should auto-populate from Awin
2. [ ] If bootstrap status shows error, POST to `/api/admin/bootstrap-products`
3. [ ] Wait for bootstrap to complete (may take several minutes for large imports)

### Architecture Rules (DO NOT CHANGE)

1. **Reranker must see descriptions**: `productsText` in reranker includes description (60 chars)
2. **Three-tier search**: Fast-path (simple) → Query interpreter (GPT) → Database search → Reranker (GPT)
3. **Fast-path optimization**: Simple queries like "trainers", "shoes", "headphones" skip GPT entirely (~1s vs ~10s)
4. **skipReranker flag**: Set `skipReranker: true` in QueryInterpretation to bypass GPT reranking
5. **Fallback behavior**: If OpenAI fails, falls back to keyword search (logs warning)
6. **Products tables**: `products` (115k) and `products_v2` (997k) - both must have search_vector column

### Performance Targets (Verified January 2026)

**V1 /api/shop/search (115k products)**
| Query Type | Example | Target | Actual |
|------------|---------|--------|--------|
| Simple (fast path) | "trainers" | <2s | ~2s |
| Semantic | "school shoes" | <7s | ~6s |

**V2 /api/shopv2/search (997k products)**
| Query Type | Example | Target | Actual |
|------------|---------|--------|--------|
| Simple (fast path) | "trainers" | <2s | ~1s |
| Semantic (with reranker) | "school shoes" | <7s | ~7s |
| Complex semantic | "gift for dad" | <7s | ~4s |

---

## System Architecture
The application follows a client-server architecture. The `client/` directory contains the frontend for the Sunny Chat UI and API documentation, utilizing React components. The `server/` directory hosts the Express.js server, defining API routes, managing data storage, and integrating with external services. Data is stored in a PostgreSQL database, accessed via Drizzle ORM, replacing previous in-memory storage.

Key architectural decisions include:
- **Data-driven API**: All endpoints query a PostgreSQL database, ensuring data persistence and eliminating hardcoded arrays.
- **Smart Query Interpreter**: Uses GPT-4o-mini to understand semantic queries (e.g., "gift ideas for dad", "rainy day activities") and expand them into searchable product keywords. Word boundary matching prevents false positives.
- **Two-Stage Search**: For semantic queries, first expands intent into multiple keyword groups, runs parallel searches, then uses GPT reranker with semantic context to select best results.
- **Hybrid Search Engine**: Employs a taxonomy-driven approach combining OpenAI embeddings, `pgvector`, and keyword matching for intelligent search results.
- **Zero Hallucination**: A critical design principle implemented through hard-gate filtering, ensuring product relevance by matching both franchise and category requirements.
- **Dual-Source Pricing**: Automatically recommends the cheaper option by comparing affiliate and direct pricing for attractions.
- **Data Integrity Safeguards**: Features startup validation to prevent the application from running with insufficient data and includes runtime audit logging for traceability.
- **UI/UX**: The client-side includes a `SunnyChat.tsx` component for the main chat interface and `home.tsx` for API documentation.

The system is designed for high data integrity, with checks to ensure minimum data thresholds are met at startup across critical tables (attractions, cinema_movies, nightin_movies, activities, products).

## External Dependencies
The project integrates with several external services and APIs:
- **PostgreSQL**: Primary database for all application data.
- **Awin API**: Used for fetching shopping deals, product data feeds, and promotions.
- **OpenAI API**: Utilized for generating embeddings for semantic search capabilities and for the Sunny GPT-4o-mini in the chat concierge.
- **Kids Pass**: Integrated for sponsor-specific promotional links and partner attractions.
- **Uber Eats**: Featured for food deals, particularly for movie night queries.