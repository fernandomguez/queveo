# Queveo · ApiPelis

**Buscador de películas en español con la API de [TMDB](https://www.themoviedb.org): resultados con póster, ficha de detalle y filtro por géneros.**

Ejercicio de práctica con **Angular 22**: `HttpClient` tipado, servicios con `HttpParams` y *timeout* de peticiones, componentes *standalone*, modelos con interfaces y tests con **Vitest**.

## Cómo funciona

- `TmdbService` encapsula toda la comunicación con TMDB (búsqueda, detalle y géneros) con parámetros de idioma `es-ES` y filtro de contenido adulto.
- `MovieList` pinta los resultados; la búsqueda pagina y el filtro de géneros reordena la vista.
- Las peticiones llevan `timeout(10000)` de RxJS para no colgar la UI si la API no responde.

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
| `src/app/core/models/movie.model.ts` | Tipos de película y respuestas |
| `src/app/movie-list/` | Componente de resultados |
| `src/app/app.spec.ts`, `src/app/tmdb.spec.ts`, `src/app/movie-list/movie-list.spec.ts` | Tests con Vitest |

## Datos

Las imágenes y los datos vienen de [TMDB](https://www.themoviedb.org); este proyecto usa sus APIs pero no está avalado ni certificado por TMDB.
