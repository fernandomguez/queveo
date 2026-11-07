import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';

const PELICULA = {
  id: 1, title: 'Prueba', poster_path: null, overview: '', release_date: '2024-01-01', vote_average: 7,
};

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  function crear() {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const store = (fixture.componentInstance as unknown as {
      store: { seleccionar: (p: unknown) => void; seleccionada: () => unknown };
    }).store;
    const html = fixture.nativeElement as HTMLElement;
    const dialogo = () => html.querySelector('dialog.c-detalle') as HTMLDialogElement;
    return { fixture, store, html, dialogo };
  }

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the brand, the search box and the filters', () => {
    const { html } = crear();
    expect(html.querySelector('h1')?.textContent).toContain('QUEVE');
    expect(html.querySelector('input[type="search"]')).toBeTruthy();
    expect(html.querySelectorAll('select').length).toBe(4);
  });

  it('should keep the detail pop up closed until a movie is chosen', () => {
    const { dialogo } = crear();
    expect(dialogo().open).toBe(false);
    expect(dialogo().textContent).not.toContain('Selecciona una película');
  });

  it('should open the pop up with the movie and close it with the X', () => {
    const { fixture, store, html, dialogo } = crear();
    store.seleccionar(PELICULA);
    fixture.detectChanges();
    expect(dialogo().open).toBe(true);
    expect(html.querySelector('#detail-title')?.textContent).toContain('Prueba');

    (html.querySelector('.c-detalle__cerrar') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(store.seleccionada()).toBeNull();
    expect(dialogo().open).toBe(false);
  });

  it('should close the pop up when the backdrop is clicked but not its content', () => {
    const { fixture, store, html, dialogo } = crear();
    store.seleccionar(PELICULA);
    fixture.detectChanges();

    // Pulsar dentro del contenido no cierra.
    (html.querySelector('#detail-title') as HTMLElement).click();
    fixture.detectChanges();
    expect(dialogo().open).toBe(true);

    // Pulsar el propio <dialog> (su velo) sí cierra.
    dialogo().click();
    fixture.detectChanges();
    expect(store.seleccionada()).toBeNull();
    expect(dialogo().open).toBe(false);
  });

  it('should close the pop up when the browser closes the dialog (Escape)', () => {
    const { fixture, store, dialogo } = crear();
    store.seleccionar(PELICULA);
    fixture.detectChanges();

    dialogo().dispatchEvent(new Event('close'));
    fixture.detectChanges();
    expect(store.seleccionada()).toBeNull();
    expect(dialogo().open).toBe(false);
  });
});
