/*jshint esversion: 9 */
/*
 * Simple Gmail Notes 
 * https://github.com/walty8
 * Copyright (C) 2017 Walty Yeung <walty@bart.com.hk>
 * License: GPLv3
 *
 */

// jshint multistr:true
//use a shorter name as we won't have name conflict here
var SGNC = SimpleGmailNotes;
var settings = SimpleGmailNotes.settings;

var debugLog = SGNC.debugLog;
var sgnGmailDom = new SGNGmailDOM(jQuery);
var gCrmTeamMemberInfo = [];

var gSummaryPulled = false;
var gCrmLoggedInChecked = false;
var gCrmLoggedIn = false;
var gClassicGmailConversation = false;
var gLastPullTimestamp = null;
var gNextPullTimestamp = null;
var gConsecutiveRequests = 0;
var gConsecutiveStartTime = 0;
var gSyncFutureNotesEnabled = false; 
var gGmailWatchEnabled = false;
var gLastCRMShareURL = null;
var gPreferences = {};

var origCss = $.fn.css;
$.fn.css = function() {
  var result = origCss.apply(this, arguments);
  $(this).trigger('stylechanged', arguments);
  return result;
};

var sendBackgroundMessage = function(message){
  var networkActions = ["post_note", "initialize", "pull_notes", "delete"];
  var action = message.action;
  
  var userEmail = sgnGmailDom.userEmail();

  message.email = userEmail;

  /*
  if(gSgnUserEmail && userEmail !== gSgnUserEmail) {
    message.email += '+' + gSgnUserEmail; //may be delegated account, gdrive and gmail are different emails
  }
  */

  // debugLog("@sendToBackGround", action, message.email);
  if(isRuntimeAlive()){
    SGNC.getBrowser().runtime.sendMessage(message, function(response){
      debugLog("Message response", response);
    });
  }
  else{
    showOfflineNotice();
  }
};


//https://stackoverflow.com/questions/25840674/chrome-runtime-sendmessage-throws-exception-from-content-script-after-reloading
var isRuntimeAlive = function(){
  return SGNC.getBrowser().runtime && !!SGNC.getBrowser().runtime.id;
};

var setupBackgroundEventsListener = function(callback) {
  SGNC.getBrowser().runtime.onMessage.addListener(
      function(request, sender, sendResponse) {
        SGNC.executeCatchingError(function(){
          callback(request);
        });
        return true;
      }
  );
};
var addScript = function(scriptPath){
  var j = document.createElement('script');
  j.src = SGNC.getBrowser().runtime.getURL(scriptPath);
  j.async = false;
  j.defer = false;
  (document.head || document.documentElement).appendChild(j);
};



/* global variables to mark the status of current tab */
var gEmailIdNoteDict = {};

var gCurrentGDriveNoteId = "";
var gCurrentGDriveFolderId = "";
var gPreviousContent = "";

var gCurrentEmailSubject = "";
var gCurrentMessageId = "";

var gCurrentBackgroundColor = "";
var gCurrentFontColor = "";

// var gAbstractBackgroundColor = "";
// var gAbstractFontColor = "";
// var gAbstractFontSize = "";

var gCurrentPreferences = {};

var gLastHeartBeat = Date.now();
var gSgnUserEmail = "";
var gCrmUserEmail = "";
var gCrmUserToken = "";
var gLastPreferenceString = "";
var gPreferenceVersion = 0;

var gSgnEmpty = "<SGN_EMPTY>";
var gSgnDeleted = "<SGN_DELETED>";  // for backward compatibility only, new deleted notes won't have this

var gSgnCrmDeleted = 'sgn-crm-has-deleted';
var gSuccessDeleted = false;

var gSearchContent = "";


/* -- end -- */

var getEmailIdNoteCache = function(id, useDeleted){
  var item = gEmailIdNoteDict[id];
  if(!item)
    return undefined;

  if(!useDeleted && item.isDeleted)
    return undefined;

  return item;
};

var setEmailIdNoteCache = function(id, value){
  gEmailIdNoteDict[id] = value;
};

var deleteEmailIdNoteCache = function(id) {
  var item = gEmailIdNoteDict[id];
  if(item){
    item.isDeleted = true;
  }
};


//http://stackoverflow.com/questions/4434076/best-way-to-alphanumeric-check-in-javascript#25352300
var isAlphaNumeric = function(str) {
  var code, i, len;

  for (i = 0, len = str.length; i < len; i++) {
    code = str.charCodeAt(i);
    if (!(code > 47 && code < 58) && // numeric (0-9)
        !(code > 64 && code < 91) && // upper alpha (A-Z)
        !(code > 96 && code < 123)) { // lower alpha (a-z)
      return false;
    }
  }
  return true;
};

//http://stackoverflow.com/questions/46155/validate-email-address-in-javascript#1373724
var gEmailRe = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i; 
var isValidEmail = function(email) {
  return gEmailRe.test(email);
};
  
var sendEventMessage = function(eventName, eventDetail){
  if(eventDetail === undefined){
    eventDetail = {};
  }

  document.dispatchEvent(new CustomEvent(eventName,  {detail: JSON.stringify(eventDetail)}));
};


var isTinyMCEEditable = function(){
  var tinymceContenteditable = $('.sgn_container .mce-tinymce').find("iframe").
                contents().find("body").attr("contenteditable");
  if(tinymceContenteditable == "true"){
    return true;
  }
  return false;
};

var getCrmThreadId = function() {
  var threadId = sgnGmailDom.getCurrentThreadId();
  return threadId;
};

var getCrmLastMessageId = function() {
  var sgnLastMessageId = sgnGmailDom.getLastMessageId();
  return sgnLastMessageId;
};

var disableEdit = function(retryCount){
  if(retryCount === undefined)
    retryCount = settings.MAX_RETRY_COUNT;

  if(!retryCount)
    return; 

  if(isRichTextEditor()){
    if(!isTinyMCEEditable())
      return;
    sendEventMessage('SGN_tinyMCE_disable'); 
    
  }else{
    $(".sgn_input").prop("disabled", true);
    setInputBackgroundColor($(".sgn_input", ""));
    clearInputValue($(".sgn_input"));
    //clear up the cache
    gEmailIdNoteDict = {};

    //keep trying until it's visible
    if($(".sgn_input").is(":disabled") && !$(".sgn_padding").is(":visible"))
      return;
  }

  debugLog("retry disable edit");
  retryCount = retryCount - 1;
  if(retryCount > 0 )
    setTimeout(disableEdit, 100, retryCount);
  
};

var enableEdit = function(retryCount){
  if(retryCount === undefined)
    retryCount = settings.MAX_RETRY_COUNT;
    
  if(!retryCount)
    return;
  

  // debugLog("@227, hidden elements", $(".sgn_container:hidden").length);
  //$(".sgn_container:hidden").remove();

  if(isRichTextEditor()){
    if(!isTinyMCEEditable())
      sendEventMessage('SGN_tinyMCE_enable');
    return;
    
  }else{
    $(".sgn_input").prop("disabled", false);
    if(!$(".sgn_input").is(":disabled"))  //keep trying until it's visible
      return;
  }
  debugLog("retry enable edit");
  retryCount = retryCount - 1;
  if(retryCount > 0 )
    setTimeout(enableEdit, 100, retryCount);
  
};

var isSGNEnabled = function() {
  return $(".sgn_prompt_logout:visible").length > 0 || gSummaryPulled || $(".sgn_logged_in:visible").length > 0;
};

var isCrmOptionEnabled = function() {
  var preferences = gPreferences;
  var enabled = (preferences && preferences["showCRMButton"] !== "false");

  return enabled;
};

var isCrmSgnEnabled = function() {
  if(!isSGNEnabled())
    return false;

  return isCrmOptionEnabled();
};



var showLoginPrompt = function(retryCount){
  if(retryCount === undefined)
      retryCount = settings.MAX_RETRY_COUNT;

  $(".sgn_prompt_login").show();
  $(".sgn_prompt_logout").hide();
  $(".sgn_padding").hide();
  debugLog("Login prompt visible", $(".sgn_prompt_login").is(":visible"));
  if(!$(".sgn_prompt_login").is(":visible")){  //keep trying until it's visible
    debugLog("Retry to show login prompt");
    retryCount = retryCount - 1;
    if(retryCount > 0 )
      setTimeout(showLoginPrompt, 100, retryCount);
  }
};

var setBackgroundColorWithPicker = function(backgroundColor){
  if(!backgroundColor)
    return;

  var input = SGNC.getCurrentInput();
  if(isRichTextEditor()){
    sendEventMessage('SGN_tinyMCE_set_backgroundColor', {backgroundColor: backgroundColor});
    $(".mce-container").parents(".sgn_container").find(".sgn_color_picker_value").val(backgroundColor);
  }else{
    setInputBackgroundColor(input, backgroundColor);
    input.parents(".sgn_container").find(".sgn_color_picker_value").val(backgroundColor);
  }

  gCurrentBackgroundColor = backgroundColor;
};

var setFontColorWithPicker = function(fontColor){
  if(!fontColor)
    return;

  var input = SGNC.getCurrentInput();
  if(isRichTextEditor()){
    sendEventMessage('SGN_tinyMCE_set_fontColor', {fontColor: fontColor});
    $(".mce-container").parents(".sgn_container").find(".sgn_font_color_picker_value").val(fontColor);
  }else{
    setInputFontColor(input, fontColor);
    input.parents(".sgn_container").find(".sgn_font_color_picker_value").val(fontColor);
  }

  gCurrentFontColor = fontColor;
};

var showLogoutPrompt = function(email, retryCount){
  if(retryCount === undefined)
    retryCount = settings.MAX_RETRY_COUNT;

  $(".sgn_prompt_logout").show();
  $(".sgn_prompt_login").hide();
  $(".sgn_padding").hide();
  $(".sgn_error").hide();

  if(email)
    $(".sgn_prompt_logout").find(".sgn_user").text(email);


  if(!$(".sgn_prompt_logout").is(":visible")){  //keep trying until it's visible
    debugLog("Retry to show prompt");
    retryCount = retryCount - 1;
    if(retryCount > 0 )
      setTimeout(showLogoutPrompt, 100, email, retryCount);
  }
};

var getCurrentGoogleAccountId = function(){
  var re = /mail\/u\/(\d+)/;
  var userId = "0";
  var match = window.location.href.match(re);
  if(match && match.length > 1)
    userId = match[1];

  return userId;
};

var getSearchNoteURL = function(){
  var searchUrl = "https://drive.google.com/drive/folders/" + gCurrentGDriveFolderId;

  return searchUrl;
};

var getDisplayContent = function(content){
  var warningMessage = SGNC.offlineMessage;
  var displayContent = content || '';

  if(displayContent.indexOf(warningMessage) === 0){
    displayContent = displayContent.substring(warningMessage.length); //truncate the warning message part
  }

  if(displayContent == gSgnEmpty)
    displayContent = "";

  if(isStripHTMLTags()){
    displayContent = SGNC.stripHtml(displayContent);
  }

  return displayContent;
};

//I use http instead of https here, because otherwise a new window will not be popped up
//in most cases, google would redirect http to https
var getHistoryNoteURL = function(messageId){
  var userId = getCurrentGoogleAccountId();
  var url = "https://mail.google.com/mail/u/" + userId + "/#all/" + messageId;
  return url;
};


var getAddCalendarURL = function(messageId){
  var userId = getCurrentGoogleAccountId();
  var emailUrl = getHistoryNoteURL(messageId);
  var details = emailUrl + "\n-----\n" + getInputValue($(".sgn_input"));
  var title = gCurrentEmailSubject;

  if(title.indexOf("Re:") < 0)
    title = "Re: " + title;

  var addCalendarURL = "https://calendar.google.com/calendar/b/" + userId + 
                            "/render?action=TEMPLATE" +
                            "&text=" + encodeURIComponent(title) + 
                            "&details=" + encodeURIComponent(details);

  return addCalendarURL;
};

var setPropertiesPublic = function(properties){
  var publicPropertyArray = [];
  for(var i=0; i<properties.length; i++){
    properties[i]["visibility"] = "PUBLIC";
    publicPropertyArray.push(properties[i]);
  }
  return publicPropertyArray;
};

var batchShareNotes = function(email, noteList){
  var commonProperties = [{"key" : "sgn-author", "value" : email}];
  var shareNotes = [];

  for(var i=0; i<noteList.length; i++){
    var properties = [];
    var shareNote = {};
    shareNote["noteId"] = noteList[i]["sgn-gdrive-note-id"];
    properties.push({"key" : "sgn-message-id", "value" : noteList[i]["message_id"]});
    properties.push({"key": "sgn-shared", "value": noteList[i]["sgn-shared"]});
    properties.push({"key": "sgn-opp-name", "value": noteList[i]["sgn-opp-name"]});
    properties.push({"key": "sgn-opp-id", "value": noteList[i]["sgn-opp-id"]});
    properties.push({"key": "sgn-opp-url", "value": noteList[i]["sgn-opp-url"]});
    properties.push({"key": "sgn-note-timestamp", "value": noteList[i]["sgn-note-timestamp"]});
    properties = setPropertiesPublic(properties);
    shareNote["metadata"] = {properties: properties};
    shareNotes.push(shareNote);
  }

  sendBackgroundMessage({action:"batch_share_crm",
                         shareNotes: shareNotes,
                         gdriveFolderId: gCurrentGDriveFolderId});    

};

var gRecentNodeDict = new LRUMap(100);  //at most ~2MB memory
var postNote = function(email, messageId, crmProp){
  debugLog("@432a", crmProp);

  //it's a message mis-match, not a callback from silent push
  if(messageId != gCurrentMessageId && !crmProp)
    return;

  if(crmProp && !crmProp['note_updated'])
    return;

  debugLog("@432", crmProp);

  var noteId, folderId, emailSubject;
  var container = SGNC.getContainer();

  var properties = [{"key" : "sgn-author", "value" : email},
                    {"key" : "sgn-message-id", "value" : messageId}];

  var content = "";

  if(crmProp){  //silent push callback
    folderId = crmProp["sgn-gdrive-folder-id"];
    noteId = crmProp["sgn-gdrive-note-id"];
    emailSubject = crmProp["sgn-subject"];
    if(crmProp["note_content_updated"])
      content = crmProp["sgn-content"];
    else {  // only updated the timestamp
      content = gRecentNodeDict.get(messageId);
      if (content === undefined) {
        content = crmProp["sgn-content"];
      }
    }

    if(content && container.find('.sgn_minimized:visible').length){
      setupNoteEditor(gSgnUserEmail, gCurrentMessageId);
    }

    properties.push({"key" : "sgn-background-color", "value" : crmProp["sgn-background-color"]});
    properties.push({"key" : "sgn-font-color", "value" : crmProp["sgn-font-color"]});
    properties.push({"key": "sgn-shared", "value": crmProp["sgn-shared"]});
    properties.push({"key": "sgn-opp-name", "value": crmProp["sgn-opp-name"]});
    properties.push({"key": "sgn-opp-id", "value": crmProp["sgn-opp-id"]});
    properties.push({"key": "sgn-opp-url", "value": crmProp["sgn-opp-url"]});
    properties.push({"key": "sgn-note-timestamp", "value": crmProp["sgn-note-timestamp"]});
  }
  else {  // messageId == gCurrentMessageId, extension UI trigger
    content = SGNC.getCurrentContent();
    folderId = gCurrentGDriveFolderId;
    noteId = gCurrentGDriveNoteId;
    emailSubject = gCurrentEmailSubject;

    gRecentNodeDict.set(messageId, content);

    var backgroundColor = SGNC.getCurrentBackgroundColor();
    var fontColor = SGNC.getCurrentFontColor();
    //a new timestamp is not provided
    var currentTimeStamp = container.attr("data-note-timestamp");

    var newTimestamp = SGNC.incrementTimeStamp(currentTimeStamp);
    updateContainerTimeStamp(newTimestamp);
    //set up the default crm properties using the container node
    properties.push({"key": "sgn-note-timestamp", 
                     "value": container.attr("data-note-timestamp")});
    properties.push({"key": "sgn-opp-id",
                     "value": container.attr("data-sgn-opp-id")});
    properties.push({"key": "sgn-opp-name",
                     "value": container.attr("data-sgn-opp-name")});
    properties.push({"key": "sgn-opp-url",
                     "value": container.attr("data-sgn-opp-url")});
    properties.push({"key" : "sgn-background-color",
                     "value" : backgroundColor});
    properties.push({"key" : "sgn-font-color",
                     "value" : fontColor});

    properties.push({"key": gSgnCrmDeleted, "value": false});


    var sgnLastMessageId = sgnGmailDom.getLastMessageId();
    properties.push({"key" : "sgn-last-message-id", "value" : sgnLastMessageId});

    var threadId = sgnGmailDom.getCurrentThreadId();
    properties.push({"key": "sgn-thread-id", "value": threadId});
  }

  if (!folderId)
    folderId = gCurrentGDriveFolderId;

  properties = setPropertiesPublic(properties);
  //update the note
  sendBackgroundMessage({action:"post_note", 
                         messageId:messageId, 
                         emailTitleSuffix: emailSubject,
                         gdriveNoteId:noteId, 
                         gdriveFolderId:folderId,
                         content:content,
                         properties:properties});


  gPreviousContent = content;

};


var deleteMessage = function(messageId){    	
  clearInputValue($(".sgn_input:visible"));
  if(isRichTextEditor()){
    sendEventMessage('SGN_tinyMCE_delete_message');
  }
  gPreviousContent = '';
  if(!gCurrentGDriveNoteId){
  	return;
  }
  deleteEmailIdNoteCache(messageId);
  gCurrentGDriveNoteId = '';

};

var updateNoteContent = function(note){
  setInputValue($(".sgn_input:visible"), note);
  if(isRichTextEditor()){
    sendEventMessage('SGN_tinyMCE_update_note', {content: note});
    setInputValue(SGNC.getCurrentInput(), note);
  }
};

var autoloadTemplateContent = function() {
  var templateAutoload = gPreferences["templateAutoload"];
  var currentNote = SGNC.getCurrentContent();
  if (gPreferences['templateContent'] !== "" && templateAutoload === 'true' && (currentNote === "" || currentNote === gSgnEmpty)){
    var note = gPreferences['templateContent'];
    updateNoteContent(note);
  }
};

var updateEmailIdNoteDict = function(messageId, description, properties, shortDescription) {
  if(!shortDescription)
    shortDescription = SGNC.getSummaryLabel(description, gPreferences);

  if(description == gSgnEmpty || description == gSgnDeleted)
    description = "";

  if(shortDescription == gSgnEmpty || shortDescription == gSgnDeleted)
    shortDescription = "";

  var emailNoteInfo = {"description": description,
                       "short_description": shortDescription,
                       "properties": properties};

  setEmailIdNoteCache(messageId, emailNoteInfo);
};

var convertTimestamp = function(timestamp){
  var result = "";
  if(timestamp){
      var receviedDatetime = moment.utc(parseInt(timestamp, 10));
      var friendlyDate = moment(receviedDatetime).calendar(null, {
        lastWeek: 'Do MMM',
        lastDay: '[Yesterday]',
        sameDay: '[Today]',
        nextDay: '[Tomorrow]',
        nextWeek: 'Do MMM',
        sameElse: 'Do MMM'
      });
      var friendlyTime = moment(receviedDatetime).format('hh:mm a');

      result = friendlyDate + ' ' + friendlyTime;
  }

  return result;
};

var cleanupSideBar = function(){
  //this was mainly used for the histroy div clean up, and it's not used any more
  // $(".Bu.y3.sgn_transform_td").remove();
};

var setupSidebarDimension = function(sideBarNode) {
  var sidebarWidth = gPreferences['sidebarWidth'];
  sideBarNode.removeClass("sgn_200_sidebar");
  if (sidebarWidth === "200px") {
    sideBarNode.addClass('sgn_200_sidebar');
  }else if (sidebarWidth === 'auto') {
    if (SGNC.getMainNode().width() > 1024) {
      sideBarNode.removeClass("sgn_200_sidebar");
    } else {
      sideBarNode.addClass("sgn_200_sidebar");
    }
  }

  // about sgn sidebar height is same with gmail main content
  if (sideBarNode.length) {
    $("table.Bs.nH.iY.bAt td.Bu.bAn").css("display", "table-cell");
  }
};

var addNodeToCRMSideBar = function(node, sideBarExtraClass, position){
  var sidebar = SGNC.getSidebarNode();

  sidebar.find(".sgn_sidebar." + sideBarExtraClass).remove();

  // create opportunity detail note
  var sidebarNode = $("<div class='sgn_sidebar'></div>").addClass(sideBarExtraClass);
  var sidebarContainerNode = $("<div class='sgn_sidebar_container'></div>");

  if(gSgnUserEmail !== sgnGmailDom.userEmail()){
    sidebarNode.addClass("sgn_is_delegated");
  }

  if(position == 'prepend'){
    sidebar.prepend(sidebarNode);
  }else{
    sidebar.append(sidebarNode);
  }
  sidebarNode.append(sidebarContainerNode);
  sidebarContainerNode.append(node);
  setupSidebarDimension(sidebarNode);

  // push the nodes to the correct orrder
  sidebar.append(sidebar.find(".sgn_notification"));

  sidebar.append(sidebar.find(".sgn_sidebar_login"));

  sidebar.append(sidebar.find(".sgn_crm_tip"));
  sidebar.append(sidebar.find(".sgn_crm_upgrade_message"));

  sidebar.append(sidebar.find(".sgn_crm_opportunity"));

  sidebar.append(sidebar.find(".sgn_crm_comments"));
  sidebar.append(sidebar.find(".sgn_crm_user_recent_notes_current_user"));
  sidebar.append(sidebar.find(".sgn_crm_user_recent_notes_team_user"));

  sidebar.append(sidebar.find(".sgn_crm_upgrade_prompt"));
  sidebar.append(sidebar.find(".sgn_faq_bar"));
  sidebar.append(sidebar.find(".sgn_history"));


  return sidebarNode;
};

var hideCRMSidebarNode = function(){
  $(".sgn_sidebar.sgn_crm_opportunity").remove();
  $(".sgn_sidebar.sgn_crm_comments").remove();
  $(".sgn_sidebar.sgn_crm_user_recent_notes_current_user").remove();
  $(".sgn_sidebar.sgn_crm_user_recent_notes_team_user").remove();
};

var hideHistorySidebarNode = function(){
  $(".sgn_sidebar.sgn_history").remove();
};

var appendCommentRecordNodes = function(comments) {
  $(".sgn_comment_history").empty();
  if(!comments){
    return;
  }

  var commentRecordNode;
  for (var i = 0; i < comments.length; i++) {
    commentRecordNode = generateCommentRecordNode(comments[i]);
    $(".sgn_comment_history").prepend(commentRecordNode);
  }
  updateCommentsTotal();
};

var generateCommentRecordNode = function(commentData) {
  if (!commentData){
    return;
  }
  var commentModifiedTime = commentData["modified_datetime"];
  var commentFormatDay = new Date(parseInt(commentModifiedTime));
  // var commentFormatDay = convertTimestamp(commentModifiedTime);
  commentFormatDay = moment(commentFormatDay).fromNow();
  var commentContent = commentData["content"];
  var authorName = commentData["author"];
  var authorImage = commentData["avatar"];
  var commentRecordNode = $("<div class='sgn_comment_record'></div>");
  var commentAuthorImageContainer = $("<div class='sgn_comment_author_image'></div>");
  var commentAuthorImage = $("<img class='sgn_author_image'>").attr("src", authorImage);
  commentAuthorImageContainer.append(commentAuthorImage); 
  // commentRecordNode.append(commentAuthorImageContainer);

  var commentRecordInfoContainer = $("<div class='sgn_comment_detail_info'></div>");
  var commentHeader = $("<div class='sgn_comment_detail_header sgn_flex_center_row'></div>");
  commentHeader.append(commentAuthorImageContainer);
  var commentAuthorNameAndTimeNode = $("<div class='sgn_comment_author_and_time'><span class='sgn_comment_author'>" + authorName + "</span> "+
  "<span class='sgn_comment_time'>" + commentFormatDay + "</span></div>");
  commentHeader.append(commentAuthorNameAndTimeNode);
  commentRecordInfoContainer.append(commentHeader);
  var url = getCRMOpportunityListUrl(gCrmUserEmail);
  var commentContentNode = getMentionCommentNode(commentContent, url);
  commentRecordInfoContainer.append(commentContentNode);
  commentRecordNode.append(commentRecordInfoContainer);
  return commentRecordNode;
};

var updateCommentUI = function(isLoading) {
  if (isLoading) {
    $("button.sgn_comment_send").text('Send...');
  } else {
    $("button.sgn_comment_send").text('Send');
    clearInputValue($("textarea.sgn_comment_textarea"));
    clearInputValue($(".sgn_crm_comment_modal textarea"));
  }
};

var appendCrmNoteComment = function(comment, userInfo) {
  comment = Object.assign(comment, userInfo);
  if (comment['thread_id'] === getCrmThreadId()) {
      var commentRecordNode = generateCommentRecordNode(comment);
      $(".sgn_comment_history").prepend(commentRecordNode);
      updateCommentsTotal();
      var tmpEmailComments = gCrmPullHistoryCache[gCurrentMessageId];
      if (!tmpEmailComments) {
        tmpEmailComments = [];
      }
      tmpEmailComments.unshift(comment);
      gCrmPullHistoryCache[gCurrentMessageId] = tmpEmailComments;
  }

  var commentOwnerEmail = comment['owner_email'];
  var commentNoteId = comment['thread_id'] || comment['note'];
  comment['author_name'] = comment['author'];
  var commentNoteContainer = $("div.sgn_crm_user_recent_note_item[data-note-owner='"+commentOwnerEmail+"'][data-note-id='"+commentNoteId+"']");
  var newCommentNode = getCRMUserSingleCommentDom(comment);
  if (commentNoteContainer.length) {
    var dataComments = JSON.parse(commentNoteContainer.attr('data-comments'));
    dataComments.unshift(comment);
    commentNoteContainer.attr('data-comments', JSON.stringify(dataComments));
    var commentsContainer = commentNoteContainer.find("div.sgn_crm_user_comments");
    if (!commentsContainer.length) {
      var newCrmUserCommentListNode = $("<div class='sgn_crm_user_comments'></div>");
      commentNoteContainer.find("div.sgn_crm_user_recent_note_item_container").append(newCrmUserCommentListNode);
    }
    commentNoteContainer.find("div.sgn_crm_user_comments").prepend(newCommentNode);
    var showCommentNodes = commentNoteContainer.find("div.sgn_crm_user_comments div.sgn_crm_user_comment_item:visible");
    if (showCommentNodes.length > 3) {
      showCommentNodes.last().hide();
    }
    var crmCommentListContainer = $("div.sgn_crm_comment_modal").find("div.sgn_crm_user_comments");
    if (!crmCommentListContainer.length) {
      $("<div class='sgn_crm_user_comments'></div>").insertAfter($("div.sgn_crm_comment_modal").find("div.sgn_crm_no_comments"));
    }
    var clonedCommentNode = newCommentNode.clone();
    processMentionURL(clonedCommentNode);
    $("div.sgn_crm_comment_modal").find("div.sgn_crm_user_comments").prepend(clonedCommentNode);
    $("div.sgn_crm_comment_modal").find("div.sgn_crm_comment_count").text(dataComments.length + " Comments").show();
    $("div.sgn_crm_comment_modal").find("div.sgn_crm_no_comments").hide();
    commentNoteContainer.find("div.sgn_crm_user_recent_note_comment_count span").text(dataComments.length);
    commentNoteContainer.find("div.sgn_crm_user_recent_note_comment_count").show();

  }

  markLastVisible($(".sgn_comment_container:visible"));

  if(comment['show_share_button']){
    noteItemDom.find('.sgn_crm_user_recent_note_share_icon').hide();
    noteItemDom.find('.sgn_crm_user_recent_note_unshare_icon').hide();
  }

  var shareUrl;
  if(comment && comment['mentioned_team_members'].length){
    //if(confirm("You mentioned team member but this email is not shared, do you want to share it now?")){}
    if(commentNoteContainer.length){
      if(commentNoteContainer.find(".sgn_crm_user_recent_note_share_icon:visible").length){
        shareUrl = commentNoteContainer.find(".sgn_crm_user_recent_note_share_icon:visible").attr("data-crm-share-email-url");
        openCRMPage(shareUrl);
      }
    }
    else if ($('.sgn_crm_sidebar_section_header .sgn_crm_sidebar_header_share:visible').length){
      shareUrl = $('.sgn_crm_sidebar_section_header .sgn_crm_sidebar_header_share:visible').attr('data-crm-share-email-url');
      openCRMPage(shareUrl);
    }
  }
  if(commentNoteContainer.length){
    updateCommentsNodeByUpdateInfo(comment, commentNoteContainer);
  }
  else{
    updateCommentsNodeByUpdateInfo(comment);
  }
};

var sendCrmNoteComment = function(email, content, noteId, noteType) {
  if(!content)
    return;

  var subContent = content.substring(0, 1000);
  var commentData = {
    'note_id': noteId,
    'source': 'sgn',
    'action': 'comment-share',
    'note_type': noteType,
    'content': subContent
  };
  if (noteType === 'email' && !noteId) {
    commentData['note_id'] = getCrmThreadId();
    var currentMessageId = sgnGmailDom.getCurrentMessageId();
    var hideEmailInfo = false;
    var emailData = getCRMShareEmailData(email, currentMessageId, hideEmailInfo);
    commentData["email_info"] = emailData;
  }
  var commentUrl = getCRMCommentUrl(getCrmUser(email), commentData);
  updateCommentUI(true);
  $.ajax({                                                                    
    url: commentUrl,                                                                 
    dataType: "json",                                                        
    success: function(response){                                              
      // debugLog("@389", response);                                       
      updateCommentUI(false);
    },                                                                        
    error: function(response){                                                
      // debugLog("@rsponse", response);
      updateCommentUI(false);
      // even for timeout error, it would not return in this closure          
      //debugLog("Failed to connect to server");                           
    }                                                                         
  });
};


var getCommentActionButtonNode = function(email) {
  var commentActionButtonNode = $("<div class='sgn_comment_buttons'>" + 
    "<div class='sgn_comment_action_buttons'><button class='sgn_comment_send'>Send</button><button class='sgn_comment_cancel'>Cancel</button></div>" + 
    "<div class='sgn_comment_emoji'>" + 
    "<button class='sgn_comment_emoji_item' data-emoji='👍'>👍</button>" + 
    "<button class='sgn_comment_emoji_item' data-emoji='🤔️'>🤔️</button>" + 
    "<button class='sgn_comment_emoji_item' data-emoji='😩'>😩</button>" + 
    "</div></div>");

  commentActionButtonNode.find("button.sgn_comment_send").click(function(e) {
    var commentContainer = $(this).parents("div.sgn_comment_textarea_container");
    var textarea = commentContainer.find("textarea");
    var content = getInputValue(textarea);
    var noteId = textarea.attr('data-note-id');
    var noteType = textarea.attr('data-note-type') || 'email';
    sendCrmNoteComment(email, content, noteId, noteType);
  });

  commentActionButtonNode.find("button.sgn_comment_cancel").click(function() {
    var commentContainer = $(this).parents("div.sgn_comment_textarea_container");
    var textarea = commentContainer.find("textarea");
    clearInputValue(textarea);

    if($.featherlight.current())
      $.featherlight.current().close();
  });

  commentActionButtonNode.find("button.sgn_comment_emoji_item").click(function() {
    var commentContainer = $(this).parents("div.sgn_comment_textarea_container");
    var textarea = commentContainer.find("textarea");
    var commentContent = getInputValue(textarea);
    var emoji = $(this).attr("data-emoji");
    setInputValue(textarea, commentContent + emoji);
  });


  return commentActionButtonNode;
};

var getAutoShareActionButtonNode = function(email) {
  autoShareAlertKey = "SGN_AUTO_SHARE_" + email;
  var autoShareButtonNode = $("<div class='sgn_auto_share_actions'>" + 
    "<button class='sgn_auto_share_understood'>Understood</button>" +
    "<div class='column_line'></div>" +
    "<button class='sgn_auto_share_not_show_again'>Don't show again</button>" +
    "</div>");

  autoShareButtonNode.find("button.sgn_auto_share_understood").click(function() {
    if($.featherlight.current()){
      $.featherlight.current().close();
    }
  });
  autoShareButtonNode.find("button.sgn_auto_share_not_show_again").click(function() {
    window.localStorage.setItem(autoShareAlertKey, true);
    if($.featherlight.current()){
      $.featherlight.current().close();
    }
  });

  return autoShareButtonNode;
};

var getCommentPlaceholder = function() {
  var placeholder = 'Add comment here';
  if(gCrmTeamMemberInfo && gCrmTeamMemberInfo.length) {
    placeholder += ", use '@' to notify your team members";
  }

  return placeholder;
};

var buildSgnCommentsNode = function(email, noteComments, data) {
  var crmCommentNode = $("<div class='sgn_comment_container'></div>");
  //var titleNode = $("<div class='sgn_comment_title'></div>");
  var inviteTeamMemberNode = $("<div class='sgn_comment_invite'>" + 
  "<a class='sgn_inviation_action'>Invite Team Member <i class='sgn_member_right_arrow'></a></div>");
  var showCommentNumberNode = $("<div class='sgn_comment_tips'>Comments</div>");
  //titleNode.append(showCommentNumberNode).append(inviteTeamMemberNode);

  //crmCommentNode.append(titleNode);
  var subject =  data["sgn-subject"] ? data["sgn-subject"]  : sgnGmailDom.getEmailSubject();
  var viewMoreUrl = "";
  var shareUrl = "";
  var unShareUrl = "";

  viewMoreUrl = getClickShareURL(email);

  crmCommentNode.append(getSidebarSectionHeader(subject, 'email.30.png', viewMoreUrl));

  var commentTextAreaContainer = $("<div class='sgn_comment_textarea_container'></div>");
  var commentActionButtonNode = getCommentActionButtonNode(email);
  var commentTextArea = $("<textarea class='sgn_comment_textarea'></textarea>");
  commentTextArea.attr("placeholder", getCommentPlaceholder());
  
  var commentErrorNode = $("<div class='sgn_comment_error'></div>");

  commentTextAreaContainer.append(commentTextArea);
  commentTextAreaContainer.append(commentActionButtonNode);
  crmCommentNode.append(commentTextAreaContainer);
  crmCommentNode.append(commentErrorNode);
  var commentRecordContainer = $("<div class='sgn_comment_history'></div>");
  crmCommentNode.append(commentRecordContainer);
  addNodeToCRMSideBar(crmCommentNode, 'sgn_crm_comments');
  appendCommentRecordNodes(noteComments);

  updateCommentsNodeByUpdateInfo(data);

  var crmContacts = data['crm_contacts'] || [];
  if (crmContacts.length) {
    addContactsToSidebar(email, crmContacts);
  }


  inviteTeamMemberNode.find("a.sgn_inviation_action").click(function() {
    openCRMInvitePage(email);
  });

  commentRecordContainer.css("cursor", "pointer").click(function(e){
    if (e.target.className != 'sgn_team_member_link')
      openCRMPage(viewMoreUrl);
  });
  /*
  addViewMoreDom(crmCommentNode, function(dom) {
  });
  */
  markLastVisible(crmCommentNode);

  initMentionIfNeeded(commentTextArea);
};


var removeCRMLoginSidebarNode = function() {
  $("div.sgn_sidebar_crm_login_container").remove();
  $(".sgn_sidebar.sgn_sidebar_login").remove();
};

var setupCRMLoginSidebarNode = function(needCheckNotificationDom) {
  
  if (gCrmLoggedIn) {
    return;
  }

  if (!gSgnUserEmail){
    return; //not yet logged in
  }

  debugLog("@802----- gCRMLogged iN", gCrmLoggedIn);
  if ($("div.sgn_sidebar_crm_login_container:visible").length > 0) {
    return;
  }
  /*
  if(!gCrmLoggedInChecked){
    return;
  }
  */

  // show add when notification side bar appears
  if(needCheckNotificationDom && $(".sgn_sidebar.sgn_notification:visible").length == 0){
    return;
  }

  var loginLogoUrl = SGNC.getBartLogoImageSrc("ed");

  debugLog("@32, @1002, set up login crm");
  var loginNodeContainer = $("<div class='sgn_sidebar_crm_login_container'>" + 
      "<div class='sgn_sidebar_login_logo'><img src='" + SGNC.getCRMLogoImageSrc("sb", "sidebar_crm_login_ad_v2.png") + "'/></div>" +
      "<div class='sgn_sidebar_login_container_title'>Simple Mobile CRM</div>" +
      "<div class='sgn_sidebar_login_description'>Notes on mobile, comment on notes, team work and more!</div>" +
      "<div class='sgn_sidebar_login_button'>Login</div>" +
    "</div>");

  addNodeToCRMSideBar(loginNodeContainer, "sgn_sidebar_login");
  loginNodeContainer.find(".sgn_sidebar_login_button").click(function(){
    var loginUrl = getCRMLoginUrl('ad');
    sendEventMessage(
      'SGN_PAGE_open_popup',
      {
        url: loginUrl,
        windowName: 'sgn-login-page',
        strWindowFeatures: SGNC.getStrWindowFeatures(1000, 700)
      }
    );
  });

};

var getCRMUserSingleCommentDom = function(comment) {
    var authorIconUrl = comment['avatar'];
    var authorName = comment['author_name'];
    var commentTime = comment['created_datetime'];
    commentTime = new Date(parseInt(commentTime));
    commentTime = moment(commentTime).fromNow();
    var crmUrl = getCRMOpportunityListUrl(gCrmUserEmail);
    var commentContent = SGNC.nl2br(SGNC.getMentionText(comment['content'], crmUrl));
    var commentDom = $("<div class='sgn_crm_user_comment_item'>"+
      "<div class='sgn_crm_user_comment_item_container'>" +
        "<div class='sgn_crm_user_comment_item_container_header sgn_flex_center_row'>" +
          "<div class='sgn_crm_user_comment_item_icon'><img src='"+authorIconUrl+"'></div>" + 
          "<div class='sgn_crm_user_comment_author_name'>"+ authorName +"</div>"+
          "<div class='sgn_crm_user_comment_created_time'>"+ commentTime +"</div>"+
        "</div>" +
        "<div class='sgn_crm_user_comment_content'>"+ commentContent +"</div>" +
      "</div>" +
      "</div>");

    processMentionURL(commentDom);
  return commentDom;
};

var getCRMUserCommentsDom = function(comments) {
  var commentLength = comments.length;
  if (!commentLength) {
    return;
  }
  var commentsContainer = $("<div class='sgn_crm_user_comments'></div>");

  var comment, commentDom;
  for (var i=0; i<commentLength; i++) {
    comment = comments[i];
    commentDom = getCRMUserSingleCommentDom(comment);
    commentsContainer.append(commentDom);
  }

  return commentsContainer;
};


var getTeamMentionMeHeaderDom = function(text) {
  if (!text) {
    return;
  }
  var infos = SGNC.getMentionInfos(text);
  var mentionTipsContainer;
  for (var i=0; i<infos.length; i++) {
    info = infos[i];
    if (info['email'] === gCrmUserEmail) {
      mentionTipsContainer = $("<div class='sgn_crm_user_mention_tips_container'>@me</div>");
    }
  }

  return mentionTipsContainer;
};


var markLastVisible = function(nodeQuery) {
  nodeQuery.find("> *").removeClass("last-visible");
  nodeQuery.find("> *:visible:not(:empty):last").addClass("last-visible");
};

var getCRMUserRecentNoteDom = function(note, email, isTeam) {
  var showNote = note['show'] || false;
  if(!showNote)
    return null;

  var noteContent = note['note'];
  var noteModifiedDate = note['modified_datetime'];
  var noteBackgroundColor = note['background_color'] || "rgb(255, 255, 153)";
  var noteSubject = note['subject'] || '';
  var noteExcerpt = note['excerpt'] || '';
  var noteIconUrl = SGNC.getIconBaseUrl() + "/gmail_note_icon.png";
  var isCRMUserNote = note['team_member'] === gCrmUserEmail;
  var noteIconBackgroundColor = isCRMUserNote ? '#dc4439' : '#4f82de';
  var noteFontColor = note['font_color'];
  var crmNoteId = note['thread_id'];
  var noteType = 'email';
  var noteContainerClass = 'sgn_crm_user_recent_note_item_container sgn_crm_user_recent_email_note';


  if (note['is_regular_note']) {
    noteBackGroundColor = '#faf7f4';
    noteContainerClass = 'sgn_crm_user_recent_note_item_container sgn_crm_user_recent_regular_note';
    noteContent = note['content'];
    noteIconBackgroundColor = isCRMUserNote ? '#f89f2c' : '#5fcde9';
    noteIconUrl = SGNC.getIconBaseUrl() + "/note_icon.png";
    crmNoteId = note['id'];
    noteType = 'note';
    noteBackgroundColor = '#fdf7ee';
    if (isTeam) {
      noteBackgroundColor = '#edfafc';
    }
  }
  var comments = note['note_comments'] || note['email_note_comments'] || [];

  var noteCommentCountIconUrl = SGNC.getIconBaseUrl() + "/comment.3x.png";
  var noteItemCommentActionNodeString = "<div class='sgn_crm_user_recent_note_comment_count'>"+
      "<img src='"+ noteCommentCountIconUrl +"'>" +
      "<span>"+comments.length+"</span>" +
    "</div>";
  var commentsNode = getCRMUserCommentsDom(comments.slice(0, 3)); // at most 3
  var crmUrl = getCRMOpportunityListUrl(gCrmUserEmail);
  
  var parsedNoteContent = SGNC.nl2br(SGNC.getMentionText(noteContent, crmUrl));

  var commentsData = JSON.stringify(comments);
  noteModifiedDate = new Date(parseInt(noteModifiedDate));
  noteModifiedDate = moment(noteModifiedDate).fromNow();

  var sgnNoteIconStr = "";
  if (!isTeam) {
    var noteArrowIconUrl = SGNC.getIconBaseUrl() + "/edit-note-icon.png";
    sgnNoteIconStr = "<div class='sgn_crm_user_recent_note_detail_icon' title='Edit the note'><img class='sgn_note_icon' src='"+noteArrowIconUrl+"' /></div>";
  }


  var shareIconUrl = SGNC.getIconBaseUrl() + "/share_note.3x.png";
  var unShareIconUrl = SGNC.getIconBaseUrl() + "/unshare_note.3x.png";
  var noteItemDom = $("<div class='sgn_crm_user_recent_note_item' "+
                            "data-note-owner='"+note['team_member']+"' "+
                            "data-note-show='"+ (note['show'] || "") +"' "+
                            " data-note-type='"+noteType+"' "+
                            " data-note-id='"+crmNoteId+"'>"+
    "<div class='"+noteContainerClass+"'>" +
      "<div class='sgn_crm_user_recent_note_header'>"+
        "<div class='sgn_crm_user_recent_note_modified_time'>"+noteModifiedDate+"</div>" +
        "<div style='display:flex'>" +
        "<div class='sgn_crm_user_recent_note_share_icon' title='Share the note to team members'><img src='"+shareIconUrl+"'></div>" +
        "<div class='sgn_crm_user_recent_note_unshare_icon' title='The note is already shared to team members'><img src='"+unShareIconUrl+"'></div>" +    
        sgnNoteIconStr + 
        "</div>" +
      "</div>" + 
      "<div class='sgn_crm_user_recent_note' style='background-color: "+noteBackgroundColor+"'>"+
        "<div class='sgn_crm_user_recent_note_content' style='color: " + noteFontColor + "'>"+parsedNoteContent+
        "</div>" + 
      "</div>" + 
      "<div class='sgn_crm_user_recent_note_subject_container'>" + 
        "<span class='sgn_crm_user_recent_note_subject'>"+ noteSubject + "</span>" +
        "<span class='sgn_crm_user_recent_note_excerpt'> " + noteExcerpt + "</span>" +
      "</div>" + 
      "<div class='sgn_crm_user_recent_note_comment_action'>" + 
        noteItemCommentActionNodeString +
        "<div class='sgn_crm_user_recent_note_add_comment'>Add Comment</div>" +
      "</div>" +
    "</div>" +
  "</div>");
 
  
  if(isTeam && crmNoteId === getCrmThreadId()){
    noteItemDom.addClass("sgn_crm_same_team_same_thread");
  }

  noteItemDom.attr('data-comments', JSON.stringify(comments));
  processMentionURL(noteItemDom);
  var teamMemberEmail = note['team_member'];
  var viewMoreUrl = getEmailDetailUrl(email, crmNoteId, teamMemberEmail);
  noteItemDom.find('.sgn_crm_user_recent_note,.sgn_crm_user_recent_note_detail_icon').click(function(e){
    // var url = getCRMOpportunityListUrl(gCrmUserEmail, note['team_member'], ':' + crmNoteId); 
    // e.stopPropagation();
    if (e.target.className != 'sgn_team_member_link')
      openCRMPage(viewMoreUrl);
  });

  //noteItemDom.find('.sgn_crm_user_recent_note_share_icon').unbind('click');
  noteItemDom.find('.sgn_crm_user_recent_note_share_icon').click(function(){
    openCRMPage(viewMoreUrl + "&action=share");
  }).attr("data-crm-share-email-url", viewMoreUrl + "&action=share");

  //noteItemDom.find('.sgn_crm_user_recent_note_unshare_icon').unbind('click');
  noteItemDom.find('.sgn_crm_user_recent_note_unshare_icon').click(function(){
    openCRMPage(viewMoreUrl + "&action=unshare");
  });

  noteItemDom.find("[title]").tooltip({
    classes: {
      "ui-tooltip": "ui-corner-all ui-widget-shadow sgn-crm-tooltip"
    },
    show: {
      effect: "none",
      delay: 0
    }
  });

  if(!note['show_share_button']){
    noteItemDom.find('.sgn_crm_user_recent_note_share_icon').hide();
  }

  if(!note['show_unshare_button']){
    noteItemDom.find('.sgn_crm_user_recent_note_unshare_icon').hide();
  }


  if (!comments.length) {
    noteItemDom.find("div.sgn_crm_user_recent_note_comment_count").hide();
  }

  if (commentsNode) {
    noteItemDom.find("div.sgn_crm_user_recent_note_item_container").append(commentsNode);
  }

  if (isTeam) {

    var authorDom = $("<div class='sgn_crm_user_recent_note_author'>@"+note['team_member_name']+"</div>");
    noteItemDom.find("div.sgn_crm_user_recent_note_modified_time").prepend(authorDom);

    authorDom.css("cursor", "pointer").click(function(){
      var url = getCRMOpportunityListUrl(gCrmUserEmail, note['team_member']);
      openCRMPage(url);
    });

    var mentionText = noteContent;
    for (var n=0; n<comments.length; n++) {
      mentionText = mentionText + comments[n]['content'];
    }
    var teamMentionHeaderDom = getTeamMentionMeHeaderDom(mentionText);
    if (teamMentionHeaderDom) {
      authorDom.append(teamMentionHeaderDom);
    }
  }

  var openCommentModalSelectors = 'div.sgn_crm_user_recent_note_comment_action > div';
  $(openCommentModalSelectors).css('cursor', 'pointer');
  noteItemDom.find(openCommentModalSelectors).featherlight('text', {
    width: 800,
   	height: 600,
    beforeOpen: function(event){
      $('.featherlight-content').empty();
      $(".featherlight-content").css("padding", 0)
                                .css("border-bottom", 'none')
                                .css("border", 'solid 1px #cccccc')
                                .css('border-radius', '10px');
      var noteItemContainer = $(this.$currentTarget).parents("div.sgn_crm_user_recent_note_item");
      var comments = noteItemContainer.attr("data-comments");
      if (comments) {
        comments = JSON.parse(comments);
      }
      var commentNoteType = noteItemContainer.attr("data-note-type");
      var commentNoteId = noteItemContainer.attr("data-note-id");
      buildCommentModal(comments, commentNoteId, commentNoteType, email);

    },
    afterOpen: function(event){
    }
  });

  noteItemDom.find(".sgn_crm_user_comments").css("cursor", "pointer").click(function(){
    var emailDetailUrl = getEmailDetailUrl(email, crmNoteId, teamMemberEmail);
    openCRMPage(emailDetailUrl);
  });

  if(!isTeam && noteType == 'email'){
    var subjectNode = noteItemDom.find(".sgn_crm_user_recent_note_subject_container");
    subjectNode.css("cursor", "pointer");
    subjectNode.click(function(){
      var noteId  = $(this).parents(".sgn_crm_user_recent_note_item").attr("data-note-id");
      var url = getHistoryNoteURL(noteId);
      window.open(url, "_blank");
    });
  }

  if (!showNote) {
    noteItemDom.hide();
  }

  return noteItemDom;
};


var buildCommentModal = function(comments, noteId, noteType, email) {
  var commentModal = $("<div class='sgn_crm_comment_modal'></div>");
  var commentTextAreaDiv = $("<div class='sgn_crm_comment sgn_comment_textarea_container'>"+
    "<textarea class='sgn_comment_textarea' data-note-type='"+noteType+"' data-note-id='"+noteId+"'></textarea>"+
    "</div>");

  commentTextAreaDiv.find("textarea").attr("placeholder", getCommentPlaceholder());
  var commentAction = getCommentActionButtonNode(email);
  var commentTextArea = commentTextAreaDiv.find("textarea");
  // initMentionIfNeeded(commentTextArea);
  commentTextAreaDiv.append(commentAction);
  var commentsNode = getCRMUserCommentsDom(comments);
  var commentListDom = $("<div class='sgn_crm_comment_list'>"+
    "<div class='sgn_crm_comment_count'>"+comments.length+" Comments</div>"+
    "<div class='sgn_crm_no_comments'>No comment</div>"+
    "</div>");
  commentListDom.find("div.sgn_crm_comment_count").hide();
  if (commentsNode) {
    commentListDom.append(commentsNode);
  }
  if (comments.length) {
    commentListDom.find("div.sgn_crm_no_comments").hide();
    commentListDom.find("div.sgn_crm_comment_count").show();
  }
  commentModal.append(commentTextAreaDiv);
  commentModal.append(commentListDom);
  $(".featherlight-content").append(commentModal);
  initMentionIfNeeded(commentModal.find("textarea"));
};

var buildAutoShareModal = function(email) {
  var modalText = "Since team member is <strong>mentioned</strong>, the corresponding note will be \
    <strong>automatically shared to all team members</strong>. If this is not expected, \
    please click the 'unshare' button of email to revoke the sharing.";
  var autoShareModal = $("<div class='sgn_crm_auto_share_modal'></div>");
  var autoShareAction = getAutoShareActionButtonNode(email);
  var textAreaDiv = $("<div class='modal_content_text_container'>"+
    "<p class='sgn_modal_text'></p>"+
    "</div>");
  var rowLine = $("<div class='row_line'></div>");
  textAreaDiv.find("p").html(modalText);
  autoShareModal.append(textAreaDiv);
  autoShareModal.append(rowLine);
  autoShareModal.append(autoShareAction);
  $(".featherlight-content").append(autoShareModal);
};


var showOrHideRecentNotes = function(actionDom) {
  var dataType = actionDom.attr("data-type");
  var notesContainer = actionDom.parents("div.sgn_crm_user_recent_notes_container");
  var noteItems = notesContainer.find("div.sgn_crm_user_recent_note_item");
  var viewMoreDom = notesContainer.find("div.sgn_crm_user_view_more");
  var inviteDetailDom = notesContainer.find("div.sgn_crm_user_invite_detail");
  var text, iconUrl;
  if (dataType === 'hide') {
    noteItems.show('slow');
    dataType = 'show';
    text = "";
    iconUrl = SGNC.getIconBaseUrl() + "/arrow_up.png";
    viewMoreDom.show();
    inviteDetailDom.show();
  } else {
    noteItems.hide();
    dataType = 'hide';
    text = "";
    noteItems.first().show();
    iconUrl = SGNC.getIconBaseUrl() + "/arrow_down.png";
    viewMoreDom.hide();
    inviteDetailDom.hide();
  }
  actionDom.attr("data-type", dataType);
  actionDom.empty();
  var icon = $("<img>").attr(
    "src", iconUrl);
  actionDom.text(text).append(icon);

  markLastVisible(notesContainer.find(".sgn_crm_user_recent_notes"));
};


var addViewMoreDom = function(parentNode) {
  if (parentNode.find("div.sgn_crm_recent_notes_action").length > 0) {
    return;
  }
  var moreIconUrl = SGNC.getIconBaseUrl() + "/arrow_down.png";
  var actionDom = $("<div class='sgn_crm_recent_notes_action' data-type='hide'>"+
    "<img src='"+moreIconUrl+"'>"+"</div>");
  actionDom.on('click', function(e) {
    showOrHideRecentNotes($(this));
  });
  parentNode.append(actionDom);
};


var addContactsToSidebar = function(email, crmContacts){
  var contactsNode = $("<div class='sgn_crm_contacts'></div>");
  var emailContactList = null;
  var followedContactList = [];
  var notFollowedContactList = [];
  var maxContactsToDisplay = 3;
  var i;
  var emailDetailUrl;

  for(i=0; i<crmContacts.length; i++){
    var contactInfo = crmContacts[i];

    var contactLineNode = $("<div class='sgn_crm_contact_row'></div>");


    // this email is not imported, and contact is derived from opp
    if(!contactInfo.thread_id && contactInfo.contact_id && emailContactList === null){   
      emailContactList = [];
      var contactList = getDomContactInfo(email)[0];
      for(var j=0; j<contactList.length; j++){
        var contact = contactList[j];
        if(!contact.isUser && contact.email){
          emailContactList.push(contact.email.toLowerCase());
        }
      }
    }

    // debugLog('@1223, contact info', contactInfo);
    if(contactInfo.contact_id){    // has contact linked to existing thread
      if(contactInfo.thread_id || emailContactList.includes(contactInfo.email)){
        var contactURL = SGNC.getCRMBaseUrl() + "/crm/contact_detail/" + contactInfo.contact_id + "/?" + getCRMBaseParam();
        var contactOppUrl = SGNC.getCRMBaseUrl() + "/crm/opportunity_detail/" + contactInfo.opportunity_id + "/?" + getCRMBaseParam();
        emailDetailUrl = getEmailDetailUrl(gCrmUserEmail, contactInfo.thread_id);
        contactLineNode.append("<div class='sgn_crm_contact_name'><img src='" + SGNC.getIconBaseUrl() + "/contact_blue.30.png'/><a href='#' data-href='" + contactURL +  "'>" + contactInfo.contact_name + "</a></div>");
        contactLineNode.append("<div class='sgn_crm_contact_opp'><a href='#' data-href='" + emailDetailUrl + "'>" + "Followed" + "</a></div>");

        followedContactList.push(contactLineNode);
      }
    }
    
    if(contactInfo.thread_id && !contactInfo.contact_id){    // has thread, but no contact
      emailDetailUrl = getEmailDetailUrl(gCrmUserEmail, contactInfo.thread_id);
      contactLineNode.append("<div class='sgn_crm_contact_name_not_followed'><img src='"+ SGNC.getIconBaseUrl() + "/contact.30.png'/>" + contactInfo.contact_name + "</div>");
      contactLineNode.append("<div class='sgn_crm_contact_action'><a href='#' data-href='" + emailDetailUrl + "'>+ Follow</a></div>");
      notFollowedContactList.push(contactLineNode);
    }

  }


  for(i=0; i<followedContactList.length; i++){
    if(i < maxContactsToDisplay) {
      contactsNode.append(followedContactList[i]);
    }
  }

  for(i=0; i<notFollowedContactList.length; i++){
    if(i + followedContactList.length < maxContactsToDisplay){
      contactsNode.append(notFollowedContactList[i]);
    }
  }

  contactsNode.find("a").click(function(){
    var url = $(this).data('href');
    openCRMPage(url);
  });

  var commentNode = $(".sgn_sidebar_container .sgn_comment_textarea_container:visible");
  commentNode.find('.sgn_crm_contacts').remove();
  commentNode.prepend(contactsNode);
};

var getSidebarSectionHeader = function(headerText, headerIconUrl, viewMoreUrl, viewEmailUrl=null) {
  var header = $("<div class='sgn_crm_sidebar_section_header'></div>");
  var headerTitle = $("<div class='sgn_crm_sidebar_section_title' style='max-width:100%'></div>");
  var imageUrl = SGNC.getIconBaseUrl() + '/' + headerIconUrl;
  headerTitle.append("<img src='" + imageUrl + "'/>");
  headerTitle.append($("<div class='sgn_crm_sidebar_section_title_text' />").text(headerText));
  header.append(headerTitle);

  
  imageUrl = SGNC.getIconBaseUrl() + "/share_note.3x.png";
  var shareUrl = viewMoreUrl + "&action=share";
  
  headerTitle.append("<div class='sgn_crm_sidebar_header_share' title='Share the note to team members'><img src='" + imageUrl + "'/></div>");
  header.find('.sgn_crm_sidebar_header_share').hide().click(function(){
    openCRMPage(shareUrl);
  }).attr("data-crm-share-email-url", shareUrl);
    
  imageUrl = SGNC.getIconBaseUrl() + "/unshare_note.3x.png";
  headerTitle.append("<div class='sgn_crm_sidebar_header_unshare' title='The note is already shared to team members'><img src='" + imageUrl + "'/></div>");
  header.find('.sgn_crm_sidebar_header_unshare').hide().click(function(){
    openCRMPage(viewMoreUrl + "&action=unshare");
  });

  imageUrl = SGNC.getIconBaseUrl() + "/crm_calendar.33.png";
  headerTitle.append("<div class='sgn_crm_create_todo' title='Convert the note to a todo item'><img src='" + imageUrl + "'</div>");
  header.find('.sgn_crm_create_todo').hide().click(function(){
    openCRMPage(viewMoreUrl + "&action=create_todo");
  });

  if(viewEmailUrl){
    headerTitle.append("<div class='sgn_crm_sidebar_header_change_project'>Change Project</div>");
    header.addClass("sgn_crm_has_view_more");
    header.find('.sgn_crm_sidebar_header_change_project').click(function(){
      openCRMPage(viewEmailUrl + '&action=change_project');
    });
  }

  if(viewMoreUrl){
    headerTitle.append("<div class='sgn_crm_sidebar_header_view_more'>More</div>");
    header.addClass("sgn_crm_has_view_more");
    header.find('.sgn_crm_sidebar_header_view_more').click(function(){
      openCRMPage(viewMoreUrl);
    });

    header.find('.sgn_crm_sidebar_section_title_text').click(function(){
      openCRMPage(viewMoreUrl);
    });
  }

  header.find("[title]").tooltip({
    classes: {
      "ui-tooltip": "ui-corner-all ui-widget-shadow sgn-crm-tooltip"
    },
    show: {
      effect: "none",
      delay: 0
    }
  });

  return header;
};

var getClickShareURL = function(email) {
  var currentMessageId = sgnGmailDom.getCurrentMessageId();
  let viewEmailUrl = getEmailDetailUrl(email, currentMessageId);
  var emailData = getCRMShareEmailData(email, currentMessageId);
  var oppInfoNode = SGNC.getSidebarNode().find('.sgn_sidebar.sgn_crm_opportunity');
  var opportunityId = oppInfoNode.attr("data-opportunity-id");
  if(opportunityId && !emailData['email']['opportunity_id']){
      emailData['email']['opportunity_id'] = opportunityId;
    }
  emailData['action'] = 'click-share';
  viewEmailUrl += '&zdata=' + LZString.compressToBase64(JSON.stringify(emailData));
  return viewEmailUrl;
};

var buildCRMRecentNotesDom = function(notes, email, isTeam, crmUserInfo, isMentionedOnly) {
  // var header = $("<div class='sgn_crm_sidebar_section_header'></div>");
  var addNoteDom;
  var recentNotesContainer = $("<div class='sgn_crm_user_recent_notes_container'></div>");

  var headerTitleContent = 'Team Latest';
  var isNotesShared = crmUserInfo['view_notes'];

  var viewMoreUrl = getCRMOpportunityListUrl(email) + "&team_only=1";

  if(isMentionedOnly){
    viewMoreUrl = getCRMMentionedListUrl(email);
    headerTitleContent = 'Mentioned Me';
  }

  var viewEmailUrl = null;
  if (!isTeam) {
    //headerTitleContent = 'Related Notes';
    var oppInfoNode = SGNC.getSidebarNode().find('.sgn_sidebar.sgn_crm_opportunity');
    var opportunityId = oppInfoNode.attr("data-opportunity-id");
    headerTitleContent = oppInfoNode.attr("data-opportunity-name");
    recentNotesContainer.addClass('sgn_crm_user_self_notes');
    // var currentMessageId = sgnGmailDom.getCurrentMessageId();
    //viewMoreUrl = getEmailDetailUrl(email, currentMessageId);
    viewMoreUrl = getCRMOpportunityDetailUrl(getCrmUser(email), opportunityId, "sb-header");

    viewEmailUrl = getClickShareURL(email);
    debugLog('##', viewEmailUrl);
  }

  // var headerTitle = $("<div class='sgn_crm_sidebar_section_title'></div>").text(headerTitleContent);
  var header = getSidebarSectionHeader(headerTitleContent, 'folder.33.png', viewMoreUrl, viewEmailUrl);
  // header.append(headerTitle);
  if (addNoteDom) {
    header.append(addNoteDom);
  }
  
  recentNotesContainer.append(header);
  var noteContainerDom = $("<div class='sgn_crm_user_recent_notes'></div>");
  var noteDom;
  var sidebarExtraClass = "sgn_crm_user_recent_notes_current_user";
  if(isTeam)
    sidebarExtraClass = "sgn_crm_user_recent_notes_team_user";

  if (isTeam && crmUserInfo['team_users'].length === 0) {
    if (crmUserInfo['user_level'] !== 'free') {
      noteContainerDom.addClass("sgn_flex_center_column");
      var inviteAction = $("<div class='sgn_crm_user_invite_action_container sgn_flex_center_column'>Invite Team Member</div>");
      var inviteDetailDom = $("<div class='sgn_crm_user_invite_detail'></div>");
      var inviteTitleDom = $("<div class='sgn_crm_user_invite_title'>Work with Team Members</div>");
      var inviteContentDom = $("<div class='sgn_crm_invite_content'>"+
                                "Team members could easily <strong>share notes</strong> and <strong>comments</strong> with each other. "+
                                "After the team member accepted an invitation, "+
                                "the user must set up the permissions to share the corresponding items.</div>");
      var inviteTeamImgUrl = SGNC.getCRMLogoImageSrc("sb", "sidebar_invite_team.png");
      var invitePosterDom = $("<div class='sgn_crm_invite_poster'><img src='"+inviteTeamImgUrl+"' /></div>");
      inviteAction.click(function(e) {
        openCRMInvitePage(email);
      });
      inviteDetailDom.append(inviteTitleDom).append(inviteContentDom)
                     .append(invitePosterDom);
      inviteDetailDom.hide();
      noteContainerDom.append(inviteAction)
                      .append(inviteDetailDom);
      recentNotesContainer.append(noteContainerDom);
      // addViewMoreDom(recentNotesContainer);
      addNodeToCRMSideBar(recentNotesContainer, sidebarExtraClass);
      return;
    }
    return;
  }

  if (notes.length === 0) {
    return;
  }

  for (var i=0; i<notes.length; i++) {
    noteDom = getCRMUserRecentNoteDom(notes[i], email, isTeam, isNotesShared);
    if(noteDom)
      noteContainerDom.append(noteDom);
  }

  recentNotesContainer.append(noteContainerDom);

  recentNotesContainer.find('.sgn_crm_user_recent_note_item[data-note-show=true]:last').css('border-bottom', 'none');

  if (notes.length >= 1 && (!isTeam || crmUserInfo['user_level'] !== 'free')) {
    // addViewMoreDom(recentNotesContainer);
  }

  addNodeToCRMSideBar(recentNotesContainer, sidebarExtraClass);
  // markLastVisible(noteContainerDom);


  //$(".sgn_history:visible").remove();
};

var getCRMRecentNotes = function(email, opportunityId) {
  var tokenInfo = "Bearer " + gCrmUserToken;
  var userNotes = [];
  var teamNotes = [];

  if($(".sgn_crm_user_recent_notes:visible").length){
    // the recent note is already constructed before
    return;
  }

  var crmRecentNotesUrl = getCRMEmailDetailUrl(email, opportunityId);

  sendCrmRequest(crmRecentNotesUrl, function(data){
      SGNC.getCRMEmailDetailCallBack(data);
  });
};

var setupCRMSidebarNode = function(email, updateInfo, noteComments, data) {
  // debugLog("@779----- note comments", noteComments);
  if (!isCrmSgnEnabled() || $(".sgn_crm_opportunity:visible").length) {
    return;
  }

  var opportunityInfo = updateInfo["opportunity_info"];
  if($.isEmptyObject(opportunityInfo)){
    return;
  }

  
  var preferences = gPreferences;
  if(preferences["showCRMSidebar"] == "always_hide"){
    return;
  }

  if(preferences["showCRMSidebar"] == "auto" && 
     !SGNC.isSidebarLayout()){
    return;
  }

  SGNC.getSidebarNode(true);

  cleanupSideBar();


  // var tipNode = $("<div class='sgn_crm_tip_container sgn_flex_center_row'><img/>tip tip tip</div>");
  // tipNode.find("img").attr("src", SGNC.getIconBaseUrl() + "/crm_tip.3x.png");
  // addNodeToCRMSideBar(tipNode, "sgn_crm_tip");


  var opportunityInfoNode = $("<div class='sgn_opportunity_info'></div>");
  var opportunityAvatar = $("<img class='sgn_folder_icon'>").attr(
    "src", SGNC.getIconBaseUrl() + '/folder.54.png');
  var opportunityName = $("<div class='sgn_opportunity_name'>").text(
    opportunityInfo["name"]);


  /*
  var opportunityArrow = $("<img class='sgn_opportunity_icon'>").attr("src",
    SGNC.getIconBaseUrl() + "/arrow-right.png");
  */

  var opportunityNoteCount = opportunityInfo['note_count'];
  opportunityInfoNode.append(opportunityAvatar).append(opportunityName);
  opportunityInfoNode.append("<div class='sgn_flex_grow'></div>");
  var opportunityNoteCountDom = $("<div class='sgn_opportunity_note_count'>"+ opportunityNoteCount+" Notes</div>");
  opportunityInfoNode.append(opportunityNoteCountDom);

  var oppNode = addNodeToCRMSideBar(opportunityInfoNode, "sgn_crm_opportunity");
  oppNode.attr("data-opportunity-name", opportunityInfo["name"]);
  oppNode.attr("data-opportunity-id", opportunityInfo["id"]);

  var _opportunityInfo = opportunityInfo;
  var _email = email;
  opportunityInfoNode.click(function(){
    openCurrentOpportunity(_email, _opportunityInfo.id, 'sb');
  });

  buildSgnCommentsNode(email, noteComments, updateInfo);


  var faqNode = $("<div class='sgn_faq_bar_container sgn_flex_center_row'>" + 
    "<div class='sgn-faq-bar-crm-logo sgn_flex_center_row'><img class='sgn-crm-logo'/>Simple Mobile CRM</div>" +
    "<a href='https://www.simplemobilecrm.com/faq-crm-sidebar' target='_blank'>FAQ</a></div>");
  faqNode.find("img.sgn-crm-logo").attr("src", SGNC.getCRMLogoImageSrc("sb", "crm-logo.24.png"));
  faqNode.find(".sgn-faq-bar-crm-logo").css("cursor", "pointer").click(function(){
    var url = getCRMOpportunityListUrl(email, '', '', 'sb');
    openCRMPage(url);
  });

  addNodeToCRMSideBar(faqNode, "sgn_faq_bar");

  resizeMentionContainer($("textarea.sgn_input"));

  SGNC.getContainer().attr("data-sgn-opp-info-id", opportunityInfo.id);

  getCRMRecentNotes(email, opportunityInfo.id);


  /*
  var commentsNode = $('.sgn_sidebar.sgn_crm_comments:visible');
  if(updateInfo["show_share_button"] === true) {
    commentsNode.find('.sgn_crm_sidebar_header_share').show();
  }
  else {
    commentsNode.find('.sgn_crm_sidebar_header_share').hide();
  }

  if(updateInfo["show_unshare_button"] === true) {
    commentsNode.find('.sgn_crm_sidebar_header_unshare').show();
  }
  else {
    commentsNode.find('.sgn_crm_sidebar_header_unshare').hide();
  }
  */
};


var updateGmailNotePosition = function(injectionNode, notePosition){
  var preferences = gPreferences;
  //var logo = injectionNode.find(".sgn_bart_logo");
  var noticeNode = injectionNode.find(".sgn_notice");

  // debugLog("@130c");
  if(injectionNode.attr('data-note-position') === notePosition) {
    return;
  }

  //debugLog("@130d");
  if(notePosition == "side-top" || notePosition == "side-bottom"){
    //injectionNode.append(logo);

    //all the sidebart display logic are now done in css
    //
    //$(".sgn_prompt_logout").css("height", "30px");
    //var showConnectionPrompt = (preferences["showConnectionPrompt"] !== "false");
    //if(showConnectionPrompt){
    //  $(".mce-tinymce").css("margin-top", "20px");
    //}

    //logo.after(noticeNode);
    //var noteTimeStampDom = SimpleGmailNotes.getNoteTimeStampDom();
    //noteTimeStampDom.after(logo);
    //if($(".sgn_clear_right").length <= 0){
     // $("<div class='sgn_clear_right'></div>").insertAfter(noteTimeStampDom);
    //}
    //
  }
  else{
    if($(".sgn_clear_right").length > 0){
      $(".sgn_clear_right").remove();
    }
    //injectionNode.children('.sgn_bart_logo').remove();
    //injectionNode.children('.sgn_prompt_logout').prepend(logo);
    injectionNode.children('.sgn_prompt_logout').append(noticeNode);

  }

  if(isRichTextEditor() && injectionNode.is(":visible"))
    //for richtext editor, cannot prepend the node again, otherwise the iframe 
    //inside will have problem
    return;

  if(notePosition == "side-top" || notePosition == "side-bottom"){
    if(notePosition == "side-top"){
      SGNC.getSidebarNode(true).prepend(injectionNode);
    }else{
      SGNC.getSidebarNode(true).append(injectionNode);
    }
    injectionNode.addClass("sgn_sidebar");
    injectionNode.parent().find(".y4").css("display", "none");
    setupSidebarDimension(injectionNode);
  }else{

    if(notePosition == "bottom"){
      if($(".nH.aHU:visible").length){
        $(".nH.aHU:visible").append(injectionNode);
      }
      else {
        $(".nH > .aHU:visible").append(injectionNode);
      }
    }else{
      if($(".nH.if:visible, .nH.aBy:visible").length){
        $(".nH.if:visible, .nH.aBy:visible").prepend(injectionNode);
      }
      else {
        // UI updated 2022-10-12
        SGNC.getMainNode().prepend(injectionNode);
        //$(".nH[role=main] table.nH td.Bu:visible").prepend(injectionNode);
      }
    }
    injectionNode.css("width", "auto");
    //$(".sgn_prompt_logout").css("height", "auto");
    
  }

  injectionNode.attr("data-note-position", notePosition);

};

var getBooleanFromPreferences = function(key, needExplicitTrue){
  var preferences = gPreferences;
  if(!preferences)
    return false;


  var value;
  
  if(needExplicitTrue) {
    value = preferences[key] === "true";
  }
  else {
    value = preferences[key] !== "false";
  }

  return value;
};

var isEnableFlexibleHeight = function(){
  return getBooleanFromPreferences("enableFlexibleHeight", false);
};

var isRichTextEditor = function(){
  return getBooleanFromPreferences("enableRichtextEditor", true);
};

var isStripHTMLTags = function() {
  var result = getBooleanFromPreferences("enableStripHTML", false);
  debugLog("@1859", result);
  return result;
};

var isDisableConsecutiveWarning = function() {
  return getBooleanFromPreferences("disableConsecutiveWarning", true);
};


var isEnableNoteFontBold = function() {
  return getBooleanFromPreferences("disableConsecutiveWarning", true);
};

var isEnableNoDisturbMode = function(){
  return getBooleanFromPreferences("enableNoDisturbMode", false);
};

var getTinymceUrl = function(){
  var baseUrl = SGNC.getBrowser().runtime.getURL('lib/tinymce');
  return baseUrl;
};

var setupOfflineNotice = function(){

  var warningMessage = SGNC.offlineMessage;
  var warningIconUrl = "https://static-gl.simplegmailnotes.com/media/warning.3x.png";
  var warningNode = $("<div class='sgn_inactive_warning'><div class='sgn_offline_message'>" + 
                        "<img src='"+ warningIconUrl +"'>" +
                        warningMessage + "</div></div>");
  var warningNodeCount = $(".sgn_inactive_warning:visible");

  var containerNode = $(".sgn_container:visible");
  if(containerNode.length){
    if(containerNode.find("> .sgn_inactive_warning").length === 0){
      containerNode.prepend(warningNode);
    }
  }
  else {
    var pageNode = $("div.aDP:visible");
    if(pageNode.length && pageNode.find("> .sgn_inactive_warning").length === 0){
      pageNode.prepend(warningNode.clone());
    }
  }
};

var getNoteHeight = function(){
  var preferences = gPreferences;
  if(!preferences)  //ui not ready
    return;

  var noteHeight = parseInt(preferences["noteHeight"]);

  if(isEnableFlexibleHeight() && !isRichTextEditor()){
    var oldNoteHeight = noteHeight;
    noteHeight = 1;
    if($(".sgn_input") && getInputValue($(".sgn_input"))){
      var line = getInputValue($(".sgn_input")).split("\n");
      var lineBreaks = line.length;
      noteHeight = lineBreaks;
      if(lineBreaks > oldNoteHeight){
        noteHeight = oldNoteHeight;
      }
    }
  }

  return noteHeight;
};

var getFontSize = function(preferences){
  var fontSize = preferences["fontSize"];
  if(fontSize == "default") {
    fontSize = parseInt($(".sgn_input").css("font-size"));
  }

  return fontSize;
};

var updateUIByPreferences = function(){
  var preferences = gPreferences;
  if(!preferences || $.isEmptyObject(preferences))  //ui not ready
    return;
  
  //the account is disabled
  var currentDisableList = JSON.parse(preferences["disabledAccounts"]);
  if(currentDisableList.indexOf(gSgnUserEmail) > 0){
    return;
  }

  var fontColor = preferences["fontColor"];
  if(fontColor){
    $(".sgn_input").css("color", SGNC.htmlEscape(fontColor));
  }
  
  var fontSize = getFontSize(preferences);
  if(preferences["fontSize"] != "default"){ // if default, do not set
    $(".sgn_input").css("font-size", fontSize + "px");
    $(".sgn_input").css("line-height", '1.2');
  }

  if(isEnableNoteFontBold() && !isRichTextEditor()) {
    $(".sgn_input").css("font-weight", "bold");
  }

  var noteHeight = getNoteHeight();
  $(".sgn_input").css("height", noteHeight * fontSize * 1.2 + 6 + "px");

  var firstVisible = $(".sgn_container:visible").first();
  $(".sgn_container:visible:not(:first)").hide();
  //avoid duplicates
  //$(".sgn_container").hide();
  //firstVisible.show();

  var notePosition = preferences["notePosition"];
  if(isRichTextEditor() && SGNC.getCurrentBackgroundColor()){
    backgroundColor = SGNC.getCurrentBackgroundColor();
  }

  firstVisible.removeClass('sgn_position_top');
  firstVisible.removeClass('sgn_position_bottom');
  firstVisible.removeClass('sgn_position_side-top');
  firstVisible.removeClass('sgn_position_side-bottom');

  updateGmailNotePosition(firstVisible, notePosition);
  //reset class attribute with current 'position' class
  firstVisible.addClass('sgn_position_' + notePosition);
  if(notePosition === "side-top" || notePosition === "side-bottom"){ //for move mail-address to top 
    var sgn_current_connection = $(".sgn_current_connection");
    $(".sgn_current_connection").remove();
    $(".sgn_prompt_logout").prepend(sgn_current_connection);
  }

  var showConnectionPrompt = (preferences["showConnectionPrompt"] !== "false");
  if(!showConnectionPrompt){
    $(".sgn_current_connection").hide();
  }


  var showAddCalendar = (preferences["showAddCalendar"] !== "false");
  if(!showAddCalendar){
    $(".sgn_add_calendar").hide();
  }

  var showDeleteButton = (preferences["showDelete"] !== "false");
  if(!showDeleteButton){
    $(".sgn_delete").hide();
  }

  var showNoteColorPicker = (preferences["showNoteColorPicker"] !== "false");
  if(!showNoteColorPicker){
    $(".sgn_background_color").hide();
  }
    
  var showCRMButton = (preferences["showCRMButton"] !== "false");
  if(!showCRMButton){
    $(".sgn_share").hide();
    $(".sgn_shared").hide();
  }

  var isPaid = (preferences["isPaid"] === "true");

  var showLogo = (preferences["showLogo"] !== "false");
  if(!showLogo && isPaid){
    $(".sgn_bart_logo_top").hide();
    $(".sgn_bart_logo_bottom").hide();
  }

  var showPrintingNote = (preferences["showPrintingNote"] !== "false");
  if(!showPrintingNote) {
    removePrintInfo(gSgnUserEmail);
  }

  var showTemplateButton = (preferences["templateContent"] !== "") && (preferences["templateAutoload"] === "false");
  if(!showTemplateButton){
    $(".sgn_template").hide();
  }

  debugLog("@470", preferences);

  if(preferences['isShowNotification'] === "true" && !$('.sgn_sidebar.sgn_notification:visible').length){

    var subscribe_href = "https://www.bart.com.hk/simple-gmail-notes-support-package/?f=sb";
    var notificationNode = $('<div class="sgn_notification_header">' +
                          '<img class="sgn_question_mark" src="' + SGNC.getIconBaseUrl() + '/question.64.png">' + 
                        '</div>' +
                        '<div class="sgn_flex">' + 
                          '<div class="sgn_notification_img_content">' + 
                            '<img class="sgn_notification_icon" src="https://static-gl-media-s.simplegmailnotes.com/media/notification-icon.png">' + 
                          '</div>' + 
                          '<div class="sgn_notification_content">' +
                            '<div>If you do like this extension, please <a href="' + subscribe_href + '">subscribe to SGN Support Package</a>, thank you!</div>' +
                            '<div class="sgn_flex" style="margin-top: 12px;">' +
                              '<input id="sgn_notification_subscribed_check" type=checkbox>' +
                              '<div class="sgn_notification_checkbox_label">I am a subscriber already.</div>' +
                            '</div>' +
                          '</div>' +
                        '</div>');
    var tip = $("<div class='sgn_notification_tip'>" + 
                  "<div class='sgn_notification_tip_title'>What's this?</div>" +
                  "<div class='sgn_notification_tip_content'><div>Your support is critical to us. " +
                    "This reminder will appear at most " + settings.NOTIFICATION_MAX_COUNT + " times every " + 
                      Math.round(settings.NOTIFICATION_DURATION/(24*60*60)) + " days. </div>" +
                    "<div>If you are a paid subscriber, please click the check box to disable the reminder. </div>" +
                    "<div>Thank you!</div>" +
                  "</div>" +
                "</div>");
    notificationNode.append(tip);
    SGNC.getSidebarNode(true);
    cleanupSideBar();
    $(".sgn_sidebar.sgn_notification").remove();
    addNodeToCRMSideBar(notificationNode, 'sgn_notification', 'prepend');
    resizeMentionContainer($("textarea.sgn_input"));
    if($('.sgn_sidebar.sgn_notification:visible').length){
      sendBackgroundMessage({action:"sgn_increment_notification_count"}); 
    }
    notificationNode.find("#sgn_notification_subscribed_check").on('click', function(){
      $(this).prop('checked', false);
      sendBackgroundMessage({action:"sgn_notification_subscribed_check"});    
    });
  }

  setupSidebarDimension($(".sgn_sidebar:visible"));
};

function rgb2hex(rgb) {
  if(!rgb)
    return '#000';

  rgb = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  function hex(x) {
      return ("0" + parseInt(x).toString(16)).slice(-2);
  }
  return "#" + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3]);
}

var getDomContactInfo = function(email) {
  var parentNode = SGNC.getMainNode();
  var contactElements =  parentNode.find('span.gD, span.hb span');

  var contacts = [];
  var fromAddress = "";
  var contactEmailList = [];
  contactElements.each(function() {
    var contactEmail = $(this).attr('email');
    if (!contactEmailList.includes(contactEmail) &&
        email !== contactEmail) {
      var name = $(this).attr('name');
      if(!name)
        name = '';

      if(!name.includes(' '))
        name += ' ';

      contacts.push({
        isUser: (email === contactEmail),
        name: name,
        firstName: name.split(' ')[0],
        lastName: name.split(' ')[1],
        email: contactEmail
      });

    }

    contactEmailList.push(contactEmail);

    if($(this).parents(".qu").length){
      fromAddress = $(this).parents(".qu").first().text(); //this one will be overwritten by others
      if (!SGNC.containsEmailTag(fromAddress)) {
        var fromAddressNode = $(this).parents(".qu").first().find("span").first();
        if (fromAddressNode.length) {
          var fromEmail = fromAddressNode.attr("email");
          var fromName = fromAddressNode.attr("name");

          fromAddress = fromName + "<" + fromEmail + ">";
        }
      }
    }

  });


  return [contacts, fromAddress];
};

var getCRMShareEmailData = function(email, messageId, hideEmailInfo) {
  //get note
  var emailNote = SGNC.getCurrentContent();
  var container = SGNC.getContainer();
  
  //do not upload the HTML
  emailNote = SGNC.stripHtml(emailNote);

  // limit the email note length
  if (emailNote) {
    emailNote = emailNote.substring(0, 2000);
  }

  //get the contacts
  var contacts = [];
  var fromAddress = "";

  if(!hideEmailInfo){ //do not send the contacts for the silent share (privacy concern)
      var result = getDomContactInfo(email);
      contacts = result[0];
      fromAddress = result[1];
  }

  //get the thread id
  var sgnLastMessageId = getCrmLastMessageId();
  var threadId = getCrmThreadId();
  // debugLog("@1159----", threadId, sgnLastMessageId);
  //get email related stuff
  var subject = "";
  var excerpt = "";
  var longExcerpt = "";
  var fontColor = "";
  var backgroundColor = "";

  if(!hideEmailInfo){ 
    subject = sgnGmailDom.getEmailSubject();

    //get the email excerpt, it would be available only if 
    var trNode = $("*[sgn_email_id='" + messageId + "']");
    if(trNode.length){
      excerpt = trNode.find("span.y2").text();
    }

    var contentNode = $(".ii.gt .a3s:visible");
    if(emailNote && contentNode.length){
      longExcerpt = contentNode.text();
      longExcerpt = longExcerpt.replaceAll('\n', ' ').replaceAll(/\s\s+/g, ' ')
      longExcerpt = longExcerpt.substring(0, 1000);
    }
  }

  // var editorNode = $(".sgn_container:visible textarea");
  //var backgroundColor = rgb2hex(editorNode.css("background-color"));
  backgroundColor = gCurrentBackgroundColor;
  fontColor = gCurrentFontColor;
  // fontColor = rgb2hex(editorNode.css("color"));

  var hideSuccuess = "";
  if(gPreferences["showCRMSuccessPage"] === "false")
    hideSuccuess = "1";

  var opportunityId = container.attr("data-sgn-opp-id");
  var noteTimestamp = container.attr("data-note-timestamp");
  var isConversation = sgnGmailDom.isConversationMode();
  //var autoSync = container.hasClass("sgn-auto-sync");
  var emailDate = sgnGmailDom.getEmailDate();

  //wrap up the data
  var data = {
    contacts: contacts.slice(0, 10),
    email: {
      id: messageId,
      sgn_email_date: emailDate,
      sgn_email_date_timezone_offset: new Date().getTimezoneOffset(),
      email_address: email,
      note: emailNote,
      subject: subject,
      thread_id: threadId,
      latest_message_id: sgnLastMessageId,
      excerpt: excerpt,
      long_excerpt: longExcerpt,
      font_color: fontColor,
      background_color: backgroundColor,
      opportunity_id: opportunityId,
      //auto_sync: autoSync,
      note_timestamp: noteTimestamp,
      gdrive_note_id: gCurrentGDriveNoteId,
      gdrive_folder_id: gCurrentGDriveFolderId,
      from_address: fromAddress,
      is_conversation: isConversation
    },
    hide_success_page: hideSuccuess
  };


  //debugLog("@633", data);
  return data;
};


var getCrmUser = function(email) {
  var crmUser = gCrmUserEmail;
  if (!crmUser)
    crmUser = gSgnUserEmail;

  if (!crmUser)
    crmUser = email;
  return crmUser;
};

var gSharePopupWindowTime;
var openCRMSharePopup = function(url){
  //sendBackgroundMessage({action: "request_permission", 
    //perm: SGNC.getCRMBaseUrl()});
  sendEventMessage(
    'SGN_PAGE_open_popup',
    { url: url,
      windowName: 'sgn-share-popup',
      strWindowFeatures: SGNC.getStrWindowFeatures(1000, 700)
    }
  );
  gSharePopupWindowTime = Date.now();
};

var gLastShareTimeStamp = null;
var shareToCRM = function(email, messageId, isSilentShare, hideEmailInfo,
  shiftKey, emailData){

  //never silently share crm user not login
  if (isSilentShare && !gCrmLoggedIn)
    return;

  if(!messageId || messageId === 'PREVIEW')
    return;

  var container = SGNC.getContainer();
  //do not do silent share if the share function is disabled
  if(isSilentShare && !(container.find(".sgn_share:visible")))
    return;

  if(gLastShareTimeStamp && Date.now() - gLastShareTimeStamp < 500){
    debugLog('@2067, two shares are too close');
    return;
  }
  gLastShareTimeStamp = Date.now();

  debugLog('@2066, share to crm', isSilentShare);

  if(gSyncFutureNotesEnabled || gGmailWatchEnabled){
    hideEmailInfo = false;  //if autosync, always collect
  }

  if(!emailData)
    emailData = getCRMShareEmailData(email, messageId, hideEmailInfo);

  if(isSilentShare)
    emailData['action'] = 'silent-share';
  else{
    emailData['action'] = 'click-share';
    emailData['show_prefs'] = '1';
  }

  
  debugLog("@1557", emailData);
  var url = getCRMShareUrl(
    getCrmUser(email), emailData, shiftKey);

  if(isSilentShare){
    sendCrmRequest(url, function(response){
        // debugLog("@389", response);
        SGNC.silentShareCallBack(response);
    });
  }
  else{
    gLastCRMShareURL = url;
    //it has to be done by page script
    openCRMSharePopup(url);
  }

};

var createTableLoading = function(){
  var modalLoadingUrl = SGNC.getIconBaseUrl() + '/modal-loading.gif';
  var modalLoadingImg = $('<img>', {
    src: modalLoadingUrl,
    alt: 'modal loading'
  });
  var modalLoading = $('<div></div>');
  modalLoading.addClass('sgn-modal-loading').append(modalLoadingImg);
  $('.sgn_show_table table').append(modalLoading);

};

var isSameContent = function(content1, content2){
  return getDisplayContent(content1) == getDisplayContent(content2);
};

var getLogoNode = function(className){
   var imageNode = $("<img title='Powered By Bart Solutions'/>").attr("src", 
                   SGNC.getBartLogoImageSrc("ed"));
   return $("<a target='_blank'/>").attr("class",  className
          ).attr('href', SGNC.getOfficalSiteUrl("ed")).append(imageNode);
};

var openCurrentOpportunity = function(email, opportunityId, source){
  if(!opportunityId)
    opportunityId = SGNC.getContainer().attr("data-sgn-opp-id");

  if (!opportunityId)
    return;

  var container = SGNC.getContainer();
  var errorNode = container.find(".sgn_error.sgn_custom:visible");
  if (errorNode && errorNode.text())
    return;

  var url = getCRMOpportunityDetailUrl(
    getCrmUser(email), opportunityId, source);

  sendEventMessage(
    'SGN_PAGE_open_popup',
    {
      url: url,
      windowName: 'sgn-opportunity-popup',
      strWindowFeatures: SGNC.getStrWindowFeatures(1000, 700)
    }
  );
};

gSgnPrintKey = "SGN_PRINT";
var setPrintInfo = function(email, note) {
  var properties = getPrintInfoProperties();
  var printObj = {
    'note': note,
    'properties': properties,
  };
  window.localStorage.setItem(gSgnPrintKey, JSON.stringify(printObj));
};

var getPrintInfo = function(email) {
  // debugLog("@418 email print", email);
  var printInfo = {};
  var printInfoStr = window.localStorage.getItem(gSgnPrintKey);
  if (printInfoStr) {
    printInfo = JSON.parse(printInfoStr);
  }

  return printInfo;
};

var isNeedInitMention = function() {
  return gCrmLoggedIn && gCrmTeamMemberInfo.length > 0;
};

var removePrintInfo = function(email) {
  window.localStorage.removeItem(gSgnPrintKey);
};

var getPrintInfoProperties = function() {
  var preferences = gPreferences;
  var showPrintingNote = (preferences["showPrintingNote"] !== "false");
  var printFontSize = preferences["printFontSize"];
  var properties = {"showPrintingNote": showPrintingNote,
                    "isRichTextEditor": isRichTextEditor()};
  if(printFontSize != "default"){
    properties['font-size'] = printFontSize;
  }

  return properties;
};

var isGmailPrintView = function() {
  if (window.location.href.indexOf("view=pt") > 0) {
    return true;
  }

  return false;
};

var setupAddNoteToolbar = function(email, messageId){
  var toolBarNode = $(".G-tF");
  exClass = 'sgn_add_notes_detail';
  if(sgnGmailDom.isPreviewPane()){
    exClass = 'sgn_add_notes_preview';
  }
  var addNotesImgNode = $("<div class='G-Ni J-J5-Ji " +
    exClass + " sgn_add_notes_container'><span class='asa' data-tooltip='Simple Gmail Notes'>" +
    "<img class='sgn_add_notes' src='" +
    SGNC.getIconBaseUrl() + "/add-note.png'></span></div>");
  addNotesImgNode.css('margin-left', '10px');
  addNotesImgNode.click(function() {
    var container = SGNC.getContainer();
    var content = SGNC.getCurrentContent();
    if(container.length) {
      if(container.is(".sgn_minimized")){
        container.removeClass('sgn_minimized');
        if(sgnGmailDom.isPreviewPane()){
          $('.S3').scrollTop(0);
        }else{
          $('.Tm').scrollTop(0);
        }
        if(isAutoFocousSgnInput(gPreferences)){
          autoFocousSgnInput();
        }
      }
      else if(!content){  // hide the editor
        container.addClass('sgn_minimized');
      }
    }
  });
  addNotesImgNode.hover(function() {
    $(this).addClass('T-I-JW');
  }, function() {
    $(this).removeClass("T-I-JW");
  });
    
  toolBarNode.append($(".sgn_opportunity_list_opener:visible").parent());
  toolBarNode.find('.sgn_add_notes_container').remove();
  toolBarNode.append(addNotesImgNode);
};

var setupNoteEditor = function(email, messageId, autohideTextArea){
  SGNC.appendLog("enterSetupNote");
  debugLog("Start to set up notes");
  debugLog("Email", email);

  if(autohideTextArea){
    if(
        !(gPreferences &&
          gPreferences["hideTextAreaForBlankNotes"] == 'true' &&
          gPreferences["isPaid"] == 'true'
      )
    ){
      autohideTextArea = false;
    }
  }

  var injectionNode = $("<div class='sgn_container'></div>");
  var subject = sgnGmailDom.getEmailSubject();
  var notePosition = "top";
  if(gPreferences){
    notePosition = gPreferences["notePosition"];
  }
  updateGmailNotePosition(injectionNode, notePosition);

  injectionNode.hide();

  //hide all others
  $(".sgn_container:visible").remove();
  injectionNode.show();

  if(autohideTextArea){
    setupAddNoteToolbar(email, messageId);
  }
  setupCalendarInfo(email, messageId, subject);
  
  //var injectionNode = SGNC.getContainer();
  //try to get the cached message
  var cachedMessage = getEmailIdNoteCache(messageId);
  debugLog("@2522", cachedMessage);

  var note = "";
  if(cachedMessage && cachedMessage.description && !SGNC.getNoteProperty(cachedMessage.properties, 'sgn-team-note'))
    note = cachedMessage.description;

  var hideTextArea = autohideTextArea && !note;
  if(hideTextArea){
    injectionNode.addClass('sgn_minimized');
  }

  //text area failed to create, may cause dead loop
  if(!$(".sgn_container:visible").length){
    SGNC.appendLog("Injection node failed to be found");
    return;
  }

  SGNC.appendLog("startSetupNote");

  
  var textAreaNode = $("<textarea></textarea>", {
    "class": "sgn_input",
    "text": note,
    "disabled":"disabled"
  }).on("blur paste", function(event){
    //var currentInput = $(".sgn_input:visible");
    //var emailSubject = gCurrentEmailSubject;
    //var noteId = gCurrentGDriveNoteId;
    //var folderId = gCurrentGDriveFolderId;

    var isDisabled = SGNC.getCurrentInput().prop('disabled');
    if(isRichTextEditor()){
      isDisabled = !isTinyMCEEditable();
    }

    var content = SGNC.getCurrentContent();
    setPrintInfo(gSgnUserEmail, content);

    //var content = currentInput.val();
    var templateAutoload = gPreferences["templateAutoload"];
    var templateContent = gPreferences["templateContent"];
    var isAutoload = templateContent !== "" && templateAutoload === 'true' && content === templateContent;
    if(!isDisabled && !isSameContent(gPreviousContent, SGNC.getCurrentContent()) && !isAutoload){
      deleteEmailIdNoteCache(messageId);//delete the previous note
      //set up the share properties
      var skipShare = false;

      showNotice("Saving note ...", "note_saving");
      postNote(email, messageId);

      if(gGmailWatchEnabled || gSyncFutureNotesEnabled){  
        // debugLog('@2325@start note');

        // debugLog('@1412');
        // email data must be collected before setTimeout
        var emailData = getCRMShareEmailData(email, messageId);
        debugLog("@2555", emailData);
        setTimeout(function(){
          shareToCRM(email, messageId, true, false, false, emailData);
        }, 100);
      }

    }

    return true;
  }).on("keyup", function(e){
    var fontSize = parseInt($(".sgn_input").css("font-size"));
    var lines = getNoteHeight();
    if(!isRichTextEditor() && isEnableFlexibleHeight()){
      $(this).css("height", (lines) * fontSize * 1.2 + 6 + "px");
    }
  }).on('stylechanged', function(e) {
    var styleName = arguments[1];
    var styleVal = arguments[2];
    var mentionContainer = $(this).parents("div.mentions-input");
    if (styleName && styleVal && mentionContainer.length > 0) {
      var divMentionHighlighterDom = mentionContainer.find("div.highlighter");
      divMentionHighlighterDom.css(styleName, styleVal);
    }
  });

  var backgroundColor = "";
  var fontColor = "";
  if(cachedMessage && cachedMessage.properties){
    backgroundColor = SGNC.getNoteProperty(cachedMessage.properties, 'sgn-background-color');
    fontColor = SGNC.getNoteProperty(cachedMessage.properties, 'sgn-font-color');
    if(fontColor){
      setInputFontColor(textAreaNode, fontColor);
    }
    if(backgroundColor){
      setInputBackgroundColor(textAreaNode, backgroundColor);
    }
  }

  var searchLogoutPromptHtml = "" + 
      "<a class='sgn_action sgn_current_connection'>SGN: " +
      "<span class='sgn_user'></span></a> " +
      "<a class='sgn_logout sgn_action sgn_button' >" + 
      "<img title='Log Out (" + gSgnUserEmail + ")' src='" + 
      SGNC.getIconBaseUrl() + "/logout.24.png'></a>" + 
      "<a class='sgn_open_options sgn_action sgn_button'>" +
      "<img title='Preferences' src='" + 
        SGNC.getIconBaseUrl() + "/preferences.24.png'></a>" +
      "<a class='sgn_action sgn_delete sgn_button' target='_blank'>" +
      "<img title='Delete' src='" + 
        SGNC.getIconBaseUrl() + "/delete.24.png'></a> " +
      "<a class='sgn_action sgn_add_calendar sgn_button' target='_blank'>" +
      "<img title='Add to Google Calendar' src='" + 
        SGNC.getIconBaseUrl() + "/calendar.24.png'></a> " +
      "<a class='sgn_action sgn_modal_list_notes sgn_button' target='_blank'>" +
      "<img title='Search' src='" + 
        SGNC.getIconBaseUrl() + "/search.24.png'></a> " +
      "<a class='sgn_action sgn_color_picker sgn_background_color sgn_button'>" +
      "<input type='hidden' class='sgn_color_picker_value' value='" + backgroundColor + "'>" +
      "<img title='Note Color' class='sgn_color_picker_button' src='" + 
      SGNC.getIconBaseUrl() + "/color-picker.24.png'></a> " +
      "<a class='sgn_action sgn_color_picker sgn_button'>";
      if(
        (gPreferences &&
          gPreferences["usefontColors"] == 'true' &&
          gPreferences["isPaid"] == 'true'
        )
      ){
        searchLogoutPromptHtml += "<input type='hidden' class='sgn_font_color_picker_value' value='" + fontColor + "'>" +
          "<img title='Font Color' class='sgn_color_picker_button' src='" + 
            SGNC.getIconBaseUrl() + "/text-color.24.png'></a> ";
      }
      searchLogoutPromptHtml += "<a class='sgn_action sgn_template sgn_button' style='margin-left: 10px;'>" +
        "<img title='Template' style='width:20.5px; height:23px;' src='" +
          SGNC.getIconBaseUrl() + "/template.png'></a> " +
        "<a class='sgn_share sgn_action sgn_button' >" +
        "<img class='sgn_share_img' title='Login CRM / Sync to mobile' src='" +
        SGNC.getIconBaseUrl() + "/share.24.png'></a>" +
        "<a class='sgn_open_opportunity sgn_action' >" +
        "<div class='sgn_opp_name'></div></a>" +
        "<div class='sgn_notice sgn_cutom'></div>" +
        "";

  var searchLogoutPrompt = $("<div class='sgn_prompt_logout'/></div>" )
    .html(searchLogoutPromptHtml)
    .hide();

  searchLogoutPrompt.prepend(getLogoNode("sgn_bart_logo_top"));

  if(gCrmUserEmail){
    searchLogoutPrompt.find(".sgn_share_img").attr("title", "Sync to CRM (" + gSgnUserEmail + ")");
  }

  var loginPrompt = $("<div class='sgn_prompt_login'/></div>" )
    .html("Please <a class='sgn_login sgn_action'>login</a> " +
            "your Google Drive to start using Simple Gmail Notes" + 
            " <a class='sgn_disable_account sgn_action'>Disable extension for this account</a>" )
    .hide();
  var emptyPrompt = $("<div class='sgn_padding'>&nbsp;<div>");
  var revokeErrorPrompt = $("<div class='sgn_error sgn_revoke'><div>")
                      .html("Error found with the existing token. " +
                          "Please try to <a class='sgn_reconnect sgn_action'>connect</a> again. \n" +
                          "If error persists, you may try to manually " +
                          "<a href='https://accounts.google.com/b/" + getCurrentGoogleAccountId() + 
                          "/IssuedAuthSubTokens'>revoke</a> previous tokens first.");
  var revokeCRMErrorPrompt = $("<div class='sgn_error sgn_revoke_crm'><div>")
                      .html("Error found with the CRM token. " +
                          "Please click the share button again to re-login Simple Mobile CRM. \n" +
                          "If error persists, you may try to manually " +
                          "<a href='https://accounts.google.com/b/" + getCurrentGoogleAccountId() + 
                          "/IssuedAuthSubTokens'>revoke</a> previous CRM tokens first.");


  var userErrorPrompt = $("<div class='sgn_error sgn_user'></div>")
                            .html("Failed to get Google Driver User");

  var loginErrorPrompt = $("<div class='sgn_error sgn_login'>Failed to login Google Drive: *error*<br/>" + 
                            "<span class='sgn_alternate_login'>" + 
                            "If the problem persists, please try the <a class='sgn_login_sgn_web sgn_action'>alternate login</a>.</span></div>");

  var customErrorPrompt = $("<div data-initial-value='*error*' class='sgn_error sgn_custom'>*error*</div>");

  var crmErrorPrompt = $("<div class='sgn_error sgn_crm'></div>");

  var sgnCrmPrompt = $("<div class='sgn_crm_prompt'></div>");

  var noteTimeStamp = $("<div class='sgn_note_timestamp sgn_is_hidden'>" + 
                        "<img alt='note timestamp' src='"+ SGNC.getIconBaseUrl()+"/note-timestamp.png' />"+
                        "<span class='sgn_note_timestamp_content'></span>"+
                        "</div>");

  if(isRichTextEditor()){
    sendEventMessage('SGN_tinyMCE_remove');
  }

  $(".sgn_input").remove();
  $(".sgn_note_timestamp").remove();
  $(".sgn_prompt_login").remove();
  $(".sgn_prompt_logout").remove();

  var textareaContainer = $("<div class='sgn_textarea_container'></div>");
  textareaContainer.append(textAreaNode);
  textareaContainer.append(noteTimeStamp);


  injectionNode.prepend(revokeErrorPrompt);
  injectionNode.prepend(revokeCRMErrorPrompt);
  injectionNode.prepend(userErrorPrompt);
  injectionNode.prepend(loginErrorPrompt);
  injectionNode.prepend(customErrorPrompt);
  injectionNode.prepend(crmErrorPrompt);
  injectionNode.prepend(sgnCrmPrompt);
  injectionNode.prepend(textareaContainer);
  injectionNode.prepend(loginPrompt);
  injectionNode.prepend(searchLogoutPrompt);
  injectionNode.prepend(emptyPrompt);
  injectionNode.append(getLogoNode('sgn_bart_logo_bottom'));
  initMentionIfNeeded(textAreaNode);
  $(".sgn_error").hide();

  injectionNode.find('.sgn_modal_list_notes').featherlight('text',{
    width: 800,
   	height: 600,
    beforeOpen: function(event){
      $('.featherlight').css('overflow', 'scroll');
      $('.featherlight-content').empty();
      setupSearchModal(email);
    },
    afterOpen: function(event){
      createTableLoading();
      gSearchContent = "";
      searchModalNotes(email);
    }
  });

  injectionNode.on("click", ".sgn_action", function(ev){
    var classList =$(this).attr('class').split(/\s+/);
    var preferences = gPreferences;
    $.each(classList, function(index, item){
      if(item != 'sgn_action'){  //for all other actions
        var action = item.substring(4);   //remove the 'sgn_' prefix
        var request = {action: action, messageId:messageId, 
                       gdriveNoteId:gCurrentGDriveNoteId};
        if(action == "delete"){
          if(!confirm("Are you sure you want to delete this note?"))
            return;
          gPreviousContent = gSgnEmpty;
          deleteMessage(messageId);
          request["need_update_timestamp"] = !gCrmLoggedIn;
        }

        if(action == "template"){
          var note = gPreferences['templateContent'];
          if(SGNC.getCurrentContent()){
            note = SGNC.getCurrentContent() + "\n" + gPreferences['templateContent'];
          }
          updateNoteContent(note);
          deleteEmailIdNoteCache(messageId);
          postNote(email, messageId);
        }

        if (action === "share" ) {
          shareToCRM(email, messageId, false, false, ev.shiftKey);
          return;
        }

        // debugLog('@222', preferences)
        if (action === 'login_sgn_web' ||
          ((SGNC.isSafari() || SGNC.isEdge() || preferences['usePopForLogin'] === 'true') && action === 'login')) {
          launchSGNWebLogin(email, messageId);
          return;
        }

        if (action === "open_opportunity") {
          openCurrentOpportunity(email);
        }

        if(action == "disable_account"){
          var confirmed = confirm("Are you sure to disable Simple Gmail Notes for '" + email + "'?" +
                      "\n(You could re-enable it later from the preferences page.)");

          if(!confirmed)
            return;

        }

        if (action == "modal_list_notes"){
          //do nothing
        }
        else {
          // debugLog('@1703', action);
          // by default, send all actions to background
          sendBackgroundMessage(request);
        }

        if (action == "disable_account"){ // confirmed and worked
          alert("Please refresh browser to make the changes effective.");
        }
      }
    });
  });


  injectionNode.find(".sgn_current_connection").attr("href", getSearchNoteURL());
  //$(".sgn_search").attr("href", getSearchNoteURL());
  
  /*$(".sgn_search").click(function(){
    sendBackgroundMessage({action: 'modal_list_notes', email: email, gdriveFolderId: gCurrentGDriveFolderId});
  });*/

  injectionNode.find(".sgn_add_calendar").attr("href", getAddCalendarURL(messageId));
  
  var colors = [                                    
    'D8EAFF', 'C7F6F5', 'FFFF99', 'ACFDC1', 
    'E1E1E1', 'FED0C4', 'DAD3FE', 'F1CDEF',
    'c6b3cc', 'c7d9c2', 'dedcab', 'afc0e6',     
    'eaa09a', 'e6b798', 'e5a9bb', 'b3ea82',
  ];

  var columns = 4;

  if(gPreferences && gPreferences["useAdvancedColors"] == 'true'){
    colors = [
      'F6F6FE', 'FFC3D5', 'FF9BEE', '9ED3FD',
      '808088', 'DE4A77', 'BD3DC9', '2EA4D8',
      '28282A', 'A02E49', '660099', '3057C2',
      '94F3FC', '80FFD1', 'A4B0FF', 'E2FF8A',
      '3AC6CD', '25D868', '5F78DA', 'B2CB20',
      '199AA3', '149767', '191D80', '8C9502',
      'FEE580', 'FFBA8E', 'FD8880', 'E9FB0C',
      'D7A826', 'CF6D19', 'DD381B', 'FB860C',
      'A17805', '8A4508', 'A70808', 'FF0D24',
      

      'D8EAFF', 'C7F6F5', 'FFFF99', 'ACFDC1', 
      'E1E1E1', 'FED0C4', 'DAD3FE', 'F1CDEF',
      'c6b3cc', 'c7d9c2', 'dedcab', 'afc0e6',     
      'eaa09a', 'e6b798', 'e5a9bb', 'b3ea82',
    ];
  }
  //set up color picker
  injectionNode.find(".sgn_color_picker_value").simpleColor({
                                      cellWidth: 16,
                                      cellHeight: 16,
                                      cellMargin: 3,
                                      columns:columns, 
                                      colors: colors,
                                      //colors: [
                                       // 'C8FBFE', 'CBFEF1', 'D6FFD1', 'E8FFC1', 'FAFDBB',
                                        //'FFEDC1', 'FFE0C7', 'FFD9D0', 'D7D6FE', 'F1CDFE'
                                       //],
                                      //colors : [
                                        //'34C8D0', '1ED6A8', '52C843', '87C31F', 'BEC42A',
                                        //'D39C16', 'D47325', 'D65234', '5C58E6', 'BD4CE7'
										//									],
                                 onSelect: function(hex, element){
                                   setBackgroundColorWithPicker('#' + hex); //set color of text area
                                   
                                   //immediate post the note again
                                   postNote(email, messageId);

                                   //notice background color update to CRM
                                   shareToCRM(email, messageId, true);
                                 } 
                              });

  injectionNode.find(".sgn_font_color_picker_value").simpleColor({
                                      cellWidth: 16,
                                      cellHeight: 16,
                                      cellMargin: 3,
                                      columns:columns, 
                                      colors: colors,
                                      //colors: [
                                       // 'C8FBFE', 'CBFEF1', 'D6FFD1', 'E8FFC1', 'FAFDBB',
                                        //'FFEDC1', 'FFE0C7', 'FFD9D0', 'D7D6FE', 'F1CDFE'
                                       //],
                                      //colors : [
                                        //'34C8D0', '1ED6A8', '52C843', '87C31F', 'BEC42A',
                                        //'D39C16', 'D47325', 'D65234', '5C58E6', 'BD4CE7'
										//									],
                                 onSelect: function(hex, element){
                                   setFontColorWithPicker('#' + hex); //set color of text area
                                   
                                   //immediate post the note again
                                   postNote(email, messageId);

                                   //notice background color update to CRM
                                   shareToCRM(email, messageId, true);
                                 } 
                              });

  injectionNode.find(".sgn_color_picker_button").click(function(e){
    if(e.target != this){
      return;
    }

    //$(this).parents(".sgn_color_picker").find(".simpleColorDisplay").click();
    e.stopPropagation();

    var picker = $(this).parents(".sgn_color_picker");
    var container = picker.find(".simpleColorContainer");
    var display = picker.find(".simpleColorDisplay");
    var colorChooser = picker.find(".simpleColorChooser");
    var input = picker.find(".sgn_color_picker_value");
    
    display.trigger('click', {input:input, display: display, container: container });
    container.find('.simpleColorChooser').css("margin-left", "-85px").css("z-index", 1);	//align back
  });

  //nothing to show now
  //sendBackgroundMessage({action:"update_debug_content_info", debugInfo: ""});

  //load initial message
  debugLog("Start to initailize");
  sendBackgroundMessage({action:"initialize",
                         messageId: messageId, title: gCurrentEmailSubject });
  updateUIByPreferences();
  setupCrmOppListOpener(gCrmUserEmail);
  // autoloadTemplateContent(note);
};


var setupCrmOppListOpener = function(email, extraClass) {
  debugLog("@32,@2889", email, gCrmUserEmail, gCrmUserToken);

  if (!email) {
    return;
  }

  if(!isCrmOptionEnabled()){
    return;
  }

  if (!extraClass) {
    extraClass = "loggedin";
  }

  // already exists
  if($(".sgn_opportunity_list_opener:visible").filter("." + extraClass).length){
    debugLog("@32@2914, already exists");
    return;
  }

  $(".sgn_opportunity_list_opener:visible").remove();

  debugLog("@32@2910, set up list opener", extraClass);
  // hook not found
  var hookNode = $(".bzn:not(.iH) .G-tF:visible");
  if(!hookNode.length){
    return;
  }
  
  var openerNode = 
    $('<div class="T-I J-J5-Ji mA nf T-I-ax7 L3" style="user-select: none;"><div class="sgn_opportunity_list_opener"><a title="Opportunity List">' +
    '<img src="' + SGNC.getCRMLogoImageSrc('ol', 'crm-logo.24.png') + '"/></a></div></div>');

  $(".sgn_opportunity_list_opener").parent().remove();
  openerNode.find(".sgn_opportunity_list_opener").addClass(extraClass);
  hookNode.append(openerNode);
  hookNode.append(hookNode.find(".sgn_add_notes_container:visible"));

  openerNode.find('.sgn_opportunity_list_opener').click(function() {
    var url = getCRMOpportunityListUrl(email, '', '', 'main');
    openCRMPage(url);
  });
};

var setupSearchInHomepage = function(email) {
  // already exists
  if($(".sgn_search_in_homepage:visible").length){
    return;
  }

  if(!gPreferences || gPreferences['searchInhome'] === 'false'){
    return;
  }

  // hook not found
  var hookNode = $(".bzn:not(.iH) .G-tF:visible");
  if(!hookNode.length){
    return;
  }

  var searchNode = 
    $('<div class="T-I J-J5-Ji mA nf T-I-ax7 L3" style="user-select: none;"><div class="sgn_search_in_homepage"><a title="Search in Simple Gmail Notes">' +
    '<img src="' + SGNC.getIconBaseUrl() + "/sgn-search-in-homepage.48.png" + '"/></a></div></div>');

  $(".sgn_search_in_homepage").parent().remove();
  hookNode.append(searchNode);
  hookNode.append(hookNode.find(".sgn_add_notes_container:visible"));

  searchNode.find('.sgn_search_in_homepage').featherlight('text',{
    width: 800,
   	height: 600,
    beforeOpen: function(event){
      $('.featherlight').css('overflow', 'scroll');
      $('.featherlight-content').empty();
      setupSearchModal(email);
    },
    afterOpen: function(event){
      createTableLoading();
      gSearchContent = "";
      searchModalNotes(email);
    }
  });
};

var openCRMInvitePage = function(email) {
  var inviationUrl = getCRMInvitationMemberUrl(email);
  sendEventMessage(
    'SGN_PAGE_open_popup',
    {
      url: inviationUrl,
      windowName: 'sgn-invitation-member',
      strWindowFeatures: SGNC.getStrWindowFeatures(1000, 700)
    }
  );
};

var openCRMUpgradePage = function() {
  var url = getCRMUpgradeUrl();
  openCRMPage(url);
};

var openCRMPage = function(url){
  //sendBackgroundMessage({action: "request_permission", 
    //perm: SGNC.getCRMBaseUrl()});
  sendEventMessage(
    'SGN_PAGE_open_popup',
    {
      url: url,
      windowName: 'sgn-opportunity-popup',
      strWindowFeatures: SGNC.getStrWindowFeatures(1000, 700)
    }
  );
};

var clearRecentNode = function(messageIds) {
  if (!messageIds) {
    return;
  }
  var messageId = '';
  for (var i = 0; i < messageIds.length; i++) {
    messageId = messageIds[i];
    if (gRecentNodeDict.get(messageId)) {
      gRecentNodeDict.delete(messageId);
    }
  }
};

var revokeSummaryNote = function(messageId){
  var emailId = messageId;

  //remove the note in cache, so the new notes would be collected next time
  var trNode = $("*[sgn_email_id='" + emailId + "']");
  
  if(trNode.is(".apv")){  //vertical split
    debugLog("deleting@vertical split",  emailId);
    trNode.next().next().find(".sgn").remove();
  }
  else{
    debugLog("deleting@normal mode", emailId);
    trNode.find(".sgn").remove();
  }

  deleteEmailIdNoteCache(messageId);

  debugLog("@447", emailId);
  debugLog("Requesting force reload");

  sendEventMessage("SGN_PAGE_force_reload");  //no effect to the page script now
};

var getEmailListCommentsNode = function(emailComments, emailNote) {
    if (!emailComments && !emailNote) {
        return;
    }

    var noteDisplay = SGNC.nl2br(SGNC.htmlEscape(emailNote.description));
    var emailCommentsNode = $("<div class='sgn_email_comments_container'><div class='sgn_email_comments_header'>Note & Comments</div></div>");
    var emailNoteNodeContainer = $("<div class='sgn_email_note'>" + noteDisplay + "</div>");

    var emailCommentListNodeContainer = $("<div class='sgn_email_comments'></div>");
    for (var i = 0; i < emailComments.length; i++) {
        var emailComment = emailComments[i];
        var commentFormatDay = new Date(parseInt(emailComment["created_datetime"]));
        commentFormatDay = moment(commentFormatDay).fromNow();
        var emailCommentNode = $("<div class='sgn_email_comment'></div>");
        var authorName = emailComment["author_name"];
        if (!authorName) {
          authorName = emailComment["author"];
        }
        var emailCommentTitleNode = $("<div class='sgn_email_comment_title'><span class='sgn_email_comment_author'>" + authorName+ "</span>" +
                                        "<span>" + commentFormatDay + "</span></div>");
        var url = getCRMOpportunityListUrl(gCrmUserEmail);
        var emailCommentContentNode = getMentionCommentNode(emailComment["content"], url, 'sgn_email_comment_content');
        emailCommentNode.append(emailCommentTitleNode);
        emailCommentNode.append(emailCommentContentNode);
        emailCommentListNodeContainer.append(emailCommentNode);
    }

    emailCommentsNode.append(emailNoteNodeContainer);

    emailCommentsNode.append(emailCommentListNodeContainer);

    return emailCommentsNode;
};

var getAbstractSummaryHook = function(mailNode) {
    var hook;
    var preferences = gPreferences;
    if (preferences["abstractStyle"] === "inbox_reminder") {
      hook = $(mailNode).find("div.xS");
    } else{   //both old and new gmail
      hook = $(mailNode).find(".xT .yi"); //new gmail

      if(!hook.length){ //vertical split view
        hook = $(mailNode).next().next().find(".apB .apu");
      }

      if(!hook.length){
        $(mailNode).find(".xT .y6").before("<div class='yi'>");
        hook = $(mailNode).find(".xT .yi"); //new gmail
      }
   }

   return hook;
};


var hasAbstractMarked = function(mailNode, timestamp){
  var sgnNode = mailNode.find(".sgn");
  if(sgnNode.length == 0)
    return false;

  var nodeTimestamp = sgnNode.attr("data-sgn-timestamp");
  if(timestamp && !nodeTimestamp)
    return false;

  if(timestamp && timestamp > nodeTimestamp)
    return false;

  return true;
};

var markAbstractCRMComments = function(mailNode, emailId, emailNote) {
  var emailCommentsNode;
  var hook = getAbstractSummaryHook(mailNode);
  var emailComments = gCrmPullHistoryCache[emailId];
  if (emailComments && emailComments.length && !hook.find(".sgn_email_comments_container").length) {
    emailCommentsNode = getEmailListCommentsNode(emailComments.slice(0, 20), emailNote);
    var sgnConainer = hook.find(".sgn");
    var commentIcon = $("<img class='sgn_comment_icon' src='"+ SGNC.getIconBaseUrl()+"/new-comment.png' />");
    sgnConainer.prepend(commentIcon);
    sgnConainer.prepend(emailCommentsNode);
  }

};


var markAbstract = function(mailNode, note, emailKey, timestamp){
  var abstractNode;

  var displayTitle = '';
  var displayDescription = '';
  var preferences = gPreferences;

  if(note && note.description && note.description != gSgnEmpty){
    displayTitle = SGNC.htmlEscape(note.description);
    var abstractNote = note.short_description;
    if (preferences["abstractStyle"] === "inbox_reminder")
      abstractNote = note.description;

    displayDescription = abstractNote;
    abstractNode = $('<div class="ar as bg sgn sgn_tooltip">' +
                        '<div class="at" title="' + displayTitle + 
                        '" style="background-color: #ddd; border-color: #ddd;display:inline-block">' + 
                        '<div class="au" style="border-color:#ddd"><div class="av" style="color: #666">' + 
                        displayDescription + '</div></div>' +
                   '</div></div>');

    debugLog("@3149", isCrmOptionEnabled(), note.properties);
    if(isCrmOptionEnabled() && SGNC.getNoteProperty(note.properties, "sgn-shared")){
      abstractNode.addClass("sgn_crm_shared");

      if(SGNC.getNoteProperty(note.properties, "sgn-team-note"))
        abstractNode.addClass("sgn_crm_shared_team_note");
        
    }
    
    var backgroundColor = gPreferences['abstractBackgroundColor'];
    var fontColor = gPreferences['abstractFontColor'];
    var fontSize = gPreferences['abstractFontSize'];

    var customNoteColor = SGNC.getNoteProperty(note.properties, 'sgn-background-color');
    var customFontColor = SGNC.getNoteProperty(note.properties, 'sgn-font-color');
    if(customNoteColor)
      backgroundColor = customNoteColor;
    if(customFontColor)
      fontColor = customFontColor;

    abstractNode.find(".at").css("background-color", backgroundColor)
                            .css("border-color", backgroundColor);
    abstractNode.find(".au").css("border-color", backgroundColor);
    abstractNode.find(".av").css("color", fontColor);
    if(fontSize != "default")
      abstractNode.find(".av").css("font-size", fontSize + "pt");
  }else{
    abstractNode = $('<div style="display:none" class="sgn"></div>');
  }

  if(timestamp)
    abstractNode.attr("data-sgn-timestamp", timestamp);


  abstractNode.hover(
    function() {
      var positionLeft = $(this).offset().left;
      var positionTop = $(this).offset().top;
      var commentContainer = $(this).find("div.sgn_email_comments_container");
      commentContainer.css({"position": "fixed"});
      commentContainer.css({"left": positionLeft, "top": positionTop + 20});
      commentContainer.show();
    },
    function() {
      var commentContainer = $(this).find("div.sgn_email_comments_container");
      commentContainer.hide();
    }
  );

  addAbstractNode(mailNode, abstractNode);

  mailNode.removeAttr("sgn_email_marking");
};

var updateNodeAbstractsByCache = function() {
    //loop for each email tr
  $("*[sgn_email_id]").each(function(){
    var emailId = $(this).attr("sgn_email_id");
    var emailNote = getEmailIdNoteCache(emailId);

    if(typeof emailNote === 'undefined')
      return;

    if(emailNote && emailNote.description && $(this).find(".sgn").css("display") == "none"){
      $(this).find(".sgn").remove();  //remove the element, so it would be filled later
      $(this).removeAttr("sgn_email_id");
    }

    var timestamp = "";

    if(emailNote && emailNote.properties){
      timestamp = SGNC.getNoteProperty(emailNote.properties, 'sgn-note-timestamp');
    }

    if(!timestamp.startsWith("20")) //invalid timestamp format
      timestamp = "";

    //debugLog("@1587", timestamp);
    if(!hasAbstractMarked($(this), timestamp)){
      //debugLog('marking', emailId, emailNote);
      markAbstract($(this), emailNote, emailId, timestamp);
    } else {
      //debugLog('escaped item because already marked', emailId);
    }

    if (isCrmSgnEnabled()) {
      markAbstractCRMComments($(this), emailId, emailNote);
    }

  });

};

var addAbstractNode = function(mailNode, abstractNode){
  var preferences = gPreferences;

  var hook = getAbstractSummaryHook(mailNode);

  //debugLog('marking - add abstract node', hook.length);

  if(hook.find('.sgn').length){
    hook.find('.sgn').remove();
  }

  if (preferences["abstractPosition"] === "before-labels" && preferences["abstractStyle"] !== "inbox_reminder") {
    hook.prepend(abstractNode);
  } else {
    hook.append(abstractNode);
  }

};

var needToShowCRMLoggedInButton = function(hasShared) {
  if(!isCrmOptionEnabled()) {
    return false;
  }

  if(gCrmLoggedIn){
    return false;
  }

  if(gCrmUserToken === settings.CRM_EXPIRED_TOKEN) {
    return true;
  }

  if(hasShared && gCrmUserToken !== settings.CRM_LOGGED_OUT_TOKEN){
    return true;
  }

  return false;
};

var updateNotesOnSummary = function(userEmail, pulledNoteList){

  if(pulledNoteList && pulledNoteList.length){
    debugLog("updated summary from pulled note, total count:", 
             pulledNoteList.length, pulledNoteList);

    var hasSharedNote = false;

    $.each(pulledNoteList, function(index, item){
      var currentItem = getEmailIdNoteCache(item.id, true);
      debugLog("@32,@1558", item.properties, item.short_description);

      // TODO, check sgn properties
      if(SGNC.getNoteProperty(item.properties, "sgn-shared")){
        hasSharedNote = true
      }

      if(currentItem && item){
        var currentTimestamp = SGNC.getNoteProperty(currentItem.properties, "sgn-note-timestamp");
        var newTimestamp = SGNC.getNoteProperty(item.properties, "sgn-note-timestamp");

        debugLog("@1558", currentItem, currentTimestamp, newTimestamp);


        //current note have a better timestamp
        if(currentTimestamp && newTimestamp && newTimestamp <= currentTimestamp)
          return;
      }

      updateEmailIdNoteDict(item.id, item.description, item.properties, item.short_description);
    });

    debugLog("@3268", hasSharedNote, gCrmUserToken, gSgnUserEmail);
    if(needToShowCRMLoggedInButton(hasSharedNote)){
      debugLog("@3268b", hasSharedNote, gCrmUserToken, gSgnUserEmail);
      setupCrmOppListOpener(gSgnUserEmail, "expired");
      $(".sgn_opportunity_list_opener img").attr("src",
        SGNC.getCRMLogoImageSrc('ol', 'crm-with-signin-list.48.png'));
    }

  }

  updateNodeAbstractsByCache();
  
  setupCrmOppListOpener(gCrmUserEmail);
};


var gPendingCrmPullList = [];
var gCrmPullHistoryCache = {};

var batchPullCRMNoteList = function(userEmail, requestList){
  if(!gCrmLoggedIn){
    if(gPendingCrmPullList.length < 500){  //CRM unlikely to be used in future
      gPendingCrmPullList = gPendingCrmPullList.concat(requestList);
    }
    requestList = [];
  }
  else{
    requestList = gPendingCrmPullList.concat(requestList);
    gPendingCrmPullList = [];
  }

  if(!userEmail || !requestList || requestList.length == 0)
    return;
    
  var finalRequestList = [];

  //make sure the request was not done before
  for(var i=0; i<requestList.length; i++){
    var emailId = requestList[i];
    if(!(emailId in gCrmPullHistoryCache)){
      finalRequestList.push(emailId);
      gCrmPullHistoryCache[emailId] = [];
    }
  }

  if(!finalRequestList.length)
    return;

  var url = getBatchPullNotesUrl(userEmail, finalRequestList);

  sendCrmRequest(url, function(data){
      SGNC.batchPullNotesCallBack(data);
  });
};

var pullNotes = function(userEmail, requestList){
  var pendingPullList = [];

  debugLog("@418, pulling notes");

  //batch pull logic here
  if(requestList.length){
    sendBackgroundMessage({action:'pull_notes',
                           pendingPullList:requestList});

    batchPullCRMNoteList(userEmail, requestList);
  }else{
    debugLog("no pending item, skipped the pull");
    updateNotesOnSummary(userEmail, []);
  }
};

var setupCalendarInfo = function(email, messageId, subject){
 // var email = e.detail.email;
 // var messageId = e.detail.messageId;

  if(!isAlphaNumeric(messageId)){
    debugLog("invalid message ID (setup email info): " + messageId);
    return;
  }

  if(!isValidEmail(email)){
    debugLog("invalid email (setup email info): " + email);
    return;
  }

  if(messageId == "PREVIEW"){
    return;
  }

    //for add to calendar use
  gCurrentEmailSubject = subject;
  gCurrentMessageId = messageId;
};

var makeSearchBold = function(matches, content){
  for(var j=0; j<matches.length; j++){
    var replaceString = "<strong>" + matches[j] + "</strong>";
    var reItem = new RegExp(matches[j], 'g');
    content = content.replace(reItem, replaceString);
  }
  return content;
};


var showDeleteMessage = function(type, email){
  $(".sgn-modal-input").prop('disabled', false);
  var message = "";
  if(type === "success"){
    message = "Notes deleted successfully";
    showDeleteNotice(message, type);
    $('.sgn_show_table table').empty();
    createTableLoading();  
    searchModalNotes(email);
  }else{
    message = "Failed to delete the notes";
    showDeleteNotice(message, type);
  }

};



var loadMoreSearchResultNotes = function(notes, email, nextPageToken){
  // debugLog(notes)
  $('.sgn-load-button-container').hide();
  var tbody = $("#sgn_table_tbody");
  for(var i=0; i<notes.length; i++){
    var modifiedDate = notes[i].modifiedDate;
    var modifiedTime = notes[i].modifiedTime;
    var emailUrl = getHistoryNoteURL(notes[i].messageId); 
    var properties = notes[i].properties;
    var modalNoteColor = SGNC.getNoteProperty(properties, 'sgn-background-color');
    var modalFontColor = SGNC.getNoteProperty(properties, 'sgn-font-color');

    var preferences = gPreferences;
    if(!modalNoteColor){
      modalNoteColor = preferences["backgroundColor"];  
    }

    var threadId = SGNC.getNoteProperty(properties, 'sgn-thread-id');
    var sgnLastMessageId = SGNC.getNoteProperty(properties, 'sgn-last-message-id');

    var title = notes[i].title;
    var subject = title;
    var description = SGNC.htmlEscape(notes[i].description);

    if(gSearchContent){
      var re = new RegExp(gSearchContent, 'gi');
      var descriptionMatches = description.match(re);
      var titleMatches = title.match(re);
      if(descriptionMatches){
        description = makeSearchBold(descriptionMatches, description); 
      }
        
      if(titleMatches){
        title = makeSearchBold(titleMatches, title);
      }

    }

    title = "<span>" + title + "</span><a href='" + emailUrl + "'>&#x1F517</a>";

    var spanTag = $('<span>').html(description)
                              .css('background-color', modalNoteColor)
                              .css('color', modalFontColor);
    var row = $('<tr></tr>');
    row.attr("noteId", notes[i].noteId);
    row.attr("emailId", notes[i].messageId);
    row.attr("lastEmailId", sgnLastMessageId);
    row.attr("threadId", threadId);
    row.attr("backgroundColor", modalNoteColor);
    row.attr("fontColor", modalFontColor);
    row.attr("subject", subject);
    row.attr("content", notes[i].content);
    row.attr("crmOppId", SGNC.getNoteProperty(properties, "sgn-opp-id"));
    row.attr("crmNoteTimeStamp", SGNC.getNoteProperty(properties, "sgn-note-timestamp"));
    var td2 = $('<td data-href="' + emailUrl + '"></td>').append(title);
    var td3 = $('<td></td>').append(spanTag);
    var td4 = $('<td></td>').text(modifiedTime);

    td2.find("span").click(function(){
      var url = $(this).parent().attr('data-href');
      window.location.href = url;
      $.featherlight.current().close();
    });

    td2.find("a").click(function(){
      var url = $(this).attr('href');
      window.open(url);
      return false;
    })

    var td1 = $('<td></td>').append("<input type='checkbox'>");
    row.append(td1)
        .append(td2)
        .append(td3)
        .append(td4);
    tbody.append(row);

  }
  if(nextPageToken){
    var loadMoreButton = $('<button>Load More</button>')
                          .addClass('sgn-modal-button')
                          .addClass('load-more-button');
    tbody.append($('<td></td>')
                  .addClass('sgn-load-button-container')
                  .append(loadMoreButton));
  }else{
    tbody.append($('<td></td>')
                  .addClass('sgn-end-blank'));
  }
  $('.load-more-button').off('click');
  $('.load-more-button').on('click', function(){
    var searchLoadingUrl = SGNC.getIconBaseUrl() + '/search-loading.gif';

    $(this).attr("disabled", true);
    $(this).hide();
    var searchLoadingGif = $('<image src="' + searchLoadingUrl + '" />').addClass('sgn-search-loading-image');
    $(this).parent().append(searchLoadingGif);
    searchModalNotes(email, nextPageToken);
  });
  $("#sgn-select-all").off('change');
  $("#sgn-select-all").on('change', function(e){
    var isSelectAll = $(this).prop("checked");
    $("#sgn_table_tbody > tr").each(function(){
      $(this).find('input[type="checkbox"]').prop("checked", isSelectAll);
    });
    switchThead(email);
  });

  $("#sgn_table_tbody > tr input[type='checkbox']").off('change');
  $("#sgn_table_tbody > tr input[type='checkbox']").on('change', function(e){
    var allCheckBoxCount = $("#sgn_table_tbody").find('input[type="checkbox"]').length;
    var selectedCount = $("#sgn_table_tbody").find('input[type="checkbox"]:checked').length;
    if(allCheckBoxCount > selectedCount){
      $("#sgn-select-all").prop("checked", false);
    }
    else if(selectedCount === allCheckBoxCount){
      $("#sgn-select-all").prop("checked", true);
    }
    switchThead(email);
  });
};

var showSearchResult = function(notes, email, nextPageToken){

  var table = $('.sgn_show_table table');
  table.empty();
  var thRow = $('<thead id="sgn_table_thead"><tr><th><input type="checkbox" id="sgn-select-all"></th><th>EMAIL SUBJECT</th><th>NOTE</th><th>LAST UPDATED</th></tr></thead>');
  var tbody = $('<tbody id="sgn_table_tbody"></tbody>');
  table.append(thRow).append(tbody);
  loadMoreSearchResultNotes(notes, email, nextPageToken);
  var final_height = $("#sgn-featherlight-content").innerHeight() - 
                        $(".sgn-header-menu").outerHeight() - 
                        $("#sgn_table_thead").outerHeight() - 14;
  tbody.css("height", final_height);

  var th3 = $('#sgn_table_thead tr th').eq(3);
  var scrolloOffset = $('#sgn_table_tbody').width() - $('#sgn_table_tbody tr').width();
  th3.css("width", (163 + scrolloOffset).toString() + 'px');
};


var getCRMShareEmailListData = function(email){
  var fontColor = gPreferences["fontColor"];
  var hideSuccuess = "";
  if(gPreferences["showCRMSuccessPage"] === "false")
    hideSuccuess = "1";

  var crmData = getSelectedNotesData();
  var dataList = [];

  for(var i=0; i<crmData.length; i++){
    var data = {
      contacts: "",
      email:{
        id: crmData[i].emailId,
        email_address: email,
        note: crmData[i].content,
        subject: crmData[i].subject,
        thread_id: crmData[i].threadId,
        excerpt: "",
        font_color: fontColor,
        background_color: crmData[i].backgroundColor,
        opportunity_id: crmData[i].crmOppId,
        note_timestamp: crmData[i].crmNoteTimeStamp,
        gdrive_note_id: crmData[i].noteId,
        latest_message_id: crmData[i].latest_message_id,
        gdrive_folder_id: gCurrentGDriveFolderId,
      },
      hide_success_page: hideSuccuess
    };
    dataList.push(data);
  }
  return dataList;

};

var filterEmailIds = function(notesData){
  var emailIds = [];
  for(var i=0; i<notesData.length; i++){
      if(notesData[i]["emailId"]){
        emailIds.push(notesData[i]["emailId"]);
      }
    }
  return emailIds;
};

var switchThead = function(email){
  var selectedCount = $("#sgn_table_tbody").find('input[type="checkbox"]:checked').length;
  if(selectedCount > 0){
    if($(".sgn-crm-modal-button").length){
      return;
    }
    $("#sgn_table_thead > tr > th").not(":first").remove();
    var iconTh = $("<th></th>");

    var sgnDeleteNotesImageUrl = SGNC.getIconBaseUrl() + "/delete.24.png";
    var sgnDeleteNotesImage = $('<img/>', {
      id: "sgn-delete-notes-button",
      src: sgnDeleteNotesImageUrl,
      alt: 'delete notes'
    });

    var sgnDeleteNotesImagePosition = $('<span id="sgn-delete-notes" class="sgn-delete-notes sgn-action"></span>')
                                      .prepend(sgnDeleteNotesImage);

    var sgnShareNotesImageUrl = SGNC.getIconBaseUrl() + "/share.24.png";
    var sgnShareNotesImage = $('<img/>', {
      src: sgnShareNotesImageUrl,
      alt: 'share notes'
    });

    var sgnShareNotesImagePosition = $('<span class="sgn-dropdown sgn-action" style="display:none">' +
                                           'Login CRM / Sync to mobile' +
                                           '<div class="sgn-sync-type">' +
                                               '<div class="sgn-crm-share-notes" data-sgn-sync-type="auto">' +
                                                   'Create / Update Multiple Opportunities' +
                                               '</div>' +
                                               '<hr>' +
                                               '<div class="sgn-crm-share-notes" data-sgn-sync-type="manually">' +
                                                   'Add to Single Opportunity' +
                                               '</div>' +
                                           '</div>' +
                                       '</span>').prepend(sgnShareNotesImage);

    //var sgnCrmManagement = $('<span></span>').text("Email Management:");
    var sgnCrmManagement = $('<span></span>').text("");
    var sgnCrmTh = $('<th id="sgn-crm-modal-button">Actions:</th>').append(sgnCrmManagement)
                    .append(sgnShareNotesImagePosition)
                    .append(sgnDeleteNotesImagePosition);
    $("#sgn_table_thead > tr").append(sgnCrmTh);

    $(".sgn-crm-share-notes").on('click', function(){
      var emailIds = [];
      var notesData = getSelectedNotesData();
      emailIds = filterEmailIds(notesData);
      if(emailIds.length === 0){
        alert("please select notes");
        return;
      }

      var syncType = $(this).attr("data-sgn-sync-type");
      var url = getCRMMultipleShareNotesUrl(
        getCrmUser(email), syncType);
      sendEventMessage("SGN_PAGE_open_popup",
                {url: url,
                windowName: 'sgn-share-notes-popup',
                strWindowFeatures: SGNC.getStrWindowFeatures(816, 766)
                });
    });

    $("#sgn-delete-notes").on('click', function(event){
      var notesData = getSelectedNotesData();
      var noteInfos = [];
      var emailIds = filterEmailIds(notesData);
      for(var i=0; i<notesData.length; i++){
        var noteInfo = {};

        if(notesData[i]["noteId"]){
          noteInfo["noteId"] = notesData[i]["noteId"];
          if(notesData[i]["sgn-opp-id"]){
            noteInfo["crmDeleteTag"] = true;
            //mark the deleted notes for crm
            var properties = [{"key" : gSgnCrmDeleted, "value" : true, "visibility": "PUBLIC"}];
            var currentTimeStamp = notesData[i]["sgn-note-timestamp"];
            if (currentTimeStamp && !gCrmLoggedIn) {
              var sgnNoteTimeStamp = SGNC.incrementTimeStamp(currentTimeStamp);
              properties.push({"key": "sgn-note-timestamp", "value": sgnNoteTimeStamp, "visibility": "PUBLIC"});
            }
            noteInfo["metadata"] = {properties:properties, description:gSgnEmpty};
          }
          noteInfos.push(noteInfo);
        }
      }
      //var searchContent = $(".sgn-modal-input").val();
      gSearchContent = $(".sgn-modal-input").val();
      if(notesData.length === 0){
        alert("please select notes");
        return;
      }
      $(".sgn-modal-input").prop('disabled', true);
      var deleteConfirmMessage = "Are you sure you want to delete " + notesData.length + " note(s)?";
      if(!confirm(deleteConfirmMessage))
        return;

      deleteNotes(noteInfos, emailIds, email);
      event.stopPropagation();
    });

  }else{
    //recover table;
    if($("#sgn_table_thead > tr:contains('TITLE')").length > 0){
      return;
    }
    $("#sgn_table_thead > tr > th").not(":first").remove();
    var thTitle = $("<th>TITLE</th>");
    var thNote = $("<th>NOTE</th>");
    var thDate = $("<th>LAST UPDATED</th>");
    $("#sgn_table_thead > tr").append(thTitle)
                        .append(thNote)
                        .append(thDate);
  }
};

var setupSearchModal = function(email){
  var closeButton = $('<button/>').addClass('sgn-modal-close featherlight-close')
                                  .attr('aria-label', 'Close')
                                  .text('x');
  var headerMenu = $('<div class="sgn-header-menu"></div>');
  var sgnModalTitle = $('<div></div>').text('Simple Gmail Notes').addClass('sgn-modal-title')
                              .append(closeButton);

  var sgnModalSubtitle = $('<div><img src="' + SGNC.getBartLogoImageSrc("s") + '"></div>').addClass('sgn-modal-subtitle');
  var sgnModalTitleContain = $('<div class="sgn-modal-title-contain"></div>').append(sgnModalTitle).append(sgnModalSubtitle);
  var sgnModalSearch = $('<div id="sgn-modal-search-div"></div>').addClass('sgn-modal-search');
  var sgnModalSearchDivContent = $('<div class="sgn-modal-search"></div>');
  var sgnModalInput = $('<input/>').addClass('sgn-modal-input')
                                    .attr({
                                      type: 'text',
                                      placeholder: 'Search'
                                    });
  var sgnGoogleDriveImageUrl = SGNC.getIconBaseUrl() + '/Google-Drive-icon.png';
  var sgnALinkToGDUrl = getSearchNoteURL();

  var sgnGoogleDriveImage = $('<img/>',{
    src: sgnGoogleDriveImageUrl,
    alt: 'google drive folder url'
  });
  var sgnAlink = $('<a></a>').append(sgnGoogleDriveImage).attr('href', sgnALinkToGDUrl);

  var sgnGoogleDriveImagePosition = $('<div></div>').addClass('sgn-googledrive-folder')
                                                    .prepend(sgnAlink);

  sgnModalSearchDivContent.append(sgnModalInput).append(sgnGoogleDriveImagePosition);
  sgnModalSearch.append(sgnModalSearchDivContent);
  headerMenu.append(sgnModalTitleContain).append(sgnModalSearch);

  var row = $('<tr><th></th><th>EMAIL SUBJECT</th><th>NOTE</th><th>LAST UPDATED</th></tr>');
  
  var table = $('<table></table>');
  table.append(row);
  var sgnShowTable = $('<div></div>').append($('<div></div>')
                                              .addClass('sgn_show_table')
                                              .append(table));
  $('.featherlight-content').append(headerMenu)
                            .append(sgnShowTable);
                                 
  $('div.featherlight-content').attr('id', 'sgn-featherlight-content');
  var searchMagnifierUrl = SGNC.getIconBaseUrl() + "/search.24.png";
  $('.sgn-modal-input').css({"background-image": "url("+ searchMagnifierUrl +")"});
  
  $(".sgn-modal-input").on('keyup', function(){
    gSearchContent = this.value;
    delayedSearchNotes(email);
  });
};

var showDeleteNotice = function(message, type){
  if($("#sgn-modal-search-div").length){
    $('<div class="sgn-show-delete-notice"></div>').insertAfter($("#sgn-modal-search-div"));
    if(type === "success"){
      $(".sgn-show-delete-notice").addClass("sgn-delete-success-notes");
    }else{
      $(".sgn-show-delete-notice").addClass("sgn-delete-fail-notes");
    }
    $(".sgn-show-delete-notice").text(message);

    setTimeout(function(){
      $(".sgn-show-delete-notice").remove();
    }, 2000);
  }
};

var deleteCrmNotes = function(email, noteList){
  //var emailIds = [];
  var correspondedIds = [];
  var lastedMessageId = "";
  for(var i=0; i<noteList.length; i++){
    var correspondedId = {};
    var properties = noteList[i]["properties"];
    for(var j=0; j<properties.length; j++){
      if(properties[j]["key"] === "sgn-opp-id"){
        // emailIds.push(noteList[i]["messageId"]);
        lastedMessageId = SGNC.getNoteProperty(properties, "sgn-last-message-id");
        correspondedIds.push({"message_id": noteList[i]["messageId"],
                              "latest_message_id": lastedMessageId});
        if (noteList[i]["messageId"] === gCurrentMessageId) {
          var timestamp = SGNC.getNoteProperty(properties, "sgn-note-timestamp");
          updateContainerTimeStamp(timestamp);
        }
        break;
      }
    } 
  }
  if(correspondedIds && correspondedIds.length > 0){
    var url = getCRMDeleteNotesUrl(
      getCrmUser(email), JSON.stringify(correspondedIds));

    sendCrmRequest(url, function(data){
        debugLog("delete successfully in crm");
        SGNC.deleteNoteCallBack(data);
    });

  }
};

var deleteNotes = function(noteInfos, emailIds, email){
  for(var i=0; i<emailIds.length; i++){
    if(gCurrentMessageId === emailIds[i]){
      // delete current email note
      deleteMessage(emailIds[i]);
    }else{
      deleteEmailIdNoteCache(emailIds[i]);
    }
  }
  gSuccessDeleted = false;
  sendBackgroundMessage({action:"delete_notes",
                         noteInfos: noteInfos,
                         gdriveFolderId: gCurrentGDriveFolderId});    
};

var getSelectedNotesData = function(){
  var crmData = [];
  $("#sgn_table_tbody > tr").each(function(){
    var checkResult;
    var idObject = {};
    checkResult = $(this).find('input[type="checkbox"]').is(":checked");
    if(checkResult){
      idObject["noteId"] = $(this).attr("noteId");
      idObject["threadId"] = $(this).attr("threadId");
      idObject["emailId"] = $(this).attr("emailId");
      idObject["latest_message_id"] = $(this).attr("lastEmailId");
      idObject["backgroundColor"] = $(this).attr("backgroundColor");
      idObject["subject"] = $(this).attr("subject");
      idObject["content"] = $(this).attr("content");
      idObject["sgn-opp-id"] = $(this).attr("crmOppId");
      idObject["sgn-note-timestamp"] = $(this).attr("crmNoteTimeStamp");
      crmData.push(idObject);
    }
  });

  return crmData;
};


var updateDeletedIcon = function(){
    $(".sgn_share").empty();
    $(".sgn_open_opportunity").remove();

    updateShareIcon("default", "Login CRM / Sync to mobile");
    
    $(".sgn_error.sgn_custom").empty();
};

var updateShareIconMeta = function(messageId, shareInfo){
  if(messageId != gCurrentMessageId)  //page flipped since request
    return;

  var isShared, autoSync, opportunityId, opportunityName, noteTimestamp;
   
  if(shareInfo instanceof Array){ //from SGN note
    isShared = SGNC.getNoteProperty(shareInfo, "sgn-shared");
    autoSync = SGNC.getNoteProperty(shareInfo, "sgn-auto-sync");
    opportunityId = SGNC.getNoteProperty(shareInfo, "sgn-opp-id");
    opportunityName = SGNC.getNoteProperty(shareInfo, "sgn-opp-name");
    opportunityUrl = SGNC.getNoteProperty(shareInfo, "sgn-opp-url");
    noteTimestamp = SGNC.getNoteProperty(shareInfo, "sgn-note-timestamp");
  }
  else {  //from CRM
    isShared = true;
    autoSync = shareInfo["sgn-auto-sync"];
    opportunityId = shareInfo["sgn-opp-id"];
    opportunityName = shareInfo["sgn-opp-name"];
    opportunityUrl = shareInfo["sgn-opp-url"];
    noteTimestamp = shareInfo["sgn-note-timestamp"];
  }

  if (isShared) {
    var container = $("div.sgn_container:visible");
      
    if(gCrmLoggedIn && !gSyncFutureNotesEnabled){ 
      updateShareIcon("shared", "Note Shared to Mobile");
    }

    
    container.attr("data-sgn-opp-id", opportunityId);
    container.attr("data-sgn-opp-name", opportunityName);
    container.attr("data-sgn-opp-url", opportunityUrl);
    updateContainerTimeStamp(noteTimestamp);
    //container.find(".sgn_opp_name").text(opportunityName);  //use sidebar to display now

    container.find(".sgn_open_opportunity")
      .attr("title", "Click to view more details: " + opportunityName)
      .css('display', 'flex');

    if(needToShowCRMLoggedInButton(true)){
      updateShareIcon("require_login");
    }
  }
  else {  // note is not shared
    if(needToShowCRMLoggedInButton(false)){
      updateShareIcon("require_login");
    }
  }

};

var delayTimer;

var delayedSearchNotes = function(email, nextPageToken){
  clearTimeout(delayTimer);
  delayTimer = setTimeout(function(){
    searchModalNotes(email, nextPageToken);
  }, 300);
};



var searchModalNotes = function(email, nextPageToken){
  sendBackgroundMessage({action:"search_notes",
                           searchContent: gSearchContent, nextPageToken: nextPageToken});
};

var hideError = function(errorNode){
  errorNode.hide();
  var initialErrorMsg = errorNode.attr("data-initial-value") || '';
  errorNode.text(initialErrorMsg);
};

var showError = function(errorNode, errorMessage){
  debugLog("Error in response:", errorMessage);
  var date = new Date();
  var timestamp = date.getHours() + ":" + date.getMinutes() + ":" + 
                    date.getSeconds();

  $(".sgn_error").hide();
  $(".sgn_error_timestamp").text("(" +  timestamp + ")");

  if(!errorNode || !errorNode.length)
    return;

  if(!errorMessage)
    errorMessage = "";

  var innerHTML = errorNode.html();
  var upgradeURL = getCRMUpgradeUrl();

  var finalErrorMessage = innerHTML;
  finalErrorMessage = finalErrorMessage.replace("*error*", errorMessage);
  finalErrorMessage = finalErrorMessage.replace("*upgrade*", "<a href='" + upgradeURL + "'>upgrade</a>");

  errorNode.html("<div>" + finalErrorMessage + "</div>");
  
  errorNode.show();
};

var showOfflineNotice = function(){
  if($(".sgn_inactive_warning") && $(".sgn_inactive_warning:visible").length > 0){
    return;
  }

  setupOfflineNotice();
  disableEdit();
};

var showNoteModifiedTime = function(modifiedTime){

  var preferences = gPreferences;
  if(!preferences)  //ui not ready
    return;

  var showNoteTimeStamp = (preferences["showNoteTimeStamp"] !== "false");

  if(showNoteTimeStamp && SGNC.getNoteTimeStampDom().length > 0 &&
          SGNC.getNoteTimeStampDom().hasClass("sgn_is_hidden")){
    SGNC.getNoteTimeStampDom().removeClass("sgn_is_hidden");
  }

  var displayTime = modifiedTime.substring(5, 16);
  SGNC.getNoteTimeStampDom().find(".sgn_note_timestamp_content")
                              .text(displayTime);
};

var showNotice = function(message, type, duration){
  var preferences = gPreferences;
  if(preferences['showSavingStatus'] === 'false' && type =='note_saving')
    return;

  $(".sgn_notice").hide();

  var noticeDiv = SGNC.getContainer().find(".sgn_notice");
  noticeDiv.show().text(message);
  if(duration){
    setTimeout(function(){
      noticeDiv.text("");
      noticeDiv.hide();
    }, duration);
  }
};

var closeWindow = function() {
    sendEventMessage("SGN_PAGE_close_window");
};

var sendCrmRequest = function(url, callback){
  debugLog("@4093, sending ajax request", url);
    $.ajax({
      url: url,
      dataType: "json",
      timout: 3000,
      success: function(data){
        debugLog("@4093b, ajax call success");
        callback(data);
      },
      error: function(data){
        debugLog("error: " + url + " => " + String(data));
      }
    });
};


var logoutCRM = function(newToken){
    sendBackgroundMessage({action:"update_crm_user_info", 
                           crm_user_email: "",
                           crm_user_token: newToken});
    $(".sgn_opportunity_list_opener").remove();
    gCrmUserEmail = "";
    gCrmUserToken = "";
    gCrmLoggedIn = false;

    updateShareIcon("default");
    hideCRMSidebarNode();

    destoryMetionInput($('.sgn_input'));

    //SGNC.getContainer().find("a.sgn_share img").removeClass("sgn_shared").attr("title", "").attr("src", 
     //   SGNC.getIconBaseUrl() + "/share.24.png");
};

var updateShareIcon = function(sharedStatus, title){
  if(!title)
    title = "";

  if(sharedStatus == "default"){
    icon = "share.24.png";
  }
  else if(sharedStatus == "shared"){
    icon = "shared.24.png";
  }
  else if(sharedStatus == "auto"){
    icon = "share-auto.24.png";
  }
  else if(sharedStatus == "require_login"){
    icon = "crm-with-signin-detail.48.png";
  }

  var img = SGNC.getContainer().find("a.sgn_share img");
  img.removeClass("sgn_shared").attr("src", SGNC.getIconBaseUrl() + "/" + icon);

  if(sharedStatus == "shared")
    img.addClass("sgn_shared");
};


var pullCRMStatus = function(email){
    if (isCrmSgnEnabled() && gCrmUserToken) {
      gCrmLoggedInChecked = true;
      // sendBackgroundMessage({action: "request_permission", 
        // perm: SGNC.getCRMBaseUrl()});
      sendCrmRequest(
          getCheckCRMLoggedInUrl(gSgnUserEmail),
          function(response) {
            SGNC.checkCRMLoggedInCallBack(response);
          }
      );
    }
    else {
      // sendEventMessage('SGN_mark_crm_checked');
    }
};

var initMentionIfNeeded = function(node) {

  if (!gCrmLoggedIn || gCrmTeamMemberInfo.length <= 0 || isRichTextEditor() || isMentionInput(node)) {
    return;
  }

  if (SGNC.isFirefox()) {
    node.css("display", "inline-block");
  }

  $(node).attr("placeholder", "type '@' to mention your team members and send out notification emails");
  initMention(node, gCrmTeamMemberInfo);
};

var getCRMBaseParam = function(){
  var params = "crm_user_email=" + gSgnUserEmail;
  
  params += "&dg="; 
  
  if(gSgnUserEmail !== sgnGmailDom.userEmail()){
    params += "1";
  }

  return params;
}

var getCRMDeleteNotesUrl = function(userEmail, data){
  var url = SGNC.getCRMBaseUrl() + '/crm/delete_note/?' + getCRMBaseParam() +
                '&token=' + gCrmUserToken +
                '&data=' + encodeURIComponent(data) + "&format=json";

  return url;
};

var getCRMLoginURL = function(userEmail, idToken){
  var url = SGNC.getCRMBaseUrl() + 
            '/crm/sgncrx_login/?crm_user_email=' + gSgnUserEmail + 
            '&id_token=' + idToken;

  return url;
};

var getCRMLogoutURL = function(userEmail) {
  var url = SGNC.getCRMBaseUrl() + '/crm/google_logout/' + gSgnUserEmail + '/?is_crx=1';

  return url;
};

var getCRMMultipleShareNotesUrl = function(userEmail, syncType){
  var url = SGNC.getCRMBaseUrl() +
            '/crm/multiple_share_email/?' + getCRMBaseParam() +
            '&token=' + gCrmUserToken +
            '&sync_type=' + syncType;
  return url;
};

var getCRMCommentUrl = function(userEmail, data){
  var url = SGNC.getCRMBaseUrl() + '/crm/create_sgn_new_comment/?' + getCRMBaseParam() +
            "&is_sgn=True&token=" + gCrmUserToken +
            '&data=' + encodeURIComponent(JSON.stringify(data));
  return url;
};

var getCRMEmailDetailUrl = function(userEmail, opportunityId) {
  var url = SGNC.getCRMBaseUrl() + "/crm/sgn_email_detail_info/?" + getCRMBaseParam() +
            "&token=" + gCrmUserToken +
            "&opportunity_id=" + opportunityId + "&thread_id=" + getCrmThreadId() + 
            "&email_id=" + getCrmLastMessageId() +
            "&current_message_id=" + gCurrentMessageId;

  return url;
};


var getCRMShareUrl = function(userEmail, data, shiftKey){
  var url = SGNC.getCRMBaseUrl() + '/crm/share_email/?' + getCRMBaseParam() +
              '&source=sha';

  if(shiftKey)
    url += '&sk=1';
          
  url += '&token=' + gCrmUserToken;

  // put the data at bottom
  url += '&zdata=' + LZString.compressToBase64(JSON.stringify(data));

  url += '&e=1'; //end character notation;
              
  return url;
};


var getCRMUpgradeUrl = function() {
  var url = SGNC.getCRMBaseUrl() + '/crm/member_upgrade/?' + getCRMBaseParam();

  return url;
};

var getCRMPullUrl = function(userEmail, messageId, noteTimestamp, 
                                          sgnLastMessageId, sgnThreadId, 
                                          isConversation){

  var url = SGNC.getCRMBaseUrl() + '/crm/pull_note/?' + getCRMBaseParam() + 
               '&token=' + gCrmUserToken + '&message_id=' + messageId + 
               '&note_timestamp=' + noteTimestamp;

  if(sgnLastMessageId){
    url = url + "&latest_message_id=" + sgnLastMessageId;
  }

  if(sgnThreadId){
    url = url + "&thread_id=" + sgnThreadId;
  }

  if(isConversation){
     url = url + '&is_conversation=1';
  }


  return url;
};

var getCRMOpportunityDetailUrl = function(userEmail, opportunityId, source){
  var url = SGNC.getCRMBaseUrl() + '/crm/opportunity_detail/' +
    opportunityId + '/?' + getCRMBaseParam() + '&token=' + gCrmUserToken;
  if (source) {
    url = url + "&source=" + source;
  }
  return url;
};

var getCRMInvitationMemberUrl = function(userEmail) {
  var url = SGNC.getCRMBaseUrl() + 
    '/crm/crm_member_invitation/?' + getCRMBaseParam() + '&token=' + gCrmUserToken;
  return url;
};

var getCRMLoginUrl = function(source) {
  var url = SGNC.getCRMBaseUrl() +
    '/crm/crm_login/';
  if (source) {
    url = url + "?source=" + source;
  }
  return url;
};

var getEmailDetailUrl = function(userEmail, threadId, teamMemberEmail) {

  //headerTitleContent = 'Related Notes';
  var emailDetailUrl = SGNC.getCRMBaseUrl() + "/crm/note_detail/?" + getCRMBaseParam() + "&id=" + threadId;

  if(teamMemberEmail && teamMemberEmail !== gSgnUserEmail){
    emailDetailUrl += "&selected_user_email=" + teamMemberEmail;
  }

  var oppInfoNode = SGNC.getSidebarNode().find('.sgn_sidebar.sgn_crm_opportunity');
  var opportunityId = oppInfoNode.attr("data-opportunity-id");
  if(opportunityId)
    emailDetailUrl += '&opp_id=' + opportunityId;

  return emailDetailUrl;
};

var getCRMOpportunityListUrl = function(userEmail, selectedUserEmail, keyword, source){
  var url = SGNC.getCRMBaseUrl() +
    '/crm/opportunity_list/?' + getCRMBaseParam() + '&token=' + gCrmUserToken + '&page=1';

  if(selectedUserEmail)
    url = url + "&selected_user_email=" + selectedUserEmail;

  if(keyword)
    url = url + "&search_string=" + keyword;

  if(source)
    url = url + "&source=" + source;

  return url;
};

var getCRMMentionedListUrl = function(userEmail){
  return SGNC.getCRMBaseUrl() + '/crm/mentioned_item_list/?' + getCRMBaseParam() + '&page=1';
};

var getCheckCRMLoggedInUrl = function(userEmail) {
  return SGNC.getCRMBaseUrl() +
         '/crm/ajax_check_crm_logged_in/?' + getCRMBaseParam() +
         '&token=' + gCrmUserToken + '&action=check_crm_logged_in';
};

var getBatchPullNotesUrl = function(userEmail, requestList) {

  var url = SGNC.getCRMBaseUrl() + 
              "/crm/batch_pull_notes/?" + getCRMBaseParam() +
              "&token=" + gCrmUserToken +
              "&request_list=" + encodeURIComponent(requestList.join(','));

  if(sgnGmailDom.isConversationMode()){
     url = url + '&is_conversation=1';
  }

  return url;
};

//for more information digging, check this:
//https://developers.google.com/gmail/api/v1/reference/users/messages/get
var getCRMUpdateMailInfoURL = function(userEmail, messageId, emailData){
  var url = SGNC.getCRMBaseUrl() + 
              "/crm/update_email_info/?" + getCRMBaseParam() +
              "&token=" + gCrmUserToken + 
              "&message_id=" + messageId + "&thread_id=" + emailData["threadId"];

  return url;
};

var updateContainerTimeStamp = function(timestamp) {
  var container = SGNC.getContainer();
  if (container.length <= 0) {
    return;
  }
  container.attr("data-note-timestamp", timestamp);
};

var setgCrmTeamMemberInfo = function(crmTeamMembers) {
  gCrmTeamMemberInfo.length = 0;
  if (!crmTeamMembers || (Array.isArray(crmTeamMembers) && crmTeamMembers.length === 0)) {
    return;
  }
  crmTeamMembers.forEach(function(item){
    gCrmTeamMemberInfo.push({
      "value": "@" + item["name"],
      "image": item['image'],
      "uid": item['email'],
    });
  });
};

var updateCommentsTotal = function() {
  var records = $("div.sgn_comment_record");
  $("div.sgn_comment_tips").text("Comments");
  if (records.length > 0) {
    $("div.sgn_comment_tips").text(records.length.toString() + " Comments");
  }
};

var reloadSideBar = function() {
  var opportunityId = SGNC.getContainer().attr("data-sgn-opp-id");
  if(!opportunityId)
    opportunityId = SGNC.getContainer().attr("data-sgn-opp-info-id");

  if(opportunityId){
    $(".sgn_crm_user_recent_notes:visible").remove();
    $(".sgn_crm_contacts:visible").remove();
    getCRMRecentNotes(gCrmUserEmail, opportunityId);
  }
};

var updateCommentsNodeByUpdateInfo = function(updateInfo, recent_node) {
  // debugLog("@4161--", updateInfo)
  var commentNode = $('.sgn_sidebar.sgn_crm_comments:visible');
  var unshareNode = commentNode.find('.sgn_crm_sidebar_header_unshare');
  var shareNode = commentNode.find('.sgn_crm_sidebar_header_share');
  if(recent_node){
    commentNode = recent_node.find('.sgn_crm_user_recent_note_header:visible');
    unshareNode = commentNode.find('.sgn_crm_user_recent_note_unshare_icon');
    shareNode = commentNode.find('.sgn_crm_user_recent_note_share_icon');
  }
  if(updateInfo['show_unshare_button']){
    unshareNode.show();
    shareNode.hide();
  }
  else{
    // if (updateInfo['user'] && updateInfo['user']['team_users'] && updateInfo['user']['team_users'].length)
    unshareNode.hide();
    shareNode.show();
  }

  if(updateInfo['show_create_todo_button'])
    commentNode.find(".sgn_crm_create_todo").show();
};

var showCommentAutoShareAlert = function(comment, userInfo) {
  comment = Object.assign(comment, userInfo);
  var commentOwnerEmail = comment['owner_email'];
  var commentNoteId = comment['thread_id'] || comment['note'];
  var commentNoteContainer = $("div.sgn_crm_user_recent_note_item[data-note-owner='"+commentOwnerEmail+"'][data-note-id='"+commentNoteId+"']");
  var newCommentNode = $('.sgn_sidebar.sgn_crm_comments:visible');
  var shareIcon;
  if(commentNoteContainer.length){
    shareIcon = commentNoteContainer.find('.sgn_crm_user_recent_note_share_icon');
  }
  else{
    shareIcon = newCommentNode.find('.sgn_crm_sidebar_header_share');
  }
  
  autoShareAlertKey = "SGN_AUTO_SHARE_" + comment['author_email'];
  var notAlert = window.localStorage.getItem(autoShareAlertKey);
  var is_note_visible = comment['is_note_visible'];
  if(comment && comment['show_auto_share_alert'] && shareIcon.is(":visible") && !notAlert && !is_note_visible){
    $.featherlight('text', {
      width: 800,
      height: 600,
      beforeOpen: function(event){
        if($.featherlight.current()){
          $.featherlight.current().close();
        }
        $('.featherlight').css("background-color", "rgba(0, 0, 0, 0.3)");
        $('.featherlight-content').empty();
        $(".featherlight-content").css("padding", 0)
                                  .css("border-bottom", 'none')
                                  .css("border", 'solid 1px #cccccc')
                                  .css('border-radius', '10px');
        buildAutoShareModal(comment['author_email']);
      },
      afterOpen: function(event){
      }
    });
  }
};

var showNoteAutoShareAlert = function(data, email){
  var updateInfo = data['update_info'];
  var newCommentNode = $('.sgn_sidebar.sgn_crm_comments:visible');
  var shareIcon = newCommentNode.find('.sgn_crm_sidebar_header_unshare');
  var prevShared = shareIcon.is(":visible");
  updateCommentsNodeByUpdateInfo(updateInfo);
  var nowShared = shareIcon.is(":visible");

  autoShareAlertKey = "SGN_AUTO_SHARE_" + email;
  var notAlert = window.localStorage.getItem(autoShareAlertKey);
  var is_note_visible = updateInfo['is_note_visible'];
  if(!notAlert && !is_note_visible && data['add_mentioned_list']){
    $.featherlight('text', {
      width: 800,
      height: 600,
      beforeOpen: function(event){
        if($.featherlight.current()){
          $.featherlight.current().close();
        }
        $('.featherlight').css("background-color", "rgba(0, 0, 0, 0.3)");
        $('.featherlight-content').empty();
        $(".featherlight-content").css("padding", 0)
                                  .css("border-bottom", 'none')
                                  .css("border", 'solid 1px #cccccc')
                                  .css('border-radius', '10px');
        buildAutoShareModal(email);
      },
      afterOpen: function(event){
      }
    });
  }
};

var updateSgnCrmPrompt = function(email, messageId, sgnCrmPrompt){
  var preferences = gPreferences;
  if(preferences['showCRMPrompt'] !== "false"){
    if(sgnCrmPrompt){
      if(sgnCrmPrompt.includes("QUERY_BASE")){
        sgnCrmPrompt = sgnCrmPrompt.replaceAll('QUERY_BASE', getCRMBaseParam());
      }

      $(".sgn_container .sgn_crm_prompt").html(sgnCrmPrompt);

      $(".sgn_container .sgn_crm_prompt").find("[data-href]").each(function(){
        $(this).attr("href", "#");
        $(this).click(function(){
          var href = $(this).attr("data-href");
          if(href == "SGN_SHARE"){
            shareToCRM(email, messageId);
          }
          else {
            openCRMPage(href);
          }

          return false;
        });
      });
    }
    else {
      $(".sgn_container .sgn_crm_prompt").empty();
    }
  }
};

var updateSGNContentByUpdateInfo= function(updateInfo){
  var messageId = updateInfo["message_id"];
  var content = updateInfo['sgn-content'];

  if(messageId == gCurrentMessageId && updateInfo["note_content_updated"]){

    setInputValue(SGNC.getCurrentInput(), getDisplayContent(content));
    if(isRichTextEditor()){
      sendEventMessage('SGN_tinyMCE_update_note', {content: content});
    }
    autoloadTemplateContent();

    debugLog("@43@4733");
  }

  if(messageId == gCurrentMessageId && updateInfo["sgn-shared"]){
    updateShareIconMeta(messageId, updateInfo);
    setBackgroundColorWithPicker(updateInfo["sgn-background-color"]);
    setFontColorWithPicker(updateInfo["sgn-font-color"]);
    debugLog("@43@4738a");
  }

};


var setupListeners = function(){


  /* Event listener for page */


  SGNC.addEventListenerToDocument('SGN_setup_note_editor', function(e) {
    SGNC.appendLog("eventSetupNote");
    var email = e.detail.email;
    var messageId = e.detail.messageId;
    var message = e.detail.message;
    var debugMessage = "";

    if(!isAlphaNumeric(messageId)){
      debugMessage = "invalid message ID (setup note editor): " + messageId;
      debugLog(debugMessage);
      SGNC.appendLog(debugMessage);
      return;
    }

    if(!isValidEmail(email)){
      debugMessage = "invalid email (setup note editor): " + email;
      debugLog(debugMessage);
      SGNC.appendLog(debugMessage);
      return;
    }

    SGNC.executeCatchingError(function(){
      setupNoteEditor(email, messageId, true);
    });

    sendDebugLog();
    /*
    if(SGNC.getLog()){
      SGNC.appendLog(SGNC.getLog());
    }*/
    
  });

  SGNC.addEventListenerToDocument('SGN_check_crm_logged_in', function(e){
    if(!gCrmLoggedInChecked) {
      pullCRMStatus(gSgnUserEmail);
    }
  });

  SGNC.addEventListenerToDocument("SGN_show_crm_login_sidebar", function(e) {
    setupCRMLoginSidebarNode(true);
  });

  SGNC.addEventListenerToDocument('SGN_crm_logged_in_failed', function(e) {
    if(gCrmUserEmail){
      logoutCRM(settings.CRM_EXPIRED_TOKEN);
    }
    setupCRMLoginSidebarNode(false);
  });

  SGNC.addEventListenerToDocument('SGN_crm_logged_in_success', function(e){
    gCrmLoggedIn = true;
    removeCRMLoginSidebarNode();
    setupCrmOppListOpener(e.detail.email);


    gGmailWatchEnabled = e.detail.auto_sync_enabled;
    gSyncFutureNotesEnabled = e.detail.sync_future_notes_enabled;

    if(gCrmLoggedIn && gSyncFutureNotesEnabled)
      updateShareIcon("auto");

    var currentMessageId = sgnGmailDom.getCurrentMessageId();
    //simply pull note, don't send the email info (better privacy)
    shareToCRM(e.detail.email, currentMessageId, true, true);

    batchPullCRMNoteList(gSgnUserEmail, []);
    initMentionIfNeeded($(".sgn_input"));
  });

  SGNC.addEventListenerToDocument('SGN_show_offline_notice', function(e){
    showOfflineNotice();
  });

  SGNC.addEventListenerToDocument('SGN_save_content', function(e){
    $('.sgn_input').trigger('blur');
  });


  SGNC.addEventListenerToDocument('SGN_heart_beat_request', function(e){
    //if background script died, exception raise from here
    if(!isRuntimeAlive()) {
      sendEventMessage('SGN_PAGE_heart_beat_response', 
        {email:e.detail.email, isBackgroundDead: true});
      showOfflineNotice();
    }
    else {
      sendBackgroundMessage({action:"heart_beat_request",
        preferences: gPreferences, preferenceVersion: gPreferenceVersion});

      sendDebugLog();
    }
  });



  SGNC.addEventListenerToDocument('SGN_pull_notes', function(e) {
    debugLog("Requested to pull notes");
    var email = e.detail.email;
    var requestList = e.detail.requestList;

    if(!isValidEmail(email)){
      debugLog("invalid email (pull notes): " + email);
      return;
    }

    $.each(requestList, function(_index, _emailId){
      if(!isAlphaNumeric(_emailId)){
        debugLog("invalid message ID (pull notes): " + _emailId);
        return;
      }
    });
    pullNotes(gSgnUserEmail, requestList);
    setupSearchInHomepage(email);
  });

  SGNC.addEventListenerToDocument('SGN_batch_pull_notes', function(e) {
    var emailList = e.detail['email_list'];
    //debugLog("@2432: " + emailList);
    //package result for updateSummary
    debugLog('@4156', emailList);
    var pulledNoteList = [];
    for(var i=0; i < emailList.length; i++){
      var email = emailList[i];
      var email_id = "";
      
      if(sgnGmailDom.isConversationMode())
        email_id = email["thread_id"];
      else
        email_id = email["email_id"];

      if(!email_id && (email["team_thread_id"] || email["team_email_id"])){
        if(sgnGmailDom.isConversationMode())
          email_id = email["team_thread_id"];
        else
          email_id = email["team_email_id"];
      }

      var description = SGNC.getMentionText(email["note"]);
      var emailComments = email["email_comments"];
      var timestamp = email["timestamp"];
      var backgroundColor = email["background_color"];
      var fontColor = email["font_color"];
      var short_description = SGNC.getSummaryLabel(description, 
                                gPreferences);
      var properties = [{"key": "sgn-font-color", "value": fontColor},
                        {"key": "sgn-note-timestamp", "value": timestamp},
                        {"key": "sgn-shared", "value": "1"}];

      if(email["team_thread_id"] || email["team_email_id"]){
        properties.push({"key": "sgn-team-note", "value": "1"})
      }

      pulledNoteList.push({"id": email_id,  
                             "description": description,
                             "short_description": short_description,
                             "timestamp": timestamp, 
                             "properties": properties});
      gCrmPullHistoryCache[email_id] = emailComments;
    }

    updateNotesOnSummary(e.detail.email, pulledNoteList);
  });

  SGNC.addEventListenerToDocument('SGN_update_debug_page_info', function(e) {
    //debugLog("Got page debug info");
    var debugInfo = e.detail.debugInfo;
    sendBackgroundMessage({action: "update_debug_page_info", debugInfo: debugInfo});
  });

  SGNC.addEventListenerToDocument('SGN_send_preference', function(e) {
    var preferenceType = e.detail.preferenceType;
    var preferenceValue = e.detail.preferenceValue;
    sendBackgroundMessage({action: "send_preference",
	preferenceType: preferenceType, preferenceValue: preferenceValue});
  });

  SGNC.addEventListenerToDocument('SGN_reset_preferences', function(e){
    sendBackgroundMessage({action: "reset_preferences"});
  });

  SGNC.addEventListenerToDocument('SGN_delete', function(e){
    var email = e.detail.email;
    var messageId = e.detail.messageId;
    deleteMessage(messageId);
    sendBackgroundMessage({action: 'delete', messageId: messageId,
        gdriveNoteId:gCurrentGDriveNoteId});
  });

  SGNC.addEventListenerToDocument('SGN_set_classic_gmail_conversation', function(e){
    gClassicGmailConversation = true; //this is a one-way road
    //debugLog("@1284, clasic gmail conversation", gClassicGmailConversation);
  });

  SGNC.addEventListenerToDocument('SGN_delete_notes', function(e){
    var data = e.detail;
    var editorNode = SGNC.getContainer();
    var errorNode = editorNode.find(".sgn_error.sgn_custom");

    var message = data['message'];

    if(message)
      showError(errorNode, message);
    else
      hideError(errorNode);

    if(data["status"] == 'failed'){
      //:todo need to show error
    }else{
      var noteUpdateArray = data["email_info_list"];
      var messageId = "";
      var email = data["email"];
      for(var i=0; i<noteUpdateArray.length; i++){
        messageId = noteUpdateArray[i]["message_id"];
        if(messageId == gCurrentMessageId){
          clearInputValue(SGNC.getCurrentInput());
          var sgnNoteTimeStamp = noteUpdateArray[i]["sgn-note-timestamp"];
          updateContainerTimeStamp(sgnNoteTimeStamp);
          if(isRichTextEditor()){
            sendEventMessage('SGN_tinyMCE_update_note', {content: ""});
          }
          autoloadTemplateContent();
        }
      }
    }
  });

  SGNC.addEventListenerToDocument('SGN_comment_note', function(e) {
    var data = e.detail;
    updateCommentUI(false);
    // debugLog("@3012---- data", data);
    var commentErrorNode = $(".sgn_comment_container .sgn_comment_error");
    var message = data['message'];

    if(message)
      showError(commentErrorNode, message);
    else
      hideError(commentErrorNode);
    if(data['status'] == 'failed') {
      debugLog("@32,@4645");
      if (data['error_type'] === 'token_expired') {
        var errorNode = $(".sgn_error.sgn_custom");
        if (message)
          showError(errorNode, message);
        logoutCRM(settings.CRM_EXPIRED_TOKEN);
        setupCRMLoginSidebarNode(false);
      }
    }else{
      commentErrorNode.hide();
      commentErrorNode.text("");
      var comment = data["comment"];
      var userInfo = data["user_info"];
      comment = Object.assign(comment, userInfo);
      showCommentAutoShareAlert(comment, userInfo);
      appendCrmNoteComment(comment, userInfo);
    }
  });

  SGNC.addEventListenerToDocument('SGN_silent_share', function(e){
    var data = e.detail;
    var editorNode = SGNC.getContainer();
    // var errorNode = editorNode.find(".sgn_error.sgn_custom");

    var errorNode = $(".sgn_error.sgn_custom");
    var message = data['message'];
    var preferences = gPreferences;
    if(message)
      showError(errorNode, message);
    else
      hideError(errorNode);


    setgCrmTeamMemberInfo(data['team_members']);
    initMentionIfNeeded($(".sgn_input"));
    var crmUserToken = data['token'];
    debugLog("@4908a", crmUserToken);
    if (crmUserToken) {
      var crmUserEmail = data['email'];
      gCrmUserEmail = crmUserEmail;
      gCrmUserToken = crmUserToken;


      sendBackgroundMessage({action:"update_crm_user_info", 
                             crm_user_email: crmUserEmail,
                             crm_user_token: crmUserToken});
    }

    if(data['status'] == 'failed'){
      editorNode.find("a.sgn_share img").attr("title", "Auto-Sync Failed").attr("src", 
        SGNC.getIconBaseUrl() + "/share-outdated.24.png");
      if (data['error_type'] === 'token_expired') {
        logoutCRM(settings.CRM_EXPIRED_TOKEN);
        setupCRMLoginSidebarNode(false);
      }
    }
    else{
      var email = gSgnUserEmail;
      if(data['update_info']){  //need to push the latest note into gdrive
        var updateInfo = data['update_info'];
        debugLog('@4307', updateInfo);

        updateSgnCrmPrompt(email, updateInfo['message_id'], updateInfo['sgn_crm_prompt']);

        //it's possible email page changed during the network response
        if(updateInfo['sgn-shared']){
          debugLog("@43@4720");
          var messageId = updateInfo["message_id"];
          updateSGNContentByUpdateInfo(updateInfo);

          postNote(email, messageId, updateInfo);
          debugLog("@43@4738b");
          if (updateInfo['increased_mentioned_number'] && updateInfo['increased_mentioned_number'] > 0 && 
          $('.sgn_crm_sidebar_section_header .sgn_crm_sidebar_header_share:visible').length){
            var shareUrl = $('.sgn_crm_sidebar_section_header .sgn_crm_sidebar_header_share:visible').attr('data-crm-share-email-url');
            openCRMPage(shareUrl);
          }
        }
        
        if(updateInfo['opportunity_info'] && updateInfo['message_id'] === gCurrentMessageId){
          //debugLog('@2753', noteComments);
          if(!SGNC.getSidebarNode().find('.sgn_crm_sidebar_section_header').width()){
            setupCRMSidebarNode(email, updateInfo, 
              data['note_comments'], data);
            if (data['note_comments']) {
              var comments = data['note_comments'].slice(0, 20);
              gCrmPullHistoryCache[gCurrentMessageId] = comments.reverse();
            }
          }
          else{
            showNoteAutoShareAlert(data, email);
            // updateCommentsNodeByUpdateInfo(updateInfo);
            // reloadSideBar(updateInfo['opportunity_info']['id']);
          }
        }
      }
    }
  });

  SGNC.addEventListenerToDocument('SGN_crm_email_detail', function(e){
    var data = e.detail;
    var email = data['email'];
    var currentMessageId = data['current_message_id'];
    // prevent that the user switches email detail page fastly
    if (currentMessageId !== gCurrentMessageId) {
      return;
    }
    var userNotes = data['notes'] || [];
    var teamNotes = data['team_notes'] || [];
    var crmUserInfo = data['user'];
    var noteComments = data["note_comments"] || [];

    crmUserInfo['team_users'] = data['team_users'] || [];

    var upgradeMessage = data['upgrade_warning_message'];

    var  viewMoreUrl = getEmailDetailUrl(email, currentMessageId);

    



    if(upgradeMessage){
      var errorMessageNode = $("<div class='sgn_crm_upgrade_message_container sgn_flex_center_column'>" +
                                 "<div class='sgn_crm_upgrade_message_description'>" + upgradeMessage + "</div>" +
                                 "<div class='sgn_upgrade_button sgn_flex_center_row'>Upgrade</div>" +
                               "</div>");

      errorMessageNode.find('.sgn_upgrade_button').click(function(){
        openCRMUpgradePage();
      });
      addNodeToCRMSideBar(errorMessageNode, "sgn_crm_upgrade_message");
    }

    if (userNotes.length) {
      buildCRMRecentNotesDom(userNotes, email, false, crmUserInfo);
    }


    buildSgnCommentsNode(email, noteComments, data);


    /*
    if(noteComments.length){
      buildSgnCommentsNode(email, noteComments, data);
    }
    */




    // always build team notes node
    if(!data['hide_team_section'])
      buildCRMRecentNotesDom(teamNotes, email, true, crmUserInfo, data['mentioned_only'] || false);

    if (data['show_upgrade_prompt']) { 
      var memberUpgradeNode = $("<div>" + 
                                 "<div class='sgn_crm_upgrade_prompt_header'>" + 
                                    "<div class='sgn_crm_sidebar_section_title'>Member Upgrade</div>" +
                                 "</div>" + 
                                 "<div class='sgn_crm_upgrade_prompt_content'>" + 
                                   "<div class='sgn_crm_upgrade_prompt_description sgn_flex_center_row'>" + 
                                     "<div>" + 
                                       "<div class='sgn_crm_upgrade_prompt_message'><strong>Unlimited</strong> note relations</div>" +
                                       "<div class='sgn_crm_upgrade_prompt_message'><strong>Share notes</strong> and <strong>comments</strong> with team</div>" +
                                       "<div class='sgn_crm_upgrade_prompt_more'>More <img/></div>" +
                                       "<div class='sgn_crm_user_upgrade_button sgn_flex_center_row'>Upgrade</div>" +
                                     "</div>" + 
                                     "<div class='sgn_crm_upgrade_banner'><img/></div>" + 
                                   "</div>" +
                                 "</div>" + 
                               "</div>");

      memberUpgradeNode.find('.sgn_crm_upgrade_banner img').attr("src",
        SGNC.getCRMLogoImageSrc("sb", "sidebar_crm_upgrade_ad.png"));

      memberUpgradeNode.find('.sgn_crm_upgrade_prompt_more img').attr("src", 
        SGNC.getIconBaseUrl() + "/arrow-right.png");

      memberUpgradeNode.find('.sgn_crm_upgrade_prompt_more').click(function(){
        openCRMUpgradePage();
      });

      memberUpgradeNode.find('.sgn_crm_user_upgrade_button').click(function(){
        openCRMUpgradePage();
      });

      addNodeToCRMSideBar(memberUpgradeNode, "sgn_crm_upgrade_prompt");
    }

  });
  /* -- end -- */

  /* handle events from background script */
  setupBackgroundEventsListener(function(request){
    //debugLog("Handle request", request);
    var preferences = {};
    var displayContent, properties, warningMessage, customNoteColor;
    var backgroundColor, showCRMButton;

    // debugLog("@action", request.action);
    switch(request.action){
      case "approve_setup":
        _setupPage();
        break;
      case "show_search_result":
        // debugLog("@4561---", request.nextPageToken)
        if(request.firstSearch)
          showSearchResult(request.notes, request.email, request.nextPageToken);
        else
          loadMoreSearchResultNotes(request.notes, request.email, request.nextPageToken);
        break;
      case "show_success_delete_message":
        if(!gSuccessDeleted){
          showDeleteMessage("success", request.email);
        }
        gSuccessDeleted = true;
        break;
      case "show_error_delete_message":
        //alert("failed to delete notes");
        showDeleteMessage("error");
        break;
      case "disable_edit":
        disableEdit();
        break;
      case "enable_edit":
        $(".sgn_add_notes_container:visible").addClass('sgn_logged_in');
        var currentDomMessageId = sgnGmailDom.getCurrentMessageId();
        if (currentDomMessageId){
          gCurrentMessageId = currentDomMessageId;
        }
        enableEdit();
        preferences = gPreferences;
        updateUIByPreferences(); 
        if(isRichTextEditor()){
          var richTextNoteHeight = parseInt($(".sgn_input").css("height"));
          var tinymceProperties = {
            baseUrl: getTinymceUrl(), 
            fontSize: getFontSize(preferences),
            fontColor: preferences["fontColor"],
            //backgroundColor: backgroundColor,
            height: richTextNoteHeight,
            cssUrl: SGNC.getCssBaseUrl() + '/style.css'
          };
          debugLog("@5080, init tinymce");
          sendEventMessage('SGN_tinyMCE_init', tinymceProperties);
          /*
          if(!window.tinymce)
            SimpleGmailNotes.loadTinymceScript(tinymceProperties);
          else{
            if(tinymce.activeEditor){  //only init once
              return;
            }
            SimpleGmailNotes.tinymceInit(tinymceProperties);
          }
          */
        }

        backgroundColor = preferences["backgroundColor"];
        fontColor = preferences["fontColor"];
        if(request.messageId && request.messageId == gCurrentMessageId){
          gPreviousContent = request.content;
          //displayContent = request.content;
          var content = SGNC.getCurrentContent();
          properties = request.properties;

          setPrintInfo(gSgnUserEmail, content);
          //warningMessage = SGNC.offlineMessage;
          customNoteColor = SGNC.getNoteProperty(properties, 'sgn-background-color');
          customFontColor = SGNC.getNoteProperty(properties, 'sgn-font-color');
          
          if(customNoteColor){
            backgroundColor = customNoteColor;
            setBackgroundColorWithPicker(customNoteColor);
          }
          if(customFontColor){
            fontColor = customFontColor;
            setFontColorWithPicker(customFontColor);
          }
        }

        if(isEnableNoDisturbMode() && !request.content){
          backgroundColor = "";
        }
          
        setInputBackgroundColor(SGNC.getCurrentInput(), backgroundColor);
        if(isRichTextEditor()){
          sendEventMessage('SGN_tinyMCE_set_backgroundColor', {backgroundColor: backgroundColor});
          sendEventMessage('SGN_tinyMCE_set_fontColor', {fontColor: fontColor});
        }
        gCurrentBackgroundColor = backgroundColor;
        gCurrentFontColor = fontColor;
        showLogoutPrompt(request.gdriveEmail);

        if(gCrmLoggedIn && gSyncFutureNotesEnabled)
          updateShareIcon('auto');


        debugLog("@4908", gCrmUserEmail);

        if (request.messageId && request.messageId == gCurrentMessageId) {
          updateShareIconMeta(request.messageId, properties);
          if (gCrmLoggedIn) {
            var currentMessageId = sgnGmailDom.getCurrentMessageId();
            //simply pull note, don't send the email info (better privacy)
            shareToCRM(request.gdriveEmail, currentMessageId, true, true);

          }
        }
        autoloadTemplateContent();
        if(isAutoFocousSgnInput(preferences)){
          autoFocousSgnInput()
        }

        break;
      case "delete_crm_notes":
        var notes = request.noteList;
        var email = request.email;
        deleteCrmNotes(email, notes);
        break;
      case "show_log_out_prompt":
        showLogoutPrompt();
        break;
      case "show_log_in_prompt":
        debugLog("Show login");
        showLoginPrompt();
        disableEdit();
        hideHistorySidebarNode();
        $('.sgn_search_in_homepage').remove();
        break;
      case "show_error":
        var errorNode = $(".sgn_error.sgn_" + request.type);
        showError(errorNode, request.message);
        break;
      case "show_timestamp_and_notice":
        if(request.messageId && request.messageId == gCurrentMessageId){
          showNotice("", "note_saving", 2000);
          showNoteModifiedTime(request.modifiedTime);
        }
        break;
      case "update_user":
        $(".sgn_user").text(request.email);
        $("div.sgn").remove();  //clean up all those outdated div
        break;
      case "crm_user_logged_in":
        var idToken = request.idToken;
        //send ID tokent backend to set up session
        var loginUrl = getCRMLoginURL(getCrmUser(request.email), idToken);
        sendCrmRequest(loginUrl, function(response){
            SGNC.crmLoggedInCallBack(response);
            // debugLog("@389", response);
        });
        break;
      case "logout_crm":
        var logoutUrl = getCRMLogoutURL(getCrmUser(request.email));
        sendCrmRequest(logoutUrl, function(response){
            SGNC.crmLoggedOutCallBack(response);
            // debugLog("@389", response);
        });
        logoutCRM(true);
        break;
      case "update_content":
        updateUIByPreferences();
        if(request.messageId == gCurrentMessageId){
          displayContent = getDisplayContent(request.content);
          if(displayContent && $('.sgn_container.sgn_minimized:visible').length){
            setupNoteEditor(gSgnUserEmail, gCurrentMessageId);
          }
          //properties = request.properties;
          warningMessage = SGNC.offlineMessage;
          //customNoteColor = SGNC.getNoteProperty(properties, 'sgn-background-color');
          //updateShareIconMeta(properties);

          gPreviousContent = request.content;

          setPrintInfo(gSgnUserEmail, displayContent);
          setInputValue(SGNC.getCurrentInput(), displayContent);
          showNoteModifiedTime(request.modifiedTime);
          if(isRichTextEditor()){
            sendEventMessage('SGN_tinyMCE_update_note', {content: displayContent});
          }

          updateEmailIdNoteDict(request.messageId, request.description, properties);
          // autoloadTemplateContent(gPreviousContent);
        }

        break;

      case "update_history":
        preferences = request.preferences;
        //work for both new and old gmail
        if(request.title == gCurrentEmailSubject){
          var history = request.data;


          if(!history.length)
            break;

          //alert(JSON.stringify(request.data));
          $(".sgn_history").remove(); //hide all previous history
          cleanupSideBar();
          //var historyInjectionNode = $(".nH.adC:visible");
          var historyInjectionNode = SGNC.getSidebarNode();
          var historyNode = $("<div class='sgn_history sgn_sidebar'>" +
            "<div class='sgn_sidebar_container'>" +
              "<div class='sgn_sidebar_title'>SGN History</div>" +
              "<div class='sgn_history_detail'></div>" +
            "</div></div>");
          historyInjectionNode.append(historyNode);
          /*
          */

          var detailNode = historyNode.find(".sgn_history_detail");


          for(var i=0; i<history.length; i++){
            var note = history[i];
            var customColor = SGNC.getNoteProperty(note.properties, 'sgn-background-color');
            var noteDate = new Date(note.createdDate);
            var description = note.description;

            backgroundColor = preferences["backgroundColor"];
            if(customColor){
              backgroundColor = customColor;
            }
            var crmUrl = "";
            if (gCrmUserEmail) {
              crmUrl = getCRMOpportunityListUrl(gCrmUserEmail);
            }
            description = SGNC.getMentionText(description, crmUrl);
            if(description.length == 500){   //postNote function sub 500 string in background script
              description = description + '...';
            }

            var node = $("<div class='sgn_history_note'>" +
                           "<div class='sgn_history_timestamp'><a target='_blank' href='" + 
                              getHistoryNoteURL(note.id) + "'>"  + 
                              noteDate.toString().substring(0, 24) + "</a></div>" + 
                           "<div class='sgn_history_content'>" + description + "</div>" +
                        "</div>");

            node.find('.sgn_history_content').css(
              "background-color", backgroundColor).css(
              "color", preferences["fontColor"]);
            detailNode.append(node);
            

            //historyNode.find(".sgn_history_note").css("background-color", backgroundColor)
            //                                     .css("color", preferences["fontColor"]);

            if(i >= 20) //show a max of 20 note history
              break;
          }

          //this feature is disabled for now
          var fullHistoryNode = historyNode.clone();
          fullHistoryNode.find('.sgn_history_header').remove();

          historyInjectionNode.append(fullHistoryNode);
          fullHistoryNode.popup();

          historyNode.find('.sgn_show_all').click(function(event){
              fullHistoryNode.popup('show');
          });

        }

        updateUIByPreferences();
        break;
      case "update_gdrive_note_info":
        debugLog("Update google drive note info", 
                      request.gdriveFolderId, request.gdriveFolderId);
        gCurrentGDriveFolderId = request.gdriveFolderId;
        gCurrentGDriveNoteId = request.gdriveNoteId;

        //the search note URL depends on gCurrentGDriveFolderId
        $(".sgn_current_connection").attr("href", getSearchNoteURL());
        //$(".sgn_search").attr("href", getSearchNoteURL());
        break;
      case "update_summary":
        debugLog("update summary from background call", request.email, request.noteList);
        var updateNoteList = request.noteList;
        updateNotesOnSummary(request.email, updateNoteList);
        updateUIByPreferences();
        gSummaryPulled = true;
        break;
      case "revoke_summary_note":
        revokeSummaryNote(request.messageId);
        var clearNodeMessageIds = request.clearNodeMessageIds;
        if (clearNodeMessageIds) {
          clearRecentNode(clearNodeMessageIds);
        }
        if(request.description && request.properties) {
          updateEmailIdNoteDict(request.messageId, request.description, request.properties);
          updateNodeAbstractsByCache();
        }
        autoloadTemplateContent();
        debugLog("Trying to revoke summary note", request);
        if(request.messageId == gCurrentMessageId){
          //better not to risk the folder ID change here
          //gCurrentGDriveFolderId = request.gdriveFolderId;
          gCurrentGDriveNoteId = request.gdriveNoteId;
        }

        break;

      //case "update_preferences":    //not to be used
       // sendEventMessage('SGN_PAGE_update_preferences', preferences);  
        //gAbstractBackgroundColor = preferences["abstractBackgroundColor"];
        //gAbstractFontColor = preferences["abstractFontColor"];
        //gAbstractFontSize = preferences["abstractFontSize"];
        //break;

      case "heart_beat_response":

        gLastHeartBeat = Date.now();

        // debugLog("@4908c", request.crmUserEmail, request.crmUserToken)
        /*
        if(gCrmUserEmail && request.crm_user_email && gCrmUserEmail != request.crm_user_email){
          var editorNode = SGNC.getContainer();
          var errorNode = editorNode.find(".sgn_error.sgn_custom");
          showError(errorNode, 'Warning, CRM user email is changed to: ' + request.crm_user_email);
        }
        */

        if(request.crmUserEmail)
          gCrmUserEmail = request.crmUserEmail;

        if(request.crmUserToken)
          gCrmUserToken = request.crmUserToken;

        // debugLog("@5128", gCurrentMessageId, sgnGmailDom.getCurrentThreadId());

        if(!$.isEmptyObject(request.preferences) && (gPreferenceVersion < request.preferenceVersion)){
          preferences = request.preferences;

          gPreferences = preferences;
          // gAbstractBackgroundColor = preferences["abstractBackgroundColor"];
          // gAbstractFontColor = preferences["abstractFontColor"];
          // gAbstractFontSize = preferences["abstractFontSize"];
          //

          updateUIByPreferences();

          gPreferenceVersion = request.preferenceVersion;

          var notificationNode = $('.sgn_sidebar.sgn_notification');
          if(notificationNode.length && preferences['isPaid'] === "true"){
            notificationNode.remove();
          }
        }

        // if(!gSgnUserEmail && request.gdriveEmail)
        gSgnUserEmail = request.gdriveEmail;

        // debugLog('@5280', request.email, gSgnUserEmail);

        sendEventMessage('SGN_PAGE_heart_beat_response', 
          {email: request.gdriveEmail, isBackgroundDead: false});  

        break;
      case "alert_message":

        var messageNode = $("<div class='sgn_message'>");
        var message = request.message.replace(/\n/g, "<br/>");
        messageNode.html(message);
        messageNode.popup("show");
        break;
      case "get_crm_thread_id_success":
        var emailData = request.emailData;
        var threadId = emailData["threadId"];
        var messageId = request.messageId;
        var url = getCRMUpdateMailInfoURL(getCrmUser(request.email), messageId, emailData);
        sendCrmRequest(url, function(response){
            SGNC.dummyCallBack(response);
        });
        break;
      default:
        debugLog("unknown background request", request);
        break;
    }
  });

  // Event listener for share email
  window.addEventListener('message', function(e) {
    // debugLog("@5442", e.data, typeof e.data, e.data.startsWith("sgncrm"));
    if (typeof e.data !== 'string' || !e.data.startsWith("sgncrm"))
      return;

    // debugLog("@5442b");
    
    var shareSuccessPrefix = "sgncrm:share_success:";
    // var sharePageLoaded = "sgncrm:sgn_share_loaded:";
    var sharePageLoaded = "sgncrm:sgn_share_loaded";


    //get id token
    //
    if (e.data.startsWith(shareSuccessPrefix)) {
      // debugLog("@5442c");
      var jsonData = e.data.substring(shareSuccessPrefix.length);
      /*
      var updateInfo = JSON.parse(jsonData);
      var messageId = updateInfo["message_id"];
      var email = updateInfo["email"];  //should be same as gCrmUserEmail
      if(messageId){
        postNote(gSgnUserEmail, messageId, updateInfo);
        updateShareIconMeta(messageId, updateInfo);
      }*/
      gLastCRMShareURL = null;
      var updateInfo = JSON.parse(jsonData);
      var messageId = "";
      messageId = updateInfo["message_id"];
      // debugLog('@3357', updateInfo);
      if(messageId === gCurrentMessageId){
        updateSGNContentByUpdateInfo(updateInfo);
        // updateShareIconMeta(messageId, updateInfo);

        updateSgnCrmPrompt(gSgnUserEmail, messageId, updateInfo['sgn_crm_prompt']);

        var crmTeamMembers = updateInfo['team_members'];
        setgCrmTeamMemberInfo(crmTeamMembers);

        setupCRMSidebarNode(gSgnUserEmail, updateInfo,
          updateInfo['note_comments'], updateInfo);

        crmContacts = updateInfo['crm_contacts'] || [];
        
        if (crmContacts.length) {
          addContactsToSidebar(gSgnUserEmail, crmContacts);
        }
              
        updateCommentsNodeByUpdateInfo(updateInfo);
        // reloadSideBar(updateInfo["sgn-opp-id"]);
      } 
      postNote(gSgnUserEmail, messageId, updateInfo);
    }
    else if(e.data.startsWith('sgncrm:login_success')){
      var data_parts = e.data.split(":");
      var crm_user_email= data_parts[2];
      var crm_user_token = "";
      if(data_parts.length > 3){
        crm_user_token = data_parts[3];
      }

      if(crm_user_email != gSgnUserEmail){
        var editorNode = SGNC.getContainer();
        var errorNode = editorNode.find(".sgn_error.sgn_custom");
        showError(errorNode, 'SGN and CRM logged in email not matched.');
      }
      else {


        gCrmUserEmail = crm_user_email;
        gCrmUserToken = crm_user_token;

        
        sendBackgroundMessage({action:"update_crm_user_info", 
                              crm_user_email: crm_user_email,
                              crm_user_token: crm_user_token});
      
        if(!gCrmLoggedIn){
          gCrmLoggedIn = true;
          removeCRMLoginSidebarNode();
          setupCrmOppListOpener(gCrmUserEmail);
          pullCRMStatus(gSgnUserEmail);
          initMentionIfNeeded($(".sgn_input"));
        }
        // update info not available here
        // updateCommentsNodeByUpdateInfo(updateInfo);

        // reloadSideBar(updateInfo["sgn-opp-id"]);
        // reloadSideBar();
      }
    }
    else if(e.data.startsWith('sgncrm:logout_success')){
      if (gCrmLoggedIn) {
        closeWindow();
      }
      logoutCRM();
      gCrmTeamMemberInfo.length = 0;
      setupCRMLoginSidebarNode(false);
    }
    else if(e.data.startsWith('sgncrm:hide_success_page')){
      sendBackgroundMessage({action: "send_preference",
        preferenceType: "showCRMSuccessPage", preferenceValue: false});
    }
    else if(e.data.startsWith('sgncrm:show_success_page')){
      sendBackgroundMessage({action: "send_preference",
        preferenceType: "showCRMSuccessPage", preferenceValue: true});
    }
    else if(e.data.startsWith('sgncrm:enable_sync_future_notes')){
      if(e.data.endsWith('true')){
        gSyncFutureNotesEnabled = true;
        updateShareIcon("auto");
       }
       else{
        gSyncFutureNotesEnabled = false;
        updateShareIcon("default");
       }
    }
    else if(e.data.startsWith('sgncrm:locli_oauth')){
      sendBackgroundMessage({action: "crm_oauth"});
    }
    else if(e.data.startsWith('sgncrm:reload_sidebar')){
      // debugLog('@4621, reload sidebar');



      reloadSideBar();
      //force reload sidebar
    }
    else if(e.data.startsWith(sharePageLoaded)){
      var email = e.data.substring(sharePageLoaded.length + 1).trim();
      var data = getCRMShareEmailListData(email);
      sendEventMessage(
        'SGN_PAGE_share_notes',{
          data: data
        });
    }
  }, true);

  // event listern for sgn login
  window.addEventListener("message", function(e){
    if(!e.data || !e.data.startsWith || !e.data.startsWith("sgnlogin:"))
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
      sendBackgroundMessage({action: "login_sgn_web", 
                             messageId: messageId,
                             code: code});
    }
    debugLog('@1835', e.data);
  }, true);

};

var gPreviousDebugLog = "";
var sendDebugLog = function(){
  var currentLog = SGNC.getLog();
  if(currentLog && currentLog != gPreviousDebugLog){
    sendBackgroundMessage({action:"update_debug_content_info", debugInfo: currentLog});
    gPreviousDebugLog = currentLog;
  }
};


//use for page script set up
var contentLoadStarted = false;
var contentLoadDone = false;

var setupPrintNote = function(printInfo) {
  var note = printInfo['note'];
  var properties = printInfo['properties'];
  var showPrintingNote = properties["showPrintingNote"];
  var fontSize = properties["font-size"];
  if (note && showPrintingNote) {
    var isRichTextEditor = false;
    // debugLog("@3215 properties", properties);
    if (!$.isEmptyObject(properties)) {
      var printNoteNode = $("<div class='gmail-note'></div>");
      $("div.maincontent").prepend(printNoteNode);
      Object.entries(properties).forEach(function(property) {
        if (property[0] === "isRichTextEditor") {
          isRichTextEditor = property[1];
          return;
        }
        $("div.gmail-note").css(property[0], property[1]);
      });
    }
    if (!isRichTextEditor) {
        $("div.gmail-note").text(note);
        $("div.gmail-note").css("white-space", "pre-wrap");
    } else {
        $("div.gmail-note").append(note);
    }
    $("div.gmail-note").addClass("sgn_print_note");
    $("div.gmail-note").css({"font-size": fontSize + "px"});

  }
};

var _setupPage = function(){
  if(true || SGNC.isSafari()){
    // for safari, all scripts are moved to content script
    return;
  }

  addScript('lib/jquery.js');
  addScript('lib/lru.js');
  addScript('settings.js');
  addScript('common/shared-common.js');
  addScript('common/gmail-sgn-page.js');
  addScript('common/gmail-sgn-dom.js');
  addScript('page.js');
};

var setupPage = function(retryCount){

  
  if(retryCount === undefined)
    retryCount = 600;//600 * 100 = 60 seconds for maximum loading time

  if(retryCount <= 0) //give up
    return; 

  // this is print email with note
  if (isGmailPrintView()) {
    // var printEmail = sgnGmailDom.getPrintPageEmail();
    // var printInfo = getPrintInfo(printEmail);
    // if (!$.isEmptyObject(printInfo)) {
    //   setupPrintNote(printInfo);
    // }
    return;
  }

  var email = sgnGmailDom.userEmail();

  if(email){
    var request = {action: 'request_setup'};
                   sendBackgroundMessage({action: 'request_setup'});
  }
  else
    setTimeout(setupPage, 100, retryCount-1);
};


var fireContentLoadedEvent = function() {
  if(contentLoadStarted){
    // debugLog("@3190 content");
    SGNC.appendLog("skipLoading");
    return;
  }

  contentLoadStarted = true;
  SGNC.appendLog("contentLoadStarted");

  setupListeners();

  setupPage();

  contentLoadDone = true;

  SGNC.appendLog("contentLoadDone");
};

var getSGNWebLoginURL = function(url) {
  var result= SGNC.getSGNWebBaseURL() + "/sgn/signin/?url=" + encodeURIComponent(url);

  // debugLog('@242', result);
  return result;
};


var isAutoFocousSgnInput = function(preferences){
  var isPaid = (preferences["isPaid"] === "true");
  var autoFocus = (preferences["autoFocus"] !== "false");
  return autoFocus && isPaid
}

var autoFocousSgnInput = function(){
  if(isRichTextEditor()){
    sendEventMessage('SGN_tinyMCE_autoFocus', {});
  }else{
    var sgnInput = $(".sgn_input")
    var strLength = sgnInput.val().length * 2;
    sgnInput.focus()
    sgnInput[0].setSelectionRange(strLength, strLength);
  }
}

var launchSGNWebLogin = function(email, messageId) {
  debugLog("Trying to login SGN Web");
  var clientId = settings.CLIENT_ID;
  var scope = settings.SCOPE;
  var state = email + "/1/" + messageId;
  var redirectURL = SGNC.getSGNWebBaseURL() + "/sgn/signin_done/";

  var url = getSGNWebLoginURL("https://accounts.google.com/o/oauth2/auth?" + $.param({"client_id": clientId,
          "scope": scope,
          "redirect_uri": SGNC.getRedirectUri('sgn_web'),
          "response_type": "code",
          "access_type": "offline",
          "login_hint": email,
          "state": state,
          //"login_hint":"",
          "prompt":"consent select_account" })); 

  sendEventMessage(
    'SGN_PAGE_open_popup',
    {
      url: url,
      windowName: 'sgn_web_login',
      strWindowFeatures: SGNC.getStrWindowFeatures(1000, 700)
    }
  );

};

$(document).ready(function(){

  SGNC.executeCatchingError(function(){
    SGNC.$ = $;
    SGNC.appendLog("documentReady");
    fireContentLoadedEvent();
  });

  $(window).on('resize', function() {
    setupSidebarDimension($(".sgn_sidebar:visible"));
  });

  sendDebugLog();
});

var processMentionURL = function(node) {
  node.on("click", "a.sgn_team_member_link", function(e) {
    e.preventDefault();
    e.stopPropagation();
    var href = $(this).attr("href");
    openCRMPage(href);
  });
};

if (isGmailPrintView()) {
  var printEmail = sgnGmailDom.getPrintPageEmail();
  var printInfo = getPrintInfo(printEmail);
  if (!$.isEmptyObject(printInfo)) {
    setupPrintNote(printInfo);
  }
}

debugLog("Finished content script (common)");

