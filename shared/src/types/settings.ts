export interface AppSettings {
  serverPort: number;
  authEnabled: boolean;
  authUsername: string;
  authPassword: string;
  paginationSize: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
  thumbnailQuality: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  serverPort: 3000,
  authEnabled: false,
  authUsername: '',
  authPassword: '',
  paginationSize: 20,
  thumbnailWidth: 300,
  thumbnailHeight: 450,
  thumbnailQuality: 80,
};
