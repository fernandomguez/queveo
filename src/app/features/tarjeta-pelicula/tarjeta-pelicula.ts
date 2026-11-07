import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Movie } from '../../core/models/movie.model';
import { anioDe, formatearNota, urlImagen } from '../../shared/utils/formato';

// Tarjeta de una película en la rejilla del catálogo.
@Component({
  selector: 'app-tarjeta-pelicula',
  templateUrl: './tarjeta-pelicula.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'c-tarjeta' },
})
export class TarjetaPelicula {
  readonly pelicula = input.required<Movie>();

  readonly abrir = output<Movie>();

  protected readonly anio = computed(() => anioDe(this.pelicula().release_date));
  protected readonly nota = computed(() => formatearNota(this.pelicula().vote_average));
  protected readonly poster = computed(() => urlImagen(this.pelicula().poster_path));
  protected readonly etiquetaAria = computed(
    () => `Ver detalle de ${this.pelicula().title}, ${this.anio()}, nota ${this.nota()}`,
  );

  protected alPulsar(): void {
    this.abrir.emit(this.pelicula());
  }
}
