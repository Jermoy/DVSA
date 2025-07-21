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
            captchaApiKey: document.getElementById('captchaApiKey'),
            alertBeforeDate: document.getElementById('alertBeforeDate'),
            checkInterval: document.getElementById('checkInterval'),
            bookingMode: document.getElementById('bookingMode'),
            centreSearchInput: document.getElementById('centreSearchInput'),
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
            // Progress elements
            progressContainer: document.getElementById('progressContainer'),
            progressLabel: document.getElementById('progressLabel'),
            progressBar: document.getElementById('progressBar'),
            // Error message elements
            dateErrorMessage: document.getElementById('date-error-message'),
            intervalErrorMessage: document.getElementById('interval-error-message'),
        };
    }

    async loadData() {
        this.settings = await window.electronAPI.getSettings();
        this.elements.licenceNumber.value = this.settings.licenceNumber;
        this.elements.bookingReference.value = this.settings.bookingReference;
        this.elements.captchaApiKey.value = this.settings.captchaApiKey;
        this.elements.alertBeforeDate.value = this.settings.alertBeforeDate;
        this.elements.checkInterval.value = this.settings.checkInterval;
        this.elements.bookingMode.value = this.settings.bookingMode;
        if (this.settings.selectedCentres) {
            this.settings.selectedCentres.forEach(c => this.selectedCentres.add(c.id));
        }

        this.testCentres = await window.electronAPI.getTestCentres();
        this.renderTestCentres();
        
        const version = await window.electronAPI.getAppVersion();
        this.elements.appVersion.textContent = version;
    }
    
    renderTestCentres() {
        const filterText = this.elements.centreSearchInput.value.toLowerCase();
        this.elements.testCentreList.innerHTML = '';

        const filteredCentres = this.testCentres.filter(centre => 
            centre.name.toLowerCase().includes(filterText)
        );

        filteredCentres.forEach(centre => {
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
            if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT')) {
                // Use 'blur' for validation-heavy saves, 'change' is fine for most
                el.addEventListener('change', () => this.saveSettings());
            }
        });

        this.elements.centreSearchInput.addEventListener('input', () => this.renderTestCentres());
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

    clearValidationErrors() {
        this.elements.alertBeforeDate.classList.remove('input-error');
        this.elements.dateErrorMessage.style.display = 'none';
        
        this.elements.checkInterval.classList.remove('input-error');
        this.elements.intervalErrorMessage.style.display = 'none';
    }

    validateSettings() {
        let isValid = true;
        this.clearValidationErrors();

        const intervalValue = parseInt(this.elements.checkInterval.value, 10);
        if (isNaN(intervalValue) || intervalValue < 5) {
            this.elements.checkInterval.classList.add('input-error');
            this.elements.intervalErrorMessage.textContent = 'Interval must be a number, 5 or greater.';
            this.elements.intervalErrorMessage.style.display = 'block';
            isValid = false;
        }

        const selectedDateStr = this.elements.alertBeforeDate.value;
        if (selectedDateStr) {
            const selectedDate = new Date(selectedDateStr);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (selectedDate < today) {
                this.elements.alertBeforeDate.classList.add('input-error');
                this.elements.dateErrorMessage.textContent = 'Date cannot be in the past.';
                this.elements.dateErrorMessage.style.display = 'block';
                isValid = false;
            }
        }
        
        return isValid;
    }

    async saveSettings() {
        if (!this.validateSettings()) {
            this.logToUI('Validation failed. Settings not saved.', true);
            return;
        }
        
        const selectedCentres = this.testCentres.filter(tc => this.selectedCentres.has(tc.id));
        const currentSettings = {
            licenceNumber: this.elements.licenceNumber.value,
            bookingReference: this.elements.bookingReference.value,
            captchaApiKey: this.elements.captchaApiKey.value,
            alertBeforeDate: this.elements.alertBeforeDate.value,
            checkInterval: parseInt(this.elements.checkInterval.value),
            bookingMode: this.elements.bookingMode.value,
            selectedCentres
        };
        await window.electronAPI.saveSettings(currentSettings);
        this.logToUI('Settings saved.', true);
    }
    
    setupIPCListeners() {
        window.electronAPI.onLog((event, message) => this.logToUI(message));
        window.electronAPI.onMonitoringStatus((event, isMonitoring) => this.updateMonitoringState(isMonitoring));
        
        window.electronAPI.onUpdateAvailable(() => {
            this.elements.notification.classList.remove('hidden');
            this.elements.notificationMessage.textContent = 'A new update is available. Downloading now...';
        });
        window.electronAPI.onUpdateDownloaded(() => {
            this.elements.notificationMessage.textContent = 'Update downloaded. It will be installed on restart.';
            this.elements.restartBtn.classList.remove('hidden');
});

        window.electronAPI.onCheckProgress((event, { current, total, name }) => {
            this.elements.progressContainer.classList.remove('hidden');
            this.elements.progressLabel.textContent = `Checking ${current} of ${total}: ${name}...`;
            this.elements.progressBar.max = total;
            this.elements.progressBar.value = current;
        });

        window.electronAPI.onCheckComplete(() => {
            this.elements.progressContainer.classList.add('hidden');
            this.elements.progressBar.value = 0;
            this.elements.progressLabel.textContent = '';
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