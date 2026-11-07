import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, catchError, from, map, mergeMap, of } from 'rxjs';
import { Movie, MovieDetails, TmdbResponse } from '../models/movie.model';
import {
  DURACION_POR_DEFECTO,
  ORDEN_POR_DEFECTO,
  rangoDuracion,
} from '../models/opciones-filtros';
import { TmdbService } from '../services/tmdb.service';
import { hoyISO } from '../../shared/utils/fechas';

// Nota mínima posible del selector: con este valor no hay ninguna nota que elegir.
const NOTA_MINIMA = 1;
// Cuántas películas se enseñan de golpe en una búsqueda (se recorta en cliente).
const PELICULAS_POR_PAGINA = 20;
// Para calcular la nota máxima se ignoran las películas con menos votos.
const VOTOS_MINIMOS = 50;

// Estado de toda la pantalla del catálogo. Los componentes solo leen sus
// signals y llaman a sus métodos.
@Injectable({ providedIn: 'root' })
export class CatalogoStore {
  private readonly tmdb = inject(TmdbService);
  private readonly destroyRef = inject(DestroyRef);
  private peticionLista: Subscription | null = null;

  // --- Buscador ---------------------------------------------------------
  // Texto escrito en el buscador y texto que se ha buscado de verdad.
  readonly texto = signal('');
  readonly consultaActiva = signal('');

  // --- Listado ----------------------------------------------------------
  readonly peliculas = signal<Movie[]>([]);
  readonly cargando = signal(false);
  readonly cargandoMas = signal(false);
  readonly error = signal('');
  readonly paginaActual = signal(0);
  readonly totalPaginas = signal(1);
  readonly totalResultados = signal(0);
  // Películas visibles en modo búsqueda: /search no admite orden ni filtros,
  // así que se pagina en cliente el conjunto ya descargado.
  readonly visibles = signal(PELICULAS_POR_PAGINA);

  // --- Filtros ----------------------------------------------------------
  readonly generoId = signal<number | null>(null);
  readonly duracion = signal(DURACION_POR_DEFECTO);
  readonly notaMinima = signal<number | null>(null);
  readonly orden = signal(ORDEN_POR_DEFECTO);
  // Mayor nota que existe con los filtros actuales (tope del selector de nota).
  readonly notaMaxima = signal(10);
  readonly hayNotas = signal(true);

  // Duración en minutos de cada película de la búsqueda, por id. /search no la
  // devuelve, así que con el filtro de duración puesto se pide el detalle de cada
  // una y se guarda aquí (null = sin dato).
  private readonly minutos = signal<Record<number, number | null>>({});
  private readonly pidiendoMinutos = new Set<number>();

  // --- Detalle ----------------------------------------------------------
  readonly seleccionada = signal<Movie | null>(null);

  // --- Datos que se piden solos con rxResource ---------------------------
  private readonly generosRes = rxResource({
    stream: () => this.tmdb.obtenerGeneros(),
  });

  // Nota máxima del catálogo: se vuelve a pedir cuando cambia el género,
  // o la duración. En modo búsqueda no se pide (undefined = quieto).
  private readonly notaMaxRes = rxResource({
    params: () =>
      this.modoBusqueda()
        ? undefined
        : { generoId: this.generoId(), duracion: this.duracion() },
    stream: ({ params }) =>
      this.tmdb.obtenerNotaMax(params.generoId, params.duracion),
  });

  private readonly detalleRes = rxResource({
    params: () => this.seleccionada()?.id,
    stream: ({ params }) => this.tmdb.obtenerDetalle(params),
  });

  readonly generos = computed(() =>
    this.generosRes.hasValue() ? (this.generosRes.value().genres ?? []) : [],
  );

  // Detalle abierto al instante con los datos básicos; cuando llega el
  // completo (idioma, géneros, duración...) lo sustituye.
  readonly detalle = computed<MovieDetails | null>(() => {
    const basica = this.seleccionada();
    if (!basica) return null;
    const completa = this.detalleRes.hasValue() ? this.detalleRes.value() : null;
    if (completa?.id === basica.id) return completa;
    return {
      ...basica,
      tagline: '',
      runtime: null,
      genres: [],
      popularity: 0,
      original_language: '',
      status: '',
    };
  });
  // Cuenta como «cargando» también el instante previo a que arranque la petición.
  readonly cargandoDetalle = computed(
    () =>
      this.seleccionada() !== null &&
      (this.detalleRes.isLoading() || this.detalleRes.status() === 'idle'),
  );
  readonly errorDetalle = computed(() =>
    this.detalleRes.error() ? 'No se pudo cargar el detalle completo. Mostrando datos básicos.' : '',
  );

  // --- Valores derivados ------------------------------------------------
  readonly modoBusqueda = computed(() => this.consultaActiva() !== '');

  // Género y nota como texto, que es lo que entiende un <select>.
  readonly generoTexto = computed(() => this.generoId()?.toString() ?? '');
  readonly notaTexto = computed(() => this.notaMinima()?.toString() ?? '');

  // En búsqueda con filtro de duración: ¿faltan películas por saber cuánto duran?
  readonly cargandoMinutos = computed(
    () =>
      this.modoBusqueda() &&
      this.duracion() !== DURACION_POR_DEFECTO &&
      this.peliculas().some((p) => !(p.id in this.minutos())),
  );

  readonly hayFiltros = computed(
    () =>
      this.generoId() !== null ||
      this.duracion() !== DURACION_POR_DEFECTO ||
      this.notaMinima() !== null ||
      this.orden() !== ORDEN_POR_DEFECTO,
  );

  // En búsqueda, la lista sale del conjunto descargado filtrado y ordenado
  // aquí; en catálogo, tal cual llega del servidor.
  readonly resultados = computed<Movie[]>(() =>
    this.modoBusqueda() ? this.filtrarBusqueda() : this.peliculas(),
  );

  readonly resultadosVisibles = computed<Movie[]>(() =>
    this.modoBusqueda() ? this.resultados().slice(0, this.visibles()) : this.resultados(),
  );

  // ¿Queda algo por mostrar o por traer? Decide el botón «Más resultados».
  readonly hayMas = computed(() => {
    const quedanPaginas = this.paginaActual() < this.totalPaginas();
    if (!this.modoBusqueda()) return quedanPaginas;
    return this.visibles() < this.resultados().length || quedanPaginas;
  });

  constructor() {
    this.cargarCatalogo();
    this.destroyRef.onDestroy(() => this.peticionLista?.unsubscribe());

    // En búsqueda con filtro de duración, pide la duración de las películas que
    // aún no se conocen.
    effect(() => {
      if (!this.modoBusqueda() || this.duracion() === DURACION_POR_DEFECTO) return;
      const peliculas = this.peliculas();
      untracked(() => this.pedirMinutos(peliculas));
    });

    // Mantiene el tope del selector de nota al día: en catálogo con lo que
    // contesta el servidor, en búsqueda con las películas ya descargadas.
    effect(() => {
      if (this.modoBusqueda()) {
        const ocupado = this.cargando() || this.cargandoMas() || this.error() !== '';
        const pelis = this.peliculas();
        if (!ocupado) untracked(() => this.ajustarNotaMaxima(this.mayorNota(pelis)));
        return;
      }
      const estado = this.notaMaxRes.status();
      if (estado === 'resolved') {
        const mejor = this.notaMaxRes.value()?.results?.[0]?.vote_average ?? null;
        untracked(() => this.ajustarNotaMaxima(mejor));
      } else if (estado === 'error') {
        // Sin respuesta el selector queda como estaba.
        untracked(() => this.hayNotas.set(this.notaMaxima() > NOTA_MINIMA));
      }
    });
  }

  // --- Buscador ---------------------------------------------------------
  buscar(): void {
    const consulta = this.texto().trim();
    this.consultaActiva.set(consulta);
    this.error.set('');

    if (!consulta) {
      this.cargarCatalogo();
      return;
    }
    if (consulta.length < 2) {
      this.error.set('Escribe al menos 2 letras para buscar.');
      this.cargando.set(false);
      return;
    }

    this.peticionLista?.unsubscribe();
    this.peliculas.set([]);
    this.visibles.set(PELICULAS_POR_PAGINA);
    this.iniciarPeticion(1);
    this.peticionLista = this.tmdb.buscarPeliculas(consulta).subscribe({
      next: (respuesta) => this.alLlegarPagina(respuesta, 1),
      error: () => this.alFallarLista(`No se pudo buscar "${consulta}". Inténtalo de nuevo.`, 1),
    });
  }

  limpiarBusqueda(): void {
    this.texto.set('');
    this.visibles.set(PELICULAS_POR_PAGINA);
    this.cargarCatalogo();
  }

  // --- Filtros ----------------------------------------------------------
  // Los <select> trabajan con texto, así que estos métodos reciben strings.
  cambiarGenero(valor: string): void {
    const numero = Number(valor);
    const nuevo = Number.isFinite(numero) && numero > 0 ? numero : null;
    if (this.generoId() === nuevo) return;
    this.generoId.set(nuevo);
    this.alCambiarFiltro();
  }

  cambiarDuracion(valor: string): void {
    if (this.duracion() === valor) return;
    this.duracion.set(valor);
    this.alCambiarFiltro();
  }

  cambiarOrden(valor: string): void {
    if (this.orden() === valor) return;
    this.orden.set(valor);
    this.alCambiarFiltro();
  }

  // '' significa «cualquier nota».
  cambiarNota(valor: string): void {
    const nota = valor === '' ? null : Number(valor);
    // Una nota por encima de la máxima disponible no se admite.
    if (nota !== null && nota > this.notaMaxima()) return;
    if (this.notaMinima() === nota) return;
    this.notaMinima.set(nota);
    this.alCambiarFiltro();
  }

  // Vuelve a los valores por defecto. Con una búsqueda abierta solo quita
  // los filtros: el conjunto descargado se conserva y se vuelve a ver entero.
  quitarFiltros(): void {
    this.generoId.set(null);
    this.duracion.set(DURACION_POR_DEFECTO);
    this.notaMinima.set(null);
    this.orden.set(ORDEN_POR_DEFECTO);
    if (this.modoBusqueda()) return;
    this.texto.set('');
    this.cargarCatalogo();
  }

  // --- Paginación -------------------------------------------------------
  verMas(): void {
    if (this.cargandoMas()) return;

    if (this.modoBusqueda()) {
      // Primero se agota lo ya descargado y solo después se pide otra página.
      if (this.visibles() < this.resultados().length) {
        this.visibles.update((n) => n + PELICULAS_POR_PAGINA);
        return;
      }
      if (this.paginaActual() >= this.totalPaginas()) return;
      const siguiente = this.paginaActual() + 1;
      this.peticionLista?.unsubscribe();
      this.iniciarPeticion(siguiente);
      this.peticionLista = this.tmdb.buscarPeliculas(this.consultaActiva(), siguiente).subscribe({
        next: (respuesta) => this.alLlegarPagina(respuesta, siguiente),
        error: () => this.alFallarVerMas(),
      });
      return;
    }

    if (this.paginaActual() >= this.totalPaginas()) return;
    const siguiente = this.paginaActual() + 1;
    this.peticionLista?.unsubscribe();
    this.iniciarPeticion(siguiente);
    this.peticionLista = this.pedirCatalogo(siguiente).subscribe({
      next: (respuesta) => this.alLlegarPagina(respuesta, siguiente),
      error: () => this.alFallarVerMas(),
    });
  }

  // --- Detalle ----------------------------------------------------------
  seleccionar(pelicula: Movie): void {
    this.seleccionada.set(pelicula);
  }

  cerrarDetalle(): void {
    this.seleccionada.set(null);
  }

  // --- Privado ----------------------------------------------------------
  cargarCatalogo(pagina = 1): void {
    this.peticionLista?.unsubscribe();
    this.iniciarPeticion(pagina);
    this.consultaActiva.set('');
    this.peticionLista = this.pedirCatalogo(pagina).subscribe({
      next: (respuesta) => this.alLlegarPagina(respuesta, pagina),
      error: () =>
        this.alFallarLista('No se pudo cargar el catálogo. Revisa tu conexión.', pagina),
    });
  }

  private pedirCatalogo(pagina: number) {
    return this.tmdb.cargarCatalogo(
      pagina,
      this.generoId(),
      this.duracion(),
      this.notaMinima(),
      this.orden(),
    );
  }

  // Qué hacer cuando cambia un filtro. En búsqueda no se pide nada (la lista
  // se recalcula sola); con texto pendiente se busca; si no, se recarga.
  private alCambiarFiltro(): void {
    if (this.modoBusqueda()) return;
    if (this.hayBusquedaPendiente()) {
      this.buscar();
      return;
    }
    this.cargarCatalogo();
  }

  // Texto escrito que todavía no se ha buscado. Tocar un filtro con ese texto
  // debe aplicar la búsqueda, no volver al catálogo ignorando lo escrito.
  private hayBusquedaPendiente(): boolean {
    const texto = this.texto().trim();
    return texto.length >= 2 && texto !== this.consultaActiva();
  }

  private iniciarPeticion(pagina: number): void {
    this.cargando.set(pagina === 1);
    this.cargandoMas.set(pagina > 1);
    this.error.set('');
  }

  private alLlegarPagina(respuesta: TmdbResponse, pagina: number): void {
    // /search no filtra por fecha en el servidor: se quita lo no estrenado.
    const nuevas = this.soloEstrenadas(respuesta.results ?? []);
    this.peliculas.update((actuales) => (pagina === 1 ? nuevas : [...actuales, ...nuevas]));
    this.paginaActual.set(respuesta.page ?? pagina);
    this.totalPaginas.set(respuesta.total_pages ?? this.totalPaginas());
    this.totalResultados.set(respuesta.total_results ?? this.totalResultados());
    this.cargando.set(false);
    this.cargandoMas.set(false);
  }

  private alFallarLista(mensaje: string, pagina: number): void {
    if (pagina === 1) this.peliculas.set([]);
    this.error.set(mensaje);
    this.cargando.set(false);
    this.cargandoMas.set(false);
  }

  private alFallarVerMas(): void {
    this.error.set('No se pudieron cargar más resultados. Inténtalo de nuevo.');
    this.cargandoMas.set(false);
  }

  // Solo películas con fecha de estreno conocida y ya pasada.
  private soloEstrenadas(peliculas: Movie[]): Movie[] {
    const hoy = hoyISO();
    return peliculas.filter((p) => !!p.release_date && p.release_date <= hoy);
  }

  // Filtros y orden de una búsqueda, aplicados en cliente.
  private filtrarBusqueda(): Movie[] {
    let lista = this.peliculas();
    const generoId = this.generoId();
    if (generoId !== null) {
      lista = lista.filter((p) => p.genre_ids?.includes(generoId));
    }
    const notaMinima = this.notaMinima();
    if (notaMinima !== null) {
      lista = lista.filter((p) => (p.vote_average ?? 0) >= notaMinima);
    }
    const duracion = this.duracion();
    if (duracion !== DURACION_POR_DEFECTO) {
      const [minimo, maximo] = rangoDuracion(duracion);
      const minutos = this.minutos();
      lista = lista.filter((p) => {
        const duracionPelicula = minutos[p.id];
        if (typeof duracionPelicula !== 'number' || duracionPelicula <= 0) return false;
        return (minimo === null || duracionPelicula >= minimo) && (maximo === null || duracionPelicula <= maximo);
      });
    }
    const orden = this.orden();
    return [...lista].sort((a, b) => this.comparar(a, b, orden));
  }

  // Popularidad, o estreno ascendente/descendente. Sin fecha, al final.
  private comparar(a: Movie, b: Movie, orden: string): number {
    if (orden === 'release_date.asc' || orden === 'release_date.desc') {
      const fechaA = a.release_date || '0000-00-00';
      const fechaB = b.release_date || '0000-00-00';
      return orden === 'release_date.asc' ? fechaA.localeCompare(fechaB) : fechaB.localeCompare(fechaA);
    }
    return (b.popularity ?? 0) - (a.popularity ?? 0);
  }

  // Pide el detalle (de 5 en 5) de las películas cuya duración no se conoce.
  private pedirMinutos(peliculas: Movie[]): void {
    const conocidos = this.minutos();
    const ids = peliculas
      .map((p) => p.id)
      .filter((id) => !(id in conocidos) && !this.pidiendoMinutos.has(id));
    if (!ids.length) return;

    ids.forEach((id) => this.pidiendoMinutos.add(id));
    from(ids)
      .pipe(
        mergeMap(
          (id) =>
            this.tmdb.obtenerDetalle(id).pipe(
              map((detalle) => [id, detalle.runtime] as const),
              catchError(() => of([id, null] as const)),
            ),
          5,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(([id, duracion]) => {
        this.pidiendoMinutos.delete(id);
        this.minutos.update((actuales) => ({ ...actuales, [id]: duracion }));
      });
  }

  // Mayor nota entre las películas descargadas (con votos suficientes si hay).
  private mayorNota(peliculas: Movie[]): number | null {
    const conVotos = peliculas.filter((p) => (p.vote_count ?? 0) >= VOTOS_MINIMOS);
    const fuente = conVotos.length ? conVotos : peliculas;
    if (!fuente.length) return null;
    return Math.max(...fuente.map((p) => p.vote_average ?? 0));
  }

  // Ajusta el tope del selector a la mayor nota observada. Si la nota elegida
  // queda por encima, vuelve a «cualquier nota» (y el catálogo se recarga).
  private ajustarNotaMaxima(mejorNota: number | null): void {
    if (mejorNota === null || mejorNota <= NOTA_MINIMA) {
      this.hayNotas.set(false);
      this.notaMaxima.set(NOTA_MINIMA);
      this.descartarNotaSiSobra();
      return;
    }
    // Se baja a múltiplos de 0,5 para no quedar entre dos opciones.
    const tope = Math.max(Math.floor(mejorNota * 2) / 2, NOTA_MINIMA);
    this.hayNotas.set(true);
    this.notaMaxima.set(tope);
    this.descartarNotaSiSobra();
  }

  private descartarNotaSiSobra(): void {
    const nota = this.notaMinima();
    if (nota === null || nota <= this.notaMaxima()) return;
    this.notaMinima.set(null);
    if (!this.modoBusqueda()) this.cargarCatalogo();
  }
}
