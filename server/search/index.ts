/**
 * Search Module Index
 * 
 * Exports all search-related functions for use in routes.ts
 * 
 * This module was created to break up the 11,234 line routes.ts file
 * into smaller, maintainable modules. Each file is under 500 lines.
 * 
 * Structure:
 * - brands.ts: Brand/character constants and validation (~120 lines)
 * - filters.ts: All filter functions (~480 lines)
 * - dedup.ts: SKU deduplication and merchant caps (~150 lines)
 * - ranking.ts: Price sorting and quality intent (~60 lines)
 * - promotions.ts: Promotion matching for search results (~150 lines)
 */

export * from './brands';
export * from './filters';
export * from './dedup';
export * from './ranking';
export * from './promotions';
