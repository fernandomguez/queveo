import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CatalogoStore } from './core/state/catalogo.store';
import { Buscador } from './features/buscador/buscador';
import { DetallePelicula } from './features/detalle-pelicula/detalle-pelicula';
import { Filtros } from './features/filtros/filtros';
import { ListaPeliculas } from './features/lista-peliculas/lista-peliculas';
import { Marca } from './features/marca/marca';
import { AperturaDetalle } from './features/tarjeta-pelicula/tarjeta-pelicula';

// Página única: cabecera con buscador y filtros, catálogo y panel de detalle.
@Component({
  selector: 'app-root',
  imports: [Marca, Buscador, Filtros, ListaPeliculas, DetallePelicula],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown.escape)': 'alPulsarEscape()' },
})
export class App {
  protected readonly store = inject(CatalogoStore);
  // Botón que abrió el detalle, para devolverle el foco al cerrarlo.
  private botonQueAbrio: HTMLElement | null = null;

  protected abrirDetalle(apertura: AperturaDetalle): void {
    this.botonQueAbrio = apertura.boton;
    this.store.seleccionar(apertura.pelicula);
  }

  protected cerrarDetalle(): void {
    this.store.cerrarDetalle();
    this.botonQueAbrio?.focus();
  }

  protected alPulsarEscape(): void {
    if (this.store.seleccionada()) this.cerrarDetalle();
  }
}
