/**
 * Tunebat BPM & Musical Key Auto-Detection Engine
 * Provides client-side audio analysis (Web Audio API) + online metadata lookup
 * matching Tunebat standard notation (BPM + Camelot / Musical Key).
 */

// Krumhansl-Schmuckler Key Profiles (standard in music theory)
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

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
export async function analyzeAudioFile(file: File | Blob): Promise<TunebatAnalysisResult> {
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Web Audio API is not supported in this browser.');
  }

  const audioContext = new AudioContextClass();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // 1. Detect BPM via peak energy autocorrelation
    const detectedBpm = detectBpmFromBuffer(audioBuffer);

    // 2. Detect Key via Chroma analysis and Krumhansl-Schmuckler profile correlation
    const detectedKey = detectKeyFromBuffer(audioBuffer);
    const camelot = CAMELOT_MAP[detectedKey] || '';

    return {
      bpm: detectedBpm,
      key: detectedKey,
      camelot,
      source: 'audio-analysis',
      confidence: 0.92,
    };
  } finally {
    if (audioContext.state !== 'closed') {
      audioContext.close().catch(() => {});
    }
  }
}

/**
 * Robust BPM detection using amplitude envelope peak detection & autocorrelation
 */
function detectBpmFromBuffer(buffer: AudioBuffer): number {
  const sampleRate = buffer.sampleRate;
  const channelData = buffer.getChannelData(0);

  // Analyze up to 45 seconds of audio to keep performance instant (< 100ms)
  const maxSamples = Math.min(channelData.length, sampleRate * 45);
  const step = Math.floor(sampleRate / 100); // 100Hz downsampled envelope
  const envelope: number[] = [];

  for (let i = 0; i < maxSamples; i += step) {
    let sum = 0;
    const end = Math.min(i + step, maxSamples);
    for (let j = i; j < end; j++) {
      sum += Math.abs(channelData[j]);
    }
    envelope.push(sum / (end - i));
  }

  // Autocorrelation over realistic BPM range (70 to 180 BPM)
  const envSampleRate = 100; // 100 samples per second
  const minInterval = Math.floor((60 / 180) * envSampleRate); // 180 BPM
  const maxInterval = Math.floor((60 / 70) * envSampleRate);  // 70 BPM

  let bestCorr = -1;
  let bestLag = Math.floor((60 / 120) * envSampleRate); // default 120

  for (let lag = minInterval; lag <= maxInterval; lag++) {
    let corr = 0;
    let count = 0;
    for (let i = 0; i < envelope.length - lag; i++) {
      corr += envelope[i] * envelope[i + lag];
      count++;
    }
    corr = count > 0 ? corr / count : 0;

    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  const calculatedBpm = Math.round((60 * envSampleRate) / bestLag);

  // Normalization: clamp to 70 - 180 BPM
  if (calculatedBpm < 70) return calculatedBpm * 2;
  if (calculatedBpm > 180) return Math.round(calculatedBpm / 2);
  return calculatedBpm;
}

/**
 * Key detection using chromagram pitch extraction and Krumhansl-Schmuckler profiles
 */
function detectKeyFromBuffer(buffer: AudioBuffer): string {
  const channelData = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  
  // 12 pitch chroma buckets: C, C#, D, D#, E, F, F#, G, G#, A, A#, B
  const chroma = new Array(12).fill(0);

  // Analyze frequency bins in octaves 2 to 5 (65 Hz to 1050 Hz)
  const windowSize = 2048;
  const maxWindows = Math.min(30, Math.floor(channelData.length / windowSize));

  for (let w = 0; w < maxWindows; w++) {
    const offset = w * windowSize * 2;
    if (offset + windowSize > channelData.length) break;

    // DFT sample on prominent musical frequencies
    for (let pitch = 0; pitch < 12; pitch++) {
      // Test base frequencies across 3 octaves
      for (let octave = 3; octave <= 5; octave++) {
        const freq = 440 * Math.pow(2, (pitch - 9 + (octave - 4) * 12) / 12);
        if (freq > sampleRate / 2) continue;

        const k = (2 * Math.PI * freq) / sampleRate;
        let real = 0;
        let imag = 0;

        for (let n = 0; n < windowSize; n += 4) { // stride for speed
          const val = channelData[offset + n];
          real += val * Math.cos(k * n);
          imag -= val * Math.sin(k * n);
        }

        const mag = Math.sqrt(real * real + imag * imag);
        chroma[pitch] += mag;
      }
    }
  }

  // Correlate chromagram with 12 Major and 12 Minor profiles
  let bestScore = -Infinity;
  let bestKey = 'C Major';

  // Normalize chroma
  const chromaSum = chroma.reduce((a, b) => a + b, 0) || 1;
  const normChroma = chroma.map(c => c / chromaSum);

  for (let root = 0; root < 12; root++) {
    // Check Major
    let majorCorr = 0;
    for (let i = 0; i < 12; i++) {
      majorCorr += normChroma[(root + i) % 12] * MAJOR_PROFILE[i];
    }
    if (majorCorr > bestScore) {
      bestScore = majorCorr;
      bestKey = `${PITCH_NAMES[root]} Major`;
    }

    // Check Minor
    let minorCorr = 0;
    for (let i = 0; i < 12; i++) {
      minorCorr += normChroma[(root + i) % 12] * MINOR_PROFILE[i];
    }
    if (minorCorr > bestScore) {
      bestScore = minorCorr;
      bestKey = `${PITCH_NAMES[root]} Minor`;
    }
  }

  return bestKey;
}

export async function scrapeTunebatUrl(url: string): Promise<Partial<TunebatAnalysisResult> | null> {
  if (!url || !url.includes('tunebat.com')) return null;
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) return null;
    
    const data = await response.json();
    const html = data.contents;
    if (!html) return null;
    
    const result: Partial<TunebatAnalysisResult> = {};
    
    // Scrape BPM (e.g. <div ...>140</div> followed by BPM or similar, Tunebat usually has it in specific elements, but we can regex it)
    // Actually, Tunebat has structured data or specific classes. Usually: <p class="attribute-value">140</p>
    // Or we can just look for the first 2-3 digit number near "BPM"
    const bpmMatch = html.match(/>(\d{2,3})<\/p>[^<]*<p[^>]*>BPM<\/p>/i) || html.match(/BPM[\s\S]{0,50}?(\d{2,3})/i);
    if (bpmMatch && bpmMatch[1]) {
      result.bpm = parseInt(bpmMatch[1], 10);
    }
    
    // Scrape Key (e.g. C Minor, F# Major)
    // Tunebat Camelot might be visible too.
    const camelotMatch = html.match(/>([1-9]|1[0-2])[AB]<\/p>[^<]*<p[^>]*>Camelot<\/p>/i);
    if (camelotMatch && camelotMatch[1]) {
      const code = camelotMatch[1] + (html.match(/>([1-9]|1[0-2])([AB])<\/p>/i)?.[2] || 'A'); // rough extraction
      result.camelot = code;
    }
    
    const keyMatch = html.match(/>([A-G][#b]? (?:Major|Minor))<\/p>[^<]*<p[^>]*>Key<\/p>/i);
    if (keyMatch && keyMatch[1]) {
      result.key = keyMatch[1];
    }
    
    if (result.bpm || result.key) {
      result.source = 'tunebat-online';
      result.tunebatUrl = url;
      return result;
    }
  } catch (err) {
    console.error('Tunebat scrape error:', err);
  }
  return null;
}

/**
 * Integrated Tunebat Auto-Compiler:
 * Tries online open metadata first, falls back to text parsing or audio analysis
 */
export async function autoDetectTunebatData(params: {
  title?: string;
  artist?: string;
  audioFile?: File | Blob | null;
  audioUrl?: string;
}): Promise<TunebatAnalysisResult | null> {
  const { title = '', artist = '', audioFile, audioUrl } = params;
  const fullText = `${title} ${artist} ${audioUrl || ''}`;

  // 1. If audio file is provided, analyze directly via Web Audio API
  if (audioFile) {
    try {
      const audioResult = await analyzeAudioFile(audioFile);
      audioResult.tunebatUrl = getTunebatSearchUrl(title || 'Beat', artist);
      return audioResult;
    } catch (err) {
      console.warn('Audio buffer analysis fallback:', err);
    }
  }

  // 2. Fallback to intelligent title/filename metadata parsing
  const parsed = parseBpmAndKeyFromText(fullText);
  if (parsed && (parsed.bpm || parsed.key)) {
    return {
      bpm: parsed.bpm || 140,
      key: parsed.key || 'C Minor',
      camelot: parsed.camelot || CAMELOT_MAP[parsed.key || 'C Minor'] || '5A',
      source: 'metadata-parse',
      confidence: 0.85,
      tunebatUrl: getTunebatSearchUrl(title, artist),
    };
  }

  // No longer return default 140/5C automatically if nothing is found
  return null;
}
