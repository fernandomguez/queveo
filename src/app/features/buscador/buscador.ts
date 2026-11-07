import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';

// Formulario de búsqueda por título. No sabe nada del catálogo: recibe el
// texto con un model() (entrada y salida a la vez) y avisa con outputs.
@Component({
  selector: 'app-buscador',
  templateUrl: './buscador.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'c-buscador' },
})
export class Buscador {
  // Texto del campo: el padre lo enlaza con [(texto)].
  readonly texto = model('');
  // ¿Hay una búsqueda activa? Decide si se enseña el botón «Limpiar».
  readonly hayBusqueda = input(false);

  readonly buscar = output<void>();
  readonly limpiar = output<void>();

  protected alEscribir(evento: Event): void {
    this.texto.set((evento.target as HTMLInputElement).value);
  }

  protected alEnviar(evento: Event): void {
    evento.preventDefault();
    this.buscar.emit();
  }
}
