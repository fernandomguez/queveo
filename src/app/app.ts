import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CatalogoStore } from './core/state/catalogo.store';
import { Buscador } from './features/buscador/buscador';
import { DetallePelicula } from './features/detalle-pelicula/detalle-pelicula';
import { Filtros } from './features/filtros/filtros';
import { ListaPeliculas } from './features/lista-peliculas/lista-peliculas';
import { Marca } from './features/marca/marca';

// Página única: cabecera con buscador y filtros, catálogo y pop up de detalle.
@Component({
  selector: 'app-root',
  imports: [Marca, Buscador, Filtros, ListaPeliculas, DetallePelicula],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly store = inject(CatalogoStore);
}
