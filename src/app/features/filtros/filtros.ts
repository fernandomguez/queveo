import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { Genre } from '../../core/models/movie.model';
import {
  DURACIONES,
  NOTAS_MINIMAS,
  ORDENES,
} from '../../core/models/opciones-filtros';

// Barra de filtros del catálogo. Cada filtro es un model(): el padre le pasa
// el valor actual y recibe el nuevo con (generoChange), (duracionChange)...
@Component({
  selector: 'app-filtros',
  templateUrl: './filtros.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'c-filtros',
    role: 'group',
    'aria-label': 'Filtrar el catálogo',
  },
})
export class Filtros {
  // Valores elegidos. Son texto porque un <select> siempre devuelve texto.
  readonly genero = model('');
  readonly duracion = model('');
  readonly nota = model('');
  readonly orden = model('');

  // Datos que necesita para pintarse.
  readonly generos = input<Genre[]>([]);
  readonly notaMaxima = input(10);
  readonly hayNotas = input(true);
  readonly hayFiltros = input(false);

  readonly quitarFiltros = output<void>();

  protected readonly duraciones = DURACIONES;
  protected readonly ordenes = ORDENES;
  protected readonly notas = NOTAS_MINIMAS;

  // Lee el valor elegido en un <select>.
  protected valorDe(evento: Event): string {
    return (evento.target as HTMLSelectElement).value;
  }
}
