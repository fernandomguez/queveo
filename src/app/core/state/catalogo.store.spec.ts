import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { CatalogoStore } from './catalogo.store';

describe('CatalogoStore', () => {
  let store: CatalogoStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(CatalogoStore);
    // Arranca los resources (géneros y nota máxima), que se lanzan con effects.
    TestBed.tick();
  });

  afterEach(() => {
    http.verify();
  });

  it('should load the popular catalog and the genres on start', async () => {
    peticionCatalogo().flush({
      page: 1,
      results: [pelicula(1, { vote_count: 10 })],
      total_pages: 2,
      total_results: 40,
    });
    peticionGeneros().flush({ genres: [{ id: 28, name: 'Acción' }] });
    peticionNotaMax().flush(respuestaVacia());
    await asentar();

    expect(store.peliculas().length).toBe(1);
    expect(store.generos().length).toBe(1);
    expect(store.cargando()).toBe(false);
  });

  it('should reject short queries without calling the API', async () => {
    await arrancar();
    store.texto.set('a');
    store.buscar();
    expect(store.error()).toContain('2 letras');
    expect(store.cargando()).toBe(false);
  });

  it('should open the detail instantly with the basic data', async () => {
    await arrancar();
    store.seleccionar(pelicula(1, { title: 'Test' }));
    expect(store.detalle()?.title).toBe('Test');
    expect(store.cargandoDetalle()).toBe(true);

    await asentar();
    http.expectOne((req) => req.url.endsWith('/movie/1')).flush({
      ...pelicula(1, { title: 'Test' }),
      tagline: 'Lema',
      runtime: 120,
      genres: [{ id: 28, name: 'Acción' }],
      popularity: 10,
      original_language: 'en',
      status: 'Released',
    });
    await asentar();

    expect(store.detalle()?.tagline).toBe('Lema');
    expect(store.cargandoDetalle()).toBe(false);
    expect(store.errorDetalle()).toBe('');
  });

  it('should keep the basic data and show an error when the detail fails', async () => {
    await arrancar();
    store.seleccionar(pelicula(1, { title: 'Test' }));
    await asentar();
    http
      .expectOne((req) => req.url.endsWith('/movie/1'))
      .flush('error', { status: 500, statusText: 'Server Error' });
    await asentar();

    expect(store.detalle()?.title).toBe('Test');
    expect(store.errorDetalle()).toContain('No se pudo cargar');
  });

  it('should close the detail', async () => {
    await arrancar();
    store.seleccionar(pelicula(1));
    store.cerrarDetalle();
    expect(store.seleccionada()).toBeNull();
    expect(store.detalle()).toBeNull();
  });

  it('should append pages and stop at the last page', async () => {
    peticionCatalogo().flush({
      page: 1,
      results: [pelicula(1)],
      total_pages: 2,
      total_results: 40,
    });
    peticionGeneros().flush({ genres: [] });
    peticionNotaMax().flush(respuestaVacia());
    await asentar();
    expect(store.peliculas().length).toBe(1);
    expect(store.paginaActual()).toBe(1);

    store.verMas();
    expect(store.cargandoMas()).toBe(true);
    http
      .expectOne((req) => esDiscover(req) && req.params.get('page') === '2')
      .flush({ page: 2, results: [pelicula(2)], total_pages: 2, total_results: 40 });
    expect(store.peliculas().map((p) => p.id)).toEqual([1, 2]);
    expect(store.cargandoMas()).toBe(false);

    // Con la última página cargada ya no se pide nada más.
    store.verMas();
    expect(store.hayMas()).toBe(false);
  });

  it('should replace the list on a fresh search and drop unreleased movies', async () => {
    await arrancar();
    store.texto.set('matrix');
    store.buscar();
    http.expectOne((req) => req.url.includes('/search/movie')).flush({
      page: 1,
      results: [
        pelicula(5, { release_date: '2999-01-01' }),
        pelicula(9, { release_date: '2020-01-01' }),
      ],
      total_pages: 5,
      total_results: 91,
    });
    expect(store.peliculas().map((p) => p.id)).toEqual([9]);
    expect(store.totalResultados()).toBe(91);
    expect(store.modoBusqueda()).toBe(true);
  });

  it('should filter by genre, duration, rating and order through /discover', async () => {
    peticionCatalogo().flush(respuestaVacia());
    peticionGeneros().flush({ genres: [{ id: 28, name: 'Acción' }] });
    peticionNotaMax().flush(respuestaNota(9.2));
    await asentar();
    expect(store.hayFiltros()).toBe(false);
    // La más valorada tiene 9,2 y el paso es 0,5: el selector llega hasta 9.
    expect(store.notaMaxima()).toBe(9);
    expect(store.hayNotas()).toBe(true);

    // Elegir género recarga el catálogo y vuelve a preguntar la nota máxima.
    store.cambiarGenero('28');
    expect(store.generoId()).toBe(28);
    expect(store.hayFiltros()).toBe(true);
    http
      .expectOne((req) => esDiscover(req) && req.params.get('with_genres') === '28' && req.params.get('sort_by') === 'popularity.desc')
      .flush({ page: 1, results: [], total_pages: 3, total_results: 60 });
    await asentar();
    http
      .expectOne((req) => esDiscover(req) && req.params.get('with_genres') === '28' && req.params.get('sort_by') === 'vote_average.desc' && req.params.get('vote_count.gte') === '50')
      .flush(respuestaNota(8.6));
    await asentar();
    expect(store.notaMaxima()).toBe(8.5);
    expect(store.totalResultados()).toBe(60);

    // Duración: añade los dos rangos de minutos.
    store.cambiarDuracion('90-150');
    http
      .expectOne((req) => esDiscover(req) && req.params.get('with_runtime.gte') === '90' && req.params.get('with_runtime.lte') === '150' && req.params.get('sort_by') === 'popularity.desc')
      .flush({ page: 1, results: [], total_pages: 1, total_results: 10 });
    await asentar();
    http
      .expectOne((req) => esDiscover(req) && req.params.get('with_runtime.gte') === '90' && req.params.get('sort_by') === 'vote_average.desc')
      .flush(respuestaNota(8.5));
    await asentar();
    expect(store.totalResultados()).toBe(10);

    // Nota mínima: añade vote_average.gte (y no vuelve a preguntar la nota máxima).
    store.cambiarNota('7');
    http
      .expectOne((req) => esDiscover(req) && req.params.get('vote_average.gte') === '7' && req.params.get('with_genres') === '28')
      .flush({ page: 1, results: [], total_pages: 1, total_results: 8 });
    expect(store.totalResultados()).toBe(8);

    // Orden por estreno: cambia sort_by manteniendo los filtros.
    store.cambiarOrden('release_date.desc');
    http
      .expectOne((req) => esDiscover(req) && req.params.get('vote_average.gte') === '7' && req.params.get('sort_by') === 'release_date.desc')
      .flush({ page: 1, results: [], total_pages: 1, total_results: 8 });

    // Una nota por encima del tope disponible (8,5) se ignora y no pide nada.
    store.cambiarNota('9');
    expect(store.notaMinima()).toBe(7);
  });

  it('should order a search client-side without refetching', async () => {
    await arrancar();
    buscarConDosResultados();
    expect(store.modoBusqueda()).toBe(true);
    // Orden por defecto: la más popular primero.
    expect(store.resultados().map((p) => p.id)).toEqual([2, 1]);

    store.cambiarOrden('release_date.desc');
    expect(store.resultados()[0].id).toBe(2);
    store.cambiarOrden('release_date.asc');
    expect(store.resultados()[0].id).toBe(1);
    expect(store.consultaActiva()).toBe('avatar');
  });

  it('should apply the genre filter client-side during a search', async () => {
    await arrancar();
    buscarConDosResultados();

    store.cambiarGenero('16');
    expect(store.resultados().map((p) => p.id)).toEqual([2]);
    expect(store.consultaActiva()).toBe('avatar');

    store.cambiarGenero('');
    expect(store.resultados().length).toBe(2);
  });

  it('should keep the active search when removing filters', async () => {
    await arrancar();
    buscarConDosResultados();
    store.cambiarGenero('16');
    expect(store.resultados().map((p) => p.id)).toEqual([2]);

    store.quitarFiltros();
    expect(store.consultaActiva()).toBe('avatar');
    expect(store.generoId()).toBeNull();
    expect(store.resultados().map((p) => p.id)).toEqual([2, 1]);
  });

  it('should search the pending text when a filter is applied', async () => {
    await arrancar();
    // Texto escrito pero sin pulsar «Buscar»: tocar un filtro lo aplica.
    store.texto.set('avatar');
    store.cambiarGenero('12');
    expect(store.consultaActiva()).toBe('avatar');
    http.expectOne((req) => req.url.includes('/search/movie')).flush({
      page: 1,
      results: [
        pelicula(1, { genre_ids: [12], popularity: 50 }),
        pelicula(2, { genre_ids: [16], popularity: 90 }),
      ],
      total_pages: 1,
      total_results: 2,
    });
    expect(store.resultados().map((p) => p.id)).toEqual([1]);
  });

  it('should show more client-side results before asking for another page', async () => {
    await arrancar();
    store.texto.set('matrix');
    store.buscar();
    http.expectOne((req) => req.url.includes('/search/movie')).flush({
      page: 1,
      results: [pelicula(1), pelicula(2)],
      total_pages: 2,
      total_results: 4,
    });

    // Queda espacio de sobra para mostrar: subir el recorte no pide nada.
    store.visibles.set(1);
    expect(store.resultadosVisibles().length).toBe(1);
    store.verMas();
    expect(store.resultadosVisibles().length).toBe(2);

    // Conjunto agotado: ahora sí, página 2 de /search.
    store.verMas();
    http
      .expectOne((req) => req.url.includes('/search/movie') && req.params.get('page') === '2')
      .flush({ page: 2, results: [pelicula(3), pelicula(4)], total_pages: 2, total_results: 4 });
    expect(store.resultados().length).toBe(4);
  });

  it('should filter a search by duration using the runtime of each result', async () => {
    await arrancar();
    buscarConDosResultados();
    expect(store.resultados().map((p) => p.id)).toEqual([2, 1]);

    // Con el filtro puesto se pide la duración de cada resultado.
    store.cambiarDuracion('90-150');
    await asentar();
    expect(store.cargandoMinutos()).toBe(true);
    expect(store.resultados()).toEqual([]);
    http.expectOne((req) => req.url.endsWith('/movie/1')).flush(detalle(1, 120));
    http.expectOne((req) => req.url.endsWith('/movie/2')).flush(detalle(2, 200));
    await asentar();

    expect(store.cargandoMinutos()).toBe(false);
    expect(store.resultados().map((p) => p.id)).toEqual([1]);

    // Cambiar de rango no vuelve a pedir nada: las duraciones están en caché.
    store.cambiarDuracion('>150');
    expect(store.resultados().map((p) => p.id)).toEqual([2]);

    // Quitar el filtro devuelve las dos.
    store.cambiarDuracion('any');
    expect(store.resultados().length).toBe(2);
  });

  // --- Ayudas ----------------------------------------------------------

  function buscarConDosResultados(): void {
    store.texto.set('avatar');
    store.buscar();
    http.expectOne((req) => req.url.includes('/search/movie')).flush({
      page: 1,
      results: [
        // La clásica: más antigua y menos popular.
        pelicula(1, { release_date: '2009-01-01', popularity: 50, genre_ids: [12] }),
        // La nueva: más reciente y más popular.
        pelicula(2, { release_date: '2025-01-01', popularity: 90, genre_ids: [16] }),
      ],
      total_pages: 1,
      total_results: 2,
    });
  }

  // Responde las tres peticiones del arranque cuando el test no las necesita ver.
  async function arrancar(): Promise<void> {
    peticionCatalogo().flush(respuestaVacia());
    peticionGeneros().flush({ genres: [] });
    peticionNotaMax().flush(respuestaVacia());
    await asentar();
  }

  // Los resources publican su valor en un microtask: se espera y se ejecutan los effects.
  async function asentar(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
  }

  function peticionCatalogo(): TestRequest {
    return http.expectOne(
      (req) =>
        esDiscover(req) &&
        !!req.params.get('release_date.lte') &&
        req.params.get('sort_by') === 'popularity.desc',
    );
  }

  function peticionGeneros(): TestRequest {
    return http.expectOne((req) => req.url.includes('/genre/movie/list'));
  }

  function peticionNotaMax(): TestRequest {
    return http.expectOne((req) => esDiscover(req) && req.params.get('sort_by') === 'vote_average.desc');
  }
});

function esDiscover(req: { url: string }): boolean {
  return req.url.includes('/discover/movie');
}

function pelicula(id: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    title: `Película ${id}`,
    poster_path: null,
    overview: '',
    release_date: '2020-01-01',
    vote_average: 7,
    vote_count: 100,
    popularity: id,
    genre_ids: [],
    ...extra,
  };
}

function detalle(id: number, runtime: number) {
  return {
    ...pelicula(id),
    tagline: '',
    runtime,
    genres: [],
    popularity: 1,
    original_language: 'en',
    status: 'Released',
  };
}

function respuestaVacia() {
  return { page: 1, results: [], total_pages: 0, total_results: 0 };
}

function respuestaNota(nota: number) {
  return {
    page: 1,
    results: [pelicula(99, { vote_average: nota })],
    total_pages: 1,
    total_results: 1,
  };
}
