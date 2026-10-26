const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const logger = require('../observability/logger');

async function syncToGitHub(dataDir) {
  const env = {};
  const envPath = path.join(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const idx = line.indexOf('=');
      if (idx > 0) env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
    });
  }
  const token = env.GITHUB_TOKEN;
  const repo = env.DATA_REPO;
  const user = env.GITHUB_USER;
  if (!token || !repo) throw new Error('GitHub not configured. Set GITHUB_TOKEN and DATA_REPO in Settings.');
  const repoWithAuth = repo.replace('https://', `https://${token}@`);
  const syncDir = path.join(dataDir, 'github-sync');
  if (!fs.existsSync(syncDir)) fs.mkdirSync(syncDir, { recursive: true });
  logger.info('Starting GitHub sync...', { category: 'github' });
  try {
    // Clone or pull
    if (!fs.existsSync(path.join(syncDir, '.git'))) {
      execSync(`git clone ${repoWithAuth} .`, { cwd: syncDir, stdio: 'pipe' });
    } else {
      execSync('git pull', { cwd: syncDir, stdio: 'pipe' });
    }
    // Copy projects to sync dir
    const projectsDir = path.join(dataDir, 'projects');
    if (fs.existsSync(projectsDir)) {
      const dest = path.join(syncDir, 'projects');
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      copyDir(projectsDir, dest);
    }
    // Commit and push
    execSync('git add -A', { cwd: syncDir, stdio: 'pipe' });
    try {
      execSync(`git commit -m "DeliverAI v2 sync ${new Date().toISOString()}"`, { cwd: syncDir, stdio: 'pipe' });
      execSync('git push', { cwd: syncDir, stdio: 'pipe' });
      logger.info('GitHub sync complete', { category: 'github' });
      return { success: true, message: 'Synced to GitHub successfully' };
    } catch(e) {
      if (e.message.includes('nothing to commit')) {
        return { success: true, message: 'Nothing to sync - already up to date' };
      }
      throw e;
    }
  } catch(e) {
    logger.error(`GitHub sync failed: ${e.message}`, { category: 'github' });
    throw e;
  }
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const item of fs.readdirSync(src)) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    if (fs.statSync(srcPath).isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

module.exports = { syncToGitHub };