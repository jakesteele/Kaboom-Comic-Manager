export interface AppSettings {
  serverPort: number;
  paginationSize: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
  thumbnailQuality: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  serverPort: 3000,
  paginationSize: 20,
  thumbnailWidth: 300,
  thumbnailHeight: 450,
  thumbnailQuality: 80,
};
