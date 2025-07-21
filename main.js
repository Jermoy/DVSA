// main.js - Main Electron process
const { app, BrowserWindow, ipcMain, Notification, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const Store = require('electron-store');
const pie = require('puppeteer-in-electron');
const puppeteer = require('puppeteer-core');
const log = require('electron-log');
const axios = require('axios');
const keytar = require('keytar');

const DVSAChecker = require('./dvsaChecker');
const { FALLBACK_TEST_CENTRES } = require('./testCentres');
const { FALLBACK_CONFIG } = require('./config');

// Initialize puppeteer-in-electron at the top level
pie.initialize(app);

//----- Configuration -----//
const REMOTE_CONFIG_URL = 'https://raw.githubusercontent.com/Jermoy/DVSA/main/selectors.json';
const REMOTE_CENTRES_URL = 'https://raw.githubusercontent.com/Jermoy/DVSA/main/test-centres.json';
log.transports.file.level = 'info';
autoUpdater.logger = log;
const store = new Store();
let mainWindow;
let checker;

// Keytar configuration for secure credential storage
const KEYTAR_SERVICE = app.getName();
const KEYTAR_ACCOUNT = 'user-credentials';

//----- Remote Data Fetching -----//
async function updateRemoteConfig() {
    log.info('Checking for new remote selector configuration...');
    try {
        const response = await axios.get(REMOTE_CONFIG_URL, { timeout: 5000 });
        const remoteConfig = response.data;
        const localVersion = store.get('config.version', '0.0.0');

        if (remoteConfig && remoteConfig.version > localVersion) {
            store.set('config', remoteConfig);
            log.info(`Updated remote selector config from version ${localVersion} to ${remoteConfig.version}`);
        } else {
            log.info('Local selector configuration is up to date.');
        }
    } catch (error) {
        log.error('Failed to fetch remote selector configuration. Using cached or fallback values.', error.message);
    }
}

async function updateTestCentres() {
    log.info('Checking for new test centre list...');
    try {
        const response = await axios.get(REMOTE_CENTRES_URL, { timeout: 5000 });
        if (response.data && Array.isArray(response.data)) {
            store.set('test-centres', response.data);
            log.info(`Successfully fetched and cached ${response.data.length} test centres.`);
        }
    } catch (error) {
        log.error('Failed to fetch remote test centre list. Using cached or fallback values.', error.message);
    }
}

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
  mainWindow.once('ready-to-show', () => {
    autoUpdater.checkForUpdatesAndNotify();
  });
}

//----- App Lifecycle -----//
app.on('ready', async () => {
    await Promise.all([
        updateRemoteConfig(),
        updateTestCentres()
    ]);
    
    checker = new DVSAChecker(pie, puppeteer, log, mainWindow, shell, store);
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
const getConfig = () => store.get('config', FALLBACK_CONFIG);
const getTestCentres = () => store.get('test-centres', FALLBACK_TEST_CENTRES);

ipcMain.handle('get-settings', async () => {
  const nonSensitiveSettings = store.get('settings', {
    currentTestDate: '',
    alertBeforeDate: '',
    selectedCentres: [],
    checkInterval: 5,
    bookingMode: 'disabled',
  });

  const credentialsJson = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
  
  if (credentialsJson) {
    const sensitiveSettings = JSON.parse(credentialsJson);
    return { ...nonSensitiveSettings, ...sensitiveSettings };
  }
  
  return { ...nonSensitiveSettings, licenceNumber: '', bookingReference: '', captchaApiKey: '' };
});

ipcMain.handle('save-settings', async (event, settings) => {
  try {
    const { licenceNumber, bookingReference, captchaApiKey, ...otherSettings } = settings;
    store.set('settings', otherSettings);

    const credentials = { licenceNumber, bookingReference, captchaApiKey };

    if (Object.values(credentials).some(val => val)) {
      await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, JSON.stringify(credentials));
    } else {
      await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    }
    
    return true;
  } catch (error) {
    log.error('Failed to save settings:', error);
    return false;
  }
});

ipcMain.handle('get-test-centres', () => {
    return getTestCentres();
});

ipcMain.handle('start-monitoring', async () => {
  if (!checker) return false;
  const settings = await ipcMain.handle('get-settings');
  const config = getConfig();
  return await checker.start(settings, config);
});

ipcMain.handle('stop-monitoring', async () => {
  if (!checker) return false;
  return await checker.stop();
});

ipcMain.handle('check-now', async () => {
    if (!checker) return { found: false, error: "Checker not initialized." };
    const settings = await ipcMain.handle('get-settings');
    const config = getConfig();
    const result = await checker.runCheck(settings, config);

    if (result.found && settings.bookingMode === 'disabled') {
        new Notification({ title: 'Manual Check Found a Test!', body: result.message }).show();
    }
    return result;
});

ipcMain.handle('open-dvsa-website', () => {
    const { urls } = getConfig();
    shell.openExternal(urls.BASE_URL);
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});