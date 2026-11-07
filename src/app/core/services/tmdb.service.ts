import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { hoyISO } from '../../shared/utils/fechas';
import { MovieDetails, TmdbGenresResponse, TmdbResponse } from '../models/movie.model';
import { rangoDuracion } from '../models/opciones-filtros';

const TIEMPO_MAXIMO_MS = 10000;

@Injectable({ providedIn: 'root' })
export class TmdbService {
  private readonly http = inject(HttpClient);

  buscarPeliculas(texto: string, pagina = 1): Observable<TmdbResponse> {
    const params = this.paramsBase()
      .set('query', texto.trim())
      .set('page', String(pagina))
      .set('include_adult', 'false');
    return this.pedir<TmdbResponse>('/search/movie', params);
  }

  obtenerDetalle(id: number): Observable<MovieDetails> {
    return this.pedir<MovieDetails>(`/movie/${id}`, this.paramsBase());
  }

  obtenerGeneros(): Observable<TmdbGenresResponse> {
    return this.pedir<TmdbGenresResponse>('/genre/movie/list', this.paramsBase());
  }

  // Catálogo por filtros. Siempre va a /discover (y no a /movie/popular)
  // porque solo /discover admite el filtro de fecha de estreno.
  cargarCatalogo(
    pagina: number,
    generoId: number | null,
    duracion: string,
    notaMinima: number | null,
    orden: string,
  ): Observable<TmdbResponse> {
    let params = this.paramsDescubrir(generoId, duracion)
      .set('page', String(pagina))
      .set('sort_by', orden);
    if (notaMinima) {
      params = params.set('vote_average.gte', String(notaMinima));
    }
    return this.pedir<TmdbResponse>('/discover/movie', params);
  }

  // La película con mayor nota que existe con los filtros de género
  // y duración. Se exigen al menos 50 votos para descartar las
  // de nicho con un 10,0 y solo 3 votos.
  obtenerNotaMax(generoId: number | null, duracion: string): Observable<TmdbResponse> {
    const params = this.paramsDescubrir(generoId, duracion)
      .set('page', '1')
      .set('sort_by', 'vote_average.desc')
      .set('vote_count.gte', '50');
    return this.pedir<TmdbResponse>('/discover/movie', params);
  }

  // Parámetros que lleva cualquier petición: clave de la API e idioma.
  private paramsBase(): HttpParams {
    return new HttpParams()
      .set('api_key', environment.tmdbApiKey)
      .set('language', environment.tmdbLanguage);
  }

  // Parámetros comunes de /discover: solo estrenadas, sin adultos y con
  // género y duración cuando los haya. La región es siempre la del entorno.
  private paramsDescubrir(generoId: number | null, duracion: string): HttpParams {
    let params = this.paramsBase()
      .set('include_adult', 'false')
      .set('release_date.lte', hoyISO())
      // TMDB usa las fechas de estreno de ese país en lugar de la fecha
      // primaria mundial.
      .set('region', environment.tmdbRegion);
    if (generoId) params = params.set('with_genres', String(generoId));

    const [minimo, maximo] = rangoDuracion(duracion);
    if (minimo) params = params.set('with_runtime.gte', String(minimo));
    if (maximo) params = params.set('with_runtime.lte', String(maximo));
    return params;
  }

  private pedir<T>(ruta: string, params: HttpParams): Observable<T> {
    return this.http
      .get<T>(`${environment.tmdbBaseUrl}${ruta}`, { params })
      .pipe(timeout(TIEMPO_MAXIMO_MS));
  }
}
