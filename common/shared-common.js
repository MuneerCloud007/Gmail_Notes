//this file should be loaded the first
//I did NOT use the following syntax because the 'window' object does not exist 
//in Firefox background script name space
//window.SimpleGmailNotes = window.SimpleGmailNotes || {}

//this script would be put into page script, better use a strong naming 
//convention
/*********** for page, content, background *********/
if (typeof SimpleGmailNotes === 'undefined' || SimpleGmailNotes === null) {
    SimpleGmailNotes = {};
  }
  
  SimpleGmailNotes.isDebug = function(callback){
    return SimpleGmailNotes.settings.IS_DEBUG;
    // return false;
    // return true;
  };
  
  
  
  SimpleGmailNotes.debugLog = function(){ //need some further work
    if (SimpleGmailNotes.isDebug() && window.console && window.console.log) {
        window.console.log.apply(console, arguments);
    }
  };
  
  
  SimpleGmailNotes.offlineMessage = "WARNING! Simple Gmail Notes is currently unavailable.\n\n<br/>" +
                                     "Please <a href=''>refresh</a> this page to clear the warning. ";
  
  
  /*
  SimpleGmailNotes.getBrowserName = function(){
    return SimpleGmailNotes.getBrowser().runtime.getBrowserInfo().name
  }
  */
  
  
  //these are set up by build script now
  SimpleGmailNotes.isFirefox = function(){
    //var isFirefox = /firefox|fxios/i.test(navigator.userAgent);
    //return isFirefox;
    return SimpleGmailNotes.getBrowserName() === 'firefox';
  };
  
  SimpleGmailNotes.isEdge = function(){
    if(SimpleGmailNotes.getBrowserName() === 'edge')
      return true;
  
    var isEdge = /edg/i.test(navigator.userAgent);
    return isEdge;
  };
  
  SimpleGmailNotes.isChrome = function(){
    //if(SimpleGmailNotes.isEdge())
    // return false;
  
    //var isChrome = /chrome|crios/i.test(navigator.userAgent);
    //return isChrome;
    return SimpleGmailNotes.getBrowserName() === 'chrome';
  };
  
  SimpleGmailNotes.isSafari = function(){
    //if(SimpleGmailNotes.isChrome() || SimpleGmailNotes.isEdge())
     // return false;
  
    //var isSafari = /safari/i.test(navigator.userAgent);
    //return isSafari;
    return SimpleGmailNotes.getBrowserName() === 'safari';
  };
  
  // ********************   END **************************************
  
  // ********************  for page script & content script
  SimpleGmailNotes.getTinyMCEContainer = function(){
    if(SimpleGmailNotes.$(".sgn_container .mce-container").length !== 0){
      return SimpleGmailNotes.$(".sgn_container .mce-container");
    } 
    return null;
  };
  
  SimpleGmailNotes.getContainer = function(){
    var injectionNode = $(".sgn_container:visible");
    return injectionNode;
  };
  
  SimpleGmailNotes.getCurrentInput = function(){
    var currentInput = SimpleGmailNotes.$(".sgn_input:visible");
    if(SimpleGmailNotes.getTinyMCEContainer()){
      currentInput = SimpleGmailNotes.getTinyMCEContainer().parents(".sgn_container").find(".sgn_input");
    }
    return currentInput;
  };
  
  SimpleGmailNotes.getNoteTimeStampDom = function(){
    var timeStampDom = SimpleGmailNotes.$(".sgn_note_timestamp");
    return timeStampDom;
  };
  
  
  SimpleGmailNotes.getCurrentContent = function(){
    var currentInput = SimpleGmailNotes.getCurrentInput();  
    var content = getInputValue(currentInput);
    if(!content)
      content = "";
    
    return content;
  };
  
  
  SimpleGmailNotes.getCurrentBackgroundColor = function(){
    var currentInput = SimpleGmailNotes.getCurrentInput();  
    var backgroundColor = currentInput.parents(".sgn_container").find(".sgn_color_picker_value").val();
    return backgroundColor;
  };
  
  SimpleGmailNotes.getCurrentFontColor = function(){
    var currentInput = SimpleGmailNotes.getCurrentInput();  
    var fontColor = currentInput.parents(".sgn_container").find(".sgn_font_color_picker_value").val();
    return fontColor;
  };
  
  SimpleGmailNotes.createSidebarNodeIfNeeded = function(){
    var mainNode = SimpleGmailNotes.getMainNode();
    var sidebarContentNode = mainNode.find(".Bu.y3.sgn_transform_td.sgn_sidebar_grand_container");
  
    // console.log("@139", mainNode.length);
    if(mainNode.length && !sidebarContentNode.length){
      mainNode.find(" > *").wrapAll('<div class="sgn_main_node sgn_transform_td"' + 
          'style="display: table-cell;">');
  
      sidebarContentNode = $('<div class="Bu y3 sgn_transform_td sgn_sidebar_grand_container" ' + 
          'style="display: table-cell; width:1px; height:100px; backgrond:#fff;padding:0; padding-left:15px">');
  
      mainNode.append(sidebarContentNode);
    }
  
    // console.log("@130", SimpleGmailNotes.$(".Bs.nH .Bu.y3").length);
  
    return sidebarContentNode;
  
  };
  
  SimpleGmailNotes.isSidebarLayout = function() {
    if(typeof gPreferences === "undefined"){
      // console.log("@125, pref not found");
      return false;
    }
  
    var preferences = gPreferences;
    var notePosition = preferences["notePosition"];
    if(notePosition === 'side-top' || notePosition === 'side-bottom'){
       return true;
    }
  
    return false;
  };
  
  SimpleGmailNotes.getSidebarNode = function(forceCreateSideBar){
    var mainNode = SimpleGmailNotes.getMainNode();
    var sidebarContentNode = mainNode.find(".Bu.y3.sgn_transform_td.sgn_sidebar_grand_container");
  
    if(sidebarContentNode.length){
      return sidebarContentNode;
    }
  
    if(forceCreateSideBar){
      // console.log("@139", mainNode.length);
      if(mainNode.length && !sidebarContentNode.length){
        mainNode.find(" > *").wrapAll('<div class="sgn_main_node sgn_transform_td"' + 
            'style="display: table-cell;">');
  
        sidebarContentNode = $('<div class="Bu y3 sgn_transform_td sgn_sidebar_grand_container" ' + 
            'style="display: table-cell; width:1px; height:100px; backgrond:#fff;padding:0; padding-left:15px">');
  
        mainNode.append(sidebarContentNode);
      }
    }
  
  
    return sidebarContentNode;
  };
  
  SimpleGmailNotes.getMainNode = function(){
    var cellElement = SimpleGmailNotes.$(".Bs.nH > tr > td:visible div.nH:first");
    if(!cellElement.length){
      cellElement = $(".nH.a98:visible");
    }
    return cellElement;
  };
  
  // ********************   END **************************************
  
  
  // ************* for content script & background script ****************
  SimpleGmailNotes.getBrowser = function(){
    if(SimpleGmailNotes.isChrome() || SimpleGmailNotes.isEdge())
      return chrome;
  
    //firefox
    return browser;
  };
  
  SimpleGmailNotes.getBrowserShortName = function(){
    if(SimpleGmailNotes.isSafari())
      return "s";
  
    if(SimpleGmailNotes.isFirefox())
      return "f";
  
    if(SimpleGmailNotes.isEdge())
      return "e";
  
    // chrome
    return "c";
  };
  
  SimpleGmailNotes.getCssBaseUrl = function(){
    if(SimpleGmailNotes.isChrome())
      return "chrome-extension://" + SimpleGmailNotes.getExtensionID() + "/css";
  
    //firefox
    return SimpleGmailNotes.getBrowser().runtime.getURL("css");
  };
  
  
  
  SimpleGmailNotes.getIconBaseUrl = function(){
    if(SimpleGmailNotes.isChrome())
      return "chrome-extension://" + SimpleGmailNotes.getExtensionID() + "/image";
  
    //firefox
    return SimpleGmailNotes.getBrowser().runtime.getURL("image");
  };
  
  SimpleGmailNotes.getExtensionID = function(){
    return SimpleGmailNotes.getBrowser().runtime.id;
  };
  
  SimpleGmailNotes.getExtensionVersion = function(){
    return SimpleGmailNotes.getBrowser().runtime.getManifest().version;
  };
  
  SimpleGmailNotes.getExtensionTypeShortName = function(){
    var extensionTypeShortName = 'n';
    return extensionTypeShortName;
  };
  
  SimpleGmailNotes.getBartLogoImageSrc = function(type){
    return "https://static-gl.simplegmailnotes.com/media/bart-logo.24.png" +
             "?v=" + SimpleGmailNotes.getExtensionVersion() + 
             "&from=" + SimpleGmailNotes.getBrowserShortName() + "-" + type +
         "-" + SimpleGmailNotes.getExtensionTypeShortName();
  };
  
  SimpleGmailNotes.getCRMLogoImageSrc = function(type, image){
    return "https://static-gl-" + type + ".mobilecrm.io/media/" + image  + "?v=" + 
             SimpleGmailNotes.getExtensionVersion();
  };
  
  
  SimpleGmailNotes.getContactUsUrl = function(type){
    return "https://www.bart.com.hk/?from=" + SimpleGmailNotes.getBrowserShortName() + 
                "-" + type + "#ContactUs-section";
  };
  
  SimpleGmailNotes.getOfficalSiteUrl = function(type){
    return "https://www.bart.com.hk/?from=" + SimpleGmailNotes.getBrowserShortName() + 
             "-" + type + "-" + SimpleGmailNotes.getExtensionTypeShortName();
  };
  
  SimpleGmailNotes.getDonationUrl = function(type){
    return "http://www.simplegmailnotes.com/donation?from=" + 
             SimpleGmailNotes.getBrowserShortName() + "-" + type;
  };
  
  
  SimpleGmailNotes.getReviewUrl = function(){
    var url; 
    if(SimpleGmailNotes.isEdge())
      url = "https://microsoftedge.microsoft.com/addons/detail/simple-gmail-notes/" + SimpleGmailNotes.getExtensionID();
    else if(SimpleGmailNotes.isSafari())
      url = "https://apps.apple.com/hk/app/simple-notes-for-gmail/id1541594492?l=en&mt=12";
    else if(SimpleGmailNotes.isFirefox())
      url = "https://addons.mozilla.org/en-US/firefox/addon/simple-gmail-notes/#reviews";
    else
      url = "https://chrome.google.com/webstore/detail/simple-gmail-notes/" + SimpleGmailNotes.getExtensionID() + "/reviews?hl=en";
  
    return url;
  };
  
  SimpleGmailNotes.getCRMBaseUrl = function(){
    return SimpleGmailNotes.settings.CRM_BASE_URL;
  };
  
  SimpleGmailNotes.getSGNWebBaseURL = function(){
    return SimpleGmailNotes.settings.SGN_WEB_LOGIN_BASE_URL;
  };
  
  SimpleGmailNotes.getBrowserName = function(){
    return SimpleGmailNotes.settings.BROWSER_NAME;
  };
  
  SimpleGmailNotes.debugLogInfo = {};
  SimpleGmailNotes.defaultScope = "_DEFAULT_";
  
  SimpleGmailNotes.getLog = function(scope){
    var log = "";
    if(!scope){
      scope = SimpleGmailNotes.defaultScope;
    }
  
    return SimpleGmailNotes.debugLogInfo[scope];
  };
  
  SimpleGmailNotes.setLog = function(err, scope){
    if(!scope){
      scope = SimpleGmailNotes.defaultScope;
    }
    SimpleGmailNotes.debugLogInfo[scope] = err;
  };
  
  SimpleGmailNotes.getErrorMessage = function(err){
    var result = "";
    if(typeof(err) === "object" && (err.message || err.stack)){
      if(err.message)
        result += err.message + ":\n";
  
      if(err.stack)
        result += err.stack + "\n--\n\n";
    }
    else if(typeof(err) === "string"){
      result = err;
    }
    else {
      result = JSON.stringify(err);
    }
  
  
    return result;
  };
  
  SimpleGmailNotes.appendLog = function(err, scope){
     var headLength = 2000;
     var tailLength = 2000;
     var maxLength = headLength + tailLength;
    /*
    if(debugInfo.length > 4096)  //better to give a limit 
      //console.log("top much error");
      return;
    */
    var result = "[" + SimpleGmailNotes.getErrorMessage(err) + "]";
  
    /*
    if(SimpleGmailNotes.debugLogInfo[scope].indexOf(result) < 0){ //do not repeatly record
      SimpleGmailNotes.debugLogInfo[scope] += result;
    }*/
  
    if(!scope){
      scope = SimpleGmailNotes.defaultScope;
    }
    if(!SimpleGmailNotes.debugLogInfo[scope]){
      SimpleGmailNotes.debugLogInfo[scope] = "";
    }
    
    
  
    var currentLog = SimpleGmailNotes.debugLogInfo[scope];
    //the log would duplicated in the last 50 characters
    if(currentLog.length > 50 && currentLog.substring(currentLog.length-50).indexOf(result) > 0)
      return;
    
    SimpleGmailNotes.debugLog('sending log', result);
    
    SimpleGmailNotes.debugLogInfo[scope] += result;
  
    var scopeDebugInfo = SimpleGmailNotes.debugLogInfo[scope];
    if(scopeDebugInfo.length > maxLength){
      SimpleGmailNotes.debugLogInfo[scope] = scopeDebugInfo.substring(0, headLength) +
        " ... "  +
        scopeDebugInfo.substring(scopeDebugInfo.length-tailLength, scopeDebugInfo.length);
    }
  
  };
  
  SimpleGmailNotes.OnceLogDict = {};
  SimpleGmailNotes.appendLogOnce = function(err, scope) {
    if(SimpleGmailNotes.OnceLogDict[err]){
      return;
    }
    SimpleGmailNotes.appendLog(err, scope);
    SimpleGmailNotes.OnceLogDict[err] = true;
  };
  
  //http://stackoverflow.com/questions/28348008/chrome-extension-how-to-trap-handle-content-script-errors-globally
  //I have to use try/catch instead of window.onerror because of restriction of same origin policy: 
  SimpleGmailNotes.executeCatchingError = function(func, arg){
    try{
      func(arg);
    }
    catch(err){
      SimpleGmailNotes.appendLog(err);
    }
  };
  
  
  SimpleGmailNotes.getShortDescription = function(description, length){
    var shortDescription;
    if(description.indexOf('<p') === 0 || 
      description.indexOf('<div') === 0 ||
      description.indexOf('<ol') === 0 ||
      description.indexOf('<ul') === 0){
      shortDescription = SimpleGmailNotes.htmlUnescape(
        SimpleGmailNotes.stripHtml(description)).substring(0, length);
    }else{
      shortDescription = description.substring(0, length);
    }
  
    return shortDescription;
  };
  
  SimpleGmailNotes.getFirstLineAbstract = function(shortDescription){ 
    var shortDescriptionArray = shortDescription.split("\n");
    var result = "";
    for(var i=0; i<shortDescriptionArray.length; i++){
      if(shortDescriptionArray[i]){
        result = shortDescriptionArray[i];
        break;
      } 
    }
  
    return result;
  };
  
   
  
  SimpleGmailNotes.getSummaryLabel = function(description, preferences){
    var firstLineAbstract = preferences["firstLineAbstract"];
    var showAbstractBracket = preferences["showAbstractBracket"];
    var abstractStyle = preferences["abstractStyle"];
  
    if(abstractStyle == "fixed_SGN")
      shortDescription = "SGN";
    else{
      var length = parseInt(abstractStyle);
      if(!length)
        length = 20;  //default to 20
  
      shortDescription = SimpleGmailNotes.getShortDescription(description, length);
      if(firstLineAbstract !== "false")
        shortDescription = SimpleGmailNotes.getFirstLineAbstract(shortDescription);
  
      if(showAbstractBracket !== "false")
        shortDescription = "[" + shortDescription + "]";
    }
  
    return shortDescription;
  };
  
  SimpleGmailNotes.containsEmailTag = function(emailAddress) {
    var re = /.*<[\w\.-]+@[\w\.-]+>/;
    return re.test(emailAddress);
  };
  
  SimpleGmailNotes.validateEmail = function(email) {
    var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
  };
  
  SimpleGmailNotes.nl2br = function(str){
    return String(str)
            .replace(/\n/g, '<br/>');
  };
  
  SimpleGmailNotes.htmlEscape = function(str) {
    return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
  };
  
  /*
  var removeHtmlTag = function(str){
    return str.replace(/<\/?("[^"]*"|'[^']*'|[^>])*(>|$)/g, "");
  }
  */
  
  // I needed the opposite function today, so adding here too:
  SimpleGmailNotes.htmlUnescape = function(value){
    return String(value)
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
  };
  
  SimpleGmailNotes.stripHtml = function(value){
    if(!value)
      return '';
  
    var specialCharRe = new RegExp(String.fromCharCode(160), 'g');
    return value.replace(/<(?:.|\n)*?>/gm, '')
                .replace(/&nbsp;/g, '')
                .replace(specialCharRe, ' ');
  };
  
  SimpleGmailNotes.isMarkCrmDeleted = function(properties){
    // not load crm delete
    if(!properties)
      return false;
  
    var crmDeleteTag = false;
    for(var n=0; n<properties.length; n++){
      if(properties[n]["key"] === gSgnCrmDeleted && properties[n]["value"] === "true"){
        crmDeleteTag = true; 
      }
    }
    return crmDeleteTag;
  };
  
  
  SimpleGmailNotes.getArrayChunk = function(array, chunk){
    if(chunk === 0){
      SimpleGmailNOtes.debugLog("chunk is not 0");
      return;
    }
    var tempArray = [];
    for(var i=0; i<array.length; i+=chunk){
      tempArray.push(array.slice(i, i+chunk));
    }
  
    return tempArray;
    
  };
  
  SimpleGmailNotes.getPopupDimensions = function(newWindowWidth, newWindowHeight){
    var dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
    var dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;
    var width = window.innerWidth ? window.innerWidth : window.screen.width;
    var height = window.innerHeight ? window.innerHeight : window.screen.height;
    
    if(!width)
      width = 0;
  
    if(!height)
      height = 0;
  
    var newWindowTop = (height - newWindowHeight) / 2 + dualScreenTop;
    var newWindowLeft = (width - newWindowWidth) / 2 + dualScreenLeft;
    
    return {height: newWindowHeight, width: newWindowWidth, top: parseInt(newWindowTop), 
            left: parseInt(newWindowLeft)}; 
  };
  
  SimpleGmailNotes.getStrWindowFeatures = function(newWindowWidth, newWindowHeight) {
    var dimensions = SimpleGmailNotes.getPopupDimensions(newWindowWidth, newWindowHeight);
    newWindowTop = dimensions.top;
    newWindowLeft = dimensions.left;
  
    var strWindowFeatures = ('innerHeight=' + newWindowHeight +
                             ', innerWidth=' + newWindowWidth +
                             ', top=' + newWindowTop + ', left=' + newWindowLeft);
    // console.log('@489', strWindowFeatures);
    return strWindowFeatures;
  };
  
  SimpleGmailNotes.getRedirectUri = function(loginType) {
    var result;
  
    if(loginType === 'sgn_web' || SimpleGmailNotes.isSafari() || SimpleGmailNotes.isEdge()){
      result = SimpleGmailNotes.getSGNWebBaseURL() + "/sgn/signin_done/";
    }
    else {
      result = SimpleGmailNotes.getBrowser().identity.getRedirectURL();
    }
  
    return result;
  };
  
  SimpleGmailNotes.getMentionInfos = function(text) {
    var infos = [];
    if (!text) {
      return infos;
    }
    var regexText = /@\[([^\]]+)\]\(([^ \)]+)\)/g;
    var matchResult = text.match(regexText);
    if (!matchResult) {
      return infos;
    }
  
    var emails = [];
    for (var j=0; j<matchResult.length; j++) {
      var matchItem = matchResult[j];
      var itemMatch = regexText.exec(matchItem);
      // https://stackoverflow.com/questions/4724701/regexp-exec-returns-null-sporadically
      regexText.lastIndex = 0;
      if (!itemMatch) {
        continue;
      }
  
      var itemName = itemMatch[1];
      var itemEmail = itemMatch[2];
      if (!emails.includes(itemEmail)) {
        infos.push({"name": itemName, "email": itemEmail});
        emails.push(itemEmail);
      }
    }
  
    return infos;
  };
  
  SimpleGmailNotes.getMentionText = function(text, baseUrl) {
    if (!text) {
      return '';
    }
    var regexText = /@\[([^\]]+)\]\(([^ \)]+)\)/g;
    var matchResult = text.match(regexText);
    if (!matchResult) {
      return text;
    }
  
    for (var j=0; j<matchResult.length; j++) {
      var matchItem = matchResult[j];
      var itemMatch = regexText.exec(matchItem);
      // https://stackoverflow.com/questions/4724701/regexp-exec-returns-null-sporadically
      regexText.lastIndex = 0;
      if (!itemMatch) {
        continue;
      }
  
      var itemName = itemMatch[1];
      if (baseUrl) {
        var itemEmail = itemMatch[2];
        var itemUrl = baseUrl + "&selected_user_email=" + itemEmail;
        var link = "<a class='sgn_team_member_link'  href=" + itemUrl +">" + itemName +"</a>";
        text = text.replaceAll(matchItem, link);
      } else {
        text = text.replaceAll(matchItem, itemName);
      }
    }
  
    return text;
  };
  
  SimpleGmailNotes.incrementTimeStamp = function(currentTimeStamp) {
    if(!currentTimeStamp)
      currentTimeStamp = "";
    var versionNumber = 0;
    var timestampBase = currentTimeStamp;
    if(currentTimeStamp && currentTimeStamp.includes("-")){
      versionNumber = parseInt(currentTimeStamp.split("-")[1]);
      timestampBase = currentTimeStamp.split("-")[0];
    }
    versionNumber += 1;
    var newTimestamp = timestampBase + "-" + String(versionNumber);
  
    return newTimestamp;
  };
  
  SimpleGmailNotes.getNoteProperty = function(properties, propertyName){
    if(!properties){
      SimpleGmailNotes.debugLog("Warning, no property found");
      return "";
    }
  
    if(properties[propertyName]){
      return properties[propertyName];
    }
    
    for(var i=0; i<properties.length; i++){
      if(properties[i]["key"] == propertyName){
        return properties[i]["value"];
      }
    }
  
    return "";
  };
  
  SimpleGmailNotes.insertOrUpdateNoteProperty = function(properties, propertyName, propertyValue){
    if(!properties){
      SimpleGmailNotes.debugLog("Warning, no property found");
      return "";
    }
  
    var needInsert = true;
    for(var i=0; i<properties.length; i++){
      if(properties[i]["key"] == propertyName){
        needInsert = false;
        properties[i]["value"] = propertyValue;
      }
    }
    if (needInsert) {
      properties.push({"key" : propertyName, "value" : propertyValue, "visibility": "PUBLIC"});
    }
  
  };
  
  
  SimpleGmailNotes.addEventListenerToDocument = function(eventName, callback){
    document.addEventListener(eventName, function(e) {
      SimpleGmailNotes.executeCatchingError(function(){
        callback(e);
      });
    });
  };
  
  // ***************** end **********************
  