export interface Movie {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  overview: string;
  release_date: string;
  vote_average: number;
  vote_count?: number;
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
