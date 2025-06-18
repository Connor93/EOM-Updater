const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const AdmZip = require('adm-zip');

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function syncViaZip(localDir, onProgress, onPercent) {
  const targetDir = localDir;
  onProgress(`Operating from base folder: ${targetDir}`);

  const configDir = path.join(targetDir, 'config');
  const versionFile = path.join(configDir, 'version.json');

  await fs.ensureDir(configDir);

  if (!fs.existsSync(versionFile)) {
    await fs.writeJson(versionFile, { version: '1.0.0' }, { spaces: 2 });
  }

  let currentVersion = (await fs.readJson(versionFile)).version;

  while (true) {
    onProgress(`Checking for updates (current version: ${currentVersion})...`);
    const versionCheckUrl = `https://endless-memories.net/patch.php?version=${currentVersion}`;

    let res;
    try {
      res = await axios.get(versionCheckUrl);
    } catch (err) {
      onProgress('Failed to contact update server: ' + err.message);
      return 'Update check failed. Please try again later.';
    }

    const { updateUrl, nextversion } = res.data;

    if (!updateUrl) {
      onProgress('No update required. You are using the latest version.');
      return 'No update needed. Version is up to date.';
    }

    if (!nextversion) {
      throw new Error('Invalid response from update server: missing next version.');
    }

    const zipPath = path.join(targetDir, 'update_temp.zip');

    let response;
    try {
      response = await axios({
        method: 'GET',
        url: updateUrl,
        responseType: 'stream'
      });
    } catch (err) {
      onProgress('Failed to download update: ' + err.message);
      return 'Update download failed. Please try again later.';
    }

    onProgress(`Downloading update (${nextversion})...`);

    const totalSize = Number(response.headers['content-length'] || 0);
    let downloaded = 0;
    const writer = fs.createWriteStream(zipPath);

    response.data.on('data', (chunk) => {
      downloaded += chunk.length;
      if (totalSize > 0 && onPercent) {
        const percent = Math.round((downloaded / totalSize) * 100);
        onPercent(percent);
      }
    });

    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    onProgress('Download complete. Extracting...');

    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();

    const replacedFiles = [];
    zipEntries.forEach(entry => {
      if (entry.isDirectory) return;

      if (entry.entryName.startsWith('resources/') || entry.entryName.includes('app.asar')) {
        return; // skip system/internal files
      }

      const fullPath = path.join(targetDir, entry.entryName);
      fs.ensureDirSync(path.dirname(fullPath));
      const newContent = entry.getData();

      let replace = true;
      if (fs.existsSync(fullPath)) {
        const existingContent = fs.readFileSync(fullPath);
        if (hashBuffer(existingContent) === hashBuffer(newContent)) {
          replace = false;
        }
      }

      if (replace) {
        fs.writeFileSync(fullPath, newContent);
        replacedFiles.push(entry.entryName);
      }
    });

    await fs.remove(zipPath);
    await fs.writeJson(versionFile, { version: nextversion }, { spaces: 2 });

    replacedFiles.forEach(f => onProgress(`Replaced: ${f}`));

    onProgress(`Update to version ${nextversion} complete. Continuing check...`);

    currentVersion = nextversion;
  }
}

module.exports = { syncViaZip };