import { useState, useRef, useEffect } from "react";
import { Search, ShoppingBag, ExternalLink, Loader2, X, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// FIX #71: Click tracking utilities (copied from shop.tsx)
function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let sessionId = localStorage.getItem('sunny_session_id');
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem('sunny_session_id', sessionId);
  }
  return sessionId;
}

function detectDevice(): string {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/mobile/i.test(ua)) return 'mobile';
  if (/tablet/i.test(ua)) return 'tablet';
  return 'desktop';
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  rrpPrice: number | null;
  savingsPercent: number | null;
  averageRating: number | null;
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
  "Nike trainers",
  "Marvel",
  "school shoes",
  "outdoor toys",
  "kids pyjamas",
  "Star Wars"
];

export default function ShopV2Search() {
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
  
  // FIX #71: Track page load time for click analytics
  const pageLoadTime = useRef<number>(Date.now());
  
  useEffect(() => {
    pageLoadTime.current = Date.now();
  }, [searchQuery]);
  
  // FIX #71: Click tracking function (copied from shop.tsx)
  const trackAndRedirect = (
    product: Product,
    position: number,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.preventDefault();
    
    const trackingData = JSON.stringify({
      session_id: getSessionId(),
      query: searchQuery || '',
      product_id: product.id,
      product_name: product.name,
      product_price: product.price,
      product_merchant: product.merchant,
      position: position + 1,
      products_shown_count: products.length,
      products_shown_ids: products.map(p => p.id),
      time_on_page_ms: Date.now() - pageLoadTime.current,
      destination_url: product.affiliateLink,
      device_type: detectDevice()
    });
    
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track/click', new Blob([trackingData], { type: 'application/json' }));
    } else {
      fetch('/api/track/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: trackingData,
        keepalive: true
      }).catch(() => {});
    }
    
    window.open(product.affiliateLink, '_blank', 'noopener,noreferrer');
  };

  const performSearch = async (searchText: string, appliedFilters: ActiveFilters = {}, offset = 0) => {
    if (!searchText.trim()) return;
    
    const isNewSearch = offset === 0;
    if (isNewSearch) {
      setIsLoading(true);
      setProducts([]);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);

    try {
      const response = await fetch("/api/shopv2/search", {
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
        })
      });

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
      }
    } catch (err) {
      setError("Failed to connect to search service");
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="text-center py-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-3 flex items-center justify-center gap-3">
            <ShoppingBag className="w-10 h-10 text-yellow-300" />
            <span>Sunny <span className="text-yellow-300">Shop V2</span></span>
          </h1>
          <p className="text-lg text-white/80">
            AI-powered search across 997,000+ family products
          </p>
          <p className="text-sm text-white/60 mt-1">
            Enhanced data with RRP, savings, and ratings
          </p>
        </header>

        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto mb-6">
          <div className="flex gap-2 bg-white rounded-full p-2 shadow-xl">
            <Input
              data-testid="input-shopv2-search"
              type="text"
              placeholder="What are you looking for? e.g. Nike trainers"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 border-0 focus-visible:ring-0 text-base"
            />
            <Button 
              data-testid="button-shopv2-search"
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
            
            {filters?.categories?.length > 0 && (
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
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      {cat.name} <span className="opacity-60">({cat.count})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {filters?.prices?.length > 0 && (
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
                            ? 'bg-emerald-600 text-white'
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
            
            {filters?.brands?.length > 0 && (
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
                          ? 'bg-emerald-600 text-white'
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
            <p>Searching 997,000+ products...</p>
          </div>
        )}

        {products.length > 0 && !isLoading && (
          <div>
            <p className="text-white text-center mb-6" data-testid="text-results-count">
              Showing <strong>{products.length}</strong> of <strong>{totalCount.toLocaleString()}</strong> products for "{searchQuery}"
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((product, index) => (
                <Card key={`${product.id}-${index}`} className="overflow-hidden h-full flex flex-col" data-testid={`card-product-${product.id}`}>
                  <div className="aspect-square bg-gray-50 p-4 flex items-center justify-center relative">
                    {product.savingsPercent && product.savingsPercent > 0 && (
                      <Badge 
                        className="absolute top-2 right-2 bg-red-500 text-white"
                        data-testid={`badge-savings-${product.id}`}
                      >
                        {Math.round(product.savingsPercent)}% OFF
                      </Badge>
                    )}
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
                      <ShoppingBag className="w-16 h-16 text-gray-300" />
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        {product.merchant}
                      </Badge>
                      {product.averageRating && product.averageRating > 0 && (
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          {product.averageRating.toFixed(1)}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm line-clamp-2 mb-2" data-testid={`text-product-name-${product.id}`}>
                      {product.name}
                    </h3>
                    
                    <div className="mt-auto">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xl font-bold text-emerald-600" data-testid={`text-product-price-${product.id}`}>
                          £{typeof product.price === 'number' ? product.price.toFixed(2) : product.price}
                        </span>
                        {product.rrpPrice && product.rrpPrice > product.price && (
                          <span className="text-sm text-muted-foreground line-through" data-testid={`text-product-rrp-${product.id}`}>
                            £{product.rrpPrice.toFixed(2)}
                          </span>
                        )}
                      </div>
                      
                      <Button 
                        className="w-full bg-emerald-600 hover:bg-emerald-700" 
                        size="sm"
                        data-testid={`link-buy-${product.id}`}
                        onClick={(e) => trackAndRedirect(product, index, e)}
                      >
                        Buy Now
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
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
                    `Load More Offers (${(totalCount - products.length).toLocaleString()} remaining)`
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
          <p>Powered by Awin affiliate network</p>
          <p className="mt-1">997,000+ real products - sourced directly from retailer datafeeds</p>
        </footer>
      </div>
    </div>
  );
}
