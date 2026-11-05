// Compatibilidad temporal: la app usa la nueva estructura en
// core/models + core/services. Este archivo reexporta para no romper
// imports existentes. Preferir importar desde las rutas nuevas.
export * from './core/models/movie.model';
export { TmdbService as Tmdb } from './core/services/tmdb.service';
