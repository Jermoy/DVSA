// main.js - Main Electron process
const { app, BrowserWindow, ipcMain, Notification, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const Store = require('electron-store');
const pie = require('puppeteer-in-electron');
const puppeteer = require('puppeteer-core');
const log = require('electron-log');

const DVSAChecker = require('./dvsaChecker'); // Import the new checker class
const testCentres = require('./testCentres');

//----- Configuration -----//
log.transports.file.level = 'info';
autoUpdater.logger = log;
const store = new Store();
let mainWindow;
let checker; // The checker instance

//----- Auto Updater -----//
autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update_available');
});
autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update_downloaded');
});
ipcMain.on('restart_app', () => {
  autoUpdater.quitAndInstall();
});

//----- Main App Window -----//
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: 'DVSA Test Checker Pro'
  });

  mainWindow.loadFile('index.html');
  // mainWindow.webContents.openDevTools();

  mainWindow.once('ready-to-show', () => {
    autoUpdater.checkForUpdatesAndNotify();
  });
}

//----- App Lifecycle -----//
app.on('ready', async () => {
    // Connect to the bundled Chromium instance
    await pie.initialize(app);
    checker = new DVSAChecker(pie, puppeteer, log, mainWindow);
    createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', async () => {
    if (checker) await checker.stop();
});

//----- IPC Handlers -----//
ipcMain.handle('get-settings', () => {
  return store.get('settings', {
    licenceNumber: '',
    bookingReference: '',
    currentTestDate: '',
    alertBeforeDate: '',
    selectedCentres: [],
    checkInterval: 5, // minutes
    autoBook: false,
  });
});

ipcMain.handle('save-settings', (event, settings) => {
  store.set('settings', settings);
  return true;
});

ipcMain.handle('get-test-centres', () => {
    return testCentres;
});

ipcMain.handle('start-monitoring', async () => {
  if (!checker) return false;
  const settings = store.get('settings');
  return await checker.start(settings);
});

ipcMain.handle('stop-monitoring', async () => {
  if (!checker) return false;
  return await checker.stop();
});

ipcMain.handle('check-now', async () => {
    if (!checker) return { found: false, error: "Checker not initialized." };
    const settings = store.get('settings');
    const result = await checker.runCheck(settings);

    if (result.found) {
        new Notification({ title: 'Manual Check Found a Test!', body: result.message }).show();
    }
    return result;
});

ipcMain.handle('open-dvsa-website', () => {
    shell.openExternal('https://www.gov.uk/change-driving-test');
});