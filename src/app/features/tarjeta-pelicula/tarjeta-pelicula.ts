import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Movie } from '../../core/models/movie.model';
import { anioDe, formatearNota, urlImagen } from '../../shared/utils/formato';

// Qué película se ha pulsado y con qué botón (para devolverle el foco al cerrar).
export interface AperturaDetalle {
  pelicula: Movie;
  boton: HTMLElement;
}

// Tarjeta de una película en la rejilla del catálogo.
@Component({
  selector: 'app-tarjeta-pelicula',
  templateUrl: './tarjeta-pelicula.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'c-tarjeta',
    '[class.c-tarjeta--estado-activa]': 'activa()',
  },
})
export class TarjetaPelicula {
  readonly pelicula = input.required<Movie>();
  // ¿Es la película que se está viendo en el detalle?
  readonly activa = input(false);

  readonly abrir = output<AperturaDetalle>();

  protected readonly anio = computed(() => anioDe(this.pelicula().release_date));
  protected readonly nota = computed(() => formatearNota(this.pelicula().vote_average));
  protected readonly poster = computed(() => urlImagen(this.pelicula().poster_path));
  protected readonly etiquetaAria = computed(
    () => `Ver detalle de ${this.pelicula().title}, ${this.anio()}, nota ${this.nota()}`,
  );

  protected alPulsar(evento: Event): void {
    this.abrir.emit({
      pelicula: this.pelicula(),
      boton: evento.currentTarget as HTMLElement,
    });
  }
}
