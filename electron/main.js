import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    title: "Anki Card Forge",
    autoHideMenuBar: true, // Hide the menu bar
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false // Allow local CORS for AnkiConnect if needed
    }
  });

  // Hide the menu bar completely
  Menu.setApplicationMenu(null);

  // Determine if we are in dev mode
  // Using env var is more reliable than isPackaged when running via nix wrapper
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    win.loadURL('http://localhost:5173');
    // win.webContents.openDevTools();
  } else {
    const distPath = path.join(__dirname, '../dist/index.html');
    if (fs.existsSync(distPath)) {
       win.loadFile(distPath);
    } else {
       console.error("Could not find dist/index.html at", distPath);
       // Fallback or error handling
    }
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Prompt editing functionality 
// Use user data directory for writable files
const userDataPath = app.getPath('userData');
const promptsPath = path.join(userDataPath, 'topics.ts');
const backupsPath = path.join(userDataPath, 'backups');

// Initialize prompts file if it doesn't exist in userData
if (!fs.existsSync(promptsPath)) {
  // Try to copy from installation directory (read-only source)
  const sourcePromptsPath = path.join(__dirname, '../prompts/topics.ts');
  if (fs.existsSync(sourcePromptsPath)) {
    try {
      fs.mkdirSync(path.dirname(promptsPath), { recursive: true });
      fs.copyFileSync(sourcePromptsPath, promptsPath);
    } catch (err) {
      console.error("Failed to copy default prompts:", err);
    }
  }
}

// Ensure backups directory exists
if (!fs.existsSync(backupsPath)) {
  fs.mkdirSync(backupsPath, { recursive: true });
}

// Load prompt backups
ipcMain.handle('load-prompt-backups', async (event, topic) => {
  try {
    const topicBackupsPath = path.join(backupsPath, `${topic.toLowerCase()}`);
    if (!fs.existsSync(topicBackupsPath)) {
      return [];
    }
    
    const files = fs.readdirSync(topicBackupsPath)
      .filter(file => file.endsWith('.json'))
      .sort((a, b) => {
        const aTime = parseInt(a.split('-')[1]);
        const bTime = parseInt(b.split('-')[1]);
        return bTime - aTime; // Most recent first
      });
    
    const backups = files.slice(0, 10).map(file => {
      const filePath = path.join(topicBackupsPath, file);
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    });
    
    return backups;
  } catch (error) {
    console.error('Failed to load backups:', error);
    return [];
  }
});

// Create backup before saving
ipcMain.handle('create-prompt-backup', async (event, topic, content) => {
  try {
    const topicBackupsPath = path.join(backupsPath, `${topic.toLowerCase()}`);
    if (!fs.existsSync(topicBackupsPath)) {
      fs.mkdirSync(topicBackupsPath, { recursive: true });
    }
    
    const timestamp = Date.now();
    const backupFile = path.join(topicBackupsPath, `backup-${timestamp}.json`);
    const backup = {
      timestamp: new Date().toISOString(),
      content: content
    };
    
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    
    // Clean up old backups (keep only last 10)
    const files = fs.readdirSync(topicBackupsPath)
      .filter(file => file.endsWith('.json'))
      .sort((a, b) => {
        const aTime = parseInt(a.split('-')[1]);
        const bTime = parseInt(b.split('-')[1]);
        return bTime - aTime;
      });
    
    if (files.length > 10) {
      const filesToDelete = files.slice(10);
      filesToDelete.forEach(file => {
        fs.unlinkSync(path.join(topicBackupsPath, file));
      });
    }
    
    return true;
  } catch (error) {
    console.error('Failed to create backup:', error);
    return false;
  }
});

// Save prompt
ipcMain.handle('save-prompt', async (event, topic, newContent) => {
  try {
    // Read current file
    const currentContent = fs.readFileSync(promptsPath, 'utf8');
    
    // Create backup first
    await ipcMain.emit('create-prompt-backup', event, topic, getCurrentPromptForTopic(currentContent, topic));
    
    // Update the specific topic prompt
    const topicKey = topic.toLowerCase().replace(/[^a-z]/g, '');
    const updatedContent = updatePromptInFile(currentContent, topicKey, newContent);
    
    // Write back to file
    fs.writeFileSync(promptsPath, updatedContent);
    
    return true;
  } catch (error) {
    console.error('Failed to save prompt:', error);
    return false;
  }
});

// Helper function to extract current prompt for a topic
function getCurrentPromptForTopic(content, topic) {
  const topicKey = topic.toLowerCase().replace(/[^a-z]/g, '');
  const regex = new RegExp(`${topicKey}:\\s*\`([^\\\`]+)\``, 's');
  const match = content.match(regex);
  return match ? match[1] : '';
}

// Helper function to update prompt in file
function updatePromptInFile(content, topicKey, newContent) {
  const regex = new RegExp(`(${topicKey}:\\s*\`)([^\\\`]*)(\`)`, 's');
  return content.replace(regex, `$1${newContent}$3`);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
