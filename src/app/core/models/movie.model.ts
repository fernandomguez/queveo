export interface Movie {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  overview: string;
  release_date: string;
  vote_average: number;
  vote_count?: number;
  // Llegan en search/movie y discover: el primero permite filtrar por
  // género en cliente cuando la búsqueda activa (el endpoint /search de
  // TMDB no admite with_genres) y el segundo ordenar por popularidad.
  genre_ids?: number[];
  popularity?: number;
}

export interface Genre {
  id: number;
  name: string;
}

export interface MovieDetails extends Movie {
  tagline: string;
  runtime: number | null;
  genres: Genre[];
  popularity: number;
  original_language: string;
  status: string;
}

export interface TmdbResponse {
  page: number;
  results: Movie[];
  total_pages: number;
  total_results: number;
}

export interface TmdbGenresResponse {
  genres: Genre[];
}

export const EMPTY_TMDB_RESPONSE: TmdbResponse = {
  page: 0,
  results: [],
  total_pages: 0,
  total_results: 0,
};
