// dvsaChecker.js
const { Notification } = require('electron');
const Captcha = require("2captcha");

class DVSAChecker {
    constructor(pie, puppeteer, log, window, shell, store) {
        this.pie = pie;
        this.puppeteer = puppeteer;
        this.log = log;
        this.mainWindow = window;
        this.shell = shell;
        this.store = store;
        this.browser = null;
        this.page = null;
        this.isMonitoring = false;
        this.isChecking = false; // Add the lock flag
        this.monitoringInterval = null;
        this.config = null;
    }

    logToUI(message) {
        this.log.info(message);
        this.mainWindow.webContents.send('log', message);
    }

    async saveCookies() {
        try {
            const cookies = await this.page.cookies();
            this.store.set('session-cookies', cookies);
            this.logToUI('   - Session cookies saved.');
        } catch (error) {
            this.logToUI(`   - ❌ Could not save cookies: ${error.message}`);
        }
    }

    async loadCookies() {
        const cookies = this.store.get('session-cookies');
        if (cookies && cookies.length) {
            await this.page.setCookie(...cookies);
            this.logToUI('   - Session cookies loaded.');
            return true;
        }
        return false;
    }
    
    async clearCookies() {
        this.store.delete('session-cookies');
        this.logToUI('   - Stale session cookies cleared.');
    }

    async start(settings, config) {
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
        this.config = config;
        this.mainWindow.webContents.send('monitoring-status', true);
        this.logToUI('▶️ Monitoring started.');
        
        this.runCheck(settings);

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
        if (!this.browser || !this.browser.isConnected()) {
             this.logToUI('🌍 Initializing or reconnecting browser...');
             this.browser = await this.pie.connect(this.puppeteer);
        }
    }
    
    async handleCaptcha(apiKey, selectors) {
        if (!apiKey) {
            this.logToUI('   - CAPTCHA found, but no API key provided. Cannot solve.');
            return false;
        }
        try {
            const solver = new Captcha.Solver(apiKey);
            const sitekey = await this.page.$eval(selectors.CAPTCHA_CHALLENGE, el => el.getAttribute('data-sitekey'));
            
            if (!sitekey) {
                this.logToUI('   - Could not find CAPTCHA sitekey on the page.');
                return false;
            }

            this.logToUI('   - Solving... (this may take a moment)');
            const { data: token } = await solver.recaptcha(sitekey, this.page.url());
            
            await this.page.evaluate((token) => {
                document.getElementById('g-recaptcha-response').value = token;
            }, token);
            
            await Promise.all([
                this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
                this.page.click(selectors.CONTINUE_BUTTON)
            ]);

            this.logToUI('   - ✅ CAPTCHA solved and submitted.');
            return true;
        } catch (error) {
            this.logToUI(`   - ❌ CAPTCHA solving failed: ${error.message}`);
            this.log.error(error);
            return false;
        }
    }

    async runCheck(settings, config) {
        // ### LOCKING MECHANISM ###
        if (this.isChecking) {
            this.logToUI('⚪ A check is already in progress. Skipping new check.');
            return;
        }
        this.isChecking = true;

        const currentConfig = config || this.config;
        if (!currentConfig) {
            this.logToUI('❌ Error: Configuration not loaded. Cannot run check.');
            this.isChecking = false; // Release lock on early exit
            return { found: false };
        }
        const { urls, selectors } = currentConfig;

        this.logToUI('🔍 Starting a new check...');
        try {
            await this.initBrowser();
            this.page = await this.browser.newPage();

            let loggedIn = false;
            if (await this.loadCookies()) {
                await this.page.goto(urls.LOGGED_IN_URL, { waitUntil: 'networkidle2' });
                try {
                    await this.page.waitForSelector(selectors.CHANGE_TEST_DATE_LINK, { timeout: 5000 });
                    this.logToUI('   - ✅ Session restored successfully.');
                    loggedIn = true;
                } catch (error) {
                    this.logToUI('   - ⚠️ Session expired or invalid. Performing full login.');
                    await this.clearCookies();
                }
            }

            if (!loggedIn) {
                this.logToUI('   - Performing full login...');
                await this.page.goto(urls.BASE_URL, { waitUntil: 'networkidle2' });
                await this.page.type(selectors.LICENCE_NUMBER_INPUT, settings.licenceNumber);
                await this.page.type(selectors.BOOKING_REFERENCE_INPUT, settings.bookingReference);
                await this.page.click(selectors.CONTINUE_BUTTON);
                await this.page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {});

                const errorElement = await this.page.$(selectors.ERROR_SUMMARY_SELECTOR);
                if (errorElement) {
                    const errorText = await this.page.$eval(selectors.ERROR_SUMMARY_SELECTOR, el => el.innerText);
                    const cleanError = errorText.replace(/\s+/g, ' ').trim();
                    this.logToUI(`❌ Login Failed: "${cleanError}". Please check your credentials and stop the monitor.`);
                    await this.stop();
                    throw new Error('Login failed due to invalid credentials.');
                }

                const isCaptchaVisible = await this.page.$(selectors.CAPTCHA_IFRAME);
                if (isCaptchaVisible) {
                    this.logToUI('   - CAPTCHA detected.');
                    const solved = await this.handleCaptcha(settings.captchaApiKey, selectors);
                    if (!solved) throw new Error("CAPTCHA appeared but could not be solved.");
                }

                await this.page.waitForSelector(selectors.CHANGE_TEST_DATE_LINK, { timeout: 15000 });
                this.logToUI('   - ✅ Login successful.');
                await this.saveCookies();
            }

            await Promise.all([
                this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
                this.page.click(selectors.CHANGE_TEST_DATE_LINK)
            ]);

            const totalCentres = settings.selectedCentres.length;
            for (let i = 0; i < totalCentres; i++) {
                const centre = settings.selectedCentres[i];
                if (!this.isMonitoring && !config) break;

                this.mainWindow.webContents.send('check-progress', { current: i + 1, total: totalCentres, name: centre.name });
                this.logToUI(`   - Checking centre: ${centre.name}`);

                await this.page.waitForSelector(selectors.TEST_CENTRE_INPUT);
                await this.page.type(selectors.TEST_CENTRE_INPUT, centre.name);
                await Promise.all([
                   this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
                   this.page.click(selectors.FIND_CENTRE_BUTTON)
                ]);

                const centreSelector = selectors.SELECT_CENTRE_RADIO_PATTERN.replace('{centreId}', centre.id);
                await this.page.waitForSelector(centreSelector);
                await this.page.click(centreSelector);
                await Promise.all([
                   this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
                   this.page.click(selectors.CONTINUE_TO_CALENDAR_BUTTON)
                ]);

                const foundDate = await this.checkCalendarForSlots(new Date(settings.alertBeforeDate), selectors);
                if (foundDate) {
                    const message = `🎉 Test found at ${centre.name} on ${foundDate.toLocaleDateString()}`;
                    this.logToUI(message);

                    switch (settings.bookingMode) {
                        case 'autoBook':
                            this.logToUI('   - 🤖 Auto-booking enabled. Attempting to book...');
                            await this.autoBookTest(selectors);
                            await this.stop();
                            break;
                        
                        case 'notify':
                            this.logToUI('   - 📣 Dry Run mode: Sending notification only.');
                            const notification = new Notification({
                                title: '✨ Earlier Test Slot Found!',
                                body: `Click here to book a test at ${centre.name} for ${foundDate.toLocaleDateString()}.`,
                                urgency: 'critical'
                            });
                            notification.on('click', () => this.shell.openExternal(urls.BASE_URL));
                            notification.show();
                            break;

                        default:
                            new Notification({ title: 'Earlier Test Found!', body: message }).show();
                            break;
                    }
                    return { found: true, message };
                }
                
                await this.page.goBack({ waitUntil: 'networkidle2' });
                await this.page.goBack({ waitUntil: 'networkidle2' });
            }
            this.logToUI('✅ Check complete. No suitable dates found this time.');
            
        } catch (error) {
            this.logToUI(`❌ An error occurred during check: ${error.message}`);
            this.log.error(error);
        } finally {
            if (this.page) await this.page.close();
            this.mainWindow.webContents.send('check-complete');
            this.isChecking = false; // ### RELEASE THE LOCK ###
        }
        return { found: false };
    }

    async checkCalendarForSlots(alertBeforeDate, selectors) {
        for (let i = 0; i < 6; i++) {
            const availableSlots = await this.page.$$(selectors.AVAILABLE_DATE_ANCHOR);
            for (const slot of availableSlots) {
                const dateStr = await this.page.evaluate(el => el.getAttribute('data-date'), slot);
                if (new Date(dateStr) < alertBeforeDate) {
                    await slot.click();
                    return new Date(dateStr);
                }
            }

            const monthHeaderSelector = selectors.CALENDAR_MONTH_YEAR_HEADER;
            const currentMonthText = await this.page.$eval(monthHeaderSelector, el => el.textContent.trim());

            await this.page.click(selectors.CALENDAR_NEXT_MONTH_BUTTON);

            await this.page.waitForFunction(
                (selector, prevText) => {
                    const newText = document.querySelector(selector)?.textContent.trim();
                    return newText && newText !== prevText;
                },
                { timeout: 10000 },
                monthHeaderSelector,
                currentMonthText
            );
        }
        return null;
    }

    async autoBookTest(selectors) {
        try {
            this.logToUI('      - Selecting first available time...');
            await this.page.waitForSelector(selectors.FIRST_AVAILABLE_SLOT_RADIO, { timeout: 5000 });
            await this.page.click(selectors.FIRST_AVAILABLE_SLOT_RADIO);
            await Promise.all([
                this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
                this.page.click(selectors.CONFIRM_SLOT_BUTTON)
            ]);

            this.logToUI('      - Confirming final change...');
            await this.page.waitForSelector(selectors.FINAL_CONFIRMATION_CHECKBOX);
            await this.page.click(selectors.FINAL_CONFIRMATION_CHECKBOX);
            await Promise.all([
                this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
                this.page.click(selectors.CONFIRM_CHANGE_BUTTON)
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