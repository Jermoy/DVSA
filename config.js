// config.js

// URLs
const BASE_URL = 'https://www.gov.uk/change-driving-test';
const MANAGE_BOOKING_URL = 'https://driverpracticaltest.dvsa.gov.uk/manage-booking';

// Selectors (these are the most likely to change)
const SELECTORS = {
    // Login Page
    LICENCE_NUMBER_INPUT: '#driving-licence-number',
    BOOKING_REFERENCE_INPUT: '#application-reference-number',
    CONTINUE_BUTTON: '#continue-button',
    // Manage Booking Page
    CHANGE_TEST_DATE_LINK: 'a[href*="/manage-booking/choose-time"]',
    // Choose Test Centre Page
    TEST_CENTRE_INPUT: '#test-centre-name',
    FIND_CENTRE_BUTTON: '#find-test-centre-button',
    SELECT_CENTRE_RADIO: (centreName) => `input[name="test-centre"][value="${centreName}"]`,
    CONTINUE_TO_CALENDAR_BUTTON: '#test-centre-submit',
    // Calendar Page
    CALENDAR_NEXT_MONTH_BUTTON: 'a.BookingCalendar-nav--next',
    AVAILABLE_DATE_ANCHOR: 'td.BookingCalendar-date--bookable > a',
    // Found Test Time Page
    FIRST_AVAILABLE_SLOT_RADIO: 'input[name="slot"][type="radio"]',
    CONFIRM_SLOT_BUTTON: '#slot-submit',
    // Confirmation Page
    FINAL_CONFIRMATION_CHECKBOX: '#change-confirmation',
    CONFIRM_CHANGE_BUTTON: '#booking-change-submit'
};


module.exports = {
    BASE_URL,
    MANAGE_BOOKING_URL,
    SELECTORS
};