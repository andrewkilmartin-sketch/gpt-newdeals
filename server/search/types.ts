export interface ProductAttributes {
  brand?: string;
  character?: string;
  model?: string;
  size?: string;
  color?: string;
  gender?: string;
  ageRange?: string;
  material?: string;
  style?: string;
}

export interface QueryInterpretation {
  isSemanticQuery: boolean;
  originalQuery: string;
  expandedKeywords: string[];
  searchTerms: string[][];
  mustHaveAll?: string[];
  mustHaveAny?: string[];
  mustHaveTerms?: string[];
  attributes?: ProductAttributes;
  context: {
    recipient?: string;
    occasion?: string;
    ageRange?: string;
    priceHint?: string;
    minPrice?: number;
    maxPrice?: number;
    categoryFilter?: string;
    excludeCategories?: string[];
  };
  rerankerContext: string;
  skipReranker?: boolean;
}

export type ProductCategory = 'clothing' | 'footwear' | 'toys' | 'electronics' | 'home' | 'beauty' | 'general';

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

export interface FilterDefinition {
  id: string;
  label: string;
  type: 'single' | 'multi' | 'range';
  options: FilterOption[];
}

export interface FilterSchema {
  category: ProductCategory;
  categoryLabel: string;
  filters: FilterDefinition[];
}

export type QueryIntent = 
  | 'PRODUCTS'
  | 'DEALS'
  | 'DAYS_OUT'
  | 'ATTRACTIONS'
  | 'MOVIE_NIGHT'
  | 'NIGHTS_IN'
  | 'TIPS'
  | 'GENERAL';
