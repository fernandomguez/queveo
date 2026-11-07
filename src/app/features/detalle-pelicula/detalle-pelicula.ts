import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { MovieDetails } from '../../core/models/movie.model';
import { anioDe, estadoEnEspanol, formatearNota, urlImagen } from '../../shared/utils/formato';

// Panel lateral con la ficha completa de la película elegida.
@Component({
  selector: 'app-detalle-pelicula',
  templateUrl: './detalle-pelicula.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'c-detalle',
    id: 'detail-panel',
    role: 'complementary',
    'aria-labelledby': 'detail-title',
    '[class.c-detalle--estado-abierto]': '!!pelicula()',
  },
})
export class DetallePelicula {
  private readonly injector = inject(Injector);

  readonly pelicula = input<MovieDetails | null>(null);
  readonly cargando = input(false);
  readonly error = input('');

  readonly cerrar = output<void>();

  private readonly titulo = viewChild<ElementRef<HTMLElement>>('titulo');

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
    // Cuando termina de cargar la ficha (bien o mal) el foco pasa al título,
    // para que un lector de pantalla anuncie la película que se acaba de abrir.
    effect(() => {
      if (!this.pelicula() || this.cargando()) return;
      afterNextRender(() => this.titulo()?.nativeElement.focus(), { injector: this.injector });
    });
  }
}
