import { resolve } from 'node:path';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  dataDir: resolve(process.env.DATA_DIR || './data'),
  webDir: process.env.WEB_DIR || '',
  get databasePath() {
    return resolve(this.dataDir, 'opds.db');
  },
  get thumbnailDir() {
    return resolve(this.dataDir, 'cache', 'thumbnails');
  },
};
