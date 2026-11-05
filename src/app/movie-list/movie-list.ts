import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { TmdbService } from '../core/services/tmdb.service';
import {
  Genre,
  Movie,
  MovieDetails,
  TmdbResponse,
} from '../core/models/movie.model';
import { environment } from '../../environments/environment';

interface Duracion {
  valor: string;
  etiqueta: string;
}

@Component({
  imports: [FormsModule],
  selector: 'app-movie-list',
  styleUrl: './movie-list.css',
  templateUrl: './movie-list.html',
})
export class MovieList implements OnInit, OnDestroy {
  estadoEspanol: Record<string, string> = {
    'Rumored': 'Rumoreada',
    'Planned': 'Planificada',
    'In Production': 'En producción',
    'Post Production': 'En postproducción',
    'Released': 'Estrenada',
    'Canceled': 'Cancelada',
  };

  // Chips del filtro de valoración; los que superen la nota máxima
  // disponible salen deshabilitados.
  notasChips = [5, 6, 7, 8, 9];

  hayDuraciones: Duracion[] = [
    { valor: 'any', etiqueta: 'Cualquier duración' },
    { valor: '<90', etiqueta: 'Menos de 90 min' },
    { valor: '90-150', etiqueta: '90 – 150 min' },
    { valor: '>150', etiqueta: 'Más de 150 min' },
  ];

  hayOrdenes: Duracion[] = [
    { valor: 'popularity.desc', etiqueta: 'Más populares' },
    { valor: 'release_date.desc', etiqueta: 'Estreno más reciente' },
    { valor: 'release_date.asc', etiqueta: 'Estreno más antiguo' },
  ];

  // Estado en signals: sin Zone.js en el proyecto, la detección de cambios
  // solo visita la plantilla si el valor de un signal cambia.
  movies = signal<Movie[]>([]);
  activeQuery = signal('');
  isLoading = signal(false);
  searchError = signal('');
  selected = signal<MovieDetails | null>(null);
  selectedId = signal<number | null>(null);
  detailLoading = signal(false);
  detailError = signal('');
  // Paginado incremental: página actual cargada, total que devuelve la API
  // y bandera para el botón «Más resultados».
  currentPage = signal(0);
  totalPages = signal(1);
  totalResults = signal(0);
  loadingMore = signal(false);
  // Filtros: lista de géneros y valores elegidos.
  genres = signal<Genre[]>([]);
  genreId = signal<number | null>(null);
  duracion = signal<string>('any');
  // Nota mínima en número (null = «cualquier nota»). El slider va de
  // 1 a notaMax, que TMDB actualiza según lo que existe de verdad.
  notaMin = signal<number | null>(null);
  notaMax = signal<number>(10);
  notasDisponibles = signal<boolean>(true);
  orden = signal<string>('popularity.desc');
  // País cuyas fechas de estreno mandan: ES/US o '' (fecha primaria
  // mundial). TMDB lo resuelve en el servidor con el parámetro region.
  region = signal<string>('ES');

  hayRegiones: Duracion[] = [
    { valor: 'ES', etiqueta: 'Estrenos España' },
    { valor: 'US', etiqueta: 'Estrenos en EE. UU.' },
    { valor: '', etiqueta: 'Cualquier país' },
  ];

  searchText = '';
  // Los <select> trabajan con cadenas; guardamos lo original
  // para comparar y recargar solo si de verdad cambia.
  private generoOriginal = '';
  private duracionOriginal = 'any';
  private ordenOriginal = 'popularity.desc';
  private regionOriginal = 'ES';
  // Paso y mínimo del slider de valoración; a 1 significa «cualquier nota».
  private readonly NOTA_MIN = 1;

  private tmdbService = inject(TmdbService);
  private searchSub: Subscription | null = null;
  private detailSub: Subscription | null = null;
  private genresSub: Subscription | null = null;
  private notaMaxSub: Subscription | null = null;
  private lastOpener: HTMLElement | null = null;

  ngOnInit(): void {
    this.load();
    this.probarNotaMax();
    this.genresSub = this.tmdbService.getGenres().subscribe({
      next: (res) => this.genres.set(res.genres ?? []),
      // Sin géneros el filtro se deshabilita y el resto sigue funcionando.
      error: () => this.genres.set([]),
    });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
    this.detailSub?.unsubscribe();
    this.genresSub?.unsubscribe();
    this.notaMaxSub?.unsubscribe();
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    if (this.selected()) this.closeDetail();
  }

  load(page = 1): void {
    this.searchSub?.unsubscribe();
    this.startListRequest(page);
    this.activeQuery.set('');
    this.searchSub = this.tmdbService
      .loadCatalogo(page, this.genreId(), this.duracion(), this.notaMin(), this.orden(), this.region())
      .subscribe({
        next: (res) => this.onPageLoaded(res, page),
        error: () =>
          this.onListError('No se pudo cargar el catálogo. Revisa tu conexión.', page),
      });
  }

  /** ¿Hay algún filtro activo? Decide si el listado va por /discover. */
  hasFilters(): boolean {
    return (
      this.genreId() !== null ||
      this.duracion() !== 'any' ||
      this.notaMin() !== null ||
      this.orden() !== 'popularity.desc'
    );
  }

  // Cambio de género: limpia la búsqueda (un título concreto manda sobre
  // los filtros) y recarga página 1 con el valor nuevo.
  setGenero(value: string): void {
    if (this.generoOriginal === value) return;
    this.generoOriginal = value;
    const n = Number(value);
    this.genreId.set(Number.isFinite(n) && n > 0 ? n : null);
    this.searchText = '';
    this.load();
    this.probarNotaMax();
  }

  setDuracion(value: string): void {
    if (this.duracionOriginal === value) return;
    this.duracionOriginal = value;
    this.duracion.set(value);
    this.searchText = '';
    this.load();
    this.probarNotaMax();
  }

  // Valoración mínima por botones: null = cualquier nota. Si alguien
  // pide una nota mayor que la máxima disponible con estos filtros, no
  // cambia nada (el chip está deshabilitado y el código también lo ignora).
  setNota(valor: number | null): void {
    if (valor !== null && valor > this.notaMax()) return;
    if ((this.notaMin() ?? null) === valor) return;
    this.notaMin.set(valor);
    this.searchText = '';
    this.load();
  }

  // Pregunta a TMDB la mayor nota real con los filtros actuales y ajusta
  // el tope del slider a ese valor. Si no hay películas, el slider se
  // queda deshabilitado y la nota a «cualquier nota».
  probarNotaMax(): void {
    this.notaMaxSub?.unsubscribe();
    this.notaMaxSub = this.tmdbService
      .getNotaMax(this.genreId(), this.duracion(), this.region())
      .subscribe({
        next: (res) => {
          const primera = (res.results ?? [])[0]?.vote_average ?? null;
          if (primera === null || primera <= this.NOTA_MIN) {
            this.notasDisponibles.set(false);
            this.notaMax.set(this.NOTA_MIN);
            if (this.notaMin()) {
              this.notaMin.set(null);
              this.load();
            }
            return;
          }
          // Baja al paso del slider (0,5) para que no se quede entre dos.
          const tope = Math.floor(primera * 2) / 2;
          this.notasDisponibles.set(true);
          this.notaMax.set(Math.max(tope, this.NOTA_MIN));
          if ((this.notaMin() ?? 0) > tope) {
            this.notaMin.set(null);
            this.load();
          }
        },
        // Sin respuesta, el slider queda como estaba y nadie rompe nada.
        error: () => this.notasDisponibles.set(this.notaMax() > this.NOTA_MIN),
      });
  }

  setOrden(value: string): void {
    if (this.ordenOriginal === value) return;
    this.ordenOriginal = value;
    this.orden.set(value);
    this.searchText = '';
    this.load();
  }

  // Cambiar de país: cambia qué fechas de estreno cuentan, así que
  // recarga y el sondeo de nota máxima vuelve a preguntar.
  setRegion(value: string): void {
    if (this.regionOriginal === value) return;
    this.regionOriginal = value;
    this.region.set(value);
    this.searchText = '';
    this.load();
    this.probarNotaMax();
  }

  // Vuelta al catálogo completo: sin ningún filtro y con la región por
  // defecto (España).
  clearFilters(): void {
    this.generoOriginal = '';
    this.duracionOriginal = 'any';
    this.ordenOriginal = 'popularity.desc';
    this.regionOriginal = 'ES';
    this.genreId.set(null);
    this.duracion.set('any');
    this.notaMin.set(null);
    this.orden.set('popularity.desc');
    this.region.set('ES');
    this.searchText = '';
    this.load();
    this.probarNotaMax();
  }

  // La búsqueda manda: si hay texto, ignora los filtros (TMDB no busca
  // y descubre a la vez) y lo dice así en la barra de estado.
  searchNow(): void {
    const q = this.searchText.trim();
    this.activeQuery.set(q);
    this.searchError.set('');

    if (!q) {
      this.load();
      return;
    }
    if (q.length < 2) {
      this.searchError.set('Escribe al menos 2 letras para buscar.');
      this.isLoading.set(false);
      return;
    }

    this.searchSub?.unsubscribe();
    this.startListRequest(1);
    this.searchSub = this.tmdbService.searchMovies(q).subscribe({
      next: (res) => this.onPageLoaded(res, 1),
      error: () =>
        this.onListError(`No se pudo buscar "${q}". Inténtalo de nuevo.`, 1),
    });
  }

  // Carga la página siguiente del listado abierto y añade las películas
  // al final, sin perder las ya mostradas.
  loadMore(): void {
    if (this.loadingMore() || this.currentPage() >= this.totalPages()) return;
    const siguiente = this.currentPage() + 1;

    this.searchSub?.unsubscribe();
    this.startListRequest(siguiente);
    const q = this.activeQuery();
    if (q) {
      this.searchSub = this.tmdbService.searchMovies(q, siguiente).subscribe({
        next: (res) => this.onPageLoaded(res, siguiente),
        error: () => this.onLoadMoreError(),
      });
    } else {
      this.searchSub = this.tmdbService
        .loadCatalogo(siguiente, this.genreId(), this.duracion(), this.notaMin(), this.orden(), this.region())
        .subscribe({
          next: (res) => this.onPageLoaded(res, siguiente),
          error: () => this.onLoadMoreError(),
        });
    }
  }

  clearSearch(): void {
    this.searchText = '';
    this.load();
  }

  // Número en español: coma y sin decimales cuando quedan enteros.
  private formatNotaParaEs(n: number): string {
    return Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1).replace('.', ',');
  }

  // El extremo derecho del sondeo, también con coma española (solo se usa
  // en los mensajes de estado del grupo de chips).
  notaMaxEtiqueta(): string {
    return this.formatNotaParaEs(this.notaMax());
  }

  // Traduce el estado del estreno que TMDB manda en inglés.
  estadoEs(estado: string | null | undefined): string {
    if (!estado) return '—';
    return this.estadoEspanol[estado] ?? estado;
  }

  startListRequest(page: number): void {
    this.isLoading.set(page === 1);
    this.loadingMore.set(page > 1);
    this.searchError.set('');
  }

  onPageLoaded(res: TmdbResponse, page: number): void {
    // La búsqueda de TMDB no admite filtro de fecha en el servidor: aquí
    // sacamos de la página lo que aún no está estrenado (los resultados
    // de /discover ya llegan filtrados con release_date.lte).
    const nuevas = this.yaEstrenadas(res.results ?? []);
    this.movies.set(page === 1 ? nuevas : [...this.movies(), ...nuevas]);
    this.currentPage.set(res.page ?? page);
    this.totalPages.set(res.total_pages ?? this.totalPages());
    this.totalResults.set(res.total_results ?? this.totalResults());
    this.isLoading.set(false);
    this.loadingMore.set(false);
  }

  onListError(mensaje: string, page: number): void {
    if (page === 1) this.movies.set([]);
    this.searchError.set(mensaje);
    this.isLoading.set(false);
    this.loadingMore.set(false);
  }

  private onLoadMoreError(): void {
    this.searchError.set(
      'No se pudieron cargar más resultados. Inténtalo de nuevo.',
    );
    this.loadingMore.set(false);
  }

  // Fecha local de hoy en YYYY-MM-DD, para comparar fechas de estreno.
  private hoyISO(): string {
    const d = new Date();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  // Solo películas con fecha de estreno conocida y ya pasada. Una sin
  // fecha se entiende «por estreñar o sin fecha oficial»: fuera.
  private yaEstrenadas(peliculas: Movie[]): Movie[] {
    const hoy = this.hoyISO();
    return peliculas.filter(
      (p) => !!p.release_date && p.release_date <= hoy,
    );
  }

  selectMovie(movie: Movie, opener?: HTMLElement): void {
    this.detailSub?.unsubscribe();
    this.lastOpener = opener ?? (document.activeElement as HTMLElement | null);
    this.selectedId.set(movie.id);
    this.detailError.set('');
    // Apertura instantánea con datos básicos; el detalle completa idioma,
    // popularidad, estado, géneros y duración.
    this.selected.set({
      ...movie,
      tagline: '',
      runtime: null,
      genres: [],
      popularity: 0,
      original_language: '',
      status: '',
    });
    this.detailLoading.set(true);

    this.detailSub = this.tmdbService.getDetails(movie.id).subscribe({
      next: (d) => {
        if (this.selectedId() !== movie.id) return;
        this.selected.set(d);
        this.detailLoading.set(false);
        this.focusDetailTitle();
      },
      error: () => {
        if (this.selectedId() !== movie.id) return;
        this.detailLoading.set(false);
        this.detailError.set(
          'No se pudo cargar el detalle completo. Mostrando datos básicos.',
        );
        this.focusDetailTitle();
      },
    });
  }

  closeDetail(returnFocus = true): void {
    this.detailSub?.unsubscribe();
    this.selected.set(null);
    this.selectedId.set(null);
    this.detailLoading.set(false);
    this.detailError.set('');
    if (returnFocus) this.lastOpener?.focus?.();
  }

  getPosterUrl(path: string | null | undefined, size = 'w500'): string {
    if (!path) return '';
    return `${environment.tmdbImageBaseUrl}/${size}${path}`;
  }

  getYear(date: string | null | undefined): string {
    if (!date || date.length < 4) return '—';
    return date.slice(0, 4);
  }

  formatVote(v: number | null | undefined): string {
    if (typeof v !== 'number' || Number.isNaN(v)) return '—';
    return v.toFixed(1);
  }

  ratingClass(v: number | null | undefined): string {
    if (typeof v !== 'number' || Number.isNaN(v)) return 'low';
    if (v >= 7) return 'good';
    if (v >= 5) return 'mid';
    return 'low';
  }

  private focusDetailTitle(): void {
    // Espera al render del panel antes de mover el foco (accesibilidad).
    setTimeout(() => {
      document.getElementById('detail-title')?.focus?.();
    }, 0);
  }
}
