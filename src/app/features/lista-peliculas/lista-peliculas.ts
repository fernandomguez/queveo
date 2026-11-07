import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { Movie } from '../../core/models/movie.model';
import { CatalogoStore } from '../../core/state/catalogo.store';
import { TarjetaPelicula } from '../tarjeta-pelicula/tarjeta-pelicula';

// Estado del listado (cargando, error, resultados), rejilla de tarjetas y
// botón «Más resultados». Lee del store y avisa al padre cuando se abre una ficha.
@Component({
  selector: 'app-lista-peliculas',
  imports: [TarjetaPelicula],
  templateUrl: './lista-peliculas.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'c-lista' },
})
export class ListaPeliculas {
  protected readonly store = inject(CatalogoStore);

  readonly abrir = output<Movie>();
}
