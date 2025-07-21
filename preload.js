const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Functions (Renderer -> Main)
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    getTestCentres: () => ipcRenderer.invoke('get-test-centres'),
    startMonitoring: () => ipcRenderer.invoke('start-monitoring'),
    stopMonitoring: () => ipcRenderer.invoke('stop-monitoring'),
    checkNow: () => ipcRenderer.invoke('check-now'),
    openDVSAWebsite: () => ipcRenderer.invoke('open-dvsa-website'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    restartApp: () => ipcRenderer.send('restart_app'),

    // Listeners (Main -> Renderer)
    onLog: (callback) => ipcRenderer.on('log', callback),
    onMonitoringStatus: (callback) => ipcRenderer.on('monitoring-status', callback),
    onUpdateAvailable: (callback) => ipcRenderer.on('update_available', callback),
    onUpdateDownloaded: (callback) => ipcRenderer.on('update_downloaded', callback),
});

// Expose app version to renderer
ipcRenderer.invoke('get-app-version').then(version => {
    contextBridge.exposeInMainWorld('appVersion', version);
});

// A slightly different pattern for getAppVersion for simplicity
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});