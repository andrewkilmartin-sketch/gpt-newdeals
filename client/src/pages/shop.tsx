import { useState } from "react";
import { Search, ExternalLink, Loader2, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency?: string;
  merchant: string;
  category: string | null;
  brand: string | null;
  imageUrl: string | null;
  affiliateLink: string;
  inStock: boolean | null;
}

interface FilterItem {
  name: string;
  count: number;
}

interface PriceFilter {
  label: string;
  min: number;
  max: number;
  count: number;
}

interface Filters {
  categories: FilterItem[];
  merchants: FilterItem[];
  brands: FilterItem[];
  prices: PriceFilter[];
}

interface ActiveFilters {
  category?: string;
  merchant?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
}

interface SearchResponse {
  success: boolean;
  query: string;
  count: number;
  totalCount: number;
  hasMore: boolean;
  products: Product[];
  filters?: Filters;
}

const SUGGESTIONS = [
  "Disney toys",
  "LEGO sets",
  "Peppa Pig",
  "Marvel",
  "school shoes",
  "outdoor toys",
  "kids pyjamas",
  "Harry Potter"
];

export default function ShopSearch() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});
  const [searchTime, setSearchTime] = useState<number | null>(null);

  const performSearch = async (searchText: string, appliedFilters: ActiveFilters = {}, offset = 0) => {
    if (!searchText.trim()) return;
    
    const isNewSearch = offset === 0;
    if (isNewSearch) {
      setIsLoading(true);
      setProducts([]);
      setSearchTime(null);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

    const startTime = performance.now();
    try {
      // Add 30-second timeout to prevent infinite spinning
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch("/api/shop/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: searchText, 
          limit: 8, 
          offset,
          filterCategory: appliedFilters.category,
          filterMerchant: appliedFilters.merchant,
          filterBrand: appliedFilters.brand,
          filterMinPrice: appliedFilters.minPrice,
          filterMaxPrice: appliedFilters.maxPrice
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      const data: SearchResponse = await response.json();
      
      if (!data.success) {
        setError("Search failed");
        if (isNewSearch) setProducts([]);
      } else {
        if (isNewSearch) {
          setProducts(data.products);
          setSearchQuery(data.query);
          if (data.filters) setFilters(data.filters);
        } else {
          setProducts(prev => [...prev, ...data.products]);
        }
        setHasMore(data.hasMore);
        setTotalCount(data.totalCount);
        setCurrentOffset(offset + data.products.length);
        if (isNewSearch) {
          setSearchTime((performance.now() - startTime) / 1000);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError("Search timed out after 30 seconds. Try a simpler search term.");
      } else {
        setError("Failed to connect to search service");
      }
      if (isNewSearch) setProducts([]);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleSearch = async (searchText: string) => {
    setQuery(searchText);
    setActiveFilters({});
    setFilters(null);
    setCurrentOffset(0);
    await performSearch(searchText, {}, 0);
  };

  const applyFilter = (filterType: keyof ActiveFilters, value: string | number | undefined) => {
    const newFilters = { ...activeFilters };
    if (filterType === 'minPrice' || filterType === 'maxPrice') {
      newFilters[filterType] = value as number | undefined;
    } else {
      newFilters[filterType] = value as string | undefined;
    }
    setActiveFilters(newFilters);
    setCurrentOffset(0);
    if (searchQuery) {
      performSearch(searchQuery, newFilters, 0);
    }
  };

  const clearFilters = () => {
    setActiveFilters({});
    setCurrentOffset(0);
    if (searchQuery) {
      performSearch(searchQuery, {}, 0);
    }
  };

  const hasActiveFilters = Object.values(activeFilters).some(v => v !== undefined);

  const handleLoadMore = async () => {
    if (!searchQuery || isLoadingMore) return;
    await performSearch(searchQuery, activeFilters, currentOffset);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="text-center py-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-3 flex items-center justify-center gap-3">
            <span>Sunny <span className="text-yellow-300">VS01</span></span>
          </h1>
          <p className="text-lg text-white/80 flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-300" />
            AI Intelligent search across 1,100,000+ products
          </p>
          <p className="text-sm text-white/60 mt-1">
            Zero hallucinations - only real products from real retailers
          </p>
          {searchTime !== null && (
            <p className="text-sm text-yellow-300/80 mt-2">
              Results returned in {searchTime.toFixed(1)} seconds
            </p>
          )}
        </header>

        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto mb-6">
          <div className="flex gap-2 bg-white rounded-full p-2 shadow-xl">
            <Input
              data-testid="input-shop-search"
              type="text"
              placeholder="What are you looking for? e.g. Disney toys"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 border-0 focus-visible:ring-0 text-base"
            />
            <Button 
              data-testid="button-shop-search"
              type="submit" 
              disabled={isLoading || !query.trim()}
              className="rounded-full px-6"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5" />
              )}
            </Button>
          </div>
        </form>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              data-testid={`button-suggestion-${suggestion.replace(/\s+/g, '-').toLowerCase()}`}
              onClick={() => handleSearch(suggestion)}
              className="bg-white/20 text-white px-4 py-2 rounded-full text-sm hover:bg-white/30 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>

        {filters && !isLoading && (
          <div className="bg-white/95 rounded-xl p-4 mb-6 shadow-lg" data-testid="filters-container">
            {hasActiveFilters && (
              <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b">
                <span className="text-sm text-muted-foreground">Active filters:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-red-600 hover:text-red-700"
                  data-testid="button-clear-filters"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear all
                </Button>
              </div>
            )}
            
            {filters.categories.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Category</div>
                <div className="flex flex-wrap gap-2">
                  {filters.categories.slice(0, 6).map((cat) => (
                    <button
                      key={cat.name}
                      data-testid={`filter-category-${cat.name.replace(/\s+/g, '-').toLowerCase()}`}
                      onClick={() => applyFilter('category', activeFilters.category === cat.name ? undefined : cat.name)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        activeFilters.category === cat.name
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      {cat.name} <span className="opacity-60">({cat.count})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {filters.prices.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Price</div>
                <div className="flex flex-wrap gap-2">
                  {filters.prices.map((price) => {
                    const isActive = activeFilters.minPrice === price.min && activeFilters.maxPrice === price.max;
                    return (
                      <button
                        key={price.label}
                        data-testid={`filter-price-${price.label.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`}
                        onClick={() => {
                          if (isActive) {
                            setActiveFilters(prev => ({ ...prev, minPrice: undefined, maxPrice: undefined }));
                            if (searchQuery) performSearch(searchQuery, { ...activeFilters, minPrice: undefined, maxPrice: undefined }, 0);
                          } else {
                            setActiveFilters(prev => ({ ...prev, minPrice: price.min, maxPrice: price.max }));
                            if (searchQuery) performSearch(searchQuery, { ...activeFilters, minPrice: price.min, maxPrice: price.max }, 0);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                          isActive
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                        }`}
                      >
                        {price.label} <span className="opacity-60">({price.count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            
            {filters.brands.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Brand</div>
                <div className="flex flex-wrap gap-2">
                  {filters.brands.slice(0, 5).map((brand) => (
                    <button
                      key={brand.name}
                      data-testid={`filter-brand-${brand.name.replace(/\s+/g, '-').toLowerCase()}`}
                      onClick={() => applyFilter('brand', activeFilters.brand === brand.name ? undefined : brand.name)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        activeFilters.brand === brand.name
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      {brand.name} <span className="opacity-60">({brand.count})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-lg text-center mb-6" data-testid="text-error">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="text-center text-white py-12" data-testid="text-loading">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
            <p>Searching 1,100,000+ products...</p>
          </div>
        )}

        {products.length > 0 && !isLoading && (
          <div>
            <p className="text-white text-center mb-6" data-testid="text-results-count">
              Showing <strong>{products.length}</strong> of <strong>{totalCount}</strong> products for "{searchQuery}"
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((product, index) => (
                <Card key={`${product.id}-${index}`} className="overflow-hidden h-full flex flex-col" data-testid={`card-product-${product.id}`}>
                  <div className="aspect-square bg-gray-50 p-4 flex items-center justify-center">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="max-w-full max-h-full object-contain"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Sparkles className="w-16 h-16 text-gray-300" />
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <Badge variant="secondary" className="mb-2 text-xs w-fit">
                      {product.merchant}
                    </Badge>
                    <h3 className="font-semibold text-sm line-clamp-2 mb-2" data-testid={`text-product-name-${product.id}`}>
                      {product.name}
                    </h3>
                    
                    <div className="mt-auto">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xl font-bold" data-testid={`text-product-price-${product.id}`}>
                          £{typeof product.price === 'number' ? product.price.toFixed(2) : product.price}
                        </span>
                      </div>
                      
                      <a
                        href={product.affiliateLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`link-buy-${product.id}`}
                        className="block"
                      >
                        <Button className="w-full" size="sm">
                          Buy Now
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </Button>
                      </a>
                    </div>
                    
                    {product.brand && product.brand !== product.merchant && (
                      <p className="text-xs text-muted-foreground mt-2">{product.brand}</p>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            {hasMore && (
              <div className="text-center mt-8">
                <Button
                  data-testid="button-load-more"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  variant="outline"
                  className="bg-white/10 text-white border-white/30 hover:bg-white/20"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Loading...
                    </>
                  ) : (
                    `Load More Offers (${totalCount - products.length} remaining)`
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {products.length === 0 && !isLoading && searchQuery && (
          <div className="text-center text-white/80 py-8" data-testid="text-no-results">
            <p>No products found. Try a different search term.</p>
          </div>
        )}

        <footer className="text-center text-white/50 text-sm mt-12 py-6">
          <p>All products are real - sourced directly from retailer datafeeds</p>
          <p className="mt-1">Designed by Andrew Kilmartin</p>
        </footer>
      </div>
    </div>
  );
}
