import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MovieDetails, TmdbGenresResponse, TmdbResponse } from '../models/movie.model';

const REQUEST_TIMEOUT_MS = 10000;

@Injectable({ providedIn: 'root' })
export class TmdbService {
  private http = inject(HttpClient);
  private apiKey = environment.tmdbApiKey;
  private baseUrl = environment.tmdbBaseUrl;
  private language = environment.tmdbLanguage;

  searchMovies(query: string, page = 1): Observable<TmdbResponse> {
    const params = new HttpParams()
      .set('api_key', this.apiKey)
      .set('language', this.language)
      .set('query', query.trim())
      .set('page', String(page))
      .set('include_adult', 'false');
    return this.http
      .get<TmdbResponse>(`${this.baseUrl}/search/movie`, { params })
      .pipe(timeout(REQUEST_TIMEOUT_MS));
  }

  getDetails(id: number): Observable<MovieDetails> {
    const params = new HttpParams()
      .set('api_key', this.apiKey)
      .set('language', this.language);
    return this.http
      .get<MovieDetails>(`${this.baseUrl}/movie/${id}`, { params })
      .pipe(timeout(REQUEST_TIMEOUT_MS));
  }

  // Lista de géneros disponibles, para el selector del filtro.
  getGenres(): Observable<TmdbGenresResponse> {
    const params = new HttpParams()
      .set('api_key', this.apiKey)
      .set('language', this.language);
    return this.http
      .get<TmdbGenresResponse>(`${this.baseUrl}/genre/movie/list`, { params })
      .pipe(timeout(REQUEST_TIMEOUT_MS));
  }

  // Catálogo por filtros: género, duración, nota mínima y orden.
  // TMDB lo expone en /discover/movie, no en /movie/popular ni /search.
  // Fecha local de hoy en YYYY-MM-DD para el filtro de estrenos.
  private hoyISO(): string {
    const d = new Date();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  discover(options: {
    page: number;
    genreId?: number | null;
    runtimeMin?: number | null;
    runtimeMax?: number | null;
    notaMin?: number | null;
    sortBy?: string;
    region?: string | null;
  }): Observable<TmdbResponse> {
    let params = new HttpParams()
      .set('api_key', this.apiKey)
      .set('language', this.language)
      .set('page', String(options.page))
      .set('sort_by', options.sortBy ?? 'popularity.desc')
      .set('include_adult', 'false')
      // Solo estrenadas: la fecha primaria tiene que ser anterior o igual
      // a la de hoy; un catálogo no puede enseñar películas por estrenar.
      .set('release_date.lte', this.hoyISO());
    // Con región, TMDB aplica las fechas de estreno de ese país (y no la
    // fecha primaria mundial): verificado, region=ES filtra por estreno
    // en España aunque la fecha primaria sea futura.
    if (options.region) {
      params = params.set('region', options.region);
    }
    if (options.genreId) {
      params = params.set('with_genres', String(options.genreId));
    }
    if (options.runtimeMin) {
      params = params.set('with_runtime.gte', String(options.runtimeMin));
    }
    if (options.runtimeMax) {
      params = params.set('with_runtime.lte', String(options.runtimeMax));
    }
    if (options.notaMin) {
      params = params.set('vote_average.gte', String(options.notaMin));
    }
    return this.http
      .get<TmdbResponse>(`${this.baseUrl}/discover/movie`, { params })
      .pipe(timeout(REQUEST_TIMEOUT_MS));
  }

  // Punto único de entrada del catálogo: siempre va a /discover (nunca a
  // /movie/popular, que no admite el filtro de fecha de estreno), con
  // género, duración, nota u orden cuando los haya.
  loadCatalogo(
    page: number,
    genreId: number | null = null,
    duracion = 'any',
    notaMin: number | null = null,
    orderBy = 'popularity.desc',
    region = 'ES',
  ): Observable<TmdbResponse> {
    const [runtimeMin, runtimeMax] = this.rangoDuracion(duracion);
    return this.discover({
      page,
      genreId,
      runtimeMin,
      runtimeMax,
      notaMin,
      sortBy: orderBy,
      // '' = cualquier país: se filtra por la fecha primaria mundial.
      region: region || null,
    });
  }

  // Mayor nota real que existe con los filtros de catálogo (género y
  // duración), sepárate de la nota que el usuario haya puesto. Ordenado
  // por nota y exigiendo al menos 50 votos, para descartar esas pelis
  // de nicho con 10,0 y 3 votos que falsean el máximo.
  getNotaMax(genreId: number | null, duracion = 'any', region = 'ES'): Observable<TmdbResponse> {
    let params = new HttpParams()
      .set('api_key', this.apiKey)
      .set('language', this.language)
      .set('page', '1')
      .set('sort_by', 'vote_average.desc')
      .set('vote_count.gte', '50')
      .set('include_adult', 'false')
      .set('release_date.lte', this.hoyISO());
    if (region) {
      params = params.set('region', region);
    }
    if (genreId) {
      params = params.set('with_genres', String(genreId));
    }
    const [runtimeMin, runtimeMax] = this.rangoDuracion(duracion);
    if (runtimeMin) {
      params = params.set('with_runtime.gte', String(runtimeMin));
    }
    if (runtimeMax) {
      params = params.set('with_runtime.lte', String(runtimeMax));
    }
    return this.http
      .get<TmdbResponse>(`${this.baseUrl}/discover/movie`, { params })
      .pipe(timeout(REQUEST_TIMEOUT_MS));
  }

  // Traduce el valor del <select> a rango de minutos para /discover.
  private rangoDuracion(duracion: string): [number | null, number | null] {
    switch (duracion) {
      case '<90':
        return [1, 89];
      case '90-150':
        return [90, 150];
      case '>150':
        return [151, null];
      default:
        return [null, null];
    }
  }
}
