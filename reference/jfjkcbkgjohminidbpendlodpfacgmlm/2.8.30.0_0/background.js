/*jshint esversion: 9 */
/*
 * Simple Gmail Notes 
 * https://github.com/walty8
 * Copyright (C) 2017 Walty Yeung <walty@bart.com.hk>
 * License: GPLv3
 *
 * This script is going to be shared for both background and options page
 *
 */

// jshint undef:true
// jshint unused:true
// jshint node: true 


/* declare global variables */
//use a shorter name as we won't have name conflict here
var SGNC = window.SimpleGmailNotes;
var settings = window.SimpleGmailNotes.settings;
var debugLog = SGNC.debugLog;
var gPageSize = 80; // 80 notes include empty and duplicate
var gApiV3Fields = "files(id, name, description, modifiedTime, properties, parents)";
var gMaxWaiting = 2;
var gBaseWaiting = 1;
var gChunkSize = 20;

var getSgnMessageForInstallOrUpgrade = function(type) {
  var title = '';
  var contentString;
  if (type == "install") {
    title = "Simple Gmail Notes Installed";
    contentString = "<div class='title_tip'>" + 
              "<div class='item sub_title'>How to use Simple Gmail Notes:</div>" +
              "<div class='item tip_item'>1. Click any email</div>" +
              "<div class='item tip_item'>2. Click 'log in' link at the top of email</div>" +
              "<div class='item tip_item'>3. Write anything in the text area</div></div>";
  } else {
    title = "Simple Gmail Notes Updated";
    contentString = "<div class='title_tip'>" +
              "<div class='item sub_title'>New in " + SGNC.getExtensionVersion() + ":</div>" +
              "<div class='item tip_item'>- Misc bug fixes</div>" +
              "<div class='item sub_title'>Important Reminder:</div>" +
              "<div class='item tip_item'>Due to <a href='https://developer.chrome.com/blog/resuming-the-transition-to-mv3' target='_blank'>" +
              "Google policy about web extension Manifest V3</a>, SGN " +
              "will have a major upgrade for the next version. <b>You will still access previous SGN notes seamlessly</b>. " +
              "However, the SGN preferences, if you ever updated, will be lost and need to be set up again. " +
              "You are advised to manually screen capture the SGN settings for later restore purpose. " +
              "If you are a subscriber, you could export settings first and import later. </div>" +
            "</div>";
  }

	if (settings.SHOW_SUBSCRIPTION_URGE) {
		contentString += "<div class='item divide_line'></div>" + 
							"<div class='title_tip'><div class='item sub_title'>Important:</div>" +
							"<div class='item tip_item'>Your support is critical to us, if you do think the extension is useful, " +
							"please <a target='_blank' href='https://www.bart.com.hk/simple-gmail-notes-support-package/?f=n2'>" +
								"subscribe to SGN support package</a> to support the continuous development and maintenance of the extension. Thank you!</div></div>";
	}

  var gMessage = "<div class='title'><img class='sgn_logo' src='https://static-gl-media-i.simplegmailnotes.com/media/sgn_logo.png'/>" + title + "</div>" +
              contentString + 
              "<div class='sgn_message_font' >Powered by" +
                "<a  target='_blank' href='" + SGNC.getOfficalSiteUrl("nt") + "'>" +
                  "<img src='https://static-gl-media-i.simplegmailnotes.com/media/bart_logo_for_sgn.png'/></a></div>";
  return gMessage;
};


var gPreferenceTypes = [
  {"type": "select", "name": "abstractStyle", "default": "20", "title": "Note Abstract Style", "panelName": "notesAppearance",
    "option": [
      {"value": "none", "text": "(No Abstract)"},
      {"value": "fixed_SGN", "text": "(Fixed) (SGN)"},
      {"value": "inbox_reminder", "text": "(Inbox Reminder)"},
    ]
  },
  {"type": "checkbox", "name": "firstLineAbstract", "default": false, "title": "Only use first line for abstract", "panelName": "notesAppearance"},
  {"type": "checkbox", "name": "enableFlexibleHeight", "default": false, "title": "Enable Note Flexible Height",
   "panelName": "notesAppearance"},
  {"type": "select", "name": "noteHeight", "default": "4", "title": "Note height, in number of rows",
    "option": [], "panelName": "notesAppearance"},
  {"type": "select", "name": "notePosition", "default": "top", "title": "Note position", "panelName": "notesAppearance",
    "option": [
      {"text": "top"},
      {"text": "bottom"},
      {"value": "side-top", "text": "sidebar top"},
      {"value": "side-bottom", "text": "sidebar bottom"}
    ]
  },
  {"type": "select", "name": "abstractPosition", "default": "before-labels", "title": "Abstract Position", "panelName": "notesAppearance",
    "option": [
      {"value": "before-labels", "text": "Before Labels"},
      {"value": "after-labels", "text": "After Labels"}
    ]
  },
  {"type": "color", "name": "fontColor", "default": "#525252", "title": "Note font color", "panelName": "notesAppearance"},
  {"type": "color", "name": "backgroundColor", "default": "#FFFF99", "title": "Note background color", "panelName": "notesAppearance"},
  {"type": "select", "name": "fontSize", "default": "default", "title": "Note font size", "panelName": "notesAppearance",
    "option": [
      {"value": "default", "text": "(Default)"},
    ]
  },
  {"type": "checkbox", "name": "enableNoteFontBold", "default": "false", "title": "Note in Bold Font", "panelName": "notesAppearance"},
  {"type": "color", "name": "abstractFontColor", "default": "#525252", "title": "Abstract font color", "panelName": "notesAppearance"},
  {"type": "color", "name": "abstractBackgroundColor", "default": "#FFFF99", "title": "Abstract background color", "panelName": "notesAppearance"},
  {"type": "select", "name": "abstractFontSize", "default": "default", "title": "Abstract font size", "panelName": "notesAppearance",
    "option": [
      {"value": "default", "text": "(Default)"}
    ]
  },
  {"type": "select", "name": "printFontSize", "default": "default", "title": "Font size for printing", "panelName": "notesAppearance",
    "option": [
      {"value": "default", "text": "(Default)"},
    ]
  },
  {"type": "select", "name": "sidebarWidth", "default": "auto", "title": "Right Sidebar Width", "panelName": "notesAppearance",
    "option": [
      {"value": "auto", "text": "Auto"},
      {"value": "200px", "text": "Narrow"},
      {"value": "300px", "text": "Wide"},
    ]
  },


  {"type": "checkbox", "name": "usePopForLogin", "default": false, "panelName": "advancedFeatures",
    "title": "Always use new window for login <br/>(Enable this when default login does not work)"},
  {"type": "checkbox", "name": "showConnectionPrompt", "default": false, "panelName": "advancedFeatures",
    "title": "Show Prompt for Current <br/>Google Drive Account"},
  {"type": "checkbox", "name": "showAddCalendar", "default": true , "panelName": "advancedFeatures",
    "title": "Show Button of <br/>Add to Google Calendar"},
  {"type": "checkbox", "name": "showDelete", "default": true, "title": "Show Button of <br/>Delete", "panelName": "advancedFeatures"},
  {"type": "checkbox", "name": "showNoteColorPicker", "default": true, "panelName": "advancedFeatures",
    "title": "Show Button of <br/>Note Color Picker"},
  {"type": "checkbox", "name": "showNoteHistory", "default": false, "title": "Show Note History<br/>", "panelName": "deprecated"},
  {"type": "checkbox", "name": "showAbstractBracket", "default": true, "title": "Show bracket [] in the abstract",
  "panelName": "advancedFeatures"},
  {"type": "checkbox", "name": "enableNoDisturbMode", "default": false, "panelName": "advancedFeatures",
    "title": "Do Not Set Background Color <br/>When Note Is Empty"},
  {"type": "checkbox", "name": "enableRichtextEditor", "default": false, "title": "Enable Richtext Editor <br/>(Experimental)",
   "panelName": "advancedFeatures"},
  {"type": "checkbox", "name": "enableStripHTML", "default": false, "title": "Always Strip HTML Tags (useful when richtext editor is reverted)",
   "panelName": "advancedFeatures"},
  {"type": "checkbox", "name": "showPrintingNote", "default": true, "title": "Show Notes When Printing", "panelName": "advancedFeatures"},
  {"type": "checkbox", "name": "showSavingStatus", "default": true, "title": "Show Saving Status", "panelName": "advancedFeatures"},
  {"type": "checkbox", "name": "showNoteTimeStamp", "default": true, "title": "Show Note Modified Time",
   "panelName": "advancedFeatures"},
  {"type": "select", "name": "noteFolderName", "default": "_SIMPLE_GMAIL_NOTES_", "title": "Gmail Note Folder Name", "panelName": "advancedFeatures",
    "option": [
      {"value": "_SIMPLE_GMAIL_NOTES_", "text": "_SIMPLE_GMAIL_NOTES_"},
      {"value": "Simple Gmail Notes", "text": "Simple Gmail Notes"}
    ]
  },
  {"type": "checkbox", "name": "disableConsecutiveWarning", "default": false, "title": "Disable Warning for Consecutive Network Requests", "panelName": "advancedFeatures",
  },
  {"type": "checkbox", "name": "searchInhome", "default": true, "title": "Show search button in the email list page", "panelName": "advancedFeatures",
  },

  {"type": "list", "name": "disabledAccounts", "default": ""},

  {"type": "checkbox", "name": "showCRMButton", "default": true, "title": "Enable Simple Mobile CRM (uncheck this will hide CRM button and disable all CRM related functionalities)",
   "panelName": "simpleMobileCRM"},
  {"type": "checkbox", "name": "showCRMSuccessPage", "default": true, "title": "Show CRM Success Page After Sharing",
   "panelName": "simpleMobileCRM"},
  {"type": "select", "name": "showCRMSidebar", "default": "auto", "title": "Show CRM Sidebar",
   "panelName": "simpleMobileCRM",
    "option": [
      {"value": "auto", "text": "Align with SGN layout"},
      {"value": "always_show", "text": "Always show"},
      {"value": "always_hide", "text": "Always hide"},
    ]
  },
  {"type": "checkbox", "name": "showCRMPrompt", "default": true, "title": "Show CRM Prompt Under Note Textarea",
   "panelName": "simpleMobileCRM"},
  {"type": "checkbox", "name": "isPaid", "default": false, "title": "I am a SGN subscriber",
   "panelName": "subscriberOptions"},
   {"type": "text", "name": "subscriptionEmail", "default": "", "title": "Subscription Email",
    "panelName": "subscriberOptions"},
  {"type": "checkbox", "name": "showLogo", "default": true, "title": "Show Logo",
   "panelName": "subscriberOptions"},
  {
    "type": "checkbox", "name": "useAdvancedColors", "default": false, "title": "Use Advanced Colors",
   "panelName": "subscriberOptions",
  },
  {
    "type": "checkbox", "name": "usefontColors", "default": false, "title": "Add button to set up custom font color for each note",
   "panelName": "subscriberOptions",
  },
   {"type": "text", "name": "useCustomGoogleDrivefolder", "default": '', 
    "title": "Use custom Google Drive folder<div style='font-size:12px'>Caution: please make sure all PC are set to the same folder name if this is set.</div>" +
              "<a target='_blank' href='https://www.bart.com.hk/simple-gmail-notes-faq/#custom-folder-name'>Learn More</a>",
    "panelName": "subscriberOptions"},
  {
    "type": "checkbox", "name": "autoFocus", "default": false, "title": "Auto focus when opening note",
    "panelName": "subscriberOptions",
  },
  {"type": "checkbox", "name": "hideTextAreaForBlankNotes", "default": "false", "title": "Hide text area for empty notes", "panelName": "subscriberOptions",
   "htmlDescription": "<tr class='sgn_hide_empty_tr'><td colspan='2'><div style='display:flex;padding-top: 10px;'><img class='sgn_hide_empty_icon' src='" +
   SGNC.getIconBaseUrl() + "/hide-empty-icon.png'><div class='sgn_hide_empty_text'>When this option is checked, the text area is hidden when note is empty." +
   " You could always click the button in toolbar to activate the text area.</div></div></td></tr>" +
   "<tr class='sgn_hide_empty_tr'><td colspan='2'><img class='sgn_toolbar_button_img' src='" + SGNC.getIconBaseUrl() + "/toolbar_button.png'></td></tr>"},

  {"type": "list", "name": "disabledAccounts", "default": "[]", "panelName": "simpleMobileCRM"},

  {"type": "textarea", "name": "templateContent", "default": ""},
  {"type": "checkbox", "name": "templateAutoload", "default": false},
  {"type": "hidden", "name": "isPaid", "default": false},
  {"type": "hidden", "name": "isShowNotification", "default": ""},
  {"type": "hidden", "name": "subscriptionEmail", "default": ""}
];

var gSgnEmpty = "<SGN_EMPTY>";
var gSgnDeleted = "<SGN_DELETED>";
var gSgnCrmDeleted = 'sgn-crm-has-deleted';
var gDuplicateNotesForMany = [];
var debugGdriveScope = "debugGdrive";
var debugBackGroundScope = "debugBackGround";
var debugContentScope = "debugContent";
var debugPageScope = "debugPage";


/* -- end -- */

/*
 * Interface declarations
 *
 * The following methods MUST be implemented by the Firefox / Chrome extension
 */


var getSafariStorage = function(){
  return SGNC.getBrowser().storage.local;
};


// decide which use window object storage
var useWindowStorage = function() {
  return !SGNC.isSafari();
};


var gStorageCache = {};

var updateSafariStorageCache = function() {
  var storage = getSafariStorage();
  debugLog('@215, trying update cache');
  storage.get(null, function(latestValues){
    var valueKeyList = Object.keys(latestValues);
    for(var i=0; i<valueKeyList.length; i++){
      var key = valueKeyList[i];

      
      if(latestValues[key] !== gStorageCache[key]){
        debugLog('@220, updating cache...', key, latestValues[key], gStorageCache[key]);
        gStorageCache[key] = latestValues[key];
      }

    }
  });
};


// initialize storage cache
var initalizeStorageCache = function(){
  if(useWindowStorage()){
    gStorageCache = window.localStorage;
  }
  else {
    var storage = getSafariStorage();
    storage.get(null, function(value){
      gStorageCache = value;

      if(SGNC.isSafari() && window.setupPreferences){
        window.setupPreferences();
      }
    });

  }
};

initalizeStorageCache();

var setStorage = function(sender, key, value) {
  var email = sender;
  if(sender !== null && typeof sender === "object") {
    email = sender.email;
  }

  var storage;
  var storageKey;

  if(email)
    storageKey = email + "||" + key;
  else
    storageKey = key;

  if(value || value === false)
    value = String(value);

  if(useWindowStorage()){
    storage = window.localStorage;
    if(value || value === false){
      storage.setItem(storageKey, value);
      gStorageCache[storageKey] = value;
    }
    else{
      storage.removeItem(storageKey);
      delete gStorageCache[storageKey];
    }
  }
  else {
    storage = getSafariStorage();
    if(value || value === false){

      var valueToSet = {};
      valueToSet[storageKey] = value;
      storage.set(valueToSet);  // this is async
      gStorageCache[storageKey] = value;
    }
    else{
      if(storageKey in storage){
        storage.remove(storageKey); // this is async
      }

      if(storageKey in gStorageCache){
        delete gStorageCache[storageKey];
      }
    }

  }
};

var getStorage = function(sender, key, skipLog) {
  var email = sender;
  if(sender !== null && typeof sender === "object") {
    email = sender.email;
  }
  if(!email || email.indexOf("@") < 0){
    // debugLog("Get storage email not found.");
  }

  var storageKey;

  if(email)
    storageKey = email + "||" + key;
  else
    storageKey = key;

  var value;

  var storage = gStorageCache;
  value = storage[storageKey];

  if(value || value === false)
    value = String(value);

  if(!skipLog)
    debugLog("Get storage result", email, key, value);


  // debugLog("@341", storageKey, value);
  return value;
};

var openTab = function(page){
  var browser = SGNC.getBrowser();

  if(SGNC.isChrome() || SGNC.isEdge())
    browser.tabs.create({"url": "chrome-extension://" + SGNC.getExtensionID() + "/" + page});
  else
    browser.tabs.create({"url" : browser.runtime.getURL(page)});
};


var sendContentMessage = function(sender, message) {
  if(!message.action || message.action != 'heart_beat_response'){
    debugLog('@222', sender, message);
  }
  // debugLog('@221', sender, message);
  SGNC.getBrowser().tabs.sendMessage(sender.worker.tab.id, message,
    function(response) {    // jshint ignore:line
    //debugLog("Message response:", response);
  });
};


// catch error for ajax result handling
var sendAjax = function(config) {
  if(config.success){
    var successOld = config.success;
    config.success = function(data){
      executeCatchingErrorBackground(function(){
        successOld(data);
      }, "ajax-success");
    };
  }

  if(config.error){
    var errorOld = config.error;
    config.error = function(data){
      executeCatchingErrorBackground(function(){
        errorOld(data);
      }, "ajax-error");
    };
  }
  $.ajax(config);
};

var iterateArray = function(arr, callback){
  $.each(arr, callback);
};


var handleGoogleAuthCode = function(code, sender, messageId, title, loginType) {
  debugLog("Code collected", code);
  if(!code || code.indexOf("error=") > 0 ){
    var error = "";
    if(!code)
      error = getLastError();
    else{
      //https://xxx/?error=access_denied#"
      error = code.split("error=")[1];
      error = error.replace(/#/g, '');
    }
        
    //var message = "[loginGoogleDrive]" + error;
    //SGNC.appendLog(message, debugGdriveScope);
    appendGdriveLog("loginGoogleDrive", error);
    sendContentMessage(sender, {action:"show_log_in_prompt"});
    sendContentMessage(sender, {action:"disable_edit"});

    sendContentMessage(sender, {action:"show_error", 
                                type:"login",
                                message:error});
  }else{
    //get code from redirect url
    if(code.indexOf("=") >= 0)  //for chrome
      code = code.split("=")[1];

    if(code.indexOf("&") >= 0)  //for chrome
      code = code.split("&")[0];

    code = code.replace("%2F", "/");

    code = code.replace(/[#]/g, "");
    debugLog("Collected code:" + code);
    setStorage(sender, "code", code);
    updateRefreshTokenFromCode(sender, messageId, title, loginType);
  }

};

var launchAuthorizer = function(sender, messageId, title) {
  debugLog("Trying to login Google Drive.");
  var clientId = settings.CLIENT_ID;
  var scope = settings.SCOPE;
  var result = SGNC.getBrowser().identity.launchWebAuthFlow(
    {"url": "https://accounts.google.com/o/oauth2/auth?" +
      $.param({"client_id": clientId,
          "scope": scope,
          "redirect_uri": SGNC.getRedirectUri(),
          "response_type":"code",
          "access_type":"offline",
          "login_hint":sender.email,
          //"login_hint":"",
          "prompt":"consent select_account"
      }),
      "interactive": true
    },
    function(code) {
      console.log(SGNC.getRedirectUri());
      handleGoogleAuthCode(code, sender, messageId, title);
    }
  );

  debugLog("authentication result: ", result);
};

var getLastError = function(){
  return SGNC.getBrowser().runtime.lastError.message;
};

var getUserEmails = function(){
  var keys = Object.keys(getPreferences());
  var userEmails = new Set();
  for(var i = 0; i<keys.length; i++){
    if(keys[i].includes('||')){
      userEmails.add(keys[i].split('||')[0]);
    }
  }

  return Array.from(userEmails);
};
/*
 * Shared Utility Functions
 */

function pushPreferences(preferences){
  $.each(gPreferenceTypes, function(index, typeInfo){
    var key = typeInfo["name"];
    if(key==='useCustomGoogleDrivefolder'){
      var lastCustomFolderName = getStorage(null, 'useCustomGoogleDrivefolder');
      if(preferences[key] && (!lastCustomFolderName || lastCustomFolderName!==preferences[key])){
        setStorage(null, 'lastCustomFolderName', lastCustomFolderName);
      }
    }
    setStorage(null, key, preferences[key]);
  });
  setStorage(null, 'preference_version', Date.now());
}

function pushSubscribedInfo(email, paid){
  setStorage(null, 'subscriptionEmail', email);
  setStorage(null, 'isPaid', paid);
  setStorage(null, 'preference_version', Date.now());
}

function getSubscribedInfo(){
  var email = getStorage(null, 'subscriptionEmail');
  var paid = getStorage(null, 'isPaid');
  if(paid === 'true'){
    paid = true;
  }else{
    paid = false;
  }

  if(paid && !email){
    var userEmails = getUserEmails();
    if(userEmails.length)
      email = userEmails[0];
  }

  return {'email': email, 'paid': paid};
}

function getNotificationInfo(){
  var count = getStorage(null, 'notificationCount');
  var timestamp = getStorage(null, 'notificationTimestamp');
  if(!count){
    count = '0';
    setStorage(null, 'notificationCount', count);
  }

  if(!timestamp){
    timestamp = Date.now();
    setStorage(null, 'notificationTimestamp', timestamp);
  }

  return {'count': parseInt(count), 'timestamp': parseInt(timestamp)};
}

function incrementNotificationCount(){
  var notificationInfo = getNotificationInfo();
  var count = notificationInfo.count;
  if(count < (settings.NOTIFICATION_MAX_COUNT - 1)){
    count += 1;
    setStorage(null, 'notificationCount', count);
  }else{
    // reset notification
    setStorage(null, 'notificationCount', 0);
    setStorage(null, 'notificationTimestamp', Date.now());
  }
}

function updateSubscribedInfoIfNeeded(forceUpdate){
  var subscribedInfo = getSubscribedInfo();
  if(!subscribedInfo.paid){
    return;
  }

  var notificationInfo = getNotificationInfo();
  var nextNotificationTime = notificationInfo.timestamp + (settings.NOTIFICATION_DURATION * 1000);
  var now = Date.now();
  if(forceUpdate || nextNotificationTime <= now){  // need to recheck
    if(!forceUpdate){
      setStorage(null, 'notificationTimestamp', Date.now());
    }

    try{
      subscribedInfo = getSubscribedInfo();
      var sgnEmail = subscribedInfo.email;
      var sgnPaid = checkSubscribedInfo(subscribedInfo);
      if(sgnPaid){
        updateSubscribedInfoAjax(sgnEmail);
      }
    }catch(error){
      console.error(error);
    }
  }
}

function isShowNotification(subscribedInfo){
  if(!settings.SHOW_SUBSCRIBER_OPTIONS){
    return false;
  }

  if(subscribedInfo.paid){
    return false;
  }

  var isShow = false;
  var notificationInfo = getNotificationInfo();
  var now  = Date.now();

  var nextNotificationTime = notificationInfo.timestamp + (settings.NOTIFICATION_DURATION * 1000);
  if(nextNotificationTime <= now){
      isShow = true;
  }
  return isShow;
}


var appendGdriveLog = function(prefix, message, postfix){
  var result = "";

  if(message && typeof(message) !== 'string'){
    message = SGNC.getErrorMessage(message);
  }

  if(prefix)
    result = result + "[" + prefix + "]";

  if(message)
    result = result + message;

  if(postfix)
    result = result + "[" + postfix + "]";

  SGNC.appendLog(result, debugGdriveScope);
};

var executeCatchingErrorBackground = function(func, prefix){
  try{
    func();
  }
  catch(err){
    appendGdriveLog(prefix, err);
  }
};

var isEmptyPrefernce = function(preference){
  var val = String(preference);
  return val === "" || val == "null" || val == "undefined";
};

var updateDefaultPreferences = function(preferences){
  var hideListingNotes = (preferences["hideListingNotes"] === "true");
  //for backward compatible
  if(hideListingNotes){
    preferences["abstractStyle"] = "none";
    delete preferences["hideListingNotes"];
  }
  for (var i=0; i < gPreferenceTypes.length; i++) {
    var defaultValue = gPreferenceTypes[i]["default"];
    var preferencesName = gPreferenceTypes[i]["name"];
    if (isEmptyPrefernce(preferences[preferencesName])) {
      preferences[preferencesName] = defaultValue;
    }
  }
  if(!settings.NOTE_FOLDER_NAMES.includes(preferences["noteFolderName"])) {
    preferences["noteFolderName"] = "_SIMPLE_GMAIL_NOTES_";
  }

  if(SGNC.isSafari()){
    preferences["showCRMButton"] = false;
  }
  return preferences;
};

var getPreferences = function(){
  var preferences = {...gStorageCache};

  var finalPrefences = updateDefaultPreferences(preferences);
  var keyList = Object.keys(finalPrefences);
  for(var i=0; i<keyList.length; i++){
    var key = keyList[i];
    finalPrefences[key] = String(finalPrefences[key]);
  }

  return finalPrefences;
};

var getPreferenceAbstractStyle = function() {
  var preferences = getPreferences();
  var abstractStyle = preferences["abstractStyle"];

  return abstractStyle;
};

//Post message to google drive via REST API
//Reference: https://developers.google.com/drive/web/quickstart/quickstart-js

var getMultipartRequestBody = function(metadata, content){

  var boundary = "-------314159265358979323846";
  var contentType = "text/plain";
  var delimiter = "\r\n--" + boundary + "\r\n";
  var close_delim = "\r\n--" + boundary + "--";
  var multipartRequest;
  var multipartRequestContent =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(metadata) ;

  if(content){
       var base64Data = btoa(window.unescape(encodeURIComponent(content)));
       multipartRequestContent = multipartRequestContent +
        delimiter +
            'Content-Type: ' + contentType + '\r\n' +
            'Content-Transfer-Encoding: base64\r\n' +
            '\r\n' +
            base64Data;

  }
        
  multipartRequestContent = multipartRequestContent + close_delim;
  multipartRequest = {
      multipartRequestBody: multipartRequestContent,
      boundary: boundary
  };
  return multipartRequest;

};

var postNote = function(sender, messageId, emailTitleSuffix, gdriveFolderId, gdriveNoteId, content, properties){
  debugLog("Posting content", content);
  debugLog("Google Drive folder ID", gdriveFolderId);

  executeIfValidToken(sender, function(){
    var uploadUrl =  "https://www.googleapis.com/upload/drive/v2/files";
    var methodType = "POST";

    if(gdriveNoteId){  //update existing one
      uploadUrl += "/" + gdriveNoteId;
      methodType = "PUT";
    }

    var noteDescripton = SGNC.stripHtml(content).substring(0,4096);
    if(content == gSgnEmpty){
      noteDescripton = gSgnEmpty;
    }

    var metadata = { title:messageId + " - " + emailTitleSuffix , parents:[{"id":gdriveFolderId}], 
                     description: noteDescripton, properties:properties};
    
    var multipartRequest = getMultipartRequestBody(metadata, content);
    sendAjax({
      type:methodType,
      url:uploadUrl + "?uploadType=multipart",
      headers: {
          "Authorization": "Bearer " + getStorage(sender, settings.ACCESS_TOKEN_KEY)
      },
      contentType: "multipart/related; boundary=\"" + multipartRequest.boundary + "\"",
      data: multipartRequest.multipartRequestBody,
      success: function(data){
        if(data.labels.trashed){  // recover the note
          var undeleteUrl =  "https://www.googleapis.com/drive/v2/files/" + gdriveNoteId + "/untrash";
          sendAjax({
            type: 'POST',
            url: undeleteUrl,
            dataType: 'json',
            contentType: 'application/json',
            data: '',
            headers: {
                "Authorization": "Bearer " + getStorage(sender, settings.ACCESS_TOKEN_KEY)
            },
            error: function(data){
              window.appendLog("faileUntrashNote", data);
            }
          });
        }
        debugLog("message posted successfully");
        sendContentMessage(sender, {action:"revoke_summary_note", 
                                    messageId: messageId,
                                    description: noteDescripton,
                                    properties: properties,
                                    gdriveNoteId: data["id"],
                                    gdriveFolderId: data["parents"][0]["id"]});

        sendContentMessage(sender, {action:"show_timestamp_and_notice", 
                                    messageId: messageId,
                                    modifiedTime: formatDate(data.modifiedDate, true)
                                    });
      },
      error: function(data){
        //var message = "[postNote]" + JSON.stringify(data);
        //SGNC.appendLog(message, debugGdriveScope);
        appendGdriveLog("postNote", data);
        sendContentMessage(sender, {action:"show_error", 
                                    type:"custom", 
                                    message:"Faild post message, error: " + 
                                      JSON.stringify(data)});
      }
    });
  });
};

var showRefreshTokenError = function(sender, error){
  if(error && typeof(error) === "object"){
    if(error.responseText && error.responseText.indexOf("{") >= 0){ 
      //got an explicit error from google
      logoutGoogleDrive(sender);
    }
    error = JSON.stringify(error);
  }

  //var preferences = getPreferences();
  //preferences['debugBackgroundInfo'] += " Refresh token error: " + error + ".";
  var message = " Refresh token error: " + error + ".";
  SGNC.appendLog(message, debugBackGroundScope);

  sendContentMessage(sender, {action:"show_error", type:"revoke"});
};


var updateRefreshTokenFromCode = function(sender, messageId, title, loginType){
  var clientId = settings.CLIENT_ID;
  var clientSecret = settings.CLIENT_SECRET;
  var refreshTokenKey = settings.REFRESH_TOKEN_KEY;
  var accessTokenKey = settings.ACCESS_TOKEN_KEY;


  // console.log('@555', clientId, loginType);
  sendAjax({
    type: "POST",
    contentType: "application/x-www-form-urlencoded",
    data: {
        "code":getStorage(sender, "code"),
        "client_id": clientId,
        "client_secret": clientSecret,
        "redirect_uri": SGNC.getRedirectUri(loginType),
        "grant_type":"authorization_code"
    },
    url: "https://www.googleapis.com/oauth2/v3/token",
    error: function(data){
      //var message = "[updateRefreshTokenFromCode]" + JSON.stringify(data);
      //SGNC.appendLog(message, debugGdriveScope);
      appendGdriveLog("updateRefreshTokenFromCode", data);
      showRefreshTokenError(sender, data);
    },
    success: function(data){
      if(!data.refresh_token){
        showRefreshTokenError(sender, 
          "Google Drive token could not be collected.");
        //for future revoking
        setStorage(sender, accessTokenKey, data.access_token); 
      }else{
        debugLog("Updated refresh token", data);
        setStorage(sender, refreshTokenKey, data.refresh_token);
        setStorage(sender, accessTokenKey, data.access_token);

        initialize(sender, messageId, title);
        updateUserInfo(sender);
      }
    }
  });
};

var updateUserInfo = function(sender){
  /*
  if(getStorage(sender, "gdrive_email")){
    sendContentMessage(sender, {action:"update_user", 
                         email:getStorage(sender, "gdrive_email")});
    return;
  }
  */

  executeIfValidToken(sender, function(){
    sendAjax({
      url:"https://www.googleapis.com/drive/v2/about?access_token=" + 
        getStorage(sender, settings.ACCESS_TOKEN_KEY),
      success:function(data){
	      debugLog("@850, set storage");
        setStorage(sender, "gdrive_email", data.user.emailAddress);
        sendContentMessage(sender, {action:"update_user", 
                             email:data.user.emailAddress});
      },
      error:function(data){
        //var message = "[updateUserInfo]" + JSON.stringify(data);
        //SGNC.appendLog(message, debugGdriveScope);
        appendGdriveLog("updateUserInfo", data);
        sendContentMessage(sender, {action:"show_error", type:"user"});
      }
    });
  });
};

var executeIfValidToken = function(sender, command){
  var clientId = settings.CLIENT_ID;
  var clientSecret = settings.CLIENT_SECRET;
  var refreshTokenKey = settings.REFRESH_TOKEN_KEY;
  var accessTokenKey = settings.ACCESS_TOKEN_KEY;


  if(!getStorage(sender, accessTokenKey) && 
     !getStorage(sender, refreshTokenKey)){  //if acccess token not found
      
    debugLog("@197, no token found, skip the verification");
    showRefreshTokenError(sender, "No token found.");
    return;
  }

  sendAjax({
    url:"https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=" + 
          getStorage(sender, accessTokenKey),
    timeout: 10000,
    success:function(data){
      command(data);
    },
    error:function(data){
      debugLog("@474, token not valid!: " + data);
      //get a new access token
      if(data["status"] && parseInt(data["status"]) >= 400){
        sendAjax({
          type: "POST",
          contentType: "application/x-www-form-urlencoded",
          data: {
              "refresh_token": getStorage(sender, refreshTokenKey),
              "client_id": clientId,
              "client_secret": clientSecret,
              "redirect_uri": SGNC.getRedirectUri(),
              "grant_type": "refresh_token"
          },
          url: "https://www.googleapis.com/oauth2/v3/token",
          success:function(data){
            debugLog("Renewed token");
            setStorage(sender, accessTokenKey, data.access_token);
            command(data);
          },
          error:function(data){
            //var message = "[executeIfValidToken]" + JSON.stringify(data);
            //SGNC.appendLog(message, debugGdriveScope);
            appendGdriveLog("executeIfValidToken", data);
            showRefreshTokenError(sender, data);
          }
        });
      }
      else{
        sendContentMessage(sender, {action:"show_error", 
                                    type:"custom",
                                    message:"Network error found, please check your connectivity to Google servers."});
      }
    }
  });
};

var logoutGoogleDrive = function(sender){
  setStorage(sender, "code", "");
  setStorage(sender, settings.ACCESS_TOKEN_KEY, "");
  setStorage(sender, settings.REFRESH_TOKEN_KEY, "");
  setStorage(sender, "gdrive_email", "");
  setStorage(sender, "crm_user_email", "");
  setStorage(sender, "crm_user_token", settings.CRM_LOGGED_OUT_TOKEN);
  sendContentMessage(sender, {action:"show_log_in_prompt"});
  sendContentMessage(sender, {action:"disable_edit"});
};


var loadMessage = function(sender, gdriveNoteId, messageId, properties,
  description, modifiedTime, baseWaiting){
  if(baseWaiting === undefined)
    baseWaiting = gBaseWaiting; //default retry count

  sendAjax({
    type:"GET",
    headers: {
      "Authorization": "Bearer " + getStorage(sender, settings.ACCESS_TOKEN_KEY)
    },
    url: "https://www.googleapis.com/drive/v3/files/" + 
          gdriveNoteId + "?alt=media",
    success: function(data) {
      debugLog("Loaded message", data);
      if(data == gSgnEmpty || SGNC.isMarkCrmDeleted(properties))
        data = "";

      if(!properties)
        properties = [];

      sendContentMessage(sender, {action:"update_content", content:data, 
                                  messageId:messageId, gdriveNoteId:gdriveNoteId, 
                                  description: description,
                                  properties:properties, modifiedTime: modifiedTime});

      sendContentMessage(sender, {action:"enable_edit", 
                                  content:data, 
                                  description: description,
                                  properties:properties,  
                                  messageId:messageId, 
                                  gdriveEmail:getStorage(sender, "gdrive_email")});  
    },
    error: function(data){
      appendGdriveLog("loadMessage", data);

      //var message = "[loadMessage]" + JSON.stringify(data);
      //SGNC.appendLog(message, debugGdriveScope);
      if(data["status"] && parseInt(data["status"]) >= 400 && baseWaiting <= gMaxWaiting){
        var sleepTime = parseInt((baseWaiting + Math.random()) * 1000);
        debugLog("@969, will retry after", sleepTime);
        setTimeout(function(){
          loadMessage(sender, gdriveNoteId, messageId, properties,
            description, modifiedTime, baseWaiting * 2);
        }, sleepTime);
      }
      else{
        sendContentMessage(sender, {action:"show_error", 
                             type: "custom", 
                             message:"Faild load message, error: " + 
                                      JSON.stringify(data)});
      }
    }
  });
};


var getFolderName = function(){
  var preferences = getPreferences();
  var folderName = preferences["noteFolderName"];
  if(preferences["isPaid"] && preferences["useCustomGoogleDrivefolder"] && preferences["isPaid"]==="true"){
    folderName = preferences["useCustomGoogleDrivefolder"];
  }

  return folderName;
};

var getFolderQuery = function(){
  var query = "";
  var defaultFolderNames = settings.NOTE_FOLDER_NAMES;
  for(var i=0;i<defaultFolderNames.length;i++){
    query = query + " name contains '" + defaultFolderNames[i] +"'";
    if(i != defaultFolderNames.length - 1){
      query = query + " or ";
    }
  }

  var currentFolderName = getFolderName();

  if(!defaultFolderNames.includes(currentFolderName)){
    query = query + " or name='" + currentFolderName + "'";
  }

  if (query) {
    query = ' (' + query + ") and mimeType='application/vnd.google-apps.folder' and 'root' in parents";
  }

  return query;
};


var getNoteFolderNames = function(){
  var noteFolderNames = settings.NOTE_FOLDER_NAMES;
  var lastCustomFolderName = getStorage(null, 'lastCustomFolderName');
  if(lastCustomFolderName && !noteFolderNames.includes(lastCustomFolderName)){
    noteFolderNames.push(lastCustomFolderName);
  }
  var folderName = getFolderName();
  if(!noteFolderNames.includes(folderName)){
    noteFolderNames.push(folderName);
  }
  return noteFolderNames;
};


//Set up notes token validity checking
var setupNotesFolder = function(sender, description, properties, messageId){
  sendAjax({
      type: "POST",
      dataType: 'json',
      contentType: "application/json",
      headers: {
          "Authorization": "Bearer " + getStorage(sender, settings.ACCESS_TOKEN_KEY)
      },
      data: JSON.stringify({
            "title": getFolderName(),
            "parents": [{"id":"root"}],
            "mimeType": "application/vnd.google-apps.folder"
      }),
      url: "https://www.googleapis.com/drive/v2/files",
      success: function(data){
       var gdriveFolderId = data.id;
       sendContentMessage(sender, {action:"update_gdrive_note_info", 
                            gdriveNoteId:"", 
                            gdriveFolderId:gdriveFolderId});
       //ready for write new message
       sendContentMessage(sender, {action:"enable_edit",
                                   content:'',
                                   description:description,
                                   properties:properties,
                                   messageId:messageId,
                                   gdriveEmail:getStorage(sender, "gdrive_email")});
       debugLog("Data loaded:", data);
     },
    error: function(data){
      //var message = "[setupNotesFolder]" + JSON.stringify(data);
      //SGNC.appendLog(message, debugGdriveScope);
      appendGdriveLog("setupNotesFolder", data);
    }
  });
};

var sendAjaxAfterValidToken = function(sender, query, ajaxData, success_cb, error_cb, baseWaiting) {
  executeIfValidToken(sender, function(){
    sendAjax({
      type:"GET",
      dataType: 'json',
      contentType: "application/json",
      data: ajaxData,
      headers: {
          "Authorization": "Bearer " + getStorage(sender, settings.ACCESS_TOKEN_KEY)
      },
      url: query,
      success:function(data){
        debugLog("@1063", query, data);

        //remove the items in the trash
        if(data.items && data.items.length){
          for(var i = data.items.length - 1; i >= 0; i--) {
            var item = data.items[i];
            if(item.labels && item.labels.trashed) { // a trashed item
               data.items.splice(i, 1);
            }
          }
        }

        success_cb(data);
      },
      error:function(data){
        debugLog("@1063b", query, data);
        if(data["status"] && parseInt(data["status"]) >= 400 && baseWaiting <= gMaxWaiting){
          appendGdriveLog("gdriveQueryRetry", data, query);
          var sleepTime = parseInt((baseWaiting + Math.random()) * 1000);
          setTimeout(function(){
            sendAjaxAfterValidToken(sender, query, ajaxData, success_cb, error_cb, baseWaiting * 2);
          }, sleepTime);
        }
        else{
          //maxmium attempts reached
          if(error_cb) 
            error_cb(data);

          appendGdriveLog("gdriveQueryFail", baseWaiting, data, query);
          const errorMessage = "Google Drive error: " +
            JSON.stringify(data) +
            '<br>Gdrive Query Retry: ' +
            JSON.stringify(query);
          sendContentMessage(sender, {action:"show_error",
                                      type:"custom",
                                      message: errorMessage});

        }
      }
    });
  });
};

var appendQueryTrashedParam = function(query) {
  if(!query.startsWith("trashed")){  //only append once
      query = "trashed = false and ( " + query + ")";

      debugLog("@1118", query);
      query = encodeURIComponent(query);
  }

  debugLog("Search message by query:", query);
  return query;
};

/*
var gdriveQuery = function(sender, query, success_cb, error_cb, baseWaiting){
  if(baseWaiting === undefined)
    baseWaiting = gBaseWaiting; //default retry count

  query = appendQueryTrashedParam(query);
  var queryUrl = "https://www.googleapis.com/drive/v2/files?q=" + query;
  sendAjaxAfterValidToken(sender, queryUrl, {}, success_cb, error_cb, baseWaiting);

};
*/

var gdriveQueryV3 = function(sender, query, success_cb, error_cb, baseWaiting){
  if(baseWaiting === undefined)
    baseWaiting = gBaseWaiting; //default retry count

  query = appendQueryTrashedParam(query);
  var queryUrl = "https://www.googleapis.com/drive/v3/files?q=" + query;

  var request = {
    "fields":"nextPageToken, " + gApiV3Fields
  };

  sendAjaxAfterValidToken(sender, queryUrl, request, function(data) {
    if(data.files){  //v3 handling
      data.items = data.files;
      for(var i=0; i<data.items.length; i++){
        var item = data.items[i];
        item.title = item.name;
        item.modifiedDate = item.modifiedTime

        var properties = item["properties"];
        debugLog("@144", properties);
        if(properties){
          var propertyList = [];
          var propertyKeys = Object.keys(properties);
          for(var j=0; j<propertyKeys.length; j++){
            var key = propertyKeys[j];
            var value = properties[key];
            propertyList.push({"key" : key, "value" : value, "visibility": "PUBLIC"});
          }

          Object.assign(item, {"properties": propertyList});
          
        }


      }
    }

    debugLog("@1159, gdriveQueryV3 result", data);
    success_cb(data);
  }, error_cb, baseWaiting);
};

/*
var renameNoteFolder = function(sender, folderId){

  sendAjax({
    type:"PATCH",
    dataType: "json",
    url: "https://www.googleapis.com/drive/v2/files/" + folderId,
    headers: {
        "Authorization": "Bearer " + getStorage(sender, settings.ACCESS_TOKEN_KEY)
    },
    contentType: "application/json",
    data: JSON.stringify({
            "title": getFolderName(),
            "mimeType": "application/vnd.google-apps.folder"
      }),

    success: function(data){
      debugLog("change note name successfully");
    },
    error: function(data){
      //var message = "[renameNoteFolder]" + JSON.stringify(data);
      //SGNC.appendLog(message, debugGdriveScope);
      appendGdriveLog("renameNoteFolder", data);

      sendContentMessage(sender, {action:"show_error", 
                              type:"custom", 
                              message:"Faild change name, error: " + 
                              JSON.stringify(data)});
    }
  });
      
};
*/


var removeDuplicateAndEmptyMessages = function(messageList){
  var finalMessageList = [];
  var foundMessage = {};
  var i, message, messageId;
  gDuplicateNotesForMany = [];
  //the logic must be in two rounds

  //remove duplicate ones
  for(i=0; i<messageList.length; i++){
    message = messageList[i];
    messageId = message["id"];

    if(foundMessage[messageId]){
      gDuplicateNotesForMany.push(message); 
      continue;
    }

    if(message["description"] == gSgnEmpty || message["description"] == gSgnDeleted)
      continue;

    foundMessage[messageId] = true;
    finalMessageList.push(message);

    if(finalMessageList.length > gPageSize)
      break;
  }


  return finalMessageList;
  
};


var getFolderItemsFromQueryResult = function(items) {
    var i, j, currentItem, currentFolderName;
    var gdriveFolders=[];

    //first pass, get folder id for gmail notes
    for(i=0; i<items.length; i++){
      currentItem = items[i];
      var noteFolderNames = getNoteFolderNames();
      for(j=0; j<noteFolderNames.length; j++){
        currentFolderName = noteFolderNames[j];
        // debugLog('@1373', noteFolderNames, currentItem)
        if(currentFolderName.toLowerCase() == currentItem.title.toLowerCase() &&
           currentItem.parents && currentItem.parents[0]){
          //found the root folder
          // gdriveFolderId = currentItem.id;

          gdriveFolders.push(currentItem);
        }
      }
    }

  debugLog("@1257", items, gdriveFolders);
  return gdriveFolders;
};

// do not rename old folder names for now (i.e. 3rd parameter is always false now)
var getFolderIdsFromQueryResult = function(items){
  var gdriveFolders = getFolderItemsFromQueryResult(items);
  var gdriveFolderIds = [];

  for(var i=0; i<gdriveFolders.length; i++){
    gdriveFolderIds.push(gdriveFolders[i].id);
  }

  return gdriveFolderIds;
};

var getCurentFolderId = function(items){
  var gdriveFolders = getFolderItemsFromQueryResult(items);
  var folderName = getFolderName();
  var folderId = "";

  for(var i=0; i<gdriveFolders.length; i++){
    var item = gdriveFolders[i];
    if(item.title.toLowerCase() == folderName.toLowerCase()){
      folderId = item.id; // do not break, try to get the last one
    }
  }

  return folderId;
};

//list the files created by this app only (as restricted by permission)
var searchNote = function(sender, messageId, title){
  // debugLog("@1065 messageId", messageId);
   
  var query = getFolderQuery() + " or name contains '" + messageId +"'";
  gdriveQueryV3(sender, query, 
    function(data){ //success callback
      var gdriveNoteId = "";
      var properties = [];
      var description = "";
      var modifiedTime = "";
      var i, currentItem;

      debugLog("@403", query, data);

      var gdriveCurrentFolderId = getCurentFolderId(data.items);
      var gdriveFolderIds = getFolderIdsFromQueryResult(data.items);

      debugLog("@1468, current folder id", gdriveCurrentFolderId);
      if(!gdriveCurrentFolderId){
        setupNotesFolder(sender, description, properties, messageId);
      }

      if(gdriveFolderIds.length){
        //second pass find the document
        debugLog("Searching message", messageId);
        for(i=0; i<data.items.length; i++){
          currentItem = data.items[i];
          /*
          if(currentItem.description === gSgnDelete)
            continue;
            */
          if(messageId.length &&
             currentItem.title.indexOf(messageId) === 0 && 
             gdriveFolderIds.includes(currentItem.parents[0])){
            gdriveNoteId = currentItem.id;
            properties = currentItem.properties;
            description = currentItem.description;
            modifiedTime = formatDate(currentItem.modifiedDate, true);
            break;
          }
        }

        debugLog("Google Drive Folder ID found", gdriveNoteId);
//
        
        sendContentMessage(sender, {action:"update_gdrive_note_info", 
                           gdriveNoteId:gdriveNoteId, 
                           gdriveFolderId:gdriveFolderIds[0]});
        if(gdriveNoteId){
          loadMessage(sender, gdriveNoteId, messageId, properties, description, 
                modifiedTime);

          var preferences = getPreferences();
          if(preferences['showNoteHistory'] !== 'false' && title){
            // searchNoteHistory(sender, gdriveFolderIds[0], messageId, title);
          }
        }else{//ready for write new message
          sendContentMessage(sender, {
              action:"enable_edit",
              content:'',
              description:description,
              properties:properties,
              messageId:messageId,
              gdriveEmail:getStorage(sender, "gdrive_email")
          });
        }
      }
    },
    function(data){ //error callback
      //showRefreshTokenError(sender, data);
      //var message = "[searchNote]" + JSON.stringify(data);
      //SGNC.appendLog(message, debugGdriveScope);
      appendGdriveLog("searchNote", data);
    }
  );
};

//Do as much initilization as possible, while not trigger login page
var initialize = function(sender, messageId, title){
  var accessTokenKey = settings.ACCESS_TOKEN_KEY;
  var refreshTokenKey = settings.REFRESH_TOKEN_KEY;
  var preferences = getPreferences();

  // the following may update version number
  updateShowNotificationIfNeeded();

  // update subscribe info each time note is loaded
  updateSubscribedInfoIfNeeded();

  debugLog("@476", preferences);
  if(getStorage(sender, refreshTokenKey)){
    debugLog("Initializing, current refresh token:", 
                getStorage(sender, refreshTokenKey), 
                accessTokenKey, 
                getStorage(sender, accessTokenKey));
    searchNote(sender, messageId, title);

    //if(preferences['showNoteHistory'] !== 'false'){
      //searchNoteHistory(sender, messageId, title); 
    //}
  }
  else{ //no refresh token
    if(getStorage(sender, accessTokenKey)){
      logoutGoogleDrive(sender);
    }
    sendContentMessage(sender, {action:"show_log_in_prompt"});
    sendContentMessage(sender, {action:"disable_edit"});
  }

};



var sendSummaryNotes = function(sender, pullList, resultList){
  var result = [];
  var itemDict = {};

  iterateArray(resultList, function(index, emailItem){
    var emailId = emailItem.title.split(" ")[0];
    debugLog("@477", emailId, emailItem.description);

    //we collect the first one
    if(emailItem.description && !itemDict[emailId]){
      itemDict[emailId] = emailItem;
    }
  });


  var gdriveFolderIds = getFolderIdsFromQueryResult(resultList);

  debugLog("@482", pullList, resultList, gdriveFolderIds);
  for(var i=0; i<pullList.length; i++){
    var emailId = pullList[i];
    var description = ""; //empty string for not found
    var shortDescription = "";
    var properties = [];

    var preferences = getPreferences();
    var item = itemDict[emailId];

    if(item && item.parents && item.parents.length && !gdriveFolderIds.includes(item.parents[0])){
      // wrong folder
      debugLog("@1431, skipped", item.parents[0]);
      continue;
    }

    if(item && item.properties)
      properties = item.properties;

    if(item && item.description != gSgnEmpty && !SGNC.isMarkCrmDeleted(properties)){
      description = SGNC.getMentionText(item.description);
      shortDescription = SGNC.getSummaryLabel(description, preferences);
    }
    else{
      // emailId = gSgnEmpty;
      description = gSgnEmpty;
      shortDescription = gSgnEmpty;
    }

    result.push({"id":emailId, "description":description, "short_description":shortDescription, "properties":properties});
  }
  sendContentMessage(sender, {email:getStorage(sender, "gdrive_email"), 
                              action:"update_summary", noteList:result});
};

var pullNotes = function(sender, pendingPullList){
  var abstractStyle = getPreferenceAbstractStyle();
  var i;

  if(abstractStyle == "none" || !getStorage(sender, settings.ACCESS_TOKEN_KEY)){
    debugLog("@482, skipped pulling because settings -> hide listing notes or no access token");
    sendSummaryNotes(sender, pendingPullList, []);  //send an empty result
    return;
  }

  if(pendingPullList.length === 0){
    debugLog("Empty pending list, no need to pull");
    return;
  }

  //var preferences = getPreferences();
  //sendContentMessage(sender, {action:"update_preferences", preferences:preferences});
  debugLog("@414", pendingPullList);

  var totalRequests = Math.floor((pendingPullList.length-1) / gChunkSize) + 1;

  var queryList = [];
  for(i=0; i<totalRequests; i++){
    var query = "1=1";
    var startIndex = i*gChunkSize;
    var endIndex = (i+1)*gChunkSize;

    if(endIndex > pendingPullList.length)
      endIndex = pendingPullList.length;


    var partialPullList = pendingPullList.slice(startIndex, endIndex);


    iterateArray(partialPullList, function(index, messageId){
      query += " or fullText contains '" + messageId + "'";
    });

    query = getFolderQuery() + " or " + query;

    query = query.replace("1=1 or", "");  //remove the heading string

    query = appendQueryTrashedParam(query);

    queryList.push({"query": query});
  }


  batchQueryV3(sender, queryList,
    function(items){ //success callback
      debugLog("@433, query succeed", items);
      sendSummaryNotes(sender, pendingPullList, items);
    },
    function(data){ //error callback
      debugLog("@439, query failed", data);
    }
  );

};


var padOneZero = function(str){
  str = str.toString();
  
  if(str.length < 2)
    return "0" + str;

  return str;
};

var formatDate = function(initialDate, includeTime){
  var formatedDate;
  var date = new Date(initialDate);
  var year = date.getFullYear();
  var month = padOneZero(date.getMonth() + 1);
  var day = padOneZero(date.getDate());

  formatedDate = year + "-" + month + "-" + day;

  if(includeTime){
    var hour = padOneZero(date.getHours());
    var minute = padOneZero(date.getMinutes());
    var second = padOneZero(date.getSeconds());
    formatedDate = formatedDate + " " + hour + ":" + minute + ":" + second;
  }

  return formatedDate;

};

var getBatchRequestBody = function(requestParams, authToken, requestUrl, method){
  var boundary = "-------314159265358979323846";
  var multiBody = "";

  debugLog("@1745", requestParams);
  
  for(var i=0; i<requestParams.length; i++){
    // var url =  "/drive/v2/files/" + noteIds[i] + "/trash";
    var url = requestUrl;
    
    if(requestParams[i].noteId){
      url = url.replace("{note_id}", requestParams[i].noteId); 
    }

    if(requestParams[i].query){
      url = url.replace("{query}", requestParams[i].query);
    }

    var body = "--" + boundary + "\r\n" + "Content-Type: application/http" + "\r\n" + 
          "content-id: " + (i + 1) + "\r\n" + 
          "content-transfer-encoding: binary" + "\r\n\r\n" + 
          method +' '+ url + '\r\n'  + 
          'Authorization: Bearer ' + authToken + '\r\n' +
          'Content-Type: application/json; charset=UTF-8' + '\r\n\r\n' ;

    if(requestParams[i]["metadata"]){
      body = body + JSON.stringify(requestParams[i]["metadata"]) + '\r\n';
    }

    if(i === requestParams.length - 1){
      body = body + "--" + boundary + "--";  
    }
    multiBody = multiBody + body;
  }
  debugLog("@1139 options", multiBody);
  return multiBody;
};

//https://stackoverflow.com/questions/33289711/parsing-gmail-batch-response-in-javascript
var parseBatchResponse = function(response){
  response = '\r\n' + response;
  //var delimiter = response.substr(0, response.indexOf('\r\n'));
  var delimiter = '\r\n--batch'
  var parts = response.split(delimiter);
  parts.shift();
  parts.pop();

  var result = [];
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    var p = part.substring(part.indexOf("{"), part.lastIndexOf("}") + 1);
    result.push(JSON.parse(p));
  }

  return result;
};

var batchDo = function(sender, requestMethod, requestUrl, noteInfos, 
                            successCommand, errorCommand){
  executeIfValidToken(sender, function(){
    var batchUrl = "https://www.googleapis.com/batch/drive/v2";
    var methodType = "POST";
    var accessTokenKey = settings.ACCESS_TOKEN_KEY;
    sendAjax({
      type:methodType,
      url:batchUrl,
      headers: {
          "content-type": 'multipart/mixed; boundary="-------314159265358979323846"',
          "Authorization": "Bearer " + getStorage(sender, accessTokenKey)
      },
      data: getBatchRequestBody(noteInfos, getStorage(sender, accessTokenKey), requestUrl, requestMethod),
      success: function(data){
        var response = parseBatchResponse(data);
        successCommand(response);
      },
      error: function(data){
        errorCommand(data);
      }
    });
  });
};



var batchQueryV3 = function(sender, queryList,
                            successCommand, errorCommand, baseWaiting){

  if(baseWaiting === undefined)
    baseWaiting = gBaseWaiting; //default retry count                              

  executeIfValidToken(sender, function(){
    debugLog("@1616", gApiV3Fields, encodeURIComponent(gApiV3Fields));
    var batchUrl = "https://www.googleapis.com/batch/drive/v3";
    var requestUrl = "https://www.googleapis.com/drive/v3/files?fields=" + (encodeURIComponent(gApiV3Fields)) + "&q={query}";
    var accessTokenKey = settings.ACCESS_TOKEN_KEY;
    var payload =  getBatchRequestBody(queryList, getStorage(sender, accessTokenKey), requestUrl, 'GET');
    sendAjax({
      type:"POST",  //batch request itself is always post
      url:batchUrl,
      headers: {
          "content-type": 'multipart/mixed; boundary="-------314159265358979323846"',
          "Authorization": "Bearer " + getStorage(sender, accessTokenKey)
      },
      data:payload,
      success: function(reponse){
        debugLog('@batchquery success', reponse);

        try{
          var items = [];

          var allData = parseBatchResponse(reponse);

          if(Array.isArray(allData) && allData[0] && allData[0].error){
            throw new Error('error found inside response');
          }

          for(var i=0; i<allData.length; i++){
            var data = allData[i];
            if(data.files){
              for(var j=0; j<data.files.length; j++){
                data.files[j].title = data.files[j].name;
                items.push(data.files[j]);
              }
            }
          }
          successCommand(items);
        }
        catch(error){
          var token = getStorage(sender, settings.ACCESS_TOKEN_KEY);
          // debugLog("@1655", token, payload);
          var payloadDebug = payload.replaceAll(token, "<Redacted>");
          // debugLog("@1655b", token, payloadDebug);
          appendGdriveLog("batchGdriveQueryFail", error, reponse, payloadDebug);

          if(baseWaiting <= gMaxWaiting){
            appendGdriveLog("retrying", queryList);
            batchQueryV3(sender, queryList,
              successCommand, errorCommand, baseWaiting*2);
          }
          
        }
      },
      error: function(data){
        appendGdriveLog("batchGdriveQueryFailExternal", data, queryList);
        debugLog("@batchquery error", data);
        errorCommand(data);
      }
    });
  });
};




var markShareNoteList = function(sender, noteInfos){
  var requestUrl = "/drive/v2/files/{note_id}?uploadType=multipart";
  var requestMethod = "PUT";
  batchDo(sender, requestMethod, requestUrl, noteInfos, function(data){
    debugLog("share notes", data);
  }, function(data){
    //var message = "[markShareNoteList]" + JSON.stringify(data);
    //SGNC.appendLog(message, debugGdriveScope);
    appendGdriveLog("markShareNoteList", data);
    debugLog("failed to share notes", data);
  });
};


var markDeleteNoteList = function(sender, noteInfos){
  var resultData = [];
  var requestUrl = "/drive/v2/files/{note_id}?uploadType=multipart";
  var requestMethod = "PUT";
  batchDo(sender, requestMethod, requestUrl, noteInfos, function(data){
    var messageId = "";
    var messageIds = [];
    for(var i=0; i<data.length; i++){
      if(data[i]["title"] && data[i]["title"].includes("-")){
        messageId = data[i]["title"].split("-")[0].replace(/\s/g, '');
        resultData.push({"messageId": messageId, "properties": data[i]["properties"]});
        messageIds.push(messageId);
      }
    }

    sendContentMessage(sender, {action:"revoke_summary_note", clearNodeMessageIds: messageIds});
    sendContentMessage(sender, {action:"delete_crm_notes", noteList: resultData,
                        email: getStorage(sender, "gdrive_email")});
    sendContentMessage(sender, {email: getStorage(sender, "gdrive_email"),
                            action: "show_success_delete_message"
                            });
  }, function(data){
    //var message = "[markDeleteNoteList]" + JSON.stringify(data);
    //SGNC.appendLog(message, debugGdriveScope);
    appendGdriveLog("markDeleteNoteList", data);
    debugLog("fail to mark Note(Deleted)", data);
  });
};

var actualDeleteNoteList = function(sender, noteInfos){
  var requestMethod = "POST";
  var requestUrl = "/drive/v2/files/{note_id}/trash";

  batchDo(sender, requestMethod, requestUrl, noteInfos, function(data){
    debugLog("message deleted successfully");
    var messageId = "";
    var messageIds = [];
    for(var i=0; i<data.length; i++){
      if(data[i]["title"] && data[i]["title"].includes("-")){
        messageId = data[i]["title"].split("-")[0].replace(/\s/g, '');
        messageIds.push(messageId);
      }
    }
    sendContentMessage(sender, {action:"revoke_summary_note", clearNodeMessageIds: messageIds});
    sendContentMessage(sender, {email: getStorage(sender, "gdrive_email"),
                            action: "show_success_delete_message"
                            });
  }, function(data){
    debugLog("message deleted failed");
    //var message = "[deleteNoteList]" + JSON.stringify(data);
    //SGNC.appendLog(message, debugGdriveScope);
    appendGdriveLog("deleteNoteList", data);
    sendContentMessage(sender, {email: getStorage(sender, "gdrive_email"),
                          action: "show_error_delete_message"});
  });
};


var shrinkSearchContent = function(content){
  var maxLength = 100;  //this is hard limit by google
  var newContent = content.trim();
  if(newContent.length <= maxLength)
    return newContent;  //happy ending

  newContent = newContent.substring(0, maxLength);
  var lastSpaceIndex = newContent.lastIndexOf(" ");
  if(lastSpaceIndex > 0){
    newContent = newContent.substring(0, lastSpaceIndex);
  }

  //debugLog("@1393, shrinked content", newContent);
  return newContent;
};


var searchNoteList = function(sender, searchContent, nextPageToken) {
  var query = getFolderQuery();
  gdriveQueryV3(sender, query, function(data) {
    var folderIds = [];
    var items = data['items'];
    for (var i=0; i<items.length; i++) {
      folderIds.push(items[i]['id']);
    }
    searchNoteInFolders(sender, folderIds, searchContent, nextPageToken);
  });
};


// no use gdriveQuery for Recursion getFirstHundredNotes function
var searchNoteInFolders = function(sender, gdriveFolderIds, searchContent, nextPageToken) {
  var notes = [];
  var initialNotes = [];
  var folderQuery = "";
  if (gdriveFolderIds) {
    for(var j=0; j<gdriveFolderIds.length; j++) {
      if (j !== 0) {
        folderQuery = folderQuery + " or";
      }
      folderQuery = folderQuery + " (parents in '" + gdriveFolderIds[j] + "')";
    }
  }

  var startQueryUrl = "https://www.googleapis.com/drive/v3/files?q=";
  var query = " (not properties has { key='"+gSgnCrmDeleted+"' and value='true' }) ";
  if (folderQuery) {
    query = query + " and " + "(" + folderQuery + ")";
  }

  // it's possible last note is empty, but second last one is not
  // query += " and not fullText contains '" + gSgnEmpty + "' and not fullText contains '" + gSgnDeleted + "' ";

  if (searchContent) {
    searchContent = shrinkSearchContent(searchContent);
    query = query + " and fullText contains '" + searchContent + "' ";
  }

  query = appendQueryTrashedParam(query);
  startQueryUrl = startQueryUrl + query;

  var getCurrentPageNotes = function(searchFullUrl, ajaxData){
    sendAjaxAfterValidToken(sender, searchFullUrl, ajaxData, function(data){
      initialNotes = initialNotes.concat(data.files);
      for(var i=0; i<initialNotes.length; i++){
        var description = initialNotes[i].description;
        description = SGNC.getMentionText(description);
        var length = description.length;
        if (length > 50){
            length = 50;
        }
        var shortDescription = SGNC.getShortDescription(description, length);

        var content = description;
        // remove previous description html tag
        var crmContent = SGNC.htmlUnescape(SGNC.stripHtml(content));
        
        var initialTitle = initialNotes[i].name;
        var messageId = initialTitle.split("-")[0].replace(/\s/g, '');
        var noteDatetime = initialNotes[i].modifiedTime;
        var properties = initialNotes[i].properties;

        var position = initialTitle.indexOf("-");
        var title = initialTitle.substring(position+1, initialTitle.length);

        var modifiedTime  = formatDate(noteDatetime, true);
        var modifiedDate = formatDate(noteDatetime);

        notes.push({
          'noteId': initialNotes[i].id, 
          'id': messageId,
          'description': description,
          'messageId': messageId,
          'shortDescription': shortDescription,
          'content': crmContent,
          'modifiedDate': modifiedDate,
          'modifiedTime': modifiedTime,
          'properties': properties,
          'title': title
        });
      }
      notes = removeDuplicateAndEmptyMessages(notes);
      // debugLog("@1563 notes", notes.length);
      var response = {
        action:"show_search_result",
        notes: notes, 
        email: sender.email,
        nextPageToken: data.nextPageToken
      };
      if(!nextPageToken){
        response['firstSearch'] = true;
      }
      sendContentMessage(sender, response);
      return;

    },function(data){
      //var message = "[searchNoteInFolders]" + JSON.stringify(data);
      //SGNC.appendLog(message, debugGdriveScope);
      appendGdriveLog("searchNoteInFolders", data);
    }, 1);
    
  };
  var request = {
    "pageSize": Math.min(gPageSize, 1000), 
    "fields":"nextPageToken, " + gApiV3Fields
  };
  if(nextPageToken){
    request["pageToken"] = nextPageToken;
  }
  getCurrentPageNotes(startQueryUrl, request);  // 1000 is update limit for google drive api

};

var deleteNote = function(sender, messageId, item, newProperties, needDeleteCRM){
  var markCrmDeleted = false;
  var gdriveNoteId = item.id;
  var properties = item["properties"];
  for(var j=0; j<properties.length; j++){
    if(properties[j]["key"] === "sgn-opp-id"){
      markCrmDeleted = true;
      break;
    }
  }

  executeIfValidToken(sender, function(){
    var deleteUrl =  "https://www.googleapis.com/drive/v2/files/" + gdriveNoteId + "/trash";
    var methodType = "POST";
    var requestBody = "";

    var contentType = "application/json";
    if(markCrmDeleted){
      deleteUrl =  "https://www.googleapis.com/upload/drive/v2/files/" + gdriveNoteId + "?uploadType=multipart";
      methodType = "PUT";
      //mark the single deleted note for crm
      var itemProperties = newProperties;
      if (itemProperties) {
        SGNC.insertOrUpdateNoteProperty(itemProperties, gSgnCrmDeleted, true);
      } else {
        itemProperties = [{"key" : gSgnCrmDeleted, "value" : true, "visibility": "PUBLIC"}];
      }
      var metadata = {properties: itemProperties, description: gSgnEmpty};
      var multipartRequest = getMultipartRequestBody(metadata, gSgnEmpty);
      requestBody = multipartRequest.multipartRequestBody;
      contentType = "multipart/related; boundary=\"" + multipartRequest.boundary + "\"";
    }

    sendAjax({
      type:methodType,
      url:deleteUrl,
      dataType: 'json',
      contentType: contentType,
      data: requestBody,
      headers: {
          "Authorization": "Bearer " + getStorage(sender, settings.ACCESS_TOKEN_KEY)
      },
      success: function(data){
        debugLog("message deleted successfully");
        if(markCrmDeleted && needDeleteCRM){
          var noteList = [];
          noteList.push({"messageId": messageId, "properties":data["properties"]});
          sendContentMessage(sender, {action:"delete_crm_notes",
                              email: getStorage(sender, "gdrive_email"),
                              noteList: noteList});
        }
        sendContentMessage(sender, {action:"revoke_summary_note", messageId: messageId, clearNodeMessageIds: [messageId]});
        // sendContentMessage(sender, {action:"clear_recent_node", messageIds: [messageId]});
      },
      error: function(data){
        //var message = "[deleteNoteByNoteId]" + JSON.stringify(data);
        //SGNC.appendLog(message, debugGdriveScope);
        appendGdriveLog("deleteNoteByNoteId", data);
        sendContentMessage(sender, {action:"show_error", 
                                    type:"custom", 
                                    message:"Failed to delete message, error: " + 
                                    JSON.stringify(data)});
      }
    });
  });
};

var deleteNoteList = function(sender, noteInfos, isMark){
  var noteInfosChunkArray = SGNC.getArrayChunk(noteInfos, 100);
  var chunkLength = noteInfosChunkArray.length;
  for(var i=0; i<chunkLength; i++){
    if(noteInfosChunkArray[i] && noteInfosChunkArray[i].length > 0){
      if(isMark){
        markDeleteNoteList(sender, noteInfosChunkArray[i]);
      }
      else{
        actualDeleteNoteList(sender, noteInfosChunkArray[i]);
      }
    }
  }

};

var deleteNoteByMessageId = function(sender, messageId, needUpdateTimeStamp){
  debugLog("Delete note for message", messageId);
  gdriveQueryV3(sender, "name contains '" + messageId + "'",
      function(data){ //success callback
        var itemLength = data.items.length;
        // for call crm delete note api multiple times
        var needDeleteCRM = false;
        var newTimeStamp = "";
        var properties = [];
        for(var i=0; i<itemLength; i++){
          var item = data.items[i];
          needDeleteCRM = false;
          if (i === 0) {
            needDeleteCRM = true;
            properties = item["properties"];
            
            newTimeStamp = SGNC.getNoteProperty(item["properties"], 'sgn-note-timestamp');
            if (needUpdateTimeStamp && newTimeStamp) {
              newTimeStamp = SGNC.incrementTimeStamp(newTimeStamp);

              debugLog("@1953", properties);
              SGNC.insertOrUpdateNoteProperty(properties, 'sgn-note-timestamp', newTimeStamp);
            }
          }
          deleteNote(sender, messageId, item, properties, needDeleteCRM);
        }
      },
      function(data){ //error backback
        debugLog("@743, query failed", data);
        //var message = "[deleteNoteByMessageId]" + JSON.stringify(data);
        //SGNC.appendLog(message, debugGdriveScope);
        appendGdriveLog("deleteNoteByMessageId");
      }
  );

};

var gAlertDone = false;
var alertMessageIfNeeded = function(sender, messageKey, preferenceType){
  if(gAlertDone)
    return;

  var message = getSgnMessageForInstallOrUpgrade(messageKey);

  if(!message)
    return;

  var isMessageDone = getStorage(null, preferenceType);
  if(isMessageDone){
    return;
  }

  setStorage(null, preferenceType, true);
  sendContentMessage(sender, {action: "alert_message", message: message}); 
  gAlertDone = true;
};

var gShowNotification;
var updateShowNotificationIfNeeded = function(forceUpdate){
  var subscribedInfo = getSubscribedInfo();
  var showNotification = isShowNotification(subscribedInfo);
  if(showNotification !== gShowNotification || forceUpdate){
    setStorage(null, 'isShowNotification', showNotification);
    setStorage(null, 'preference_version', Date.now());
    gShowNotification = showNotification;
  }
};

//For messaging between background and content script
var handleRequest = function(sender, request){  // jshint ignore:line
  var preferences = {};

  debugLog("Request body:", request);
  switch (request.action){
    case "request_setup":
      preferences = getPreferences();
      var email = request.email;
      var currentDisableList = JSON.parse(preferences["disabledAccounts"]);
      //it's not disabled
      if(currentDisableList.indexOf(email) < 0){
        sendContentMessage(sender, {action: "approve_setup"});
        currentDisableList.push(email);
      } 
      break;
    case "batch_share_crm":
      markShareNoteList(sender, request.shareNotes);
      break;
    case "delete_notes":
      var noteInfos = request.noteInfos;

      var markNoteInfos = [];
      var trashNoteInfos = [];
      for(var i=0; i<noteInfos.length; i++){
        if(noteInfos[i]["crmDeleteTag"]){
          markNoteInfos.push(noteInfos[i]);
        }
        else{
          trashNoteInfos.push(noteInfos[i]);
        }
      }
      
     //this is for delete dupliate notes
      if(gDuplicateNotesForMany.length > 0){
        trashNoteInfos = trashNoteInfos.concat(gDuplicateNotesForMany);
      }

      deleteNoteList(sender, trashNoteInfos, false);
      deleteNoteList(sender, markNoteInfos, true);

      break;
    case "search_notes":
      // searchNoteInFolders(sender, request.gdriveFolderId, request.searchContent);
      searchNoteList(sender, request.searchContent, request.nextPageToken);
      break;
    case "logout":
      logoutGoogleDrive(sender);
      break;
    case "reconnect":
    case "login":
      debugLog("Trying to login Google Drive.");
      launchAuthorizer(sender, request.messageId, request.title);
      break;
    case "crm_oauth":
      // this logic will not be used any more
      // launchAuthorizer(sender, null, null, true);
      break;
    case "post_note":
      var content = request.content;
      if(content === "")
        content = gSgnEmpty;
      postNote(sender, request.messageId, request.emailTitleSuffix,
                 request.gdriveFolderId, request.gdriveNoteId, content, request.properties);
      break;
    case "initialize":
      initialize(sender, request.messageId, request.title);
      break;
    case "pull_notes":
      pullNotes(sender, request.pendingPullList);
      break;
    case "login_sgn_web":
      var code = request.code;
      var messageId = request.messageId;
      var title = null;
      var loginType = "sgn_web";
      handleGoogleAuthCode(code, sender, messageId, title, loginType);
      break;
    case "open_options":
      openTab("options.html");
      break;
    case "sgn_notification_subscribed_check":
      if(SGNC.isChrome()){
        SGNC.getBrowser().permissions.request({
          origins: [getPortalBaseUrl()]
        }, function(granted) {
          if(granted){
            var url = getPortalBaseUrl() + "portal/subscribed_info/?id=" + SGNC.getExtensionID();
            if(SGNC.isChrome()){
              window.open(url, "subscribe","width=1000,height=700");
            }else{
              SGNC.getBrowser().tabs.create({url: url});
            }
          }
        });
      }else{
        openTab("options.html#subscriberPanel");
      }
      break;
    case "sgn_increment_notification_count":
      incrementNotificationCount();
      break;
    case "heart_beat_request":

      //do nothing except echo back, to show it's alive
      alertMessageIfNeeded(sender, 'install', "install_notification_done");
      alertMessageIfNeeded(sender, 'upgrade', "upgrade_notification_done");


      if(SGNC.isSafari()){
        updateSafariStorageCache();
      }

      var contentPreferenceVersion = request.preferenceVersion;
      var contentPreferences = request.preferences;
      var preferenceVersion = getPreferenceVersion();

      // var subscribedInfo = getSubscribedInfo();
      // var showNotification = false;
      // if(subscribedInfo.paid){
        // check portal and see if user is still paid status
        //updateSubscribedInfoIfNeeded();
      //}else{
        //showNotification = isShowNotification(subscribedInfo);
      //}

      // if(showNotification){
      // setStorage(null, 'preference_version', Date.now());
      // }

      var displayPreferences = {};
      if(!contentPreferenceVersion || contentPreferenceVersion < preferenceVersion){
        debugLog('@2172, send back preferences');
        preferences = getPreferences();
        
        // preferences["isPaid"] = (preferences["isPaid"] === 'true');
        for(var j=0; j<gPreferenceTypes.length; j++){
          var key = gPreferenceTypes[j]["name"];
          if(key.startsWith("debug"))
            continue;

          displayPreferences[key] = preferences[key];
        }

        //displayPreferences['isShowNotification'] = showNotification;
        //displayPreferences['isPaid'] = subscribedInfo.paid;
      }

      // add a safety measure, to avoid false banner display
      if(contentPreferences["isShowNotification"] != String(gShowNotification)){
        updateShowNotificationIfNeeded(true);
      }
      var gdriveEmail = getStorage(sender, "gdrive_email", true) || "";

      // debugLog("@2238", gdriveEmail);
      sendContentMessage(sender, {action: "heart_beat_response", 
                                  email:request.email,
                                  gdriveEmail:gdriveEmail,
                                  crmUserEmail:getStorage(sender, "crm_user_email", true),
                                  crmUserToken:getStorage(sender, "crm_user_token", true),
                                  preferenceVersion:preferenceVersion,
                                  preferences:displayPreferences});
      break;
    case "update_debug_page_info":
      SGNC.setLog(request.debugInfo, debugPageScope);
      break;
    case "update_debug_content_info":
      SGNC.setLog(request.debugInfo, debugContentScope);
      break;
    case "delete":
      deleteNoteByMessageId(sender, request.messageId, request.need_update_timestamp);
      break;
    case "send_preference":
      preferences = getPreferences();
      setStorage(null, request.preferenceType, request.preferenceValue);
      break;
    case "reset_preferences":
      resetPreferences();
      preferences = getPreferences();
      break;
    case "update_crm_user_info":
      var crm_user_email = request.crm_user_email;
      var crm_user_token = request.crm_user_token;
      setStorage(sender, "crm_user_email", crm_user_email);
      setStorage(sender, "crm_user_token", crm_user_token);
      break;
    case "request_permission":
      var perm = request.perm;
      debugLog("@1779a", perm);
      SGNC.getBrowser().permissions.request(
        { origins: [perm + "/"], },
        function (response){
          debugLog('@1779b response', response);
        }
      );
      break;
    case "disable_account":
      var accountEmail = request.email;
      preferences = getPreferences();
      var disableCurrentList = JSON.parse(preferences["disabledAccounts"]);
      if(disableCurrentList.indexOf(accountEmail) < 0){
        disableCurrentList.push(accountEmail);
      } 
      setStorage(null, "disabledAccounts", JSON.stringify(disableCurrentList));
      break;
    default:
      debugLog("unknown request to background", request);
      break;
  }
};

var getPreferenceVersion = function(){
  var preferenceVersion = getStorage(null, "preference_version", true);
  if(!preferenceVersion){
    preferenceVersion = Date.now();
    setStorage(null, "preference_version", preferenceVersion);
  }
  return preferenceVersion;
};

var getPortalBaseUrl = function(){
  return settings.SUBSCRIBER_PORTAL_BASE_URL;
};

var checkSubscribedInfo = function(subscribedInfo){
  if(subscribedInfo.paid && subscribedInfo.email){
    return true;
  }
  return false;
};

var resetPreferences = function() {
    var defaultPreferences = updateDefaultPreferences({});
    pushPreferences(defaultPreferences);
};

/*
window.addEventListener("message", function(e){
  if(!e.data.startsWith("sgnlogin:"))
    return;

  if (e.data.startsWith("sgnlogin:")) {
    var data = e.data.split(":");
    var state = data[1];
    var code = data[2];
    var error = data[3];

    var stateData = state.split("/");
    var email = stateData[0];
    var tabId = parseInt(stateData[1]);
    var messageId = stateData[2];

    //simulate state
    var sender = {email: email, worker: {tab: {id: tabId}}};
    handleGoogleAuthCode(code, sender, messageId, null, "sgn_web");
  }
  debugLog('@1835', e.data);
}, true);
*/

function initSubscribedInfo(updateSubscriberStatus){
  var subscribedPreference = getSubscribedInfo();
  var paid = subscribedPreference['paid'];
  var subscriptionEmail = subscribedPreference['email'];
  var inputs = $("#subscriberOptions").find('input[type=checkbox]');
  if(paid){
    for(var i=1; i<inputs.length; i++){
      inputs.eq(i).prop('disabled', false);
    }
    $("#useCustomGoogleDrivefolder").prop("disabled", false);
    $("#export_settings").prop("disabled", false);
    $("#import_settings").prop("disabled", false);
    $("#templateAutoload").prop("disabled", false);

    $("#subscriptionEmail").val(subscriptionEmail);

    if(updateSubscriberStatus){
      $('#isPaid').prop('checked', true);
      $("#subscriptionEmail").val(subscriptionEmail);
      $('#showLogo').prop('checked', false);
      $('#useAdvancedColors').prop('checked', true);
      $("#templateAutoload").prop("checked", false);
    }

  }else{
    for(var j=1; j<inputs.length; j++){
      inputs.eq(j).prop('disabled', true);
    }
    $("#useCustomGoogleDrivefolder").prop("disabled", true);
    $("#export_settings").prop("disabled", true);
    $("#import_settings").prop("disabled", true);
    $("#templateAutoload").prop("disabled", true);

    $('#isPaid').prop('checked', false);
    $("#subscriptionEmail").val("");
    $('#showLogo').prop('checked', true);
    $('#useAdvancedColors').prop('checked', false);
    $("#templateAutoload").prop("checked", false);

  }
}

var updateSubscribedInfoAjax = function(sgnEmail, isOptionClicked){
  sendAjax({
    type: 'GET',
    url: getPortalBaseUrl() + "portal/check_subscribed/?email=" + sgnEmail,
    success: function(data){
      pushSubscribedInfo(sgnEmail, data.paid);
      
      if(data.paid){
        $('#isPaid').prop('checked', true);
        $("#subscriptionEmail").val(sgnEmail);
        if(isOptionClicked){
          window.alert('Subscription verified successfully, thank you!');
        }
      }else{
        $('#isPaid').prop('checked', false);
        $("#subscriptionEmail").val("");
        if(isOptionClicked){
          window.alert('Subscription verification failed, please check your payment account or contact us, thank you.');
        }
      }
      initSubscribedInfo();
  
      return true;
    },
    error: function(data){
      debugLog(data);
      // console.log(data);
      if(isOptionClicked){
        window.alert('Server error found, please try again later.');
      }
    }
  });
};

