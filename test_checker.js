const DVSAChecker = require('./dvsaChecker');
const { FALLBACK_TEST_CENTRES } = require('./testCentres');
const { FALLBACK_CONFIG } = require('./config');
const Store = require('electron-store');
const pie = require('puppeteer-in-electron');
const puppeteer = require('puppeteer-core');
const log = require('electron-log');
const { app, BrowserWindow, shell } = require('electron');

const store = new Store();

const settings = {
  licenceNumber: 'dummy-licence',
  bookingReference: 'dummy-booking',
  selectedCentres: [FALLBACK_TEST_CENTRES[0]],
  checkInterval: 5,
  bookingMode: 'disabled',
  captchaApiKey: '',
  alertBeforeDate: new Date()
};

const config = {
  ...FALLBACK_CONFIG,
  ...store.get('config')
};

async function runTest() {
  await pie.initialize(app);
  const mainWindow = new BrowserWindow({ show: false });
  const checker = new DVSAChecker(pie, puppeteer, log, mainWindow, shell, store);
  await checker.runCheck(settings, config);
  await app.quit();
}

runTest();
