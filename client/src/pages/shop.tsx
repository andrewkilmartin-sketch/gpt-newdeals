import { useState, useRef, useEffect } from "react";
import { Search, ExternalLink, Loader2, X, Sparkles, Tag, Ticket, ImageOff, Copy, Check, Film, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

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

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast({
        title: "Code copied!",
        description: `"${code}" copied to clipboard`,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Please copy the code manually",
        variant: "destructive",
      });
    }
  };
  
  return (
    <button 
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-xs font-medium transition-colors"
      data-testid="button-copy-code"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

// ProductImage component - simplified to trust database URLs
function ProductImage({ src, alt }: { src: string | null; alt: string }) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Only reject truly empty URLs - let the browser handle the rest
  if (!src || src.trim() === '' || hasError) {
    return (
      <div className="flex flex-col items-center justify-center text-muted-foreground h-full">
        <ImageOff className="w-12 h-12 mb-2" />
        <span className="text-xs">Image unavailable</span>
      </div>
    );
  }
  
  return (
    <>
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`max-w-full max-h-full object-contain transition-opacity duration-200 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
        onError={() => setHasError(true)}
        onLoad={() => setIsLoaded(true)}
      />
    </>
  );
}

interface ProductPromotion {
  title: string;
  voucherCode?: string;
  expiresAt?: string;
  type: string;
}

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
  promotion?: ProductPromotion;
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

interface DealOnly {
  title: string;
  voucherCode?: string;
  expiresAt?: string;
  merchantName?: string;
  description?: string;
  deepLink?: string;
}

interface CinemaMovie {
  type: string;
  id: number;
  title: string;
  overview: string;
  poster: string;
  backdrop: string;
  releaseDate: string;
  rating: number;
  genres: string[];
  certification: string;
  contentType: string;
}

interface CinemaResults {
  content: CinemaMovie[];
  attribution: string;
}

interface SearchResponse {
  success: boolean;
  query: string;
  count: number;
  totalCount: number;
  hasMore: boolean;
  products: Product[];
  filters?: Filters;
  dealsOnly?: DealOnly[];
  message?: string;
  cinemaResults?: CinemaResults;
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
  const [dealsOnly, setDealsOnly] = useState<DealOnly[]>([]);
  const [dealsMessage, setDealsMessage] = useState<string | null>(null);
  const [cinemaResults, setCinemaResults] = useState<CinemaMovie[]>([]);
  
  const pageLoadTime = useRef<number>(Date.now());
  
  useEffect(() => {
    pageLoadTime.current = Date.now();
  }, [searchQuery]);

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
    
    // FIX: sendBeacon can silently return false - must check and fallback
    let beaconSent = false;
    if (navigator.sendBeacon) {
      beaconSent = navigator.sendBeacon('/api/track/click', new Blob([trackingData], { type: 'application/json' }));
      if (!beaconSent) {
        console.warn('[Click Tracking] sendBeacon returned false, using fetch fallback');
      }
    }
    
    // Always use fetch as fallback or redundancy
    if (!beaconSent) {
      fetch('/api/track/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: trackingData,
        keepalive: true
      }).catch((err) => {
        console.error('[Click Tracking] Fetch fallback failed:', err);
      });
    }
    
    window.open(product.affiliateLink, '_blank', 'noopener,noreferrer');
  };

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
          
          // Handle cinema results
          if (data.cinemaResults?.content && data.cinemaResults.content.length > 0) {
            setCinemaResults(data.cinemaResults.content);
          } else {
            setCinemaResults([]);
          }
          
          // Only show deals-only when no products, otherwise clear
          if (data.products.length === 0 && data.dealsOnly && data.dealsOnly.length > 0) {
            setDealsOnly(data.dealsOnly);
            setDealsMessage(data.message || null);
          } else {
            setDealsOnly([]);
            setDealsMessage(null);
          }
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
            {(() => {
              const productsWithPromos = products.filter(p => p.promotion);
              const uniquePromos = new Map<string, { merchant: string; promo: ProductPromotion }>();
              productsWithPromos.forEach(p => {
                if (p.promotion && !uniquePromos.has(p.merchant)) {
                  uniquePromos.set(p.merchant, { merchant: p.merchant, promo: p.promotion });
                }
              });
              const promoList = Array.from(uniquePromos.values()).slice(0, 4);
              
              if (promoList.length > 0) {
                return (
                  <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-4 mb-6 shadow-lg" data-testid="promotions-carousel">
                    <div className="flex items-center gap-2 mb-3">
                      <Tag className="w-5 h-5 text-white" />
                      <h2 className="text-white font-bold text-lg">Deals on {searchQuery}</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {promoList.map(({ merchant, promo }) => (
                        <div key={merchant} className="bg-white rounded-lg p-3 shadow-md">
                          <p className="font-semibold text-sm text-gray-800 truncate">{merchant}</p>
                          <p className="text-xs text-red-600 font-medium line-clamp-2 mt-1">{promo.title}</p>
                          {promo.voucherCode ? (
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-gray-600">Use code:</span>
                              <code className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-mono font-bold">{promo.voucherCode}</code>
                              <CopyCodeButton code={promo.voucherCode} />
                            </div>
                          ) : (
                            <div className="mt-2 flex items-center gap-1 text-xs text-blue-600">
                              <Sparkles className="w-3 h-3" />
                              <span>No code needed - auto applies</span>
                            </div>
                          )}
                          {promo.expiresAt && (
                            <p className="text-xs text-gray-400 mt-1">Until {promo.expiresAt}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })()}
            
            {/* Cinema Results - displayed as movie tiles */}
            {cinemaResults.length > 0 ? (
              <>
                <p className="text-white text-center mb-6" data-testid="text-cinema-count">
                  <strong>{cinemaResults.length}</strong> movies now showing at the cinema
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
                  {cinemaResults.map((movie) => (
                    <Card key={movie.id} className="overflow-hidden h-full flex flex-col" data-testid={`card-movie-${movie.id}`}>
                      <div className="aspect-[2/3] bg-gray-900 relative">
                        {movie.poster ? (
                          <img 
                            src={movie.poster} 
                            alt={movie.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <Film className="w-12 h-12 mb-2" />
                            <span className="text-xs">No poster</span>
                          </div>
                        )}
                        {movie.certification && (
                          <Badge className="absolute top-2 right-2 bg-black/80 text-white">
                            {movie.certification}
                          </Badge>
                        )}
                      </div>
                      <div className="p-4 flex-1 flex flex-col">
                        <h3 className="font-semibold text-sm line-clamp-2 mb-2" data-testid={`text-movie-title-${movie.id}`}>
                          {movie.title}
                        </h3>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {movie.genres.slice(0, 2).map(genre => (
                            <Badge key={genre} variant="secondary" className="text-xs">
                              {genre}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-3 mb-3">
                          {movie.overview}
                        </p>
                        <div className="mt-auto flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                            <span className="text-sm font-medium">{movie.rating.toFixed(1)}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(movie.releaseDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                <p className="text-white/60 text-center text-xs mb-6">
                  Movie data provided by TMDB
                </p>
              </>
            ) : (
              <p className="text-white text-center mb-6" data-testid="text-results-count">
                Showing <strong>{products.length}</strong> of <strong>{totalCount}</strong> products for "{searchQuery}"
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((product, index) => (
                <Card key={`${product.id}-${index}`} className="overflow-hidden h-full flex flex-col relative" data-testid={`card-product-${product.id}`}>
                  {product.promotion && (
                    <div className="absolute top-2 right-2 z-10">
                      <Badge className="bg-red-500 text-white text-xs px-2 py-1 flex items-center gap-1 shadow-lg">
                        <Tag className="w-3 h-3" />
                        {product.promotion.voucherCode 
                          ? `${product.promotion.voucherCode}` 
                          : 'DEAL'}
                      </Badge>
                    </div>
                  )}
                  <div className="aspect-square bg-gray-50 p-4 flex items-center justify-center relative">
                    {product.imageUrl ? (
                      <ProductImage 
                        src={product.imageUrl} 
                        alt={product.name} 
                      />
                    ) : (
                      <div className="flex flex-col items-center text-gray-400">
                        <Sparkles className="w-12 h-12 mb-2" />
                        <span className="text-xs">No image</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <Badge variant="secondary" className="mb-2 text-xs w-fit">
                      {product.merchant}
                    </Badge>
                    <h3 className="font-semibold text-sm line-clamp-2 mb-2" data-testid={`text-product-name-${product.id}`}>
                      {product.name}
                    </h3>
                    
                    {product.promotion && (
                      <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-100 rounded-md px-2 py-1.5 mb-2">
                        <p className="text-xs font-medium text-red-600 line-clamp-2 flex items-center gap-1">
                          <Ticket className="w-3 h-3 flex-shrink-0" />
                          {product.promotion.title}
                        </p>
                        {product.promotion.voucherCode ? (
                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs text-gray-600">Use code:</span>
                            <code className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-xs font-mono font-bold">{product.promotion.voucherCode}</code>
                            <CopyCodeButton code={product.promotion.voucherCode} />
                          </div>
                        ) : (
                          <div className="mt-1.5 flex items-center gap-1 text-xs text-blue-600">
                            <Sparkles className="w-3 h-3" />
                            <span>Auto-applies at checkout</span>
                          </div>
                        )}
                        {product.promotion.expiresAt && (
                          <p className="text-xs text-gray-500 mt-1">
                            Expires: {product.promotion.expiresAt}
                          </p>
                        )}
                      </div>
                    )}
                    
                    <div className="mt-auto">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xl font-bold" data-testid={`text-product-price-${product.id}`}>
                          £{typeof product.price === 'number' ? product.price.toFixed(2) : product.price}
                        </span>
                      </div>
                      
                      <Button 
                        className="w-full" 
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
                    `Load More Offers (${totalCount - products.length} remaining)`
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {products.length === 0 && !isLoading && searchQuery && (
          <div className="text-center text-white/80 py-8" data-testid="text-no-results">
            {dealsOnly.length > 0 ? (
              <div className="max-w-2xl mx-auto" data-testid="container-deals-only">
                <p className="text-lg mb-4" data-testid="text-deals-message">{dealsMessage || `No products, but we have deals for "${searchQuery}"!`}</p>
                <div className="grid gap-4">
                  {dealsOnly.map((deal, idx) => (
                    <Card key={idx} className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200 p-4" data-testid={`card-deal-${idx}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 text-left">
                          {deal.merchantName && (
                            <p className="font-bold text-gray-900 mb-1" data-testid={`text-deal-merchant-${idx}`}>{deal.merchantName}</p>
                          )}
                          <p className="text-sm text-gray-700" data-testid={`text-deal-title-${idx}`}>{deal.title}</p>
                          
                          {deal.voucherCode ? (
                            <div className="mt-2 flex items-center gap-2 flex-wrap bg-white/80 rounded-lg px-3 py-2">
                              <span className="text-sm text-gray-600 font-medium">Use code:</span>
                              <code className="bg-green-100 text-green-800 px-3 py-1 rounded text-sm font-mono font-bold">{deal.voucherCode}</code>
                              <CopyCodeButton code={deal.voucherCode} />
                            </div>
                          ) : (
                            <div className="mt-2 flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2">
                              <Sparkles className="w-4 h-4 text-blue-500" />
                              <span className="text-sm text-blue-700 font-medium">No code needed - discount applies automatically</span>
                            </div>
                          )}
                          
                          {deal.expiresAt && (
                            <p className="text-xs text-gray-500 mt-2" data-testid={`text-deal-expires-${idx}`}>Expires: {deal.expiresAt}</p>
                          )}
                        </div>
                        {deal.deepLink && (
                          <a href={deal.deepLink} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                            <Button size="sm" className="bg-red-500 hover:bg-red-600 w-full sm:w-auto" data-testid={`button-get-deal-${idx}`}>
                              Get Deal <ExternalLink className="w-3 h-3 ml-1" />
                            </Button>
                          </a>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <p>No products found. Try a different search term.</p>
            )}
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
