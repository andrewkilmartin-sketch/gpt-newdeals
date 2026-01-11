import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CheckCircle, XCircle, SkipForward, RefreshCw, Search, ChevronLeft, ChevronRight } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: number;
  merchant: string;
  imageUrl?: string;
  brand?: string;
  category?: string;
}

interface SearchResult {
  success: boolean;
  products: Product[];
  count: number;
  cached?: boolean;
}

interface VerifyStats {
  total: number;
  verified: number;
  flagged: number;
  remaining: number;
}

export default function VerifyPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [queries, setQueries] = useState<string[]>([]);

  useEffect(() => {
    fetch('/data/test-queries-500.json')
      .then(res => res.json())
      .then((data: string[]) => setQueries(data))
      .catch(err => console.error('Failed to load queries:', err));
  }, []);

  const currentQuery = queries[currentIndex] || "";

  const { data: searchResults, isLoading: searching, refetch } = useQuery<SearchResult>({
    queryKey: ['/api/shop/search', currentQuery],
    queryFn: async () => {
      if (!currentQuery) return { success: false, products: [], count: 0 };
      const res = await fetch('/api/shop/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: currentQuery, limit: 10 })
      });
      return res.json();
    },
    enabled: !!currentQuery,
    staleTime: 60000,
  });

  const { data: stats, refetch: refetchStats } = useQuery<VerifyStats>({
    queryKey: ['/api/verify/stats'],
    staleTime: 30000,
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ action }: { action: 'correct' | 'wrong' | 'skip' }) => {
      if (action === 'skip') {
        return { skipped: true };
      }
      
      const productIds = searchResults?.products?.map(p => p.id) || [];
      const productNames = searchResults?.products?.map(p => p.name) || [];
      
      const response = await apiRequest('POST', '/api/verify/save', {
        query: currentQuery,
        productIds,
        productNames,
        confidence: action === 'correct' ? 'manual' : 'flagged',
        verifiedBy: 'admin'
      });
      return response.json();
    },
    onSuccess: () => {
      refetchStats();
      if (currentIndex < queries.length - 1) {
        setCurrentIndex(prev => prev + 1);
      }
    }
  });

  const handleAction = (action: 'correct' | 'wrong' | 'skip') => {
    verifyMutation.mutate({ action });
  };

  const goNext = () => setCurrentIndex(prev => Math.min(prev + 1, queries.length - 1));
  const goPrev = () => setCurrentIndex(prev => Math.max(prev - 1, 0));

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Result Verification
            </CardTitle>
            <CardDescription>
              Review search results and mark them as correct or flag for fixing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-center">
              <Badge variant="outline" data-testid="text-progress">
                Query {currentIndex + 1} of {queries.length}
              </Badge>
              {stats && (
                <>
                  <Badge variant="secondary" data-testid="text-verified-count">
                    Verified: {stats.verified}
                  </Badge>
                  <Badge variant="destructive" data-testid="text-flagged-count">
                    Flagged: {stats.flagged}
                  </Badge>
                  <Badge variant="outline" data-testid="text-remaining-count">
                    Remaining: {stats.remaining}
                  </Badge>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl" data-testid="text-current-query">
                  "{currentQuery}"
                </CardTitle>
                {searchResults?.cached && (
                  <Badge variant="secondary" className="mt-2">Cached Result</Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={goPrev} disabled={currentIndex === 0} data-testid="button-prev">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={goNext} disabled={currentIndex >= queries.length - 1} data-testid="button-next">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {searching ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Searching...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {searchResults?.products?.map((product, idx) => (
                  <div 
                    key={product.id} 
                    className="border rounded-lg p-3 hover-elevate"
                    data-testid={`card-product-${idx}`}
                  >
                    <div className="text-xs text-muted-foreground mb-1">#{idx + 1}</div>
                    {product.imageUrl && (
                      <img 
                        src={product.imageUrl} 
                        alt={product.name}
                        className="w-full h-24 object-contain mb-2 rounded"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">
                      {product.name}
                    </div>
                    <div className="text-sm text-primary font-semibold mt-1">
                      £{product.price?.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {product.merchant}
                    </div>
                  </div>
                ))}
                {(!searchResults?.products || searchResults.products.length === 0) && (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    No products found
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-center gap-4">
          <Button
            onClick={() => handleAction('correct')}
            disabled={verifyMutation.isPending || searching}
            className="bg-green-600 hover:bg-green-700"
            size="lg"
            data-testid="button-correct"
          >
            <CheckCircle className="h-5 w-5 mr-2" />
            Correct - Cache It
          </Button>
          <Button
            onClick={() => handleAction('wrong')}
            disabled={verifyMutation.isPending || searching}
            variant="destructive"
            size="lg"
            data-testid="button-wrong"
          >
            <XCircle className="h-5 w-5 mr-2" />
            Wrong - Flag It
          </Button>
          <Button
            onClick={() => handleAction('skip')}
            disabled={verifyMutation.isPending || searching}
            variant="outline"
            size="lg"
            data-testid="button-skip"
          >
            <SkipForward className="h-5 w-5 mr-2" />
            Skip
          </Button>
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Keyboard shortcuts: C = Correct, W = Wrong, S = Skip, Arrow keys = Navigate</p>
        </div>
      </div>
    </div>
  );
}
