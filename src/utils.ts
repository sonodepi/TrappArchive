export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  // Ancorato all'inizio dell'indirizzo: senza, `https://altrosito.it/youtu.be/ID`
  // veniva scambiato per un video di YouTube e l'app mostrava il player
  // sbagliato al posto di dire che quel link non si puo' riprodurre.
  const match = url.match(
    /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?/]+)/,
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
