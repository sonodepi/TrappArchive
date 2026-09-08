/**
 * Ruota Camelot: notazione usata da DJ e producer (ed è quella mostrata da Tunebat).
 * Tabella completa, comprese tutte le enarmonie.
 */

export const PITCH_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const;

/** Nome preferito per la scrittura delle tonalità (bemolli dove è convenzione). */
export const PITCH_DISPLAY = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B',
] as const;

/** classe di altezza (0 = C) → codice Camelot, per modo. */
const MAJOR_CAMELOT = [
  '8B', '3B', '10B', '5B', '12B', '7B', '2B', '9B', '4B', '11B', '6B', '1B',
];
const MINOR_CAMELOT = [
  '5A', '12A', '7A', '2A', '9A', '4A', '11A', '6A', '1A', '8A', '3A', '10A',
];

export type Scale = 'Major' | 'Minor';

/** Normalizza una nota scritta in qualunque enarmonia nella sua classe di altezza. */
export function pitchClassOf(note: string): number | null {
  const map: Record<string, number> = {
    C: 0, 'B#': 0,
    'C#': 1, Db: 1,
    D: 2,
    'D#': 3, Eb: 3,
    E: 4, Fb: 4,
    F: 5, 'E#': 5,
    'F#': 6, Gb: 6,
    G: 7,
    'G#': 8, Ab: 8,
    A: 9,
    'A#': 10, Bb: 10,
    B: 11, Cb: 11,
  };
  const clean = note.trim().replace(/^([a-g])/i, m => m.toUpperCase());
  const value = map[clean];
  return value === undefined ? null : value;
}

export function toCamelot(pitchClass: number, scale: Scale): string {
  const pc = ((pitchClass % 12) + 12) % 12;
  return scale === 'Major' ? MAJOR_CAMELOT[pc] : MINOR_CAMELOT[pc];
}

/** Camelot a partire da una scrittura testuale, es. "F# Minor" o "Gb minor". */
export function camelotFromKeyName(keyName: string): string {
  const match = keyName.trim().match(/^([A-Ga-g][#b]?)\s*(maj|major|min|minor|m)?$/i);
  if (!match) return '';
  const pc = pitchClassOf(match[1]);
  if (pc === null) return '';
  const mode = (match[2] ?? 'major').toLowerCase();
  const scale: Scale = mode.startsWith('min') || mode === 'm' ? 'Minor' : 'Major';
  return toCamelot(pc, scale);
}

export function formatKey(pitchClass: number, scale: Scale): string {
  const pc = ((pitchClass % 12) + 12) % 12;
  return `${PITCH_DISPLAY[pc]} ${scale}`;
}
