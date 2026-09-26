import { describe, expect, it } from 'vitest';
import { getLibraryEmptyState, shouldShowRecordFilterButton } from './Library';

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

describe('getLibraryEmptyState', () => {
  it('cataloga come vuoto solo quando non c\'è nessuna traccia', () => {
    expect(getLibraryEmptyState(0, 0)).toBe('catalogo-vuoto');
  });

  it('non mostra nulla quando la lista filtrata ha risultati', () => {
    expect(getLibraryEmptyState(3, 2)).toBeNull();
  });

  it('T-01: segnala "nessun risultato" quando il filtro svuota la lista ma il catalogo non è vuoto', () => {
    // Scenario esatto della review: 3 tracce, 1 sola "da registrare", filtro
    // acceso, elimino l'unica traccia in quello stato. tracks.length resta 2
    // (le altre due restano nel catalogo), ma sortedTracks (filtrata) è vuota.
    // Prima del fix questo caso non produceva nessun messaggio.
    expect(getLibraryEmptyState(2, 0)).toBe('filtro-senza-risultati');
  });
});
