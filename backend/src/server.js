import { loadBackendEnvironment } from './config/load-environment.js';

loadBackendEnvironment();

const { default: app } = await import('./app.js');
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`RecruiHub Backend running at http://localhost:${PORT}`);
});
