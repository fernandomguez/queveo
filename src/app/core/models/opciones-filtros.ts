export interface Opcion {
  valor: string;
  etiqueta: string;
}

// Valores por defecto de los filtros (sin ningún filtro aplicado).
export const DURACION_POR_DEFECTO = 'any';
export const ORDEN_POR_DEFECTO = 'popularity.desc';

export const DURACIONES: Opcion[] = [
  { valor: 'any', etiqueta: 'Cualquier duración' },
  { valor: '<90', etiqueta: 'Menos de 90 min' },
  { valor: '90-150', etiqueta: '90 – 150 min' },
  { valor: '>150', etiqueta: 'Más de 150 min' },
];

export const ORDENES: Opcion[] = [
  { valor: 'popularity.desc', etiqueta: 'Más populares' },
  { valor: 'release_date.desc', etiqueta: 'Estreno más reciente' },
  { valor: 'release_date.asc', etiqueta: 'Estreno más antiguo' },
];

// Traduce el valor del <select> de duración a un rango de minutos [mínimo, máximo].
export function rangoDuracion(duracion: string): [number | null, number | null] {
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

// Notas mínimas que ofrece el select; las que superan la nota máxima
// disponible salen deshabilitadas.
export const NOTAS_MINIMAS = [5, 6, 7, 8, 9];
