# GPT Deals & Tips API

## Overview
This project provides a production-grade REST API backend for a custom ChatGPT GPT integration. Its primary purpose is to serve a variety of data, including shopping deals, cinema listings, UK attractions, family activities, nights-in ideas, and money-saving tips. It aims to be the backend for a "Sunny AI Chat Concierge" with Kids Pass sponsor integration, offering a zero-hallucination, database-backed experience with robust search capabilities and price comparison. The project vision is to offer a comprehensive AI-powered concierge service, leveraging AI for intelligent data retrieval and user interaction, with potential for market expansion in personalized deal discovery and activity planning.

## User Preferences
I prefer simple language. I want iterative development. Ask before making major changes. I prefer detailed explanations. Do not make changes to the folder `Z`. Do not make changes to the file `Y`.

## System Architecture
The application follows a client-server architecture with a React-based frontend (`client/`) for the Sunny Chat UI and API documentation, and an Express.js backend (`server/`) handling API routes, data management, and external service integrations. Data is persistently stored in a PostgreSQL database, managed via Drizzle ORM.

Key architectural decisions and features include:
-   **Data-driven API**: All endpoints query a PostgreSQL database, ensuring data persistence and eliminating hardcoded data.
-   **Smart Query Interpreter**: Utilizes GPT-4o-mini to semantically understand user queries (e.g., "gift ideas for dad") and expand them into searchable keywords, enhancing search relevance.
-   **Two-Stage Search**: Semantic queries undergo an initial intent expansion into multiple keyword groups, followed by parallel searches and a GPT-based reranker to select the most relevant results.
-   **Hybrid Search Engine**: Combines OpenAI embeddings, `pgvector`, and keyword matching for intelligent and context-aware search capabilities.
-   **Zero Hallucination**: Implemented through hard-gate filtering, ensuring product relevance by precisely matching franchise and category requirements.
-   **Dual-Source Pricing**: Automatically recommends the cheaper option by comparing affiliate and direct pricing for attractions.
-   **Data Integrity Safeguards**: Includes startup validation to ensure minimum data thresholds are met across critical tables (attractions, cinema_movies, nightin_movies, activities, products) and runtime audit logging for traceability.
-   **UI/UX**: The client-side includes a `SunnyChat.tsx` component for the main chat interface and `home.tsx` for API documentation, providing a user-friendly experience.
-   **Sunny Voice Assistant (VS01)**: Voice-first shopping experience with OpenAI TTS (shimmer voice) and STT (Whisper). Features include:
    - 6-state machine: IDLE, GREETING, LISTENING, PROCESSING, CLARIFYING, SEARCHING
    - 20+ greeting variations for first-time and follow-up interactions
    - GPT-4o-mini intent parser with multi-intent support ("shoes AND pizza" = 2 searches)
    - Clarification flow for size, age, budget, gender
    - Error handling for inappropriate/off-topic requests
    - Backend endpoints: `/api/voice/tts`, `/api/voice/stt`, `/api/voice/parse-intent`
-   **Product Catalog Management**: Features a 3-tier automated refresh system for product catalog freshness: daily price/stock refresh, weekly new product imports (from Awin/CJ feeds), and monthly full catalog synchronization. This system tracks product views and sales to prioritize refresh cycles.
-   **Affiliate Network Integration**: Supports bulk import from Commission Junction (CJ) with mechanisms to handle API rate limits and prevent product duplication using unique ID strategies.
-   **Search Reranker Logic**: The GPT reranker for search results *must* include product descriptions (first 60 characters) to accurately understand product context and avoid irrelevant results.
-   **Pre-Deployment Checklist**: Strict checks are enforced before deployment to ensure schema consistency, proper API key configuration (OpenAI, Awin), and database connectivity.
-   **Performance Targets**: Achieves target response times of under 2 seconds for simple queries and under 7 seconds for semantic queries against a catalog of over 1.1 million products.
-   **Performance Optimizations (Jan 2026)**:
    - **Fast Path Interpreter**: Brand-only queries (lego, barbie, disney) bypass GPT interpretation entirely (~0ms)
    - **Known Brand Whitelist**: Skip database brand validation for 30+ popular brands (saves 2-5s per query)
    - **Simplified SQL**: Keyword search only uses indexed `name` column with GIN trigram index
    - **Reranker Skip**: Simple 1-2 word queries skip GPT reranker (saves 5-8s)
    - **Results**: Brand queries now return in 30-200ms (down from 7-18 seconds)
-   **Character/Franchise Search Fix (Jan 2026)**:
    - Brand validation now checks BOTH `products.brand` AND `products.name` columns using `or()`
    - This fixes 90+ broken queries where character names (Hulk, Moana, Encanto, Mandalorian, Hermione) exist in product names but not the brand field
    - Added fallback: When GPT returns empty keywords but a brand/character is detected, the search seeds `searchTerms` with the original query
    - Results: hulk(30), encanto(1000), mandalorian(30), moana(1000), hermione(1) - all now return products
-   **Fallback Behavior**: If OpenAI services fail, the system gracefully falls back to basic keyword search, logging warnings.

-   **Brand-Based Promotions (Jan 2026)**:
    - Promotions are now matched by brand/franchise keywords (Disney, LEGO, Marvel, etc.) in addition to merchant name
    - Extracts 40+ known brand keywords from promotion titles/descriptions at cache build time
    - Products with Disney/LEGO/Marvel etc. in name/brand now receive relevant brand promotions even when merchant doesn't match
    - Priority: Merchant match > Brand match (merchant promotions preferred if available)
    - Performance: No per-request overhead - brand index built during 30-minute cache refresh
    - Services: `getAllBrandPromotions()` in both `awin.ts` and `cj.ts` (unified Awin + CJ)

-   **TMDB Integration (Jan 2026)**:
    - Movie data from The Movie Database (TMDB) API for cinema listings and upcoming films
    - Tables: `movies` (TMDB movie cache), `upsell_mappings` (genre-to-product keywords), `upsell_clicks` (tracking)
    - Services: `server/services/tmdb.ts` (sync/fetch), `server/services/upsell.ts` (smart product recommendations)
    - Mixed Results API: `/api/mixed/movies` returns 6 content tiles + 2 upsell tiles per CTO spec
    - Performance: 146ms response time for mixed results
    - Attribution: "This product uses the TMDB API but is not endorsed or certified by TMDB."

-   **Search Quality Filters (Jan 2026)**:
    - **Inappropriate Content Blocklist**: INAPPROPRIATE_TERMS array filters ED pills, STI testing, adult content from family platform
    - **Context-Aware Detection**: hasBookContext() prevents "book tokens" from returning booking.com; hasPartyBagContext() prevents party bags returning fashion handbags; hasAgeContext() prevents "5 year old" matching "5-Year Warranty"
    - **Quality Intent Detection**: hasQualityIntent() detects "best/top/quality" queries and deprioritizes PoundFun and discount merchants (DISCOUNT_MERCHANTS list)
    - **Fallback Detection**: isKnownFallback() identifies generic results like "Gifting At Clarks" appearing for unrelated queries
    - **applySearchQualityFilters()**: Central function applied to both /api/shop/search and /api/shopv2/search before pagination
    - **Enhanced Audit Verdicts**: Diagnostic endpoint now captures INAPPROPRIATE, KEYWORD_MISMATCH, QUALITY_MISMATCH, FALLBACK_RESULT verdict types
    - **All 8 Results Captured**: diagnosis.allResults array with position, name, merchant, price, hasImage for proper audit

-   **CTO Audit Fixes (Jan 2026)** - Major search quality overhaul based on manual audit revealing 86% PASS rate was actually ~30% real relevance:
    - **PHASE 1 - Content Safety**:
      - Expanded INAPPROPRIATE_TERMS with 25+ alcohol terms (gin gift, wine subscription, bottle club, save on gin/wine/whisky)
      - Added BLOCKED_MERCHANTS kill-list: 16 merchants banned entirely (Bottle Club, Naked Wines, Virgin Wines, Majestic Wine, Beer Hawk, etc.)
      - filterInappropriateContent() now checks BOTH content terms AND merchant names
      - Promotion filtering in awin.ts and cj.ts blocks STI testing, ED pills, alcohol ads at cache time (9+ blocked)
    - **PHASE 2 - Search Quality**:
      - deduplicateResults(): Removes duplicate products using ID or name+merchant key, skips entries without names
      - applyMerchantCaps(): Limits any merchant to max 2 results per query (fixes PoundFun in 126 queries)
      - filterFallbackSpam(): Removes known spam patterns (Gifting at Clarks, 10% off Organic Baby) with normalized matching
      - Enhanced KNOWN_FALLBACKS with 25+ CTO's reported patterns: organic baby, treetop challenge, honor choice/magic/pad
    - **PHASE 3 - Context Awareness**:
      - hasBlindContext() + filterForBlindContext(): "blind character" → NOT window blinds
      - hasFilmContext() + filterForFilmContext(): "feelings film" → movies, not shoe sales
      - hasGenderContext() + filterForGenderContext(): "dunno what to get him" → NOT "Gifts for Her"
      - hasWatchOrderContext() + filterForWatchOrderContext(): "MCU watch order" → NOT Sekonda watches (explicit merchant list)
      - hasBreakContext() + filterForBreakContext(): "chapter break" → NOT Jet2 holidays (explicit travel merchant list)
      - GENDER_EXCLUSION_MAP: 16 gender keywords (him/her/boy/girl/son/daughter/etc.) with exclusion lists
    - **Relevance Scorer Updates**: Same expanded blocklists in server/services/relevance-scorer.ts for AI audit scoring

-   **Word Boundary Search Fix (Jan 2026)** - Critical fix for substring matching disasters:
    - Changed keyword matching from `ILIKE '%word%'` to PostgreSQL regex with word boundaries `~* '\yword\y'`
    - Prevents "bike" matching "biker", "cheap" matching "cheapskate", "book" matching "booking"
    - Fixed both keyword search path AND semantic search path in routes.ts
    - Also fixed queryParser character detection to use word boundaries (prevents "legoland" → "lego")
    - Added logic to ensure queryParser-detected characters are always added to interpretation.mustHaveAll
    - Results: "bike for kids" returns bikes (not Biker Coat), "nerf gun" returns Nerf blasters, "school shoes boys" returns boys shoes

-   **Audit V2 System (Jan 2026)** - Real relevance scoring replacing fake 100% pass rates:
    - Uses queryParser to extract age, gender, character, price from queries
    - Calls actual `/api/shop/search` endpoint to test full pipeline with MEGA-FIX 10
    - Weighted scoring: Character 40%, Age 30%, Price 20%, Diversity 10%
    - Character matching checks BOTH product text AND brand field (fixes "Jungle Pups" branded as "Paw Patrol")
    - Null checks fixed: parseQuery returns `null` not `undefined` for missing age/price
    - New verdict thresholds: PASS ≥70%, PARTIAL ≥40%, FAIL <40%
    - Breakdown shows: characterMatchPct, ageMatchPct, priceMatchPct, diversityScore, duplicateCount
    - Example: "paw patrol tower" → 84% PASS (100% char, N/A age, N/A price, 2/10 diversity)
    - Example: "lego for 8 year old boy under 50" → 91% PASS (100% char, 100% age, 100% price, 1/10 diversity)

-   **Alcohol Removal (Jan 2026)** - Complete removal of alcohol products from family platform:
    - Permanently deleted all alcohol products from database (wine gifts, gin bottles, champagne, whisky, etc.)
    - Added ALCOHOL_BLOCKLIST to both CJ and Awin import pipelines to prevent future imports
    - ALCOHOL_MERCHANT_BLOCKLIST blocks entire alcohol merchants (Naked Wines, Virgin Wines, Majestic Wine, etc.)
    - Import filters in: `server/services/cj.ts`, `server/boot/productBootstrap.ts`
    - Search filters in: `server/routes.ts` (INAPPROPRIATE_TERMS, BLOCKED_MERCHANTS)
    - Zero alcohol products will appear in search results or be imported in future

## External Dependencies
-   **PostgreSQL**: The primary relational database used for all application data persistence.
-   **Awin API**: Integrated for comprehensive shopping deals, product data feeds, and promotional content.
-   **OpenAI API**: Utilized for generating embeddings for semantic search and powering the Sunny GPT-4o-mini in the chat concierge for intelligent query interpretation and reranking.
-   **Kids Pass**: A sponsor integration providing specific promotional links and access to partner attractions.
-   **Uber Eats**: Featured for food deals, especially relevant for movie night recommendations.
-   **Commission Junction (CJ) API**: Integrated for accessing and importing additional product catalogs from various advertisers.
-   **TMDB API**: The Movie Database API for cinema now playing, upcoming films, and movie metadata with UK certifications.