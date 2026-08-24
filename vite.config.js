import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { deleteLevelAssetsAndManifestEntries } from './scripts/curationLevelPruner.mjs';

function curationPrunerPlugin() {
  return {
    name: 'curation-pruner-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/curation/prune-dismissed' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body || '{}');
              const levelIds = data.levelIds || [];
              const result = deleteLevelAssetsAndManifestEntries(levelIds);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify(result));
            } catch (err) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }
        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), curationPrunerPlugin()],
  server: {
    allowedHosts: true,
  },
});
