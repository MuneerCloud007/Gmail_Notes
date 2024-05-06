/*
 * Simple Gmail Notes 
 * https://github.com/walty8
 * Copyright (C) 2017 Walty Yeung <walty@bart.com.hk>
 * License: GPLv3
 *
 * This script is going to be used by background only
 */

//For messaging between background and content script
$(window).on('load', function(){
  SGNC.getBrowser().runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      // debugLog("Get message to background", request);
      sender = {worker: sender, email: request.email};

      executeCatchingErrorBackground(function(){
        handleRequest(sender, request);
      }, "background-event");
      return true;
  });


  //var preferences = getPreferences();
  //preferences['debugBackgroundInfo'] = "Extension Version: " + SGNC.getExtensionVersion();
  var message = "Extension Version: " + SGNC.getExtensionVersion();
  SGNC.appendLog(message, debugBackGroundScope);
});

SGNC.getBrowser().runtime.onInstalled.addListener(function(details){
    var preferences = getPreferences();
    if(details.reason == "install"){
      /*
      if(SGNC.isChrome()){
        alert("Thanks for installing. Please reload the Gmail page (click address bar & press enter key) to start using the extension!");
      }
      */
      chrome.tabs.create({url: "https://www.bart.com.hk/simple-gmail-notes-installed/"}, function (tab) {
          console.log("Welcome page launched");
      });
      setStorage(null, "install_notification_done", "");
      setStorage(null, "upgrade_notification_done", true);
    } 
    else if(details.reason == "update"){
      SGNC.getBrowser().browserAction.setBadgeText({"text": ""});
      setStorage(null, "install_notification_done", true);
      setStorage(null, "upgrade_notification_done", "");
      chrome.tabs.create({url: "https://www.bart.com.hk/simple-gmail-notes-updated/"}, function (tab) {
          console.log("Welcome page launched");
      });
      /*
      alert("The exteions of \'Simple Gmail Notes\' was updated. " +
            "Please reload the Gmail page (click address bar & press enter key) to continue using the extension!\n\n");
      */


      /*
      alert("The exteions of \'Simple Gmail Notes\' was updated. " +
            "Please reload the Gmail page (click address bar & press enter key) to continue using the extension!\n\n" +
                    "New in v0.9.0:\n" +
                    "- Able to set color to individual notes\n" +
                    "- Increased max height for textarea\n" +
                    "- User could select the Google Drive to connect during each login\n" +
                    "- Fixed bugs regarding to split view\n" +
                    "\n\nIf you think the extension is helpful, please consider a donation via the preferences page. Thank you!");
		    */
    }

});


function handleSubscribedMessage(message, sender) {
  if (sender.url.includes("portal/subscribed_info") && message) {
    subscribedInfoList = message.split(',');
    email = subscribedInfoList[0];
    paid = subscribedInfoList[1];
    if(paid === 'True'){
      paid = true;
    }else{
      paid = false;
    }
    if(paid){
      pushSubscribedInfo(email, paid);
    }
  }
}

SGNC.getBrowser().runtime.onMessageExternal.addListener(handleSubscribedMessage);

debugLog("Finished background script (event)");
