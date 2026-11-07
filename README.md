# Queveo | ApiPelis

**Buscador de películas en español con la API de [TMDB](https://www.themoviedb.org): catálogo de estrenos con póster, búsqueda por título, ficha de detalle y filtros por género, duración, nota y orden.**

Ejercicio de práctica con **Angular 22**: componentes *standalone* con `input()`, `output()` y `model()`, estado con *signals*, `rxResource`, aplicación *zoneless*, `HttpClient` tipado, estilos con **Sass** por capas y tests con **Vitest**.

## Cómo funciona

- `TmdbService` encapsula toda la comunicación con TMDB (catálogo, búsqueda, detalle y géneros), con idioma `es-ES`, filtro de contenido adulto y `timeout(10000)` de RxJS.
- `CatalogoStore` guarda el estado de la pantalla con *signals* y *computed*: texto buscado, filtros, paginación, resultados y película seleccionada. Los géneros, el detalle y la nota máxima se piden con `rxResource`.
- El catálogo va a `/discover`, que admite filtros en el servidor. La búsqueda va a `/search`, que no los admite, así que género, nota, orden y duración se aplican en cliente. Para filtrar por duración se pide el detalle de cada resultado y se guarda en caché.
- Los componentes de `features/` solo pintan y avisan con `output()`; la lógica está en el store.

## Desarrollo

```bash
npm install
npm start        # http://localhost:4200
npm run test     # Vitest
npm run build    # producción en dist/apiPelis/browser
```

## Estructura

| Ruta | Contenido |
| --- | --- |
| `src/app/core/services/tmdb.service.ts` | Comunicación con la API de TMDB |
| `src/app/core/state/catalogo.store.ts` | Estado del catálogo con *signals* y `rxResource` |
| `src/app/core/models/` | Tipos de TMDB (`movie.model.ts`) y opciones de los filtros |
| `src/app/features/` | Componentes: `marca`, `buscador`, `filtros`, `lista-peliculas`, `tarjeta-pelicula` y `detalle-pelicula` |
| `src/app/shared/utils/` | Funciones de formato y de fechas |
| `src/styles/` | Estilos Sass por capas (ver abajo) |
| `src/**/*.spec.ts` | Tests con Vitest |

## Estilos

Sass con la arquitectura de capas `s01`–`s06` y componentes con BEM (`c-*`):

| Capa | Contenido |
| --- | --- |
| `s01_utilities` | Catálogo de valores puros (`_system_tokens.scss`), decisiones (`_semantic_tokens.scss`), funciones y mixins. No genera CSS |
| `s02_vendor` | Librerías externas (vacía) |
| `s03_base` | Tokens de sistema `--mlt-sys-*` generados con bucles, reset y tipografía |
| `s04_components` | Un archivo por componente (`c-boton`, `c-tarjeta`, `c-detalle`...) |
| `s05_layouts` | Maquetas de página (`l-pagina`) |
| `s06_global` | Fuentes, valores por defecto y utilidades |

Los tokens numéricos de cada componente se llaman `--componente-familia-N`, con el mismo número que el token de sistema al que apuntan (`--hero-padding-9` apunta a `--mlt-sys-padding-9`).

## Datos

Las imágenes y los datos vienen de [TMDB](https://www.themoviedb.org); este proyecto usa sus APIs pero no está avalado ni certificado por TMDB.
