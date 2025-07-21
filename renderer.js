class DVSAProApp {
    constructor() {
        this.settings = {};
        this.testCentres = [];
        this.selectedCentres = new Set();
        this.initializeUI();
        this.loadData();
        this.setupEventListeners();
        this.setupIPCListeners();
    }

    initializeUI() {
        this.elements = {
            // Inputs
            licenceNumber: document.getElementById('licenceNumber'),
            bookingReference: document.getElementById('bookingReference'),
            alertBeforeDate: document.getElementById('alertBeforeDate'),
            checkInterval: document.getElementById('checkInterval'),
            autoBook: document.getElementById('autoBook'),
            // Buttons
            startBtn: document.getElementById('startBtn'),
            stopBtn: document.getElementById('stopBtn'),
            checkNowBtn: document.getElementById('checkNowBtn'),
            dvsaWebsiteBtn: document.getElementById('dvsaWebsiteBtn'),
            restartBtn: document.getElementById('restart-button'),
            // Displays
            status: document.getElementById('status'),
            log: document.getElementById('log'),
            testCentreList: document.getElementById('testCentreList'),
            notification: document.getElementById('notification'),
            notificationMessage: document.getElementById('notification-message'),
            appVersion: document.getElementById('app-version'),
        };
    }

    async loadData() {
        // Load settings
        this.settings = await window.electronAPI.getSettings();
        this.elements.licenceNumber.value = this.settings.licenceNumber;
        this.elements.bookingReference.value = this.settings.bookingReference;
        this.elements.alertBeforeDate.value = this.settings.alertBeforeDate;
        this.elements.checkInterval.value = this.settings.checkInterval;
        this.elements.autoBook.checked = this.settings.autoBook;
        this.settings.selectedCentres.forEach(c => this.selectedCentres.add(c.id));

        // Load test centres
        this.testCentres = await window.electronAPI.getTestCentres();
        this.renderTestCentres();
        
        const version = await window.electronAPI.getAppVersion();
        this.elements.appVersion.textContent = version;
    }
    
    renderTestCentres() {
        this.elements.testCentreList.innerHTML = '';
        this.testCentres.forEach(centre => {
            const label = document.createElement('label');
            label.className = 'centre-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = centre.id;
            checkbox.checked = this.selectedCentres.has(centre.id);

            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedCentres.add(centre.id);
                } else {
                    this.selectedCentres.delete(centre.id);
                }
                this.saveSettings();
            });

            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(centre.name));
            this.elements.testCentreList.appendChild(label);
        });
    }

    setupEventListeners() {
        Object.values(this.elements).forEach(el => {
            if (el.tagName === 'INPUT') {
                el.addEventListener('change', () => this.saveSettings());
            }
        });
        this.elements.startBtn.addEventListener('click', () => window.electronAPI.startMonitoring());
        this.elements.stopBtn.addEventListener('click', () => window.electronAPI.stopMonitoring());
        this.elements.checkNowBtn.addEventListener('click', () => this.checkNow());
        this.elements.dvsaWebsiteBtn.addEventListener('click', () => window.electronAPI.openDVSAWebsite());
        this.elements.restartBtn.addEventListener('click', () => window.electronAPI.restartApp());
    }
    
    async checkNow() {
        this.elements.checkNowBtn.disabled = true;
        this.elements.checkNowBtn.textContent = 'Checking...';
        await window.electronAPI.checkNow();
        this.elements.checkNowBtn.disabled = false;
        this.elements.checkNowBtn.textContent = '🔍 Check Now';
    }

    async saveSettings() {
        const selectedCentres = this.testCentres.filter(tc => this.selectedCentres.has(tc.id));
        const currentSettings = {
            licenceNumber: this.elements.licenceNumber.value,
            bookingReference: this.elements.bookingReference.value,
            alertBeforeDate: this.elements.alertBeforeDate.value,
            checkInterval: parseInt(this.elements.checkInterval.value),
            autoBook: this.elements.autoBook.checked,
            selectedCentres
        };
        await window.electronAPI.saveSettings(currentSettings);
        this.logToUI('Settings saved.', true);
    }
    
    setupIPCListeners() {
        window.electronAPI.onLog((event, message) => this.logToUI(message));
        window.electronAPI.onMonitoringStatus((event, isMonitoring) => this.updateMonitoringState(isMonitoring));
        
        // Auto-update listeners
        window.electronAPI.onUpdateAvailable(() => {
            this.elements.notification.classList.remove('hidden');
            this.elements.notificationMessage.textContent = 'A new update is available. Downloading now...';
        });
        window.electronAPI.onUpdateDownloaded(() => {
            this.elements.notificationMessage.textContent = 'Update downloaded. It will be installed on restart.';
            this.elements.restartBtn.classList.remove('hidden');
        });
    }

    updateMonitoringState(isMonitoring) {
        if (isMonitoring) {
            this.elements.status.textContent = '▶️ Monitoring';
            this.elements.status.className = 'status monitoring';
            this.elements.startBtn.disabled = true;
            this.elements.stopBtn.disabled = false;
        } else {
            this.elements.status.textContent = '⏹️ Idle';
            this.elements.status.className = 'status stopped';
            this.elements.startBtn.disabled = false;
            this.elements.stopBtn.disabled = true;
        }
    }

    logToUI(message, isSystem = false) {
        const timestamp = new Date().toLocaleTimeString();
        const p = document.createElement('p');
        p.textContent = isSystem ? `[SYSTEM] ${message}` : `[${timestamp}] ${message}`;
        this.elements.log.appendChild(p);
        this.elements.log.scrollTop = this.elements.log.scrollHeight;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.dvsaApp = new DVSAProApp();
});