// this should only be used by content.js & background.js, so namespace is safe
if (typeof SimpleGmailNotes === 'undefined' || SimpleGmailNotes === null) {
  SimpleGmailNotes = {};
}

SimpleGmailNotes.settings = {
  IS_DEBUG: false,
  CLIENT_ID: "408564813280-vvn4gnid8dfi8miv9ol9ijdms2qgpdrt.apps.googleusercontent.com",
  CLIENT_SECRET: "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",
  SCOPE: 'https://www.googleapis.com/auth/drive.file',
  NOTE_FOLDER_NAMES: ["_SIMPLE_GMAIL_NOTES_", "Simple Gmail Notes"],
  ACCESS_TOKEN_KEY: "access_token",
  REFRESH_TOKEN_KEY: "refresh_token",
  // NOTIFICATION_DURATION: 3 * 24 * 60 * 60,
  NOTIFICATION_DURATION: 3 * 24 * 60 * 60,
  //NOTIFICATION_DURATION: 3 * 24 * 60 * 60,
  NOTIFICATION_MAX_COUNT: 2,
  MAX_RETRY_COUNT : 20,
  SHOW_REVIEW_URL: true,
  SHOW_SUBSCRIPTION_URGE: true,
  SHOW_SUBSCRIBER_OPTIONS: true,
  BROWSER_NAME: "chrome",
  CRM_LOGGED_OUT_TOKEN: '__CRM_LOGOUT__',
  CRM_EXPIRED_TOKEN: '__CRM_EXPIRED__',
};
