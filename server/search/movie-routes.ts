import { Express } from 'express';
import { 
  syncMovies, 
  getMoviesByType, 
  searchMovies, 
  getPosterUrl, 
  getBackdropUrl, 
  getGenreNames,
  TMDB_GENRES 
} from '../services/tmdb';

export function registerMovieRoutes(app: Express): void {
  app.post('/api/movies/sync', async (req, res) => {
    try {
      console.log('[TMDB] Manual sync triggered');
      const result = await syncMovies();
      res.json({ 
        success: true, 
        message: 'Movies synced successfully',
        ...result 
      });
    } catch (error: any) {
      console.error('[TMDB] Sync error:', error);
      res.status(500).json({ error: 'Movie sync failed', details: error.message });
    }
  });

  app.get('/api/movies/cinema', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const dbMovies = await getMoviesByType('cinema', limit);
      
      const movies = dbMovies.map(m => ({
        id: m.id,
        title: m.title,
        overview: m.overview,
        poster: getPosterUrl(m.posterPath, 'w342'),
        backdrop: getBackdropUrl(m.backdropPath),
        releaseDate: m.releaseDate,
        rating: m.voteAverage,
        genres: m.genreIds ? getGenreNames(m.genreIds) : [],
        certification: m.ukCertification,
        runtime: m.runtime,
      }));
      
      res.json({ 
        movies, 
        count: movies.length,
        attribution: 'This product uses the TMDB API but is not endorsed or certified by TMDB.'
      });
    } catch (error: any) {
      console.error('[TMDB] Cinema fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch cinema movies', details: error.message });
    }
  });

  app.get('/api/movies/coming-soon', async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const dbMovies = await getMoviesByType('coming_soon', limit);
      
      const movies = dbMovies.map(m => ({
        id: m.id,
        title: m.title,
        overview: m.overview,
        poster: getPosterUrl(m.posterPath, 'w342'),
        backdrop: getBackdropUrl(m.backdropPath),
        releaseDate: m.releaseDate,
        rating: m.voteAverage,
        genres: m.genreIds ? getGenreNames(m.genreIds) : [],
        certification: m.ukCertification,
      }));
      
      res.json({ 
        movies, 
        count: movies.length,
        attribution: 'This product uses the TMDB API but is not endorsed or certified by TMDB.'
      });
    } catch (error: any) {
      console.error('[TMDB] Coming soon fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch upcoming movies', details: error.message });
    }
  });

  app.get('/api/movies/search', async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
      }
      
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const dbMovies = await searchMovies(query, limit);
      
      const movies = dbMovies.map(m => ({
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
      
      res.json({ 
        query,
        movies, 
        count: movies.length,
        attribution: 'This product uses the TMDB API but is not endorsed or certified by TMDB.'
      });
    } catch (error: any) {
      console.error('[TMDB] Search error:', error);
      res.status(500).json({ error: 'Movie search failed', details: error.message });
    }
  });

  app.get('/api/movies/genres', (req, res) => {
    res.json({ genres: TMDB_GENRES });
  });
}
