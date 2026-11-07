import { ChangeDetectionStrategy, Component } from '@angular/core';

// Logotipo animado de Queveo con su subtítulo.
@Component({
  selector: 'app-marca',
  templateUrl: './marca.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'c-marca' },
})
export class Marca {}
