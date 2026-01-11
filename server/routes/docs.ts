import { Express } from 'express';

export function registerDocsRoutes(app: Express): void {
  app.get("/api/openapi", async (req, res) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const schemaPath = path.join(process.cwd(), 'openapi.yaml');
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      res.type('text/yaml').send(schema);
    } catch (error) {
      res.status(500).json({ error: "Failed to load OpenAPI schema" });
    }
  });

  app.get("/api/docs", (req, res) => {
    res.json({
      name: "GPT Deals & Tips API",
      version: "1.2.0",
      description: "API endpoints for ChatGPT custom GPT integration providing shopping deals, cinema listings, UK attractions, family activities, night-in ideas, and money-saving tips",
      endpoints: [
        {
          path: "/shopping/awin-link",
          method: "GET",
          description: "Get shopping deals and affiliate links",
          parameters: {
            query: "Search term (optional)",
            category: "Filter by category: Electronics, Fashion, Kitchen, Home, etc. (optional)",
            limit: "Number of results, 1-50, default 10 (optional)"
          }
        },
        {
          path: "/cinema/search",
          method: "GET",
          description: "Search cinema listings and movie deals",
          parameters: {
            query: "Movie title or genre (optional)",
            location: "City or area (optional)",
            limit: "Number of results, 1-50, default 10 (optional)"
          }
        },
        {
          path: "/attractions/search",
          method: "GET",
          description: "Search UK attractions and days out (305 real UK attractions from daysout.co.uk)",
          parameters: {
            query: "Attraction name or type (optional)",
            category: "Filter by category: Theme Parks, Museums, Historical, Landmarks, Zoos, Entertainment (optional)",
            location: "City or area (optional)",
            limit: "Number of results, 1-50, default 10 (optional)"
          }
        },
        {
          path: "/activities/search",
          method: "GET",
          description: "Family activities from the Sunny Playbook - 40+ activities with rich filtering",
          parameters: {
            query: "Activity name or keyword (optional)",
            category: "Filter by topic: Car, Rainy Day, Keep Busy, Chores, Bedtime, Morning, Homework, Big Feelings, Craft, Building, LEGO (optional)",
            age: "Child's age number e.g. 5, 8, 12 (optional)",
            energy: "Energy level: LOW, MED, HIGH (optional)",
            setting: "Setting: INDOOR, OUTDOOR, CAR (optional)",
            limit: "Number of results, 1-50, default 10 (optional)"
          }
        },
        {
          path: "/nightin/search",
          method: "GET",
          description: "Get movies to watch at home with UK streaming availability",
          parameters: {
            query: "Movie title, actor, or director search (optional)",
            category: "Filter by genre: Action, Comedy, Drama, Horror, Sci-Fi, Animation, Romance, Thriller, etc. (optional)",
            service: "Filter by streaming service: Netflix, Prime Video, Disney+, Apple TV+, Sky, NOW, MUBI (optional)",
            mood: "Filter by mood: Fun, Romantic, Intense, Scary, Heartwarming, Epic, Dark, etc. (optional)",
            limit: "Number of results, 1-50, default 10 (optional)"
          }
        },
        {
          path: "/hintsandtips/search",
          method: "GET",
          description: "Get money-saving hints and tips plus family activity ideas",
          parameters: {
            query: "Topic or keyword (optional)",
            category: "Filter by category: Shopping, Entertainment, Days Out, Food, Bills, Travel, Car Games, Calm Down, Chores, etc. (optional)",
            limit: "Number of results, 1-50, default 10 (optional)"
          }
        },
        {
          path: "/sunny/chat",
          method: "POST",
          description: "Sunny AI Chat Concierge - conversational family entertainment assistant",
          parameters: {
            message: "User message to Sunny (required)",
            sessionId: "Session ID for conversation continuity (optional)",
            location: "User's location for local recommendations (optional)"
          }
        },
        {
          path: "/sunny/health",
          method: "GET",
          description: "Sunny AI health check - verify service is running"
        },
        {
          path: "/sunny/history",
          method: "GET",
          description: "Conversation logs - retrieve saved chats from database for verification",
          parameters: {
            sessionId: "Filter by specific session ID (optional)",
            limit: "Number of results, 1-100, default 50 (optional)",
            full: "Set to 'true' to see full responses instead of truncated (optional)"
          }
        },
        {
          path: "/sunny/diagnostics",
          method: "GET",
          description: "Sunny diagnostics - verify data sources and configuration"
        }
      ],
      exampleCalls: [
        "GET /shopping/awin-link?category=Electronics",
        "GET /cinema/search?location=London",
        "GET /attractions/search?category=Theme Parks&location=London",
        "GET /activities/search?age=6&energy=HIGH&setting=INDOOR",
        "GET /activities/search?category=CAR&limit=5",
        "GET /nightin/search?category=Cooking",
        "GET /hintsandtips/search?category=Shopping",
        "POST /sunny/chat with {message: 'zoos near London'}",
        "GET /sunny/history?full=true",
        "GET /sunny/history?sessionId=abc123"
      ]
    });
  });
}
