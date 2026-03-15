export interface Series {
  id: number;
  name: string;
  nameNormalized: string;
  sortTitle: string;
  thumbnailPath: string | null;
  createdAt: Date;
  updatedAt: Date;
  seasons?: Season[];
  volumeCount?: number;
  seasonCount?: number;
}

export interface Season {
  id: number;
  seriesId: number;
  name: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  volumes?: Volume[];
}

export interface Volume {
  id: number;
  seasonId: number;
  filePath: string;
  fileName: string;
  displayName: string;
  volumeNumber: number | null;
  year: number | null;
  scanGroup: string | null;
  fileSizeBytes: number;
  thumbnailPath: string | null;
  sortOrder: number;
  comicInfoParsed: boolean;
  ciTitle: string | null;
  ciSeries: string | null;
  ciNumber: string | null;
  ciVolume: number | null;
  ciYear: number | null;
  ciWriter: string | null;
  ciSummary: string | null;
  ciPageCount: number | null;
  ciLanguage: string | null;
  ciGenre: string | null;
  pageCount: number | null;
  lastScannedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
