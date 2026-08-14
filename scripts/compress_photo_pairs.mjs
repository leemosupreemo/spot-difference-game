import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(filePath));
    } else if (/\.(jpe?g|png)$/i.test(file)) {
      results.push(filePath);
    }
  });
  return results;
}

const targetDir = './public/levels/photo-pairs';
if (fs.existsSync(targetDir)) {
  const files = getFiles(targetDir);
  console.log(`Starting compression for ${files.length} photo pair images...`);
  
  let count = 0;
  for (const filePath of files) {
    try {
      execSync(`sips -Z 640 -s format jpeg -s formatOptions 55 "${filePath}" --out "${filePath}"`, { stdio: 'ignore' });
      count++;
      if (count % 50 === 0) {
        console.log(`Compressed ${count}/${files.length} images...`);
      }
    } catch (e) {
      console.warn(`Failed to compress ${filePath}:`, e.message);
    }
  }
  console.log(`Successfully compressed all ${count} images!`);
}
