import { app, BrowserWindow, dialog, ipcMain, net, protocol } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'novel-asset',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
]);

const previewProjects = new Map<number, unknown>();

function assetUrl(filePath: string): string {
  return `novel-asset://local/${encodeURI(filePath.replace(/\\/g, '/'))}`;
}

function fromAssetUrl(src: string): string | null {
  if (!src.startsWith('novel-asset://local/')) return null;
  return decodeURIComponent(src.slice('novel-asset://local/'.length));
}

function rewriteIn(dir: string, project: Record<string, unknown>, toPortable: boolean): void {
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const record = value as Record<string, unknown>;
    if (typeof record.src === 'string') {
      if (toPortable) {
        const abs = fromAssetUrl(record.src);
        if (abs) record.src = path.relative(dir, abs).replace(/\\/g, '/');
      } else if (!/^(https?:|blob:|data:|novel-asset:|\/)/.test(record.src)) {
        record.src = assetUrl(path.join(dir, record.src));
      }
    }
    Object.values(record).forEach(visit);
  };
  visit(project);
}

function settingsFile(): string {
  return path.join(app.getPath('userData'), 'novel-studio-settings.json');
}

function savesFile(): string {
  return path.join(app.getPath('userData'), 'novel-studio-saves.json');
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  } catch {
    return null;
  }
}

function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function gameDirectory(): string | null {
  const dir = path.join(process.resourcesPath, 'game');
  return fs.existsSync(path.join(dir, 'project.json')) ? dir : null;
}

function readBundledProject(): Record<string, unknown> | null {
  const dir = gameDirectory();
  if (!dir) return null;
  const project = JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8')) as Record<string, unknown>;
  if (!project.script && typeof project.scriptFile === 'string') {
    project.script = fs.readFileSync(path.join(dir, project.scriptFile), 'utf8');
  }
  rewriteIn(dir, project, false);
  return project;
}

function contentType(file: string): string {
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.frag': 'text/plain; charset=utf-8',
    '.glsl': 'text/plain; charset=utf-8',
  };
  return types[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

function webPreferences() {
  return {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  };
}

function loadApp(win: BrowserWindow, query = ''): void {
  if (!app.isPackaged) {
    void win.loadURL(`http://localhost:5173/${query}`);
    return;
  }
  void win.loadURL(`app://bundle/index.html${query}`);
}

function createWindow(player: boolean): void {
  const win = new BrowserWindow({
    width: player ? 1280 : 1440,
    height: player ? 800 : 900,
    minWidth: player ? 960 : 1100,
    minHeight: 640,
    title: player ? 'ノベル' : 'ノベルスタジオ',
    backgroundColor: '#16130f',
    autoHideMenuBar: player,
    webPreferences: webPreferences(),
  });
  loadApp(win, player ? '?player=1' : '');
}

function projectTitle(project: unknown): string {
  if (project && typeof project === 'object' && 'name' in project && typeof project.name === 'string') return project.name;
  return 'プレビュー';
}

function exportScript(): string {
  return path.join(app.getAppPath(), 'scripts', 'export-installer.mjs');
}

function runExport(dir: string | null, project: unknown, outDir: string): Promise<string> {
  const script = exportScript();
  if (!fs.existsSync(script)) {
    return Promise.reject(new Error('インストーラ作成は、このプロジェクトの Windows アプリから実行できます。'));
  }
  const folder = path.join(app.getAppPath(), 'build');
  fs.mkdirSync(folder, { recursive: true });
  const request = path.join(folder, 'export-request.json');
  fs.writeFileSync(request, JSON.stringify({ dir, project, outDir }), 'utf8');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, request], {
      cwd: app.getAppPath(),
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
      windowsHide: true,
    });
    let log = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      log += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      log += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      const marked = log.split('\n').map((line) => line.trim()).find((line) => line.startsWith('EXPORT_EXE='));
      if (code !== 0 || !marked) {
        reject(new Error(log.trim().slice(-1800) || `インストーラの作成に失敗しました (${code})`));
        return;
      }
      resolve(marked.slice('EXPORT_EXE='.length));
    });
  });
}

app.whenReady().then(() => {
  protocol.handle('novel-asset', (request) => {
    const pathname = decodeURIComponent(new URL(request.url).pathname).replace(/^\//, '');
    return net.fetch(pathToFileURL(pathname).toString());
  });
  protocol.handle('app', (request) => {
    const distRoot = path.resolve(__dirname, '../dist');
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    const file = path.resolve(distRoot, rel);
    if (file !== distRoot && !file.startsWith(`${distRoot}${path.sep}`)) {
      return new Response('forbidden', { status: 403 });
    }
    try {
      const body = fs.readFileSync(file);
      return new Response(body, { headers: { 'content-type': contentType(file) } });
    } catch {
      return new Response('not found', { status: 404 });
    }
  });

  ipcMain.handle('settings:read', () => readJson(settingsFile()));
  ipcMain.handle('settings:write', (_event, data: unknown) => writeJson(settingsFile(), data));
  ipcMain.handle('saves:read', () => readJson(savesFile()));
  ipcMain.handle('saves:write', (_event, data: unknown) => writeJson(savesFile(), data));
  ipcMain.handle('window:fullscreen', (event, on: boolean) => {
    BrowserWindow.fromWebContents(event.sender)?.setFullScreen(on);
  });
  ipcMain.handle('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
  ipcMain.handle('project:open', async () => {
    const picked = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Project', extensions: ['json'] }],
    });
    if (picked.canceled || !picked.filePaths[0]) return null;
    const file = picked.filePaths[0];
    const dir = path.dirname(file);
    const project = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
    if (!project.script && typeof project.scriptFile === 'string') {
      project.script = fs.readFileSync(path.join(dir, project.scriptFile), 'utf8');
    }
    rewriteIn(dir, project, false);
    return { dir, project };
  });
  ipcMain.handle('project:save', async (_event, dir: string | null, project: Record<string, unknown>) => {
    let folder = dir;
    if (!folder) {
      const picked = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
      if (picked.canceled || !picked.filePaths[0]) return null;
      folder = picked.filePaths[0];
    }
    const copy = structuredClone(project);
    rewriteIn(folder, copy, true);
    const script = typeof copy.script === 'string' ? copy.script : '';
    fs.writeFileSync(path.join(folder, 'script.txt'), script, 'utf8');
    copy.scriptFile = 'script.txt';
    delete copy.script;
    fs.writeFileSync(path.join(folder, 'project.json'), JSON.stringify(copy, null, 2), 'utf8');
    return folder;
  });
  ipcMain.handle('asset:import', (_event, dir: string, sub: string, name: string, bytes: Uint8Array) => {
    const folder = path.join(dir, sub);
    fs.mkdirSync(folder, { recursive: true });
    const dest = path.join(folder, path.basename(name));
    fs.writeFileSync(dest, Buffer.from(bytes));
    return assetUrl(dest);
  });
  ipcMain.handle('player:bundled', () => readBundledProject());
  ipcMain.handle('preview:project', (event) => previewProjects.get(event.sender.id) ?? null);
  ipcMain.handle('preview:open', async (event, project: unknown) => {
    const win = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 960,
      minHeight: 640,
      title: projectTitle(project),
      backgroundColor: '#16130f',
      autoHideMenuBar: true,
      webPreferences: webPreferences(),
    });
    previewProjects.set(win.webContents.id, project);
    win.on('closed', () => previewProjects.delete(win.webContents.id));
    loadApp(win, '?player=1');
    return true;
  });
  ipcMain.handle('game:canExport', () => fs.existsSync(exportScript()));
  ipcMain.handle('game:export', async (_event, dir: string | null, project: unknown) => {
    const picked = await dialog.showOpenDialog({
      title: 'インストーラの保存先',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: 'ここに作成',
    });
    if (picked.canceled || !picked.filePaths[0]) return null;
    const exe = await runExport(dir, project, picked.filePaths[0]);
    await dialog.showMessageBox({ type: 'info', message: 'インストーラを作成しました', detail: exe });
    return exe;
  });

  createWindow(Boolean(gameDirectory()));
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
