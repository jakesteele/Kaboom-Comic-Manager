export interface WatchDirectory {
  id: number;
  path: string;
  enabled: boolean;
  lastScanAt: Date | null;
  fileCount: number;
  createdAt: Date;
}

export interface ScanLog {
  id: number;
  watchDirId: number;
  startedAt: Date;
  completedAt: Date | null;
  filesFound: number;
  filesAdded: number;
  filesRemoved: number;
  filesUpdated: number;
  status: 'running' | 'completed' | 'failed';
  errorMessage: string | null;
}

export interface ScanStatus {
  isScanning: boolean;
  currentDirectory: string | null;
  progress: number;
  filesProcessed: number;
  filesTotal: number;
}
