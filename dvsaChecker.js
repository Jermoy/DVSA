// dvsaChecker.js
const { Notification } = require('electron');
const { SELECTORS, BASE_URL } = require('./config');

class DVSAChecker {
    constructor(pie, puppeteer, log, window) {
        this.pie = pie;
        this.puppeteer = puppeteer;
        this.log = log;
        this.mainWindow = window;
        this.browser = null;
        this.page = null;
        this.isMonitoring = false;
        this.monitoringInterval = null;
    }

    logToUI(message) {
        this.log.info(message);
        this.mainWindow.webContents.send('log', message);
    }

    async start(settings) {
        if (this.isMonitoring) return false;
        if (!settings.licenceNumber || !settings.bookingReference) {
            this.logToUI('❌ Error: Licence Number and Booking Reference are required.');
            return false;
        }
        if (settings.selectedCentres.length === 0) {
            this.logToUI('❌ Error: Please select at least one test centre to monitor.');
            return false;
        }
        
        this.isMonitoring = true;
        this.mainWindow.webContents.send('monitoring-status', true);
        this.logToUI('▶️ Monitoring started.');

        // Initial check
        this.runCheck(settings);

        // Set interval
        const intervalMinutes = parseInt(settings.checkInterval, 10);
        this.monitoringInterval = setInterval(() => this.runCheck(settings), intervalMinutes * 60 * 1000);
        return true;
    }

    async stop() {
        if (!this.isMonitoring) return false;
        this.isMonitoring = false;
        this.mainWindow.webContents.send('monitoring-status', false);
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
        this.logToUI('⏹️ Monitoring stopped.');
        return true;
    }

    async initBrowser() {
        if (this.browser) return;
        this.logToUI('🌍 Initializing browser...');
        this.browser = await this.pie.connect(this.puppeteer);
    }
    
    async runCheck(settings) {
        this.logToUI('🔍 Starting a new check...');
        try {
            await this.initBrowser();
            this.page = await this.browser.newPage();
            await this.page.goto(BASE_URL, { waitUntil: 'networkidle2' });

            // Step 1: Login
            this.logToUI('   - Logging in...');
            await this.page.type(SELECTORS.LICENCE_NUMBER_INPUT, settings.licenceNumber);
            await this.page.type(SELECTORS.BOOKING_REFERENCE_INPUT, settings.bookingReference);
            await Promise.all([
                this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
                this.page.click(SELECTORS.CONTINUE_BUTTON)
            ]);

            // Step 2: Navigate to Change Test Date
            await this.page.waitForSelector(SELECTORS.CHANGE_TEST_DATE_LINK);
            await Promise.all([
                this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
                this.page.click(SELECTORS.CHANGE_TEST_DATE_LINK)
            ]);

            // Step 3: Iterate through selected test centres
            for (const centre of settings.selectedCentres) {
                 if (!this.isMonitoring) break; // Stop if monitoring was cancelled mid-check
                this.logToUI(`   - Checking centre: ${centre.name}`);

                // Select the test centre
                await this.page.waitForSelector(SELECTORS.TEST_CENTRE_INPUT);
                await this.page.type(SELECTORS.TEST_CENTRE_INPUT, centre.name);
                await Promise.all([
                   this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
                   this.page.click(SELECTORS.FIND_CENTRE_BUTTON)
                ]);

                // Choose the exact centre from radio buttons
                await this.page.waitForSelector(SELECTORS.SELECT_CENTRE_RADIO(centre.id));
                await this.page.click(SELECTORS.SELECT_CENTRE_RADIO(centre.id));
                await Promise.all([
                   this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
                   this.page.click(SELECTORS.CONTINUE_TO_CALENDAR_BUTTON)
                ]);

                // Step 4: Check Calendar
                const foundDate = await this.checkCalendarForSlots(new Date(settings.alertBeforeDate));
                if (foundDate) {
                    const message = `🎉 Test found at ${centre.name} on ${foundDate.toLocaleDateString()}`;
                    this.logToUI(message);
                    new Notification({ title: 'Earlier Test Found!', body: message }).show();

                    if (settings.autoBook) {
                        this.logToUI('   - 🤖 Auto-booking enabled. Attempting to book...');
                        await this.autoBookTest();
                        await this.stop(); // Stop monitoring after successful booking
                    }
                    return { found: true, message };
                }
                
                // Go back to change test centre
                await this.page.goBack({ waitUntil: 'networkidle2' });
                await this.page.goBack({ waitUntil: 'networkidle2' });
            }
            this.logToUI('✅ Check complete. No suitable dates found this time.');
            
        } catch (error) {
            this.logToUI(`❌ An error occurred during check: ${error.message}`);
            this.log.error(error);
        } finally {
            if (this.page) await this.page.close();
        }
        return { found: false };
    }

    async checkCalendarForSlots(alertBeforeDate) {
        // Check up to 6 months ahead
        for (let i = 0; i < 6; i++) {
            const availableSlots = await this.page.$$(SELECTORS.AVAILABLE_DATE_ANCHOR);
            for (const slot of availableSlots) {
                const dateStr = await this.page.evaluate(el => el.getAttribute('data-date'), slot);
                const availableDate = new Date(dateStr);
                if (availableDate < alertBeforeDate) {
                    await slot.click();
                    return availableDate; // Found a suitable date, click it and return
                }
            }
            await this.page.click(SELECTORS.CALENDAR_NEXT_MONTH_BUTTON);
            await this.page.waitForTimeout(500); // Small delay for calendar to load
        }
        return null; // No suitable date found
    }

    async autoBookTest() {
        try {
            this.logToUI('      - Selecting first available time...');
            await this.page.waitForSelector(SELECTORS.FIRST_AVAILABLE_SLOT_RADIO, { timeout: 5000 });
            await this.page.click(SELECTORS.FIRST_AVAILABLE_SLOT_RADIO);
            await Promise.all([
                this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
                this.page.click(SELECTORS.CONFIRM_SLOT_BUTTON)
            ]);

            this.logToUI('      - Confirming final change...');
            await this.page.waitForSelector(SELECTORS.FINAL_CONFIRMATION_CHECKBOX);
            await this.page.click(SELECTORS.FINAL_CONFIRMATION_CHECKBOX);
            await Promise.all([
                this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
                this.page.click(SELECTORS.CONFIRM_CHANGE_BUTTON)
            ]);
            
            const successMessage = '✅✅✅ AUTO-BOOKING SUCCESSFUL! Check your email for confirmation.';
            this.logToUI(successMessage);
            new Notification({ title: 'Booking Complete!', body: successMessage, urgency: 'critical' }).show();

        } catch (error) {
             const errorMessage = `❌❌❌ AUTO-BOOKING FAILED: ${error.message}`;
             this.logToUI(errorMessage);
             this.log.error(error);
        }
    }
}

module.exports = DVSAChecker;