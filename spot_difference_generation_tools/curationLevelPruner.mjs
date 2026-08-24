import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, '..');

/**
 * Permanently delete level image assets from disk and remove entries from photo_pair_manifest.json
 * @param {string[]} levelIds - Array of level IDs to delete
 * @param {object} options - Options including projectRoot
 * @returns {object} Summary of deleted files and manifests updated
 */
export function deleteLevelAssetsAndManifestEntries(levelIds = [], options = {}) {
  const projectRoot = options.projectRoot || DEFAULT_PROJECT_ROOT;
  const idSet = new Set(levelIds);

  if (!idSet.size) {
    return {
      success: true,
      deletedLevelIds: [],
      deletedFiles: [],
      deletedDirs: [],
      manifestUpdates: []
    };
  }

  const manifestPath = path.join(projectRoot, 'public/levels/photo_pair_manifest.json');
  let mainManifest = [];
  try {
    if (fs.existsSync(manifestPath)) {
      mainManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    }
  } catch (err) {
    console.error(`[deleteLevelAssets] Failed to read main manifest:`, err);
  }

  const deletedFiles = [];
  const deletedDirs = [];
  const matchedLevelIds = new Set();

  // Find entries to retain vs delete in main manifest
  const retainedEntries = mainManifest.filter(entry => !idSet.has(entry.id));
  const entriesToDelete = mainManifest.filter(entry => idSet.has(entry.id));
  entriesToDelete.forEach(entry => matchedLevelIds.add(entry.id));
  idSet.forEach(id => matchedLevelIds.add(id));

  // Build a set of normalized asset paths still in use by retained levels
  const normalizeRel = (relPath) => (relPath ? relPath.replace(/^\/+/, '') : null);
  const inUseAssetPaths = new Set();
  retainedEntries.forEach(entry => {
    if (entry.baseImage) inUseAssetPaths.add(normalizeRel(entry.baseImage));
    if (entry.variantImage) inUseAssetPaths.add(normalizeRel(entry.variantImage));
  });

  // Helper to remove asset safely if not in use by other retained levels
  const removeAssetFile = (relPath) => {
    const cleanRel = normalizeRel(relPath);
    if (!cleanRel || inUseAssetPaths.has(cleanRel)) return; // Do not delete shared assets!

    const absPath = path.join(projectRoot, 'public', cleanRel);
    if (fs.existsSync(absPath)) {
      try {
        fs.unlinkSync(absPath);
        deletedFiles.push(absPath);

        // Attempt to clean up parent directory if it only contains deleted files
        const parentDir = path.dirname(absPath);
        if (fs.existsSync(parentDir)) {
          const filesLeft = fs.readdirSync(parentDir).filter(f => f !== '.DS_Store');
          if (filesLeft.length === 0) {
            fs.rmSync(parentDir, { recursive: true, force: true });
            deletedDirs.push(parentDir);
          }
        }
      } catch (err) {
        console.warn(`[deleteLevelAssets] Could not delete ${absPath}:`, err.message);
      }
    }
  };

  // Delete image assets referenced in entries to delete (if not shared)
  entriesToDelete.forEach(entry => {
    if (entry.baseImage) removeAssetFile(entry.baseImage);
    if (entry.variantImage) removeAssetFile(entry.variantImage);
  });

  // Check standard photo-pairs directory for any orphan folders matching level IDs
  const photoPairsBase = path.join(projectRoot, 'public/levels/photo-pairs');
  if (fs.existsSync(photoPairsBase)) {
    try {
      const subCategories = fs.readdirSync(photoPairsBase);
      for (const cat of subCategories) {
        const catDir = path.join(photoPairsBase, cat);
        if (fs.statSync(catDir).isDirectory()) {
          for (const id of idSet) {
            const levelDir = path.join(catDir, id);
            if (fs.existsSync(levelDir)) {
              // Only delete if none of the files inside are in use
              const filesInDir = fs.readdirSync(levelDir);
              const anyInUse = filesInDir.some(f => {
                const rel = path.relative(path.join(projectRoot, 'public'), path.join(levelDir, f));
                return inUseAssetPaths.has(rel);
              });
              if (!anyInUse) {
                try {
                  fs.rmSync(levelDir, { recursive: true, force: true });
                  deletedDirs.push(levelDir);
                } catch (err) {
                  console.warn(`[deleteLevelAssets] Could not remove directory ${levelDir}:`, err.message);
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[deleteLevelAssets] Error searching photoPairsBase:', e.message);
    }
  }

  // Update manifests in public/levels/
  const manifestUpdates = [];
  const levelManifestFiles = [
    'photo_pair_manifest.json',
    'curated_photo_levels.json',
    'frequency_ssim_manifest.json',
    'generated_level_pack.json',
    'generated_levels.json',
    'pipeline_manifest.json'
  ];

  for (const manifestFileName of levelManifestFiles) {
    const filePath = path.join(projectRoot, 'public/levels', manifestFileName);
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (Array.isArray(data)) {
          const originalCount = data.length;
          const filtered = data.filter(item => !idSet.has(item.id));
          if (filtered.length !== originalCount) {
            fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2) + '\n', 'utf8');
            manifestUpdates.push({
              file: manifestFileName,
              removed: originalCount - filtered.length,
              remaining: filtered.length
            });
          }
        }
      } catch (err) {
        console.warn(`[deleteLevelAssets] Error updating ${manifestFileName}:`, err.message);
      }
    }
  }

  return {
    success: true,
    deletedLevelIds: Array.from(matchedLevelIds),
    deletedFiles,
    deletedDirs: Array.from(new Set(deletedDirs)),
    manifestUpdates
  };
}
