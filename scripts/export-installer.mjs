import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stageGame } from './lib/stage-game.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: appRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} が終了コード ${code} で失敗しました`));
    });
  });
}

const requestPath = process.argv[2];
if (!requestPath) {
  console.error('使い方: node scripts/export-installer.mjs <request.json>');
  process.exit(1);
}

const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'));
const payloadDir = path.join(appRoot, 'build', 'game-payload');
const staged = stageGame({
  projectDir: request.dir || null,
  project: request.project,
  payloadDir,
  searchRoots: [path.join(appRoot, 'projects')],
});
const outDir = request.outDir || path.join(request.dir || appRoot, 'release');
fs.mkdirSync(outDir, { recursive: true });

const configPath = path.join(appRoot, 'build', 'electron-builder.game.json');
const config = {
  appId: `com.novelstudio.game.${staged.slug.toLowerCase()}`,
  productName: staged.productName,
  directories: { output: outDir },
  files: ['dist/**/*', 'dist-electron/**/*', 'package.json', '!node_modules/**'],
  extraResources: [{ from: 'build/game-payload', to: 'game' }],
  asar: true,
  npmRebuild: false,
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    signAndEditExecutable: false,
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    include: 'build/installer.nsh',
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: staged.productName,
    artifactName: `${staged.productName}-Setup.\${ext}`,
    unicode: true,
  },
};
fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
if (!request.skipBuild) await run(npm, ['run', 'build']);
await run(npx, ['electron-builder', '--win', 'nsis', '--x64', '--config', configPath]);

const exe = fs.readdirSync(outDir)
  .filter((name) => name.toLowerCase().endsWith('.exe') && !name.startsWith('__'))
  .map((name) => ({ name, time: fs.statSync(path.join(outDir, name)).mtimeMs }))
  .sort((a, b) => b.time - a.time)[0];
const result = exe ? path.join(outDir, exe.name) : outDir;
console.log(`EXPORT_EXE=${result}`);
