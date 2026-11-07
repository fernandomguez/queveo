import { anioDe, estadoEnEspanol, formatearNota, urlImagen } from './formato';
import { hoyISO } from './fechas';

describe('formato', () => {
  it('should format null or invalid values safely', () => {
    expect(formatearNota(null)).toBe('—');
    expect(formatearNota(Number.NaN)).toBe('—');
    expect(formatearNota(7.46)).toBe('7.5');
    expect(anioDe(null)).toBe('—');
    expect(anioDe('2024-05-01')).toBe('2024');
  });

  it('should translate the release status to Spanish', () => {
    expect(estadoEnEspanol('Released')).toBe('Estrenada');
    expect(estadoEnEspanol('Post Production')).toBe('En postproducción');
    expect(estadoEnEspanol('In Production')).toBe('En producción');
    expect(estadoEnEspanol('Otro')).toBe('Otro');
    expect(estadoEnEspanol(null)).toBe('—');
  });

  it('should build image urls', () => {
    expect(urlImagen(null)).toBe('');
    expect(urlImagen('/a.jpg', 'w780')).toContain('/w780/a.jpg');
  });

  it('should give today as YYYY-MM-DD', () => {
    expect(hoyISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
