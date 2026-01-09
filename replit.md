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
-   **Product Catalog Management**: Features a 3-tier automated refresh system for product catalog freshness: daily price/stock refresh, weekly new product imports (from Awin/CJ feeds), and monthly full catalog synchronization. This system tracks product views and sales to prioritize refresh cycles.
-   **Affiliate Network Integration**: Supports bulk import from Commission Junction (CJ) with mechanisms to handle API rate limits and prevent product duplication using unique ID strategies.
-   **Search Reranker Logic**: The GPT reranker for search results *must* include product descriptions (first 60 characters) to accurately understand product context and avoid irrelevant results.
-   **Pre-Deployment Checklist**: Strict checks are enforced before deployment to ensure schema consistency, proper API key configuration (OpenAI, Awin), and database connectivity.
-   **Performance Targets**: Achieves target response times of under 2 seconds for simple queries and under 7 seconds for semantic queries against a catalog of over 1.1 million products.
-   **Fallback Behavior**: If OpenAI services fail, the system gracefully falls back to basic keyword search, logging warnings.

## External Dependencies
-   **PostgreSQL**: The primary relational database used for all application data persistence.
-   **Awin API**: Integrated for comprehensive shopping deals, product data feeds, and promotional content.
-   **OpenAI API**: Utilized for generating embeddings for semantic search and powering the Sunny GPT-4o-mini in the chat concierge for intelligent query interpretation and reranking.
-   **Kids Pass**: A sponsor integration providing specific promotional links and access to partner attractions.
-   **Uber Eats**: Featured for food deals, especially relevant for movie night recommendations.
-   **Commission Junction (CJ) API**: Integrated for accessing and importing additional product catalogs from various advertisers.