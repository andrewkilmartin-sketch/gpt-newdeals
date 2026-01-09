import { db } from "../db";
import { movies, type InsertMovie } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

function getTMDBApiKey(): string | undefined {
  return process.env.TMDB_API_KEY;
}

interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  adult: boolean;
  original_language: string;
}

interface TMDBResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

interface TMDBCertification {
  iso_3166_1: string;
  release_dates: {
    certification: string;
    type: number;
  }[];
}

export const TMDB_GENRES: Record<number, string> = {
  28: "Action",
  12: "Adventure", 
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

export function getGenreNames(genreIds: number[]): string[] {
  return genreIds.map(id => TMDB_GENRES[id]).filter(Boolean);
}

export function getPosterUrl(path: string | null, size: "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "original" = "w342"): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function getBackdropUrl(path: string | null, size: "w300" | "w780" | "w1280" | "original" = "w780"): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

async function fetchTMDB<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = getTMDBApiKey();
  if (!apiKey) {
    throw new Error("TMDB_API_KEY not configured");
  }
  
  const queryParams = new URLSearchParams({
    api_key: apiKey,
    ...params,
  });
  
  const url = `${TMDB_BASE_URL}${endpoint}?${queryParams}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

async function getUKCertification(movieId: number): Promise<string | null> {
  try {
    const data = await fetchTMDB<{ results: TMDBCertification[] }>(
      `/movie/${movieId}/release_dates`
    );
    
    const uk = data.results.find(r => r.iso_3166_1 === "GB");
    if (uk && uk.release_dates.length > 0) {
      const theatrical = uk.release_dates.find(r => r.type === 3) || uk.release_dates[0];
      return theatrical.certification || null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchNowPlaying(): Promise<TMDBMovie[]> {
  const data = await fetchTMDB<TMDBResponse>("/movie/now_playing", { region: "GB" });
  return data.results;
}

export async function fetchUpcoming(): Promise<TMDBMovie[]> {
  const data = await fetchTMDB<TMDBResponse>("/movie/upcoming", { region: "GB" });
  return data.results;
}

export async function fetchPopular(): Promise<TMDBMovie[]> {
  const data = await fetchTMDB<TMDBResponse>("/movie/popular", { region: "GB" });
  return data.results;
}

export async function fetchTopRated(): Promise<TMDBMovie[]> {
  const data = await fetchTMDB<TMDBResponse>("/movie/top_rated", { region: "GB" });
  return data.results;
}

async function upsertMovie(movie: TMDBMovie, contentType: string): Promise<void> {
  const certification = await getUKCertification(movie.id);
  
  const movieData: InsertMovie = {
    id: movie.id,
    title: movie.title,
    overview: movie.overview,
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path,
    releaseDate: movie.release_date,
    voteAverage: movie.vote_average,
    voteCount: movie.vote_count,
    popularity: movie.popularity,
    genreIds: movie.genre_ids,
    adult: movie.adult,
    originalLanguage: movie.original_language,
    status: contentType === "coming_soon" ? "Upcoming" : "Released",
    contentType,
    ukCertification: certification,
  };
  
  await db.insert(movies)
    .values(movieData)
    .onConflictDoUpdate({
      target: movies.id,
      set: {
        ...movieData,
        lastUpdated: sql`now()`,
      },
    });
}

export async function syncMovies(): Promise<{ nowPlaying: number; upcoming: number }> {
  console.log("[TMDB] Starting movie sync...");
  
  const [nowPlayingMovies, upcomingMovies] = await Promise.all([
    fetchNowPlaying(),
    fetchUpcoming(),
  ]);
  
  console.log(`[TMDB] Fetched ${nowPlayingMovies.length} now playing, ${upcomingMovies.length} upcoming`);
  
  for (const movie of nowPlayingMovies) {
    await upsertMovie(movie, "cinema");
  }
  
  for (const movie of upcomingMovies) {
    await upsertMovie(movie, "coming_soon");
  }
  
  console.log("[TMDB] Movie sync complete");
  
  return {
    nowPlaying: nowPlayingMovies.length,
    upcoming: upcomingMovies.length,
  };
}

export async function getMoviesByType(contentType: "cinema" | "coming_soon" | "streaming", limit = 20) {
  return db.select()
    .from(movies)
    .where(eq(movies.contentType, contentType))
    .orderBy(sql`popularity DESC`)
    .limit(limit);
}

export async function searchMovies(query: string, limit = 10) {
  const lowerQuery = query.toLowerCase();
  return db.select()
    .from(movies)
    .where(sql`LOWER(${movies.title}) LIKE ${'%' + lowerQuery + '%'}`)
    .orderBy(sql`popularity DESC`)
    .limit(limit);
}
