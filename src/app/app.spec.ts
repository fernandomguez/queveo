import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the brand, the search box and the filters', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('h1')?.textContent).toContain('QUEVE');
    expect(html.querySelector('input[type="search"]')).toBeTruthy();
    expect(html.querySelectorAll('select').length).toBe(4);
  });

  it('should open and close the detail panel from a card', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const store = (fixture.componentInstance as unknown as { store: { seleccionar: (p: unknown) => void } }).store;
    store.seleccionar({
      id: 1, title: 'Prueba', poster_path: null, overview: '', release_date: '2024-01-01', vote_average: 7,
    });
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('.c-detalle--estado-abierto')).toBeTruthy();
    expect(html.querySelector('#detail-title')?.textContent).toContain('Prueba');

    (html.querySelector('.c-detalle__cerrar') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(html.querySelector('.c-detalle--estado-abierto')).toBeNull();
  });
});
