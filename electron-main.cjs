const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    kiosk: true, // Forces absolute full-screen and hides OS taskbars
    autoHideMenuBar: true,
    alwaysOnTop: true, // Prevents other apps from covering the exam
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: false // Blocks students from inspecting the code
    }
  });

  const isDev = !app.isPackaged || process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL(process.env.ELECTRON_DEV_URL || 'http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  // Block keyboard shortcuts for a secure exam environment
  const shortcutsToBlock = [
    'CommandOrControl+R',
    'CommandOrControl+Shift+R',
    'Alt+Tab',
    'CommandOrControl+C',
    'CommandOrControl+V',
    'PrintScreen'
  ];

  shortcutsToBlock.forEach(shortcut => {
    const registered = globalShortcut.register(shortcut, () => {
      console.log(`Shortcut blocked: ${shortcut}`);
    });
    if (!registered) {
      console.warn(`Failed to register global shortcut: ${shortcut}`);
    }
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
