import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { deleteLevelAssetsAndManifestEntries } from './scripts/curationLevelPruner.mjs';

function curationPrunerPlugin() {
  return {
    name: 'curation-pruner-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/curation/record-decision' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const { levelId, status, meta } = JSON.parse(body || '{}');
              const fs = await import('fs');
              const path = await import('path');
              const officialPath = path.resolve('official_curated_levels.json');
              const manifestPath = path.resolve('public/levels/photo_pair_manifest.json');
              const official = JSON.parse(fs.readFileSync(officialPath, 'utf-8'));
              const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
              
              official.rawStatusMap = official.rawStatusMap || {};
              official.rawStatusMap[levelId] = { status, ...meta, updatedAt: new Date().toISOString() };
              
              const approved = new Set(official.approvedLevelIds || []);
              const dismissed = new Set(official.dismissedLevelIds || []);
              
              if (status === 'approved') {
                approved.add(levelId);
                dismissed.delete(levelId);
              } else if (status === 'dismissed') {
                dismissed.add(levelId);
                approved.delete(levelId);
              }
              
              official.approvedLevelIds = Array.from(approved);
              official.dismissedLevelIds = Array.from(dismissed);
              official.summary.approvedCount = official.approvedLevelIds.length;
              official.summary.dismissedCount = official.dismissedLevelIds.length;
              
              fs.writeFileSync(officialPath, JSON.stringify(official, null, 2));
              console.log(`\n📢 [LIVE CURATION] ${status.toUpperCase()}: ${levelId} (Approved: ${official.summary.approvedCount}, Dismissed: ${official.summary.dismissedCount})`);
              
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, levelId, status }));
            } catch (err) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }
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
