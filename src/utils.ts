export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  // Uno spazio incollato per sbaglio davanti al link non deve bastare a farlo
  // sembrare un indirizzo diverso: si toglie prima di guardare l'ancoraggio.
  const trimmed = url.trim();
  // Ancorato all'inizio dell'indirizzo: senza, `https://altrosito.it/youtu.be/ID`
  // veniva scambiato per un video di YouTube e l'app mostrava il player
  // sbagliato al posto di dire che quel link non si puo' riprodurre.
  // Il sottodominio `music.` (YouTube Music) e il dominio `youtube-nocookie.com`
  // (usato per gli embed) portano video reali quanto `youtube.com`; `shorts/`
  // è un formato di percorso in più, non un sito diverso.
  const match = trimmed.match(
    /^(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([^&?/]+)/,
  );
  return match ? match[1] : null;
}

export function formatDuration(ms: number): string {
  if (!ms) return '--:--';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
