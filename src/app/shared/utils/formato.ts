import { environment } from '../../../environments/environment';

// Estados de estreno que TMDB devuelve en inglés.
const ESTADOS_EN_ESPANOL: Record<string, string> = {
  Rumored: 'Rumoreada',
  Planned: 'Planificada',
  'In Production': 'En producción',
  'Post Production': 'En postproducción',
  Released: 'Estrenada',
  Canceled: 'Cancelada',
};

const SIN_DATO = '—';

export function anioDe(fecha: string | null | undefined): string {
  if (!fecha || fecha.length < 4) return SIN_DATO;
  return fecha.slice(0, 4);
}

export function formatearNota(nota: number | null | undefined): string {
  if (typeof nota !== 'number' || Number.isNaN(nota)) return SIN_DATO;
  return nota.toFixed(1);
}

export function urlImagen(ruta: string | null | undefined, tamano = 'w500'): string {
  if (!ruta) return '';
  return `${environment.tmdbImageBaseUrl}/${tamano}${ruta}`;
}

export function estadoEnEspanol(estado: string | null | undefined): string {
  if (!estado) return SIN_DATO;
  return ESTADOS_EN_ESPANOL[estado] ?? estado;
}
