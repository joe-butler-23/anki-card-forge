import { app, BrowserWindow, Menu, ipcMain, globalShortcut, safeStorage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { generateFlashcardsInMain, amendFlashcardInMain } from './gemini.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const promptsJsonPath = path.join(__dirname, '../src/prompts/topics.json');
const userDataPath = app.getPath('userData');
const promptsDir = path.join(userDataPath, 'prompts');
const customPromptsPath = path.join(promptsDir, 'prompts.json');
const backupsPath = path.join(promptsDir, 'backups');

// Secure storage for API keys
const credentialsPath = path.join(userDataPath, 'credentials.enc');
const fallbackCredentialsPath = path.join(userDataPath, 'credentials.json');
const defaultGeminiModel = 'gemini-3-pro-preview';

const normalizeTopicKey = (topic) => {
  if (!topic) return 'general';
  return topic.toLowerCase().replace(/[^a-z]/g, '');
};

const loadDefaultPrompts = () => {
  if (!fs.existsSync(promptsJsonPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(promptsJsonPath, 'utf8'));
  } catch (error) {
    console.error('Unable to read default prompts:', error);
    return {};
  }
};

const defaultPrompts = loadDefaultPrompts();

const ensureStorage = () => {
  if (!fs.existsSync(promptsDir)) {
    fs.mkdirSync(promptsDir, { recursive: true });
  }
  if (!fs.existsSync(customPromptsPath)) {
    fs.writeFileSync(customPromptsPath, JSON.stringify({}, null, 2));
  }
  if (!fs.existsSync(backupsPath)) {
    fs.mkdirSync(backupsPath, { recursive: true });
  }
};

const readCustomPrompts = () => {
  ensureStorage();
  try {
    const raw = fs.readFileSync(customPromptsPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to read custom prompts:', error);
    return {};
  }
};

const writeCustomPrompts = (data) => {
  ensureStorage();
  fs.writeFileSync(customPromptsPath, JSON.stringify(data, null, 2));
};

const getTopicBackupDir = (topic) => {
  const dir = path.join(backupsPath, normalizeTopicKey(topic));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const getEnvApiKey = () => process.env.GEMINI_API_KEY || process.env.API_KEY || null;

const readFallbackApiKey = () => {
  if (!fs.existsSync(fallbackCredentialsPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(fallbackCredentialsPath, 'utf8');
    const credentials = JSON.parse(raw);
    if (typeof credentials?.geminiApiKey !== 'string') {
      return null;
    }
    const trimmed = credentials.geminiApiKey.trim();
    return trimmed || null;
  } catch (error) {
    console.error('Failed to read fallback API key storage:', error);
    return null;
  }
};

const writeFallbackApiKey = (apiKey) => {
  fs.writeFileSync(
    fallbackCredentialsPath,
    JSON.stringify({ geminiApiKey: apiKey }, null, 2),
    { mode: 0o600 }
  );

  // Enforce user-only permissions when supported by the platform.
  try {
    fs.chmodSync(fallbackCredentialsPath, 0o600);
  } catch (error) {
    if (process.platform !== 'win32') {
      console.warn('Unable to set strict permissions on fallback credentials file:', error);
    }
  }
};

const readStoredApiKey = () => {
  if (safeStorage.isEncryptionAvailable() && fs.existsSync(credentialsPath)) {
    try {
      const encryptedData = fs.readFileSync(credentialsPath);
      const decrypted = safeStorage.decryptString(encryptedData);
      const credentials = JSON.parse(decrypted);
      return credentials.geminiApiKey || null;
    } catch (error) {
      console.error('Failed to read encrypted API key storage:', error);
    }
  }

  return readFallbackApiKey();
};

const resolveApiKey = () => getEnvApiKey() || readStoredApiKey();

const resolveModel = (model, image, useThinking) => {
  if (image || useThinking) {
    return defaultGeminiModel;
  }
  if (typeof model === 'string' && model.trim()) {
    return model.trim();
  }
  return defaultGeminiModel;
};

const cleanupOldBackups = (dir) => {
  const files = fs.readdirSync(dir)
    .filter(file => file.endsWith('.json'))
    .sort((a, b) => {
      const aTime = parseInt(a.split('-')[1]) || 0;
      const bTime = parseInt(b.split('-')[1]) || 0;
      return bTime - aTime;
    });
  const toRemove = files.slice(10);
  toRemove.forEach(file => {
    fs.unlinkSync(path.join(dir, file));
  });
};

const createPromptBackup = (topic, content) => {
  const dir = getTopicBackupDir(topic);
  const timestamp = Date.now();
  fs.writeFileSync(
    path.join(dir, `backup-${timestamp}.json`),
    JSON.stringify({ timestamp: new Date().toISOString(), content }, null, 2)
  );
  cleanupOldBackups(dir);
};

const loadBackupsForTopic = (topic) => {
  const dir = getTopicBackupDir(topic);
  const files = fs.readdirSync(dir)
    .filter(file => file.endsWith('.json'))
    .sort((a, b) => {
      const aTime = parseInt(a.split('-')[1]) || 0;
      const bTime = parseInt(b.split('-')[1]) || 0;
      return bTime - aTime;
    });
  return files.map(file => {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    return JSON.parse(content);
  });
};

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    title: 'Anki Card Forge',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  });

  Menu.setApplicationMenu(null);

  // Register zoom shortcuts when window is focused
  const registerZoomShortcuts = () => {
    globalShortcut.register('CommandOrControl+Plus', () => {
      const current = win.webContents.getZoomLevel();
      win.webContents.setZoomLevel(Math.min(current + 0.5, 3));
    });
    globalShortcut.register('CommandOrControl+=', () => {
      const current = win.webContents.getZoomLevel();
      win.webContents.setZoomLevel(Math.min(current + 0.5, 3));
    });
    globalShortcut.register('CommandOrControl+-', () => {
      const current = win.webContents.getZoomLevel();
      win.webContents.setZoomLevel(Math.max(current - 0.5, -3));
    });
    globalShortcut.register('CommandOrControl+0', () => {
      win.webContents.setZoomLevel(0);
    });
  };

  const unregisterZoomShortcuts = () => {
    globalShortcut.unregister('CommandOrControl+Plus');
    globalShortcut.unregister('CommandOrControl+=');
    globalShortcut.unregister('CommandOrControl+-');
    globalShortcut.unregister('CommandOrControl+0');
  };

  win.on('focus', registerZoomShortcuts);
  win.on('blur', unregisterZoomShortcuts);
  win.webContents.on('did-finish-load', registerZoomShortcuts);

  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    const distPath = path.join(__dirname, '../dist/index.html');
    if (fs.existsSync(distPath)) {
      win.loadFile(distPath);
    } else {
      console.error('Could not find dist/index.html at', distPath);
    }
  }
};

app.whenReady().then(() => {
  ensureStorage();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

ipcMain.handle('zoom-in', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    const current = win.webContents.getZoomLevel();
    win.webContents.setZoomLevel(Math.min(current + 0.5, 3));
  }
});

ipcMain.handle('zoom-out', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    const current = win.webContents.getZoomLevel();
    win.webContents.setZoomLevel(Math.max(current - 0.5, -3));
  }
});

ipcMain.handle('load-prompt-backups', async (event, topic) => {
  try {
    return loadBackupsForTopic(topic);
  } catch (error) {
    console.error('Failed to load backups:', error);
    return [];
  }
});

ipcMain.handle('save-prompt', async (event, topic, newContent) => {
  try {
    const normalized = normalizeTopicKey(topic);
    const prompts = readCustomPrompts();
    const previous = prompts[normalized] ?? defaultPrompts[normalized] ?? '';
    createPromptBackup(topic, previous);
    prompts[normalized] = newContent;
    writeCustomPrompts(prompts);
    return true;
  } catch (error) {
    console.error('Failed to save prompt:', error);
    return false;
  }
});

ipcMain.on('read-prompt-overrides-sync', (event) => {
  event.returnValue = readCustomPrompts();
});

ipcMain.handle('read-prompt-overrides', async () => {
  return readCustomPrompts();
});

ipcMain.handle('has-api-key', async () => {
  try {
    return !!resolveApiKey();
  } catch (error) {
    console.error('Failed to check API key status:', error);
    return false;
  }
});

ipcMain.handle('set-api-key', async (event, apiKey) => {
  try {
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return false;
    }

    const trimmedApiKey = apiKey.trim();

    if (safeStorage.isEncryptionAvailable()) {
      try {
        const credentials = { geminiApiKey: trimmedApiKey };
        const encrypted = safeStorage.encryptString(JSON.stringify(credentials));
        fs.writeFileSync(credentialsPath, encrypted);
        if (fs.existsSync(fallbackCredentialsPath)) {
          fs.unlinkSync(fallbackCredentialsPath);
        }
        return true;
      } catch (error) {
        console.warn('Secure storage failed, using fallback file storage:', error);
      }
    } else {
      console.warn('Secure storage not available on this system, using fallback file storage');
    }

    writeFallbackApiKey(trimmedApiKey);
    return true;
  } catch (error) {
    console.error('Failed to save API key to secure storage:', error);
    return false;
  }
});

ipcMain.handle('clear-api-key', async () => {
  try {
    if (fs.existsSync(credentialsPath)) {
      fs.unlinkSync(credentialsPath);
    }
    if (fs.existsSync(fallbackCredentialsPath)) {
      fs.unlinkSync(fallbackCredentialsPath);
    }
    return true;
  } catch (error) {
    console.error('Failed to clear API key:', error);
    return false;
  }
});

ipcMain.handle('generate-cards', async (event, payload) => {
  try {
    const apiKey = resolveApiKey();
    if (!apiKey) {
      throw new Error('Missing API key. Please add one in Settings.');
    }

    const prompt = typeof payload?.prompt === 'string' ? payload.prompt : '';
    const image = typeof payload?.image === 'string' ? payload.image : null;
    const model = resolveModel(payload?.model, image, payload?.useThinking);
    const useThinking = !!payload?.useThinking;

    return await generateFlashcardsInMain({ prompt, model, image, useThinking }, apiKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (process.env.NODE_ENV === 'development') {
      console.error('Gemini generation failed:', error);
    }
    throw new Error(message);
  }
});

ipcMain.handle('amend-card', async (event, payload) => {
  try {
    const apiKey = resolveApiKey();
    if (!apiKey) {
      throw new Error('Missing API key. Please add one in Settings.');
    }

    const prompt = typeof payload?.prompt === 'string' ? payload.prompt : '';
    const model = resolveModel(payload?.model, null, false);

    return await amendFlashcardInMain({ prompt, model }, apiKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (process.env.NODE_ENV === 'development') {
      console.error('Gemini amendment failed:', error);
    }
    throw new Error(message);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
