import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ShoppingBag, Film, MapPin, Home, Lightbulb, ExternalLink, Copy, Check } from "lucide-react";

interface Endpoint {
  path: string;
  method: string;
  description: string;
  icon: typeof ShoppingBag;
  parameters: { name: string; description: string }[];
  exampleCall: string;
}

const endpoints: Endpoint[] = [
  {
    path: "/shopping/awin-link",
    method: "GET",
    description: "Get shopping deals and affiliate links from various merchants",
    icon: ShoppingBag,
    parameters: [
      { name: "query", description: "Search term (optional)" },
      { name: "category", description: "Filter by category: Electronics, Fashion, Kitchen, Home, etc." },
      { name: "limit", description: "Number of results, 1-50, default 10" }
    ],
    exampleCall: "/shopping/awin-link?category=Electronics"
  },
  {
    path: "/cinema/search",
    method: "GET",
    description: "Search cinema listings, movie showtimes, and ticket deals",
    icon: Film,
    parameters: [
      { name: "query", description: "Movie title or genre (optional)" },
      { name: "location", description: "City or area (optional)" },
      { name: "limit", description: "Number of results, 1-50, default 10" }
    ],
    exampleCall: "/cinema/search?location=London"
  },
  {
    path: "/attractions/search",
    method: "GET",
    description: "Search local attractions, theme parks, museums, and days out",
    icon: MapPin,
    parameters: [
      { name: "query", description: "Attraction name or type (optional)" },
      { name: "category", description: "Theme Parks, Museums, Historical, Landmarks" },
      { name: "location", description: "City or area (optional)" },
      { name: "limit", description: "Number of results, 1-50, default 10" }
    ],
    exampleCall: "/attractions/search?category=Theme%20Parks"
  },
  {
    path: "/nightin/search",
    method: "GET",
    description: "Get ideas for nights in at home - movies, cooking, games, and more",
    icon: Home,
    parameters: [
      { name: "query", description: "Activity type or mood (optional)" },
      { name: "category", description: "Entertainment, Cooking, Games, Self-Care, Creative" },
      { name: "limit", description: "Number of results, 1-50, default 10" }
    ],
    exampleCall: "/nightin/search?category=Cooking"
  },
  {
    path: "/hintsandtips/search",
    method: "GET",
    description: "Get money-saving hints and tips for shopping, bills, travel, and more",
    icon: Lightbulb,
    parameters: [
      { name: "query", description: "Topic or keyword (optional)" },
      { name: "category", description: "Shopping, Entertainment, Days Out, Food, Bills, Travel" },
      { name: "limit", description: "Number of results, 1-50, default 10" }
    ],
    exampleCall: "/hintsandtips/search?category=Shopping"
  }
];

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [copied, setCopied] = useState(false);
  const Icon = endpoint.icon;
  const baseUrl = window.location.origin;
  const fullUrl = `${baseUrl}${endpoint.exampleCall}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card data-testid={`card-endpoint-${endpoint.path.replace(/\//g, '-')}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="p-2 rounded-md bg-muted">
            <Icon className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="font-mono text-xs">
                {endpoint.method}
              </Badge>
              <code className="text-sm font-mono" data-testid={`text-endpoint-path-${endpoint.path.replace(/\//g, '-')}`}>
                {endpoint.path}
              </code>
            </CardTitle>
          </div>
        </div>
        <CardDescription className="mt-2">
          {endpoint.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-2">Parameters</h4>
          <div className="space-y-2">
            {endpoint.parameters.map((param) => (
              <div key={param.name} className="flex gap-2 text-sm">
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                  {param.name}
                </code>
                <span className="text-muted-foreground">{param.description}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h4 className="text-sm font-medium mb-2">Example</h4>
          <div className="flex items-center gap-2 bg-muted rounded-md p-2">
            <code className="text-xs font-mono flex-1 overflow-x-auto" data-testid={`text-example-${endpoint.path.replace(/\//g, '-')}`}>
              {endpoint.exampleCall}
            </code>
            <Button
              size="icon"
              variant="ghost"
              onClick={copyToClipboard}
              data-testid={`button-copy-${endpoint.path.replace(/\//g, '-')}`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => window.open(fullUrl, '_blank')}
              data-testid={`button-open-${endpoint.path.replace(/\//g, '-')}`}
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <header className="text-center space-y-4 py-8">
          <h1 className="text-4xl font-bold tracking-tight" data-testid="text-title">
            GPT Deals & Tips API
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-description">
            API endpoints for ChatGPT custom GPT integration. Provides shopping deals, 
            cinema listings, attractions, night-in ideas, and money-saving tips.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" data-testid="badge-version">v1.0.0</Badge>
            <Badge variant="secondary" data-testid="badge-status">Ready for GPT Integration</Badge>
          </div>
        </header>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-2xl font-semibold">Available Endpoints</h2>
            <Button
              variant="outline"
              onClick={() => window.open('/api/docs', '_blank')}
              data-testid="button-view-json-docs"
            >
              View JSON Docs
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </div>
          
          <div className="grid gap-4">
            {endpoints.map((endpoint) => (
              <EndpointCard key={endpoint.path} endpoint={endpoint} />
            ))}
          </div>
        </section>

        <section className="bg-muted rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold">ChatGPT Integration</h2>
          <p className="text-muted-foreground">
            To use this API with your custom GPT, add the following OpenAPI schema 
            or configure actions pointing to these endpoints.
          </p>
          <div className="space-y-2">
            <p className="text-sm font-medium">Base URL:</p>
            <code className="block bg-background rounded-md p-3 text-sm font-mono" data-testid="text-base-url">
              {window.location.origin}
            </code>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Example Request:</p>
            <code className="block bg-background rounded-md p-3 text-sm font-mono overflow-x-auto" data-testid="text-example-request">
              curl "{window.location.origin}/shopping/awin-link?category=Electronics"
            </code>
          </div>
        </section>

        <footer className="text-center text-sm text-muted-foreground py-8" data-testid="text-footer">
          Built for ChatGPT Custom GPT Integration
        </footer>
      </div>
    </div>
  );
}
