/**
 * Tunebat BPM & Musical Key Auto-Detection Engine
 * Provides client-side audio analysis (Web Audio API) + online metadata lookup
 * matching Tunebat standard notation (BPM + Camelot / Musical Key).
 */

// Krumhansl-Schmuckler Key Profiles (standard in music theory)


// Camelot wheel mapping for DJ/Producer compatibility (Tunebat standard)
const CAMELOT_MAP: Record<string, string> = {
  'Ab Minor': '1A', 'B Major': '1B',
  'Eb Minor': '2A', 'F# Major': '2B',
  'Bb Minor': '3A', 'Db Major': '3B',
  'F Minor': '4A', 'Ab Major': '4B',
  'C Minor': '5A', 'Eb Major': '5B',
  'G Minor': '6A', 'Bb Major': '6B',
  'D Minor': '7A', 'F Major': '7B',
  'A Minor': '8A', 'C Major': '8B',
  'E Minor': '9A', 'G Major': '9B',
  'B Minor': '10A', 'D Major': '10B',
  'F# Minor': '11A', 'A Major': '11B',
  'C# Minor': '12A', 'E Major': '12B',
  // Enharmonic aliases
  'G# Minor': '1A',
  'D# Minor': '2A', 'Gb Major': '2B',
  'A# Minor': '3A', 'C# Major': '3B',
};

export interface TunebatAnalysisResult {
  bpm: number;
  key: string;
  camelot?: string;
  source: 'tunebat-online' | 'audio-analysis' | 'metadata-parse';
  confidence: number;
  tunebatUrl?: string;
}

/**
 * Generate a direct link to Tunebat search for a given song or beat
 */
export function getTunebatSearchUrl(title: string, artist?: string): string {
  const query = [title, artist].filter(Boolean).join(' ');
  return `https://tunebat.com/Search?q=${encodeURIComponent(query.trim())}`;
}

/**
 * Extract BPM and Key from track title or beat filename if present
 * E.g. "Drake Type Beat 140 BPM C# Min" or "Sample_128bpm_Am.wav"
 */
export function parseBpmAndKeyFromText(text: string): Partial<TunebatAnalysisResult> | null {
  if (!text) return null;
  const result: Partial<TunebatAnalysisResult> = {};

  // BPM regex: e.g. "140 bpm", "140bpm", "tempo 140", "bpm: 140"
  const bpmMatch = text.match(/(?:bpm|tempo|速度)[\s:_=-]*(\d{2,3})|(\d{2,3})[\s_-]*bpm/i);
  if (bpmMatch) {
    const bpmVal = parseInt(bpmMatch[1] || bpmMatch[2], 10);
    if (bpmVal >= 50 && bpmVal <= 220) {
      result.bpm = bpmVal;
    }
  }

  // Key regex: e.g. "C# min", "F minor", "G#m", "D maj", "8A", "11B"
  const camelotMatch = text.match(/\b(1[0-2]|[1-9])([AB])\b/i);
  if (camelotMatch) {
    const code = camelotMatch[0].toUpperCase();
    result.camelot = code;
    // reverse lookup camelot
    for (const [k, c] of Object.entries(CAMELOT_MAP)) {
      if (c === code) {
        result.key = k;
        break;
      }
    }
  } else {
    const keyMatch = text.match(/\b([A-G][#b]?)\s*(major|minor|maj|min|m)\b/i);
    if (keyMatch) {
      const root = keyMatch[1].toUpperCase();
      const type = keyMatch[2].toLowerCase();
      const isMinor = type.startsWith('min') || type === 'm';
      const formattedKey = `${root} ${isMinor ? 'Minor' : 'Major'}`;
      result.key = formattedKey;
      result.camelot = CAMELOT_MAP[formattedKey];
    }
  }

  if (result.bpm || result.key) {
    result.source = 'metadata-parse';
    result.confidence = 0.85;
    return result;
  }
  return null;
}

/**
 * Auto-detect BPM and Key from an audio File or Blob using Web Audio API
 */
/*
 * Il rilevamento di BPM e tonalita’ che stava qui e’ stato rimosso: era
 * basato su un’autocorrelazione senza rimozione della continua, non
 * disambiguava l’ottava e confrontava i profili con un prodotto scalare,
 * restituendo una confidenza fissa di 0.92 indipendente dal risultato.
 * Il motore corretto, con i suoi test, e’ in src/audio/.
 */

/*
 * `scrapeTunebatUrl` e' stato rimosso.
 *
 * Scaricava l'HTML di una pagina Tunebat attraverso api.allorigins.win, un
 * proxy pubblico di terze parti, e cercava BPM e tonalita' con espressioni
 * regolari. Non poteva funzionare: Tunebat costruisce quei valori con
 * JavaScript dopo che la pagina e' stata caricata, quindi l'HTML grezzo e' un
 * guscio senza dati. In piu' faceva transitare da un operatore esterno il
 * brano che l'utente stava cercando.
 *
 * Al suo posto: l'analisi locale in src/audio/, che misura davvero il file e
 * non manda niente a nessuno, piu' `getTunebatSearchUrl` qui sotto per aprire
 * la pagina vera e leggere i valori a mano.
 */

export async function autoDetectTunebatData(params: {
  title?: string;
  artist?: string;
  audioUrl?: string;
}): Promise<TunebatAnalysisResult | null> {
  const { title = '', artist = '', audioUrl } = params;
  const fullText = `${title} ${artist} ${audioUrl || ''}`;

  // Per analizzare davvero un file si usa analyzeAudio() in src/audio/.
  // Qui si legge solo cio' che e' scritto nel titolo o nell'indirizzo.
  const parsed = parseBpmAndKeyFromText(fullText);
  if (parsed && (parsed.bpm || parsed.key)) {
    return {
      bpm: parsed.bpm || 140,
      key: parsed.key || 'C Minor',
      camelot: parsed.camelot || CAMELOT_MAP[parsed.key || 'C Minor'] || '5A',
      source: 'metadata-parse',
      // Letto dal titolo, non misurato: e' un indizio, non una stima.
      confidence: 0,
      tunebatUrl: getTunebatSearchUrl(title, artist),
    };
  }

  // No longer return default 140/5C automatically if nothing is found
  return null;
}
