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
-   **Data Integrity Safeguards**: Includes startup validation to ensure minimum data thresholds are met across critical tables and runtime audit logging for traceability.
-   **UI/UX**: The client-side includes a `SunnyChat.tsx` component for the main chat interface and `home.tsx` for API documentation, providing a user-friendly experience.
-   **Sunny Voice Assistant (VS01)**: Provides a voice-first shopping experience with OpenAI TTS (shimmer voice) and STT (Whisper), featuring a 6-state machine, diverse greetings, GPT-4o-mini intent parsing with multi-intent support, and clarification flows.
-   **Product Catalog Management**: Features a 3-tier automated refresh system for product catalog freshness: daily price/stock refresh, weekly new product imports, and monthly full catalog synchronization, prioritizing refresh cycles based on product views and sales.
-   **Affiliate Network Integration**: Supports bulk import from Commission Junction (CJ) with mechanisms to handle API rate limits and prevent product duplication.
-   **Search Reranker Logic**: The GPT reranker for search results incorporates product descriptions to accurately understand product context.
-   **Pre-Deployment Checklist**: Strict checks are enforced before deployment for schema consistency, API key configuration, and database connectivity.
-   **Performance Targets**: Achieves target response times under 2 seconds for simple queries and under 7 seconds for semantic queries against a catalog of over 1.1 million products through optimizations like fast path interpretation for brand-only queries, known brand whitelists, simplified SQL for keyword search, and conditional reranker skipping.
-   **Character/Franchise Search**: Brand validation now checks both `products.brand` and `products.name` columns using `or()` with word boundaries to improve accuracy for character-based searches (e.g., Hulk, Moana). Includes fallback logic for empty GPT keywords.
-   **Brand-Based Promotions**: Promotions are matched by brand/franchise keywords in addition to merchant name, with a priority given to merchant promotions. This is handled during cache build time to avoid per-request overhead.
-   **Category-Based Promotions (Fix #58-60)**: Added 3-tier promotion matching: merchant → brand → category. Searches like "school shoes" now show relevant promotions (e.g., "Student Discount") even when the merchant doesn't have direct promotions. Categories include: school, shoes, clothing, toys, books, baby, outdoor, sports, electronics, home.
-   **Search Quality Filters**: Implements robust filtering, including an inappropriate content blocklist, context-aware detection (e.g., preventing "book tokens" from returning booking.com), quality intent detection to deprioritize discount merchants, and fallback detection for generic results. These filters are applied before pagination and inform enhanced audit verdicts.
-   **CTO Audit Fixes**: Major search quality overhaul with expanded inappropriate content and merchant blocklists, deduplication of results, merchant caps (max 2 results per merchant), and removal of known spam patterns. Includes context-aware filtering for blind, film, gender, watch order, and break-related queries.
-   **Word Boundary Search Fix**: Changed keyword matching to use PostgreSQL regex with word boundaries `~* '\yword\y'` to prevent substring matching issues. This was applied to both keyword and semantic search paths, including queryParser character detection. An age stoplist was added to skip age-related terms in `mustHaveAll` filters to prevent zero results.
-   **Audit V2 System**: Implemented a real relevance scoring system using `queryParser` to extract age, gender, character, and price from queries. It calls the actual `/api/shop/search` endpoint and uses weighted scoring for Character (40%), Age (30%), Price (20%), and Diversity (10%). New verdict thresholds are PASS ≥70%, PARTIAL ≥40%, FAIL <40%.
-   **Alcohol Removal**: All alcohol products have been permanently deleted from the database. An `ALCOHOL_BLOCKLIST` and `ALCOHOL_MERCHANT_BLOCKLIST` have been implemented in both CJ and Awin import pipelines and search filters to prevent future imports and display of alcohol-related products.
-   **TSVECTOR Ultra Fast Path (v7-fix28)**: Search now uses PostgreSQL full-text search with GIN indexes BEFORE calling OpenAI API, achieving sub-100ms cached response times. Includes production-safe fallbacks when `search_vector` column is missing.
-   **Production Compatibility**: All database operations wrapped in try/catch with ILIKE fallbacks to prevent 500 errors when schema differs between environments.
-   **Fix #29 - Critical**: Main tsvector search wrapped in try/catch with runtime `TSVECTOR_DISABLED` flag. If search_vector column is missing, automatically falls back to ILIKE. This prevents 100% failure when deploying without database migration.

## External Dependencies
-   **PostgreSQL**: The primary relational database used for all application data persistence.
-   **Awin API**: Integrated for comprehensive shopping deals, product data feeds, and promotional content.
-   **OpenAI API**: Utilized for generating embeddings for semantic search and powering the Sunny GPT-4o-mini in the chat concierge for intelligent query interpretation and reranking.
-   **Kids Pass**: A sponsor integration providing specific promotional links and access to partner attractions.
-   **Uber Eats**: Featured for food deals, especially relevant for movie night recommendations.
-   **Commission Junction (CJ) API**: Integrated for accessing and importing additional product catalogs from various advertisers.
-   **TMDB API**: The Movie Database API for cinema now playing, upcoming films, and movie metadata with UK certifications.