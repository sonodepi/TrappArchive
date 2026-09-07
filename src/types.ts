export interface Track {
  id: string;
  title: string;
  producer: string;
  mainArtist: string;
  featurings: string[];
  lyrics: string;
  audioFilePath: string;
  durationMs: number; // For sorting by duration
  createdAt: number; // For sorting by date
}

export interface Album {
  id: string;
  title: string;
  coverArt: string;
  year: number;
  genre: string;
  trackIds: string[]; // Relational link to tracks
  createdAt: number;
}

export interface DraftProject {
  id: string;
  title: string;
  lyrics: string;
  ownerLyrics?: string;
  collaboratorLyrics?: string;
  isCoopMode?: boolean;
  ownerReady?: boolean;
  collabReady?: boolean;
  beatUrl: string;
  shareCode: string;
  updatedAt: number;
}

