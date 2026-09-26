import { describe, expect, it } from 'vitest';
import { shouldShowRecordFilterButton } from './Library';

/**
 * Solo la logica pura del filtro "Da registrare", senza renderizzare il
 * componente: il progetto non ha un ambiente DOM nei test (niente jsdom/
 * @testing-library/react in package.json), quindi un test di rendering vero
 * e proprio richiederebbe una dipendenza e una configurazione nuove, fuori
 * dai confini di questa scheda.
 */
describe('shouldShowRecordFilterButton', () => {
  it('mostra il pulsante quando ci sono tracce da registrare', () => {
    expect(shouldShowRecordFilterButton(3, false)).toBe(true);
  });

  it('nasconde il pulsante quando non ce ne sono e il filtro è spento', () => {
    expect(shouldShowRecordFilterButton(0, false)).toBe(false);
  });

  it('tiene il pulsante visibile col filtro acceso anche a conteggio zero', () => {
    // Bug: eliminando l'ultima traccia "da registrare" col filtro attivo,
    // il pulsante spariva e non restava modo di spegnere il filtro.
    expect(shouldShowRecordFilterButton(0, true)).toBe(true);
  });
});
