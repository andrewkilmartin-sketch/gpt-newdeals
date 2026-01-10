import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle, XCircle, AlertTriangle, Package, Image, Clock, Film, Search, ArrowRight, Star, Download } from "lucide-react";

interface DiagnosticResult {
  query: string;
  verdict: string;
  fixAction: string;
  dbCount: number;
  searchCount: number;
  relevance: number;
  imagePercent: number;
  timeMs: number;
}

interface BatchResponse {
  summary: {
    total: number;
    passed: number;
    passWithFallback: number;
    cinemaIntents: number;
    inventoryGaps: number;
    searchBugs: number;
    rankingBugs: number;
    imageBugs: number;
    speedBugs: number;
    errors: number;
  };
  results: DiagnosticResult[];
}

interface ScoredResult {
  position: number;
  title: string;
  merchant: string;
  price: string;
  score: number;
  reason: string;
  flagged: boolean;
}

interface ScoredAuditResult {
  query: string;
  verdict: string;
  dbCount: number;
  resultCount: number;
  avgScore: string;
  relevancePercent: number;
  flaggedCount: number;
  timeMs: number;
  results: ScoredResult[];
  fixAction: string;
}

interface ScoredBatchResponse {
  summary: {
    total: number;
    passed: number;
    cinemaIntents: number;
    inventoryGaps: number;
    searchBugs: number;
    flaggedContent: number;
    poorRelevance: number;
    weakRelevance: number;
    errors: number;
    avgRelevanceScore: number;
    overallRelevancePercent: number;
    totalTimeMs: number;
  };
  results: ScoredAuditResult[];
}

const DEFAULT_QUERIES = [
  "nike trainers",
  "school shoes",
  "lego star wars",
  "barbie dolls",
  "paw patrol toys",
  "kids pyjamas",
  "whats on at the cinema",
  "movies",
  "films tonight",
  "clarks",
  "dr martens",
  "playmobil",
  "hugo boss",
  "birthday gift for 5 year old girl under £20",
];

function getVerdictIcon(verdict: string) {
  switch (verdict) {
    case 'PASS':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'PASS_WITH_FALLBACK':
      return <ArrowRight className="w-5 h-5 text-emerald-500" />;
    case 'CINEMA_INTENT':
      return <Film className="w-5 h-5 text-blue-500" />;
    case 'INVENTORY_GAP':
      return <Package className="w-5 h-5 text-orange-500" />;
    case 'SEARCH_BUG':
      return <XCircle className="w-5 h-5 text-red-500" />;
    case 'RANKING_BUG':
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    case 'IMAGE_BUG':
      return <Image className="w-5 h-5 text-purple-500" />;
    case 'SPEED_BUG':
      return <Clock className="w-5 h-5 text-red-500" />;
    case 'INAPPROPRIATE':
      return <XCircle className="w-5 h-5 text-red-600" />;
    case 'KEYWORD_MISMATCH':
      return <AlertTriangle className="w-5 h-5 text-orange-600" />;
    case 'QUALITY_MISMATCH':
      return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    case 'FALLBACK_RESULT':
      return <ArrowRight className="w-5 h-5 text-gray-500" />;
    default:
      return <XCircle className="w-5 h-5 text-gray-500" />;
  }
}

function getVerdictLabel(verdict: string) {
  switch (verdict) {
    case 'PASS': return 'PASS';
    case 'PASS_WITH_FALLBACK': return 'FALLBACK';
    case 'CINEMA_INTENT': return 'CINEMA';
    case 'INVENTORY_GAP': return 'INV GAP';
    case 'SEARCH_BUG': return 'SEARCH';
    case 'RANKING_BUG': return 'RANKING';
    case 'IMAGE_BUG': return 'IMAGES';
    case 'SPEED_BUG': return 'SPEED';
    case 'INAPPROPRIATE': return 'INAPPROPRIATE';
    case 'KEYWORD_MISMATCH': return 'KEYWORD';
    case 'QUALITY_MISMATCH': return 'QUALITY';
    case 'FALLBACK_RESULT': return 'GENERIC';
    default: return verdict;
  }
}

export default function TestDashboard() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<BatchResponse | null>(null);
  const [scoredResults, setScoredResults] = useState<ScoredBatchResponse | null>(null);
  const [customQuery, setCustomQuery] = useState("");
  const [singleResult, setSingleResult] = useState<any>(null);
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);

  const runBatchTest = async () => {
    setIsLoading(true);
    setSingleResult(null);
    setScoredResults(null);
    try {
      const response = await fetch('/api/diagnostic/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries: DEFAULT_QUERIES })
      });
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Test failed:', error);
    }
    setIsLoading(false);
  };

  const runScoredAudit = async () => {
    setIsLoading(true);
    setSingleResult(null);
    setResults(null);
    try {
      const response = await fetch('/api/diagnostic/audit-scored', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries: DEFAULT_QUERIES })
      });
      const data = await response.json();
      setScoredResults(data);
    } catch (error) {
      console.error('AI Audit failed:', error);
    }
    setIsLoading(false);
  };

  const downloadCSV = async () => {
    try {
      const response = await fetch('/api/diagnostic/audit-scored', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries: DEFAULT_QUERIES, exportCsv: true })
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sunny-audit-scored.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('CSV download failed:', error);
    }
  };

  const runSingleTest = async () => {
    if (!customQuery.trim()) return;
    setIsLoading(true);
    setResults(null);
    setScoredResults(null);
    try {
      const response = await fetch('/api/diagnostic/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: customQuery })
      });
      const data = await response.json();
      setSingleResult(data);
    } catch (error) {
      console.error('Test failed:', error);
    }
    setIsLoading(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'text-green-500';
    if (score >= 3) return 'text-blue-500';
    if (score >= 2) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Sunny Diagnostic Dashboard</h1>
        <p className="text-muted-foreground mb-6">Test search quality across DATA, SEARCH, RANKING, IMAGES, SPEED layers</p>
        
        <div className="flex flex-wrap gap-4 mb-6">
          <Button 
            onClick={runBatchTest} 
            disabled={isLoading}
            size="lg"
            data-testid="button-run-batch"
          >
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
            Quick Test ({DEFAULT_QUERIES.length})
          </Button>

          <Button 
            onClick={runScoredAudit} 
            disabled={isLoading}
            size="lg"
            variant="secondary"
            data-testid="button-run-scored"
          >
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Star className="w-4 h-4 mr-2" />}
            AI Scored Audit
          </Button>

          {scoredResults && (
            <Button 
              onClick={downloadCSV} 
              variant="outline"
              data-testid="button-download-csv"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          )}
          
          <div className="flex gap-2">
            <Input
              placeholder="Custom query..."
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSingleTest()}
              className="w-64"
              data-testid="input-custom-query"
            />
            <Button onClick={runSingleTest} disabled={isLoading || !customQuery.trim()} data-testid="button-run-single">
              Test
            </Button>
          </div>
        </div>

        {results && (
          <>
            <Card className="p-4 mb-6">
              <h2 className="font-semibold mb-3">Summary</h2>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-900 rounded-md" data-testid="summary-pass">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium">PASS: {results.summary.passed}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-100 dark:bg-emerald-900 rounded-md" data-testid="summary-fallback">
                  <ArrowRight className="w-5 h-5 text-emerald-600" />
                  <span className="font-medium">FALLBACK: {results.summary.passWithFallback || 0}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-900 rounded-md" data-testid="summary-cinema">
                  <Film className="w-5 h-5 text-blue-600" />
                  <span className="font-medium">CINEMA: {results.summary.cinemaIntents}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-orange-100 dark:bg-orange-900 rounded-md" data-testid="summary-inventory">
                  <Package className="w-5 h-5 text-orange-600" />
                  <span className="font-medium">INV GAP: {results.summary.inventoryGaps}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-red-100 dark:bg-red-900 rounded-md" data-testid="summary-search">
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span className="font-medium">SEARCH: {results.summary.searchBugs}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-yellow-100 dark:bg-yellow-900 rounded-md" data-testid="summary-ranking">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <span className="font-medium">RANKING: {results.summary.rankingBugs}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-purple-100 dark:bg-purple-900 rounded-md" data-testid="summary-images">
                  <Image className="w-5 h-5 text-purple-600" />
                  <span className="font-medium">IMAGES: {results.summary.imageBugs}</span>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium">Query</th>
                    <th className="text-left p-3 font-medium">Verdict</th>
                    <th className="text-right p-3 font-medium">DB</th>
                    <th className="text-right p-3 font-medium">Found</th>
                    <th className="text-right p-3 font-medium">Relevance</th>
                    <th className="text-right p-3 font-medium">Images</th>
                    <th className="text-right p-3 font-medium">Time</th>
                    <th className="text-left p-3 font-medium">Fix</th>
                  </tr>
                </thead>
                <tbody>
                  {results.results.map((r, i) => (
                    <tr key={i} className="border-t hover:bg-muted/50" data-testid={`row-result-${i}`}>
                      <td className="p-3 font-mono text-sm">{r.query}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {getVerdictIcon(r.verdict)}
                          <span className="text-sm font-medium">{getVerdictLabel(r.verdict)}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono">{r.dbCount}</td>
                      <td className="p-3 text-right font-mono">{r.searchCount}</td>
                      <td className="p-3 text-right font-mono">{r.relevance}%</td>
                      <td className="p-3 text-right font-mono">{r.imagePercent}%</td>
                      <td className="p-3 text-right font-mono">{r.timeMs}ms</td>
                      <td className="p-3 text-sm text-muted-foreground">{r.fixAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        )}

        {scoredResults && (
          <>
            <Card className="p-4 mb-6">
              <h2 className="font-semibold mb-3">AI Scored Audit Summary</h2>
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="p-4 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 rounded-lg" data-testid="summary-relevance">
                  <div className="text-3xl font-bold text-green-600">{scoredResults.summary.overallRelevancePercent}%</div>
                  <div className="text-sm text-muted-foreground">Overall Relevance</div>
                  <div className="text-xs text-muted-foreground mt-1">Avg Score: {scoredResults.summary.avgRelevanceScore}/5.0</div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-900 rounded-md">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium">PASS: {scoredResults.summary.passed}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-red-100 dark:bg-red-900 rounded-md">
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span className="font-medium">FLAGGED: {scoredResults.summary.flaggedContent}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-orange-100 dark:bg-orange-900 rounded-md">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  <span className="font-medium">POOR: {scoredResults.summary.poorRelevance}</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-yellow-100 dark:bg-yellow-900 rounded-md">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <span className="font-medium">WEAK: {scoredResults.summary.weakRelevance}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Total Time: {(scoredResults.summary.totalTimeMs / 1000).toFixed(1)}s | 
                Tested: {scoredResults.summary.total} queries
              </p>
            </Card>

            <Card className="overflow-hidden mb-6">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium">Query</th>
                    <th className="text-left p-3 font-medium">Verdict</th>
                    <th className="text-center p-3 font-medium">Score</th>
                    <th className="text-right p-3 font-medium">Relevance</th>
                    <th className="text-right p-3 font-medium">Flagged</th>
                    <th className="text-right p-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {scoredResults.results.map((r, i) => (
                    <>
                      <tr 
                        key={i} 
                        className="border-t hover:bg-muted/50 cursor-pointer" 
                        onClick={() => setExpandedQuery(expandedQuery === r.query ? null : r.query)}
                        data-testid={`scored-row-${i}`}
                      >
                        <td className="p-3 font-mono text-sm">{r.query}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {getVerdictIcon(r.verdict)}
                            <span className="text-sm font-medium">{getVerdictLabel(r.verdict)}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`font-bold text-lg ${getScoreColor(parseFloat(r.avgScore))}`}>
                            {r.avgScore}
                          </span>
                          <span className="text-xs text-muted-foreground">/5</span>
                        </td>
                        <td className="p-3 text-right font-mono">{r.relevancePercent}%</td>
                        <td className="p-3 text-right font-mono">
                          {r.flaggedCount > 0 ? (
                            <span className="text-red-500 font-bold">{r.flaggedCount}</span>
                          ) : (
                            <span className="text-green-500">0</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono">{r.timeMs}ms</td>
                      </tr>
                      {expandedQuery === r.query && (
                        <tr key={`${i}-expanded`} className="bg-muted/30">
                          <td colSpan={6} className="p-4">
                            <h4 className="font-medium mb-2">Scored Results for "{r.query}"</h4>
                            <div className="space-y-2">
                              {r.results.map((res, j) => (
                                <div 
                                  key={j} 
                                  className={`flex items-center gap-3 p-2 rounded text-sm ${res.flagged ? 'bg-red-100 dark:bg-red-900/30' : 'bg-background'}`}
                                >
                                  <span className="font-mono text-muted-foreground w-6">{res.position}.</span>
                                  <span className={`font-bold w-8 ${getScoreColor(res.score)}`}>{res.score}</span>
                                  <span className="flex-1 truncate">{res.title || '(empty)'}</span>
                                  <span className="text-muted-foreground w-32 truncate">{res.merchant}</span>
                                  <span className="text-xs text-muted-foreground w-48 truncate">{res.reason}</span>
                                </div>
                              ))}
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">{r.fixAction}</p>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        )}

        {singleResult && (
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Single Query Result: "{singleResult.query}"</h2>
            <div className="flex items-center gap-2 mb-4">
              {getVerdictIcon(singleResult.verdict)}
              <span className="font-bold text-lg">{singleResult.verdict}</span>
              <span className="text-muted-foreground">- {singleResult.fixAction}</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-3 bg-muted rounded-md">
                <h3 className="font-medium mb-2">Intent</h3>
                <p className="text-sm">Detected: {singleResult.diagnosis?.intent?.detected}</p>
                <p className="text-sm text-muted-foreground">Keywords: {singleResult.diagnosis?.intent?.queryWords?.join(', ')}</p>
              </div>
              
              <div className="p-3 bg-muted rounded-md">
                <h3 className="font-medium mb-2">Database</h3>
                <p className="text-sm">Total in DB: {singleResult.diagnosis?.database?.totalInDB}</p>
                <p className="text-sm">With Images: {singleResult.diagnosis?.database?.withImages}</p>
                <p className="text-sm text-muted-foreground">Awin: {singleResult.diagnosis?.database?.awinProducts} | CJ: {singleResult.diagnosis?.database?.cjProducts}</p>
              </div>
              
              <div className="p-3 bg-muted rounded-md">
                <h3 className="font-medium mb-2">Search</h3>
                <p className="text-sm">Returned: {singleResult.diagnosis?.search?.returnedCount}</p>
                <p className="text-sm">Time: {singleResult.diagnosis?.search?.searchTimeMs}ms</p>
              </div>
              
              <div className="p-3 bg-muted rounded-md">
                <h3 className="font-medium mb-2">Relevance</h3>
                <p className="text-sm">Relevant in Top 10: {singleResult.diagnosis?.relevance?.relevantInTop10}</p>
                <p className="text-sm">Score: {singleResult.diagnosis?.relevance?.relevancePercent}%</p>
              </div>
              
              <div className="p-3 bg-muted rounded-md">
                <h3 className="font-medium mb-2">Images</h3>
                <p className="text-sm">With Images: {singleResult.diagnosis?.images?.withImages}</p>
                <p className="text-sm">Missing: {singleResult.diagnosis?.images?.withoutImages}</p>
                <p className="text-sm">Coverage: {singleResult.diagnosis?.images?.imagePercent}%</p>
              </div>
            </div>
            
            {singleResult.diagnosis?.search?.topResults && (
              <div className="mt-4">
                <h3 className="font-medium mb-2">Top 5 Results</h3>
                <div className="space-y-2">
                  {singleResult.diagnosis.search.topResults.map((r: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-2 bg-muted rounded text-sm">
                      <span className="font-mono text-muted-foreground">{i + 1}.</span>
                      <span className="flex-1">{r.name}</span>
                      <span className="text-muted-foreground">{r.merchant}</span>
                      <span className="font-mono">£{r.price}</span>
                      <span className={r.hasImage ? 'text-green-500' : 'text-red-500'}>
                        {r.hasImage ? 'IMG' : 'NO IMG'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {!results && !singleResult && !isLoading && (
          <Card className="p-8 text-center text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Click "Run All Tests" to test {DEFAULT_QUERIES.length} queries, or enter a custom query above.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
