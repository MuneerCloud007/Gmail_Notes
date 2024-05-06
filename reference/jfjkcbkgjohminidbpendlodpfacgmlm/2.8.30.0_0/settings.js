// this should only be used by content.js & background.js, so namespace is safe
if (typeof SimpleGmailNotes === 'undefined' || SimpleGmailNotes === null) {
  SimpleGmailNotes = {};
}

SimpleGmailNotes.settings = {
  IS_DEBUG: false,
  CLIENT_ID: "38131814991-p4u809qrr5ee1bsehregd4os69jf2n7i.apps.googleusercontent.com",
  CLIENT_SECRET: "mdA0U_jSkAjI_1x8pdgtrx02",
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
  CRM_BASE_URL: "https://sgn.mobilecrm.io",
  SGN_WEB_LOGIN_BASE_URL: "https://app.simplegmailnotes.com",
  SUBSCRIBER_PORTAL_BASE_URL: "https://portal.simplegmailnotes.com/",
  BROWSER_NAME: "chrome",
  CRM_LOGGED_OUT_TOKEN: '__CRM_LOGOUT__',
  CRM_EXPIRED_TOKEN: '__CRM_EXPIRED__',
};
