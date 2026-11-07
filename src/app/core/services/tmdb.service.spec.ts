import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TmdbService } from './tmdb.service';

describe('TmdbService', () => {
  let service: TmdbService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TmdbService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should search with the query, language and no adult content', () => {
    service.buscarPeliculas('  matrix ', 2).subscribe();
    const req = http.expectOne((r) => r.url.includes('/search/movie'));
    expect(req.request.params.get('query')).toBe('matrix');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('language')).toBe('es-ES');
    expect(req.request.params.get('include_adult')).toBe('false');
    req.flush({});
  });

  it('should translate the duration select into a runtime range', () => {
    service.cargarCatalogo(1, 28, '>150', 7, 'popularity.desc').subscribe();
    const req = http.expectOne((r) => r.url.includes('/discover/movie'));
    expect(req.request.params.get('with_genres')).toBe('28');
    expect(req.request.params.get('with_runtime.gte')).toBe('151');
    expect(req.request.params.has('with_runtime.lte')).toBe(false);
    expect(req.request.params.get('vote_average.gte')).toBe('7');
    expect(req.request.params.get('region')).toBe('ES');
    expect(req.request.params.get('release_date.lte')).toBeTruthy();
    req.flush({});
  });

  it('should not send genre or rating when they are empty', () => {
    service.cargarCatalogo(1, null, 'any', null, 'popularity.desc').subscribe();
    const req = http.expectOne((r) => r.url.includes('/discover/movie'));
    expect(req.request.params.has('with_genres')).toBe(false);
    expect(req.request.params.has('vote_average.gte')).toBe(false);
    req.flush({});
  });
});
