import { createApp } from './app';
import { loadEnvFile } from './config';

loadEnvFile();

const serveApp = process.argv.includes('--serve-app');
const port = Number(process.env.PORT || (serveApp ? 3000 : 3001));

createApp({ serveApp }).listen(port, () => {
  const mode = serveApp ? 'API + PWA' : 'API';
  console.log(`Chef en el Aire (${mode}) en http://localhost:${port}`);
});
