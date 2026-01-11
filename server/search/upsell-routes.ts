import { Express } from 'express';
import { seedDefaultMappings, getUpsellProducts, trackUpsellClick } from '../services/upsell';
import { getMoviesByType, getPosterUrl, getBackdropUrl, getGenreNames } from '../services/tmdb';

export function registerUpsellRoutes(app: Express): void {
  app.post('/api/upsells/seed', async (req, res) => {
    try {
      const count = await seedDefaultMappings();
      res.json({ success: true, seeded: count });
    } catch (error: any) {
      console.error('[Upsell] Seed error:', error);
      res.status(500).json({ error: 'Failed to seed mappings', details: error.message });
    }
  });

  app.post('/api/upsells/get', async (req, res) => {
    try {
      const { contentId, contentType, genreIds, title, category, limit = 2 } = req.body;
      
      if (!contentId || !contentType) {
        return res.status(400).json({ error: 'contentId and contentType are required' });
      }
      
      const products = await getUpsellProducts({
        contentId: String(contentId),
        contentType,
        genreIds,
        title,
        category,
      }, Math.min(limit, 5));
      
      res.json({ 
        products, 
        count: products.length,
        contentId,
        contentType,
      });
    } catch (error: any) {
      console.error('[Upsell] Get error:', error);
      res.status(500).json({ error: 'Failed to get upsell products', details: error.message });
    }
  });

  app.post('/api/upsells/click', async (req, res) => {
    try {
      const { contentId, contentType, productId, intentCategory, sessionId } = req.body;
      
      if (!contentId || !contentType || !productId) {
        return res.status(400).json({ error: 'contentId, contentType, and productId are required' });
      }
      
      await trackUpsellClick(contentId, contentType, productId, intentCategory, sessionId);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Upsell] Click tracking error:', error);
      res.status(500).json({ error: 'Failed to track click', details: error.message });
    }
  });

  // Mixed Results API - 6 content tiles + 2 upsell tiles
  app.post('/api/mixed/movies', async (req, res) => {
    try {
      const { contentType = 'cinema', limit = 6 } = req.body;
      const contentLimit = Math.min(limit, 10);
      
      const dbMovies = await getMoviesByType(contentType, contentLimit);
      
      const contentItems = dbMovies.map(m => ({
        type: 'movie' as const,
        id: m.id,
        title: m.title,
        overview: m.overview,
        poster: getPosterUrl(m.posterPath, 'w342'),
        backdrop: getBackdropUrl(m.backdropPath),
        releaseDate: m.releaseDate,
        rating: m.voteAverage,
        genres: m.genreIds ? getGenreNames(m.genreIds) : [],
        certification: m.ukCertification,
        contentType: m.contentType,
      }));
      
      let upsellProducts: any[] = [];
      if (contentItems.length > 0) {
        const firstMovie = dbMovies[0];
        upsellProducts = await getUpsellProducts({
          contentId: String(firstMovie.id),
          contentType: 'movie',
          genreIds: firstMovie.genreIds || undefined,
          title: firstMovie.title,
        }, 2);
      }
      
      const upsellItems = upsellProducts.map(p => ({
        type: 'upsell' as const,
        id: p.id,
        name: p.name,
        price: p.price,
        imageUrl: p.imageUrl,
        affiliateLink: p.affiliateLink,
        merchant: p.merchant,
        upsellReason: p.upsellReason,
      }));
      
      res.json({
        content: contentItems,
        upsells: upsellItems,
        totalItems: contentItems.length + upsellItems.length,
        attribution: 'This product uses the TMDB API but is not endorsed or certified by TMDB.',
      });
    } catch (error: any) {
      console.error('[Mixed] Movies error:', error);
      res.status(500).json({ error: 'Failed to fetch mixed results', details: error.message });
    }
  });
}
