import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MovieList } from './movie-list';

describe('MovieList', () => {
  let component: MovieList;
  let fixture: ComponentFixture<MovieList>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MovieList],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MovieList);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    // Lanza la primera detección de cambios para que corra ngOnInit
    // y queden registradas sus peticiones HTTP.
    fixture.detectChanges();
  });

  it('should create', async () => {
    await fixture.whenStable();
    expect(component).toBeTruthy();
  });

  it('should load popular and genres on init', async () => {
    http.expectOne((req) => req.url.includes('/discover/movie') && !!req.params.get('release_date.lte') && req.params.get('sort_by') === 'popularity.desc').flush({
      page: 1, results: [{ id: 1, title: 'A', poster_path: null, overview: '', release_date: '2020-01-01', vote_average: 5, vote_count: 10 }], total_pages: 2, total_results: 40,
    });
    http.expectOne((req) => req.url.includes('/genre/movie/list')).flush({
      genres: [{ id: 28, name: 'Acción' }],
    });
    expect(component.movies().length).toBe(1);
    expect(component.genres().length).toBe(1);
  });

  it('should reject short queries without calling the API', async () => {
    await fixture.whenStable();
    component.searchText = 'a';
    component.searchNow();
    expect(component.searchError()).toContain('2 letras');
    expect(component.isLoading()).toBe(false);
  });

  it('should handle null vote/year safely', () => {
    expect(component.formatVote(null)).toBe('—');
    expect(component.formatVote(Number.NaN)).toBe('—');
    expect(component.getYear(null)).toBe('—');
    expect(component.ratingClass(undefined)).toBe('low');
  });

  it('should open the detail instantly on select', async () => {
    await fixture.whenStable();
    component.selectMovie({
      id: 1,
      title: 'Test',
      poster_path: null,
      overview: '',
      release_date: '2024-01-01',
      vote_average: 7.5,
    });
    expect(component.selectedId()).toBe(1);
    expect(component.selected()?.title).toBe('Test');
    expect(component.detailLoading()).toBe(true);
  });

  it('should append pages and stop at the last page', () => {
    // ngOnInit pide discover (p1), géneros y el sondeo de nota máxima.
    http.expectOne((req) => req.url.includes('/discover/movie') && !!req.params.get('release_date.lte') && req.params.get('sort_by') === 'popularity.desc').flush({
      page: 1, results: [{ id: 1, title: 'A', poster_path: null, overview: '', release_date: '2020-01-01', vote_average: 5 }], total_pages: 2, total_results: 40,
    });
    http.expectOne((req) => req.url.includes('/genre/movie/list')).flush({ genres: [] });
    // El sondeo de nota máxima del arranque también hay que responderlo.
    http.expectOne((req) => req.url.includes('/discover/movie') && req.params.get('sort_by') === 'vote_average.desc').flush({
      page: 1, results: [], total_pages: 0, total_results: 0,
    });
    expect(component.movies().length).toBe(1);
    expect(component.currentPage()).toBe(1);
    expect(component.loadingMore()).toBe(false);

    component.loadMore();
    expect(component.loadingMore()).toBe(true);
    http
      .expectOne((req) => req.url.includes('/discover/movie') && req.params.get('page') === '2')
      .flush({
        page: 2, results: [{ id: 2, title: 'B', poster_path: null, overview: '', release_date: '2021-01-01', vote_average: 6 }], total_pages: 2, total_results: 40,
      });
    expect(component.movies().length).toBe(2);
    expect(component.movies()[1].id).toBe(2);
    expect(component.currentPage()).toBe(2);
    expect(component.loadingMore()).toBe(false);

    // Con la última página cargada, loadMore ya no vuelve a pedir nada.
    const anterior = component.movies().length;
    component.loadMore();
    http.verify();
    expect(component.movies().length).toBe(anterior);
  });

  it('should replace movies on a fresh search (page 1)', () => {
    component.searchText = 'matrix';
    component.searchNow();
    http.expectOne((req) => req.url.includes('/search/movie')).flush({
      page: 1, results: [
        { id: 5, title: 'Futura', poster_path: null, overview: '', release_date: '2999-01-01', vote_average: 8 },
        { id: 9, title: 'Estrenada', poster_path: null, overview: '', release_date: '2020-01-01', vote_average: 7 },
      ], total_pages: 5, total_results: 91,
    });
    // La búsqueda (sin filtro server-side de fecha) descarta lo no estrenado.
    expect(component.movies().length).toBe(1);
    expect(component.movies()[0].id).toBe(9);
    expect(component.currentPage()).toBe(1);
    expect(component.totalResults()).toBe(91);
  });

  it('should filter by genre and duration through /discover', () => {
    // Respondemos lo del arranque: popular, géneros y sondeo de nota máx.
    http.expectOne((req) => req.url.includes('/discover/movie') && !!req.params.get('release_date.lte') && req.params.get('sort_by') === 'popularity.desc').flush({
      page: 1, results: [], total_pages: 1, total_results: 0,
    });
    http.expectOne((req) => req.url.includes('/genre/movie/list')).flush({
      genres: [{ id: 28, name: 'Acción' }, { id: 35, name: 'Comedia' }],
    });
    http.expectOne((req) => req.url.includes('/discover/movie') && req.params.get('sort_by') === 'vote_average.desc').flush({
      page: 1, results: [{ id: 9, title: 'Tope', poster_path: null, overview: '', release_date: '2025-01-01', vote_average: 9.2 }], total_pages: 1, total_results: 1,
    });
    expect(component.hasFilters()).toBe(false);
    // El sondeo: la más valorada tiene 9,2 con paso 0,5 → slider hasta 9.
    expect(component.notaMax()).toBe(9);
    expect(component.notasDisponibles()).toBe(true);

    // Elegir género: la recarga va a /discover con with_genres, y el
    // sondeo vuelve a volar con el filtro puesto.
    component.setGenero('28');
    expect(component.genreId()).toBe(28);
    expect(component.hasFilters()).toBe(true);
    http
      .expectOne((req) => req.url.includes('/discover/movie') && req.params.get('with_genres') === '28' && req.params.get('sort_by') === 'popularity.desc')
      .flush({ page: 1, results: [], total_pages: 3, total_results: 60 });
    http
      .expectOne((req) => req.url.includes('/discover/movie') && req.params.get('with_genres') === '28' && req.params.get('sort_by') === 'vote_average.desc' && req.params.get('vote_count.gte') === '50')
      .flush({ page: 1, results: [{ id: 10, title: 'Tope acción', poster_path: null, overview: '', release_date: '2025-01-01', vote_average: 8.6 }], total_pages: 1, total_results: 1 });
    expect(component.notaMax()).toBe(8.5);
    expect(component.totalResults()).toBe(60);

    // Añadir duración: añade los dos rangos de minutos a los parámetros.
    component.setDuracion('90-150');
    http
      .expectOne((req) => {
        const p = req.params;
        return req.url.includes('/discover/movie')
          && p.get('with_genres') === '28'
          && p.get('with_runtime.gte') === '90'
          && p.get('with_runtime.lte') === '150'
          && p.get('sort_by') === 'popularity.desc';
      })
      .flush({ page: 1, results: [], total_pages: 1, total_results: 10 });
    http
      .expectOne((req) => {
        const p = req.params;
        return req.url.includes('/discover/movie')
          && p.get('with_genres') === '28'
          && p.get('with_runtime.gte') === '90'
          && p.get('with_runtime.lte') === '150'
          && p.get('sort_by') === 'vote_average.desc';
      })
      .flush({ page: 1, results: [{ id: 11, title: 'Tope acción larga', poster_path: null, overview: '', release_date: '2025-01-01', vote_average: 8.5 }], total_pages: 1, total_results: 1 });
    expect(component.notaMax()).toBe(8.5);
    expect(component.totalResults()).toBe(10);

    // La nota mínima con los chips: añade vote_average.gte a la consulta.
    component.setNota(7);
    http
      .expectOne((req) => {
        const p = req.params;
        return req.url.includes('/discover/movie')
          && p.get('vote_average.gte') === '7'
          && p.get('with_genres') === '28'
          && p.get('sort_by') === 'popularity.desc';
      })
      .flush({ page: 1, results: [], total_pages: 1, total_results: 8 });
    expect(component.totalResults()).toBe(8);

    // Orden por estreno: cambia sort_by, manteniendo los filtros.
    component.setOrden('release_date.desc');
    http
      .expectOne((req) => {
        const p = req.params;
        return req.url.includes('/discover/movie')
          && p.get('vote_average.gte') === '7'
          && p.get('sort_by') === 'release_date.desc';
      })
      .flush({ page: 1, results: [], total_pages: 1, total_results: 8 });
    expect(component.totalResults()).toBe(8);

    // La traducción del estado llega al español.
    expect(component.estadoEs('Released')).toBe('Estrenada');
    expect(component.estadoEs('Post Production')).toBe('En postproducción');
    expect(component.estadoEs('In Production')).toBe('En producción');
    expect(component.estadoEs(null)).toBe('—');

    // Pedir 9 cuando el tope disponible es 8,5: no se cambia nada ni
    // sale ninguna petición (el chip 9+ estaría deshabilitado).
    const esperaNota = component.notaMin();
    component.setNota(9);
    expect(component.notaMin()).toBe(esperaNota);
    http.verify();
  });

  it('should search and then apply the order client-side without refetching', () => {
    cargarArranque(http);
    component.searchText = 'avatar';
    component.searchNow();
    const SEARCH = (req: any) => req.url.includes('/search/movie');
    http.expectOne(SEARCH).flush({
      page: 1, results: [
        // La clásica: más popular pero más antigua.
        { id: 1, title: 'Clásica', poster_path: null, overview: '', release_date: '2009-01-01', vote_average: 7, vote_count: 100, popularity: 50, genre_ids: [12] },
        // La nueva: menos popular pero más reciente.
        { id: 2, title: 'Nueva', poster_path: null, overview: '', release_date: '2025-01-01', vote_average: 6, vote_count: 100, popularity: 90, genre_ids: [12] },
      ], total_pages: 1, total_results: 2,
    });
    expect(component.modoBusqueda()).toBe(true);

    // Orden por defecto «Más popular»: la de popularidad 90 primero.
    expect(component.resultados().map((m) => m.id)).toEqual([2, 1]);

    // Cambiar el orden reordena el mismo pool sin nueva petición.
    component.setOrden('release_date.desc');
    expect(component.resultados()[0].id).toBe(2);
    component.setOrden('release_date.asc');
    expect(component.resultados()[0].id).toBe(1);
    // Y la búsqueda sigue activa: nada de catálogo completo.
    expect(component.activeQuery()).toBe('avatar');
    http.verify();
  });

  it('should apply genre filters client-side during an active search', () => {
    cargarArranque(http);
    component.searchText = 'avatar';
    component.searchNow();
    const SEARCH = (req: any) => req.url.includes('/search/movie');
    http.expectOne(SEARCH).flush({
      page: 1, results: [
        { id: 1, title: 'Aventura', poster_path: null, overview: '', release_date: '2009-01-01', vote_average: 7, vote_count: 100, popularity: 50, genre_ids: [12] },
        { id: 2, title: 'Animación', poster_path: null, overview: '', release_date: '2025-01-01', vote_average: 6, vote_count: 100, popularity: 90, genre_ids: [16] },
      ], total_pages: 1, total_results: 2,
    });
    expect(component.resultados().length).toBe(2);

    // Elegir género con la búsqueda activa: filtra el pool en cliente,
    // no spawnea ninguna petición y no limpia la búsqueda.
    component.setGenero('16');
    expect(component.genreId()).toBe(16);
    expect(component.resultados().map((m) => m.id)).toEqual([2]);
    expect(component.activeQuery()).toBe('avatar');

    // Quitar el género vuelve a enseñar los dos resultados.
    component.setGenero('');
    expect(component.resultados().length).toBe(2);
    http.verify();
  });

  it('should show more client-filtered results before asking for another page', () => {
    cargarArranque(http);
    component.searchText = 'matrix';
    component.searchNow();
    const SEARCH = (req: any) => req.url.includes('/search/movie');
    const fila = (id: number) => ({
      id, title: 'M' + id, poster_path: null, overview: '',
      release_date: '2020-01-01', vote_average: 7, vote_count: 100,
      popularity: id, genre_ids: [],
    });
    http.expectOne(SEARCH).flush({
      page: 1, results: [fila(1), fila(2)], total_pages: 2, total_results: 4,
    });
    expect(component.resultados().length).toBe(2);

    // Queda espacio de sobra para mostrar: subir el recorte no pide nada.
    component.visibleCount.set(1);
    expect(component.resultadosVisibles().length).toBe(1);
    component.loadMore();
    expect(component.resultadosVisibles().length).toBe(2);
    http.verify();

    // Pool agotado: ahora sí, página 2 de /search.
    component.loadMore();
    http
      .expectOne((req) => req.url.includes('/search/movie') && req.params.get('page') === '2')
      .flush({ page: 2, results: [fila(3), fila(4)], total_pages: 2, total_results: 4 });
    expect(component.resultados().length).toBe(4);
  });
});

// Responde las tres peticiones que lanza ngOnInit si ningún test las
// necesita inspeccionar: catálogo popular, géneros y sondeo de nota máxima.
function cargarArranque(http: HttpTestingController): void {
  http
    .expectOne((req) => req.url.includes('/discover/movie') && !!req.params.get('release_date.lte') && req.params.get('sort_by') === 'popularity.desc')
    .flush({ page: 1, results: [], total_pages: 1, total_results: 0 });
  http.expectOne((req) => req.url.includes('/genre/movie/list')).flush({ genres: [] });
  http
    .expectOne((req) => req.url.includes('/discover/movie') && req.params.get('sort_by') === 'vote_average.desc')
    .flush({ page: 1, results: [], total_pages: 0, total_results: 0 });
}
