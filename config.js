// config.js

// These are now FALLBACK values in case the remote config fails to load.
const FALLBACK_CONFIG = {
    urls: {
        BASE_URL: 'https://www.gov.uk/change-driving-test',
    },
    selectors: {
        LICENCE_NUMBER_INPUT: '#driving-licence-number',
        BOOKING_REFERENCE_INPUT: '#application-reference-number',
        CONTINUE_BUTTON: '#continue-button',
        CHANGE_TEST_DATE_LINK: 'a[href*="/manage-booking/choose-time"]',
        TEST_CENTRE_INPUT: '#test-centre-name',
        FIND_CENTRE_BUTTON: '#find-test-centre-button',
        // Note the pattern change to allow dynamic ID insertion later
        SELECT_CENTRE_RADIO_PATTERN: `input[name="test-centre"][value="{centreId}"]`,
        CONTINUE_TO_CALENDAR_BUTTON: '#test-centre-submit',
        CALENDAR_NEXT_MONTH_BUTTON: 'a.BookingCalendar-nav--next',
        AVAILABLE_DATE_ANCHOR: 'td.BookingCalendar-date--bookable > a',
        FIRST_AVAILABLE_SLOT_RADIO: 'input[name="slot"][type="radio"]',
        CONFIRM_SLOT_BUTTON: '#slot-submit',
        FINAL_CONFIRMATION_CHECKBOX: '#change-confirmation',
        CONFIRM_CHANGE_BUTTON: '#booking-change-submit'
    }
};


module.exports = {
    FALLBACK_CONFIG
};