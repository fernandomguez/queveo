import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { MovieDetails } from '../../core/models/movie.model';
import { anioDe, estadoEnEspanol, formatearNota, urlImagen } from '../../shared/utils/formato';

// Pop up con la ficha completa de la película elegida. Usa el <dialog> nativo:
// el navegador se encarga del foco, de la tecla Escape y de dejar inerte el fondo.
@Component({
  selector: 'app-detalle-pelicula',
  templateUrl: './detalle-pelicula.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetallePelicula {
  readonly pelicula = input<MovieDetails | null>(null);
  readonly cargando = input(false);
  readonly error = input('');

  readonly cerrar = output<void>();

  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');

  protected readonly anio = computed(() => anioDe(this.pelicula()?.release_date));
  protected readonly nota = computed(() => formatearNota(this.pelicula()?.vote_average));
  protected readonly imagenFondo = computed(() => urlImagen(this.pelicula()?.backdrop_path, 'w780'));
  protected readonly idioma = computed(() => this.pelicula()?.original_language?.toUpperCase() || '—');
  protected readonly estado = computed(() => estadoEnEspanol(this.pelicula()?.status));
  protected readonly popularidad = computed(() => {
    const valor = this.pelicula()?.popularity;
    return valor ? valor.toFixed(0) : '—';
  });

  constructor() {
    // Abre el pop up cuando hay una película elegida y lo cierra cuando no.
    effect(() => {
      const dialogo = this.dialogo()?.nativeElement;
      if (!dialogo) return;
      const debeEstarAbierto = !!this.pelicula();
      if (debeEstarAbierto && !dialogo.open) {
        // Sin showModal (entornos de test) se abre con el atributo.
        if (typeof dialogo.showModal === 'function') dialogo.showModal();
        else dialogo.setAttribute('open', '');
      } else if (!debeEstarAbierto && dialogo.open) {
        if (typeof dialogo.close === 'function') dialogo.close();
        else dialogo.removeAttribute('open');
      }
    });
  }

  // El navegador cierra el <dialog> con Escape y avisa con el evento close.
  protected alCerrarDialogo(): void {
    if (this.pelicula()) this.cerrar.emit();
  }

  // Pulsar fuera del cuadro es pulsar el propio <dialog> (su velo), no su contenido.
  protected alPulsarDialogo(evento: MouseEvent): void {
    if (evento.target === this.dialogo()?.nativeElement) this.cerrar.emit();
  }
}
