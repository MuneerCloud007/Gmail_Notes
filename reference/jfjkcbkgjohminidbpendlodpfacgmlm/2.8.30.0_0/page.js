/*   
 * Simple Gmail Notes
 * https://github.com/walty8
 * Copyright (C) 2017 Walty Yeung <walty@bart.com.hk>
 * License: GPLv3
 *
 * This script is going to be shared for both Firefox and Chrome extensions.
 */

SimpleGmailNotes.start = function(){

(function(SimpleGmailNotes, localJQuery){
  var $ = localJQuery;

  /* global variables (inside the closure)*/
  var SGNC = SimpleGmailNotes;
  var debugLog = SGNC.debugLog;
  var sgnGmailPage;
  var gEmailIdDict = new LRUMap(2000);  //at most ~2MB memory
  var gClassicGmailConversation = false;
  var gDebugInfoDetail = "";
  var gDebugInfoSummary = "";
  var gCrmLoggedInChecked = false;
  var gIsBackgroundDead = false;

  //var gDebugInfoErrorTrace = "";
  //followings are for network request locking control
  var sgnGmailDom = new SGNGmailDOM(localJQuery);
  var mceEditor = null;

  SGNC.gdriveEmail = "";
  SGNC.startHeartBeat = Date.now();
  SGNC.lastHeartBeat = SGNC.startHeartBeat;
  /* -- end -- */

  //send message to content script
  var sendContentMessage = function(eventName, eventDetail){
    if(eventDetail === undefined){
      eventDetail = {};
    }

    eventDetail.email = sgnGmailDom.userEmail()
    document.dispatchEvent(new CustomEvent(eventName,  {detail: eventDetail}));
  };

  //utils

  var deleteNote = function(){
    sendContentMessage('SGN_delete', {messageId: sgnGmailDom.getCurrentMessageId()});
  };

  var resetPreferences = function(){
    sendContentMessage('SGN_reset_preferences');
  };

  var sendPreferences = function(preferenceType, preferenceValue){
    sendContentMessage('SGN_send_preference',
      {preferenceType: preferenceType, preferenceValue: preferenceValue});
  };

  var gPreviousDebugLog = "";
  var sendDebugLog = function(){
    var currentLog = SGNC.getLog();
    if(currentLog && currentLog != gPreviousDebugLog){
      debugLog("@65, sending log");
      sendContentMessage('SGN_update_debug_page_info', {debugInfo:currentLog});
      gPreviousDebugLog = currentLog;
    }
  };

  SimpleGmailNotes.sendPageDebugLog = sendDebugLog;

  var isNumeric = function(str){
    var code, i, len;

    for (i = 0, len = str.length; i < len; i++) {
      code = str.charCodeAt(i);
      if (!(code > 47 && code < 58)){ // numeric (0-9)
        return false;
      }
    }
    return true;
  };
	
  //var heartBeatAlertSent = false;
  var sendHeartBeat = function(){
  SGNC.executeCatchingError(function(){
    sendContentMessage("SGN_heart_beat_request");
    // sendDebugLog();

    var warningMessage = SGNC.offlineMessage;

    if(!gIsBackgroundDead){  
      if($(".sgn_inactive_warning").length){
        //background is back to alive
        $(".sgn_inactive_warning").remove();
        if($(".sgn_input").is(":visible")){
          setupNoteEditor();
        }
      }
    }

  });
  };

  // === GMAIL ONLY FUNCTION START ===
  var getEmailKey = function(title, sender, time, excerpt){
    time = time.split("\n")[0]; //some extension will mess up with this
    var emailKey = sender + "|" + time + "|" + SGNC.stripHtml(title) + "|" + SGNC.stripHtml(excerpt);

    //debugLog("@209, generalted email key:" + emailKey);

    //in case already escaped
    emailKey = SGNC.htmlEscape(emailKey);
    return emailKey;
  };

  var getGmailNodeTitle = function(mailNode){
    var hook = $(mailNode).find(".xT .y6");

    if(!hook.length)  //vertical split view
      hook = $(mailNode).next().find(".xT .y6");

    return hook.find("span").first().text();
  };

  var getGmailNodeTime = function(mailNode) {
    var hook = $(mailNode).find(".xW");

    if(!hook.length)  //vertical split view
      hook = $(mailNode).find(".apm");

    return hook.find("span").last().attr("title");
  };

  var getGmailNodeSender = function(mailNode) {
    return mailNode.find(".yW .yP, .yW .zF").last().attr("email");
  };

  var getGmailNodeExcerpt = function(mailNode){
    var excerpt = "";

    if($(mailNode).find(".xW").length){ //normal view
      excerpt = $(mailNode).find(".xT .y2").text().substring(3);  //remove " - "
    }
    else{ //vertical view
      excerpt = $(mailNode).next().next().find(".xY .y2").text();
    }

    return excerpt;
  };


  var getEmailId = function(mailNode){
    var emailId = "";
    var title = getGmailNodeTitle(mailNode);
    var sender = getGmailNodeSender(mailNode);
    var time = getGmailNodeTime(mailNode);
    var excerpt = getGmailNodeExcerpt(mailNode);

    var emailKey = getEmailKey(title, sender, time, excerpt);
    var email = gEmailIdDict.get(emailKey);

    if(!email){ //second try
      emailKey = getEmailKey(title, sender, time, '__INCREMENT_MAIL__');
      email = gEmailIdDict.get(emailKey);
    }

    if(email)
      emailId = email.id;

    debugLog("@249, email ID:" + emailId);

    return emailId;
  };
  // === GMAIL ONLY FUNCTIONS END ===

  // === INBOX ONLY FUNCTIONS START ====
  // === INBOX ONLY FUNCTIONS END ===

  var previousMessageId = null;
  //set up note editor in the email detail page
  var setupNoteEditor = function(){
    SGNC.executeCatchingError(function(){
    //No email selected, happened when page up or page down
      if(!$(".nH.aHU:visible").length && !$(".nH > .aHU:visible").length  && sgnGmailDom.isPreviewPane()){
        SGNC.appendLog("No email selected");
        return;
      }

      
      var messageId = sgnGmailDom.getCurrentMessageId();
      if(!messageId){
        SGNC.appendLog("message not found");
        return;
      }


      var visible_container = $(".sgn_container:visible");
      if(visible_container.length && visible_container.height() &&
         !(messageId !== previousMessageId && previousMessageId === 'PREVIEW'))  
      {
        SGNC.appendLog("textarea already exists");
        return;
      }


      SGNC.appendLog("Page URL: " + window.location.href);

    //if(!acquireNetworkLock()){
        //SGNC.appendLog("Network lock failed");
        //debugLog("setupNoteEditor failed to get network lock");
        //return;
    //}

      sendContentMessage('SGN_setup_note_editor', {messageId:messageId});
      
      SGNC.appendLog("set up request sent");

      previousMessageId = messageId;
      // sendDebugLog();

    
    });
  };

  var checkCRMLoggedIn = function() {
    SGNC.executeCatchingError(function() {
      if (gCrmLoggedInChecked) {
        SGNC.appendLogOnce("crm logged in already checked");
        // debugLog('crm logged in already checked')
        return;
      }

      // sendContentMessage('SGN_show_crm_login_sidebar');

      sendContentMessage('SGN_check_crm_logged_in');

      SGNC.appendLogOnce("check crm logged in request sent");
      // sendDebugLog();

    });
  };

  var updateEmailIdDictByJSON = function(dataString){
    SGNC.executeCatchingError(function(dataString){
      var startString = ")]}'\n\n";
      var totalLength = dataString.length;

      if(dataString.substring(0, startString.length) != startString){
      //not a valid view data string
        return;
      }


      var strippedString = dataString.substring(startString.length);

      var lineList = dataString.split("\n");
      var email_list = [];
      var i;

      if(lineList.length == 3){  //JSON data
        if(dataString.substring(totalLength-1, totalLength) != ']'){
          //not a valid format
          return;
        }

        var emailData;
        //new email arrived for priority inbox view
        if(strippedString.indexOf('["tb"') > 0){ 
          emailData = JSON.parse(strippedString);
          email_list = sgnGmailPage.parseViewData(emailData[0]);
        }
        else if(strippedString.indexOf('["stu"') > 0){
          var newData = [];
          emailData = JSON.parse(strippedString);
          emailData = emailData[0];

          if(emailData[7] && emailData[7].length >= 3 && 
             emailData[7][0] == "stu" && 
             emailData[7][2] && emailData[7][2].length){
             var tempData = emailData[7][2];
             //to wrap up into a format that could be parsed by parseViewData
             for(i=0; i<tempData.length; i++){
                newData.push(["tb", "", [tempData[i][1]]]);
             }
          }

          email_list = sgnGmailPage.parseViewData(newData);
        }
        else if(strippedString.indexOf('["ms"') > 0){
          emailData = JSON.parse(strippedString);
          email_list = sgnGmailPage.parseIncrementData(emailData[0]);
        }
    }
    else if(lineList.length > 3){ //JSON data mingled with byte size
        if(dataString.substring(totalLength-2, totalLength-1) != ']'){
        //not a valid format
          return;
        }

        var firstByteCount = lineList[2];

        if(!isNumeric(firstByteCount)){
          return; //invalid format
        }

        if(strippedString.indexOf('["tb"') < 0){
          return; //invalid format
        }

        var tempString = "[null";
        var resultList = [];

        for(i=3; i<lineList.length; i++){
          var line = lineList[i];
          if(isNumeric(line)){
            continue;
          }

          if(line.indexOf('["tb"') < 0){
            continue;
          }

          var tempList = JSON.parse(line);

          for(var j=0; j<tempList.length; j++){
            if(tempList[j][0] == 'tb'){
              resultList.push(tempList[j]);
            }
          }

        //resultList.push(tempList[0]);
        }

        email_list = sgnGmailPage.parseViewData(resultList);
      }
      
      for(i=0; i < email_list.length; i++){
        var email = email_list[i];
        var emailKey = getEmailKey(SGNC.htmlUnescape(email.title), email.sender, email.time, SGNC.htmlUnescape(email.excerpt));
        gEmailIdDict.set(emailKey, email);

        if(!gClassicGmailConversation && email.id != email.lastMessageId){
          gClassicGmailConversation = true;
          sendContentMessage('SGN_set_classic_gmail_conversation');
        }
      }

    }, dataString);
  };

  var updateEmailIdDictByJS = function(dataString){
  SGNC.executeCatchingError(function(dataString){
    var totalLength = dataString.length;
    var signatureString = "var GM_TIMING_START_CHUNK2=";

    //for better performance
    if(!dataString.startsWith(signatureString)){
      return;
    }

    if(dataString.indexOf("var VIEW_DATA=") < 0){
      return;
    }

    var startIndex = dataString.indexOf("[");
    var endIndex = dataString.lastIndexOf("]");

    if(startIndex < 0 || endIndex < 0 )
      return;

    var strippedString = dataString.substring(startIndex, endIndex+1);

    var viewData = JSON.parse(strippedString);

    var email_list = sgnGmailPage.parseViewData(viewData);

    for(var i=0; i< email_list.length; i++){
      var email = email_list[i];
      var emailKey = getEmailKey(SGNC.htmlUnescape(email.title), email.sender, email.time, SGNC.htmlUnescape(email.excerpt));
      gEmailIdDict.set(emailKey, email);
    }
  }, dataString);
  };

  var isLoggedIn = function(){
    return SGNC.gdriveEmail && SGNC.gdriveEmail !== "";
  };

  var lastPullDiff = 0;
  var lastPullHash = null;
  var lastPullItemRange = null;
  var lastPendingCount = 0;
  var lastAbstractSignature = "";
  SGNC.duplicateRequestCount = 0;
  var markAbstracts = function(){
    SGNC.executeCatchingError(function(){
      if(gIsBackgroundDead){
        return; //no need to pull, walty temp
      }

      if(!isLoggedIn()){
        SGNC.appendLog("not logged in, skipped pull requests");
        SGNC.duplicateRequestCount = 0;
        return;
      }


      var visibleRows = $("tr.zA[id]:visible");


      if(visibleRows.length === 0){
        // debugLog("no visible rows")
        SGNC.appendLogOnce("no need to check");
        return;
      }

      
      var unmarkedRows = visibleRows.filter(":not([sgn_email_id])");
      //rows that has been marked, but has no notes

      /*
      if(sgnGmailDom.isPreviewPane() && sgnGmailDom.isVerticalSplit()){
        visibleRows.each(function(){
          if($(this).is(":not(:has(div.sgn))")){
            pendingRows = pendingRows.add($(this));
          }
        });
      }
      else{
        pendingRows = visibleRows.filter("[sgn_email_id]:not(:has(.sgn))");
      }
      */

      var pendingRows = visibleRows.filter("[sgn_email_id]:not(:has(.sgn))").filter(":not([sgn_email_marking])");


      if(unmarkedRows.length === 0 && pendingRows.length === 0){
        debugLog("no pending unmarked rows & pending rows");
        SGNC.appendLogOnce("no need to check");
        return;
      }


      var thisPullDiff = visibleRows.length - unmarkedRows.length;
      var thisPullHash = window.location.hash;
      var thisPullItemRange = $(".Di .Dj:visible").text();
      var thisPendingCount = pendingRows.length;


      debugLog("@104", visibleRows.length, unmarkedRows.length, thisPullDiff);


      var thisAbstractSignature = thisPullDiff + "|" + thisPullHash + "|" + 
                                  thisPullItemRange + "|" + thisPendingCount + "|" + 
                                  pendingRows.first().attr("id") + "|" + pendingRows.last().attr("id");

      if(thisAbstractSignature == lastAbstractSignature){
        SGNC.duplicateRequestCount += 1;
      }
      else
        SGNC.duplicateRequestCount = 0;

      if(SGNC.duplicateRequestCount > 3){
        SGNC.appendLog("3 duplicate requests");
        return; //danger, may be endless loop here
      }




      debugLog("@104, total unmarked rows", unmarkedRows.length);
      //mark the email ID for each row
      unmarkedRows.each(function(){
        var emailId = sgnGmailDom.getNewGmailEmailIdFromNode($(this));
        if(emailId){
          //add email id to the TR element
          $(this).attr("sgn_email_id", emailId);
        }
      });


      var requestList = [];
      unmarkedRows.add(pendingRows).each(function(){
        if(sgnGmailDom.isPreviewPane() &&
          $(this).next().next().find(".apB .apu .sgn").length){
            //marked in preview pane
            var dummy = 1;
        }
        else{ //this apply to both normal gmail and inbox view
          var emailId = $(this).attr("sgn_email_id");
          if(emailId)
            requestList.push(emailId);

          $(this).attr("sgn_email_marking", "1");
        }
      });



      /*
      lastPullDiff = thisPullDiff;
      lastPullHash = thisPullHash;
      lastPullItemRange = thisPullItemRange;
      lastPendingCount = thisPendingCount;
      */


      if(requestList.length === 0){
        debugLog("no need to pull rows");
        SGNC.appendLog("no need to pull rows");
        return;
      }


      //this line MUST be above acquireNetworkLock, otherwise it would be point less
      lastAbstractSignature = thisAbstractSignature;

      debugLog("Simple-gmail-notes: pulling notes", requestList);
      //g_pnc += 1;
      //the lock must be acaquired right before the request is issued
      //if(!acquireNetworkLock()){
      //  SGNC.appendLog("markAbstracts failed to get network lock");
      //  return;
      //}
      sendContentMessage("SGN_pull_notes",
                      {requestList:requestList});


      SGNC.appendLog("pull request sent");
      // sendDebugLog();
    });
  };
  

  var deleteNoteCallBack = function(data){
    sendContentMessage('SGN_delete_notes', data);
  };

  var commentNoteCallBack = function(data) {
    sendContentMessage('SGN_comment_note', data);
  };

  var silentShareCallBack = function(data){
    // show handle the result in content script
    sendContentMessage('SGN_silent_share', data);
    //debugLog(data);
  };

  var getCRMEmailDetailCallBack = function(data){
    sendContentMessage('SGN_crm_email_detail', data);
  };

  var checkCRMLoggedInCallBack = function(data) {
    gCrmLoggedInChecked = true;
    debugLog("@593------ data", data["status"]);
    if (data["status"] === "success") {
      sendContentMessage('SGN_crm_logged_in_success', data);
    } else {
      sendContentMessage('SGN_crm_logged_in_failed', data);
      //sendContentMessage('SGN_show_crm_login_sidebar', {});
    }
  };

  var batchPullNotesCallBack = function(data) {
    sendContentMessage('SGN_batch_pull_notes', data);
  };

  var dummyCallBack = function(){
    var i=0;  //for debug breakpoint set up
  };

  var main = function(){
    SGNC.$ = $;

    SGNC.appendLog("page main start");

    SGNC.appendLog("Browser Version: " + navigator.userAgent + "\n" + 
                    gDebugInfoSummary + "\n" + gDebugInfoDetail);


    var debugSummary = "Page URL: " + window.location.href + 
                         "\nIs Vertical Split: " + sgnGmailDom.isVerticalSplit() + 
                         "\nIs Horizontal Split: " + sgnGmailDom.isHorizontalSplit() +
                         "\nIs Preview Pane: " + sgnGmailDom.isPreviewPane() +
                         "\nIs Multiple Inbox: " + sgnGmailDom.isMultipleInbox() +
                         "\nIs Conversation: " + sgnGmailDom.isConversationMode();
    SGNC.appendLog(debugSummary);
    // sendDebugLog();
    //sgnGmailDom = new SimpleGmailNotes_Gmail(localJQuery);

    var sgnGmailPageOptions = {
      openEmailCallback: function(){  //no effect for inbox
        debugLog("simple-gmail-notes: open email event");
        //g_oec += 1;
        setupNoteEditor();
      },
      httpEventCallback: function(params, responseText, readyState) { //no effect for inbox
        //debugLog("xhr:", xhr);
        updateEmailIdDictByJSON(responseText);
      },
      onloadCallback: function(){
        debugLog("simple-gmail-notes: load event");
        //g_lc += 1;
        setupNoteEditor();
      },
    };

    sgnGmailPage = new SGNGmailPage(localJQuery, sgnGmailPageOptions);

    var tinymceInit = function(tinymceProperties){
      tinymce.baseURL = tinymceProperties.baseUrl;
      tinymce.suffix = '.min';
      tinymce.init({
        selector: '.sgn_input',
        statusbar: false,
        menubar: false,
        branding: true,
        readonly: 1,
        content_css: tinymceProperties.cssUrl,
        plugins: ["lists", "link"],
        toolbar: "bold italic underline strikethrough | numlist bullist | link",
        init_instance_callback: function(editor){
          mceEditor = editor;
          // debugLog('@668', tinymceProperties);
          var editorBody = $(editor.getBody());
          $(".mce-edit-area").css('height', tinymceProperties.height);
          $(".mce-edit-area iframe").css('height', tinymceProperties.height);
          if(tinymceProperties.backgroundColor)
            editorBody.css('background-color', tinymceProperties.backgroundColor);
          if(tinymceProperties.fontColor)
            editorBody.css('color', SGNC.htmlEscape(tinymceProperties.fontColor));
          if(tinymceProperties.fontSize)
            editorBody.css('font-size', tinymceProperties.fontSize + "pt");

          editor.on('blur', function(e){
            var content = mceEditor.getContent();
            $('.sgn_input').val(content);
            sendContentMessage('SGN_save_content', true);
          });

          var visible_container = $(".sgn_container:visible");
          visible_container.find(".mce-widget.mce-first.mce-last").each(function(){
            if($(this).css("visibility") == "hidden"){
              $(this).hide();
            }
          });

          // debugLog('@680');
          editor.editorLoaded = true;
        }
      });
    };

    var loadTinymceScript = function(tinymceProperties){
      var tinymceUrl = tinymceProperties.baseUrl + '/tinymce.min.js';
      $.getScript(tinymceUrl)
        .done(function(data){
          debugLog('load tinymce.min.js successfully', data, window.tinymce);  
            tinymceInit(tinymceProperties);
        })
        .fail(function(){
          debugLog('fail to load tinymce.min.js');
        });
    };

    var waitUntilEditorReady = function(func, retryCount) {
      if(retryCount === undefined){
        retryCount = 20;
      }

      if(!retryCount)
        return;

      var editor;
      
      if(!mceEditor || !mceEditor.getBody()){
        retryCount = retryCount - 1;
        setTimeout(waitUntilEditorReady, 100, func, retryCount);
        // debugLog('waiting for editor', retryCount);
        return;
      }

      // debugLog("@729, editor loaded");

      // editor loaded now
      func();
    };

    document.addEventListener('SGN_tinyMCE_update_note', function(e){
      waitUntilEditorReady(function(){
        var tinymceProperties = JSON.parse(e.detail); 
        var content = tinymceProperties.content;
        if(!content.startsWith("<p>") && 
           !content.startsWith("<ul>") &&
           !content.startsWith("<ol>")){          //deal with linebreak when content in plainText showed up in richTextarea
          var plainTextSplit = content.split('\n');
          content = "";
          for(var i = 0;i < plainTextSplit.length;i++){
            content = content + "<p>" + plainTextSplit[i] + "</p>";
          }
          
        }
        if(mceEditor){
          // debugLog('@721, content', content);
          mceEditor.setContent(content);
          mceEditor.selection.select(mceEditor.getBody(), true);
          mceEditor.selection.collapse(false);
        }
      });
      
    });

    document.addEventListener('SGN_tinyMCE_autoFocus', function(e){
      waitUntilEditorReady(function(){
        if(mceEditor){
          setTimeout(()=>{
            mceEditor.focus();
            mceEditor.selection.select(mceEditor.getBody(), true);
            mceEditor.selection.collapse(false);
          }, 100)
        }
      })
    })
   

    document.addEventListener('SGN_tinyMCE_delete_message', function(e){
      waitUntilEditorReady(function(){
        var tinymceProperties = JSON.parse(e.detail);
        if(mceEditor){
          mceEditor.setContent('');
        }
      });
    });
    

    document.addEventListener('SGN_tinyMCE_disable', function(e){
      waitUntilEditorReady(function(){
        var tinymceProperties = JSON.parse(e.detail);
        var editor = mceEditor;
        if(editor){
          editor.setMode('readonly');
          $(editor.getBody()).css("background-color", "");
          editor.setContent("");
        }
      });
    });

    var executeEditorCommand = function (editor, cmd, state) {
      editor.getDoc().execCommand(cmd, false, state);
    };

    document.addEventListener('SGN_tinyMCE_enable', function(e){
      waitUntilEditorReady(function(){
        var editor = mceEditor;

        // debugLog('@73, set up tinymce editor');
        editor.readonly = false;
        editor.getBody().contentEditable = true;
        editor.fire('SwitchMode', { mode: 'code' });
        executeEditorCommand(editor, 'StyleWithCSS', false);
        executeEditorCommand(editor, 'enableInlineTableEditing', false);
        executeEditorCommand(editor, 'enableObjectResizing', false);
        editor.nodeChanged();
      });
    });
    
    document.addEventListener('SGN_tinyMCE_set_backgroundColor', function(e){
      waitUntilEditorReady(function(){ 
        var tinymceProperties = JSON.parse(e.detail);
        var backgroundColor = tinymceProperties.backgroundColor;
        if(mceEditor && mceEditor.editorLoaded && backgroundColor){
            editor = $(mceEditor.getBody());
            // debugLog('@833', backgroundColor);
            editor.css('background-color', backgroundColor); 
        }
      });
    });

    document.addEventListener('SGN_tinyMCE_set_fontColor', function(e){
      waitUntilEditorReady(function(){ 
        var tinymceProperties = JSON.parse(e.detail);
        var fontColor = tinymceProperties.fontColor;
        if(mceEditor && mceEditor.editorLoaded && fontColor){
            editor = $(mceEditor.getBody());
            // debugLog('@833', backgroundColor);
            editor.css('color', fontColor); 
        }
      });
    });

    document.addEventListener('SGN_tinyMCE_remove', function(e){
      if(!mceEditor){
        return;
      }

      mceEditor.remove();
    });
    
    document.addEventListener('SGN_tinyMCE_init', function(e){
      var tinymceProperties = JSON.parse(e.detail);
      if(!window.tinymce)
        loadTinymceScript(tinymceProperties);
      else{
        if(tinymce.activeEditor){  //only init once
          return;
        }
        tinymceInit(tinymceProperties);
      }
    });

    document.addEventListener('SGN_PAGE_share_notes', function(e){
      var detail = JSON.parse(e.detail);
      var shareData = {"source": "sgn_share_notes", "data": detail["data"]};
      popupWindow['SGNC-share-notes-popup'].postMessage(shareData, "*");
    });


    document.addEventListener('SGN_PAGE_heart_beat_response', function(e) {
      var detail = JSON.parse(e.detail);
      SGNC.lastHeartBeat = Date.now();

      // console.log("@832", detail.email);

      SGNC.gdriveEmail = detail.email;
      gIsBackgroundDead = detail.isBackgroundDead;

      return true;
    });

    document.addEventListener('SGN_mark_crm_checked', function(e){
      gCrmLoggedInChecked = true;
    });
    
    var popupWindow = {
      'SGNC-share-popup': null,
      'SGNC-share-notes-popup': null,
      'SGNC-opportunity-popup': null
    };
    var previousPopupInfo = null;

    document.addEventListener('SGN_PAGE_close_window', function(e) {
      Object.keys(popupWindow).forEach(function(key) {
        if (popupWindow[key]) {
          popupWindow[key].close();
        }
      });
    });

    document.addEventListener('SGN_PAGE_open_popup', function(e){
      var detail = JSON.parse(e.detail);
      var url = detail.url;
      var windowName = detail.windowName;
      var strWindowFeatures = detail.strWindowFeatures;

      if(popupWindow[windowName])
        popupWindow[windowName].close();

      popupWindow[windowName] = window.open(url, windowName, strWindowFeatures);

      previousPopupInfo = [url, windowName, strWindowFeatures];
    });

    var crmLoggedInCallBack = function(data) {
      if(previousPopupInfo){
        var url = previousPopupInfo[0];
        var windowName = previousPopupInfo[1];
        var strWindowFeatures = previousPopupInfo[2];

        popupWindow[windowName] = window.open(url, windowName, strWindowFeatures);
      }
    };

    var crmLoggedOutCallBack = function(){
      //dummy call back from CRM logged in jsonp response
    };



    var isAdnInserted = false;
    if(sgnGmailDom.isPreviewPane() && $("div.S3").css('flex-grow') != '0'){
      $(document).on('DOMNodeInserted', 'div.adn', function (e) {
        if(!isAdnInserted){
          isAdnInserted = true;
          setTimeout(function(){ isAdnInserted=false; }, 300);
          setupNoteEditor();
        }
      });
    }


    $(window).on('beforeunload', function(){
      var popupShareWindow = popupWindow['SGNC-share-popup'];
      if (popupShareWindow)
        popupShareWindow.close();

      var popupShareNotesWindow = popupWindow['SGNC-share-notes-popup'];
      if (popupShareNotesWindow)
        popupShareWindow.close();

      var popupOpportunityWindow = popupWindow['SGNC-opportunity-popup'];
      if (popupOpportunityWindow)
        popupOpportunityWindow.close();
    });

    //initialization script
    //use current DOM to update email ID of first page
    for(var i=0; i<document.scripts.length; i++){
      updateEmailIdDictByJS(document.scripts[i].text);
    }

    //https://stackoverflow.com/questions/6685396/execute-the-setinterval-function-without-delay-the-first-time
    setInterval(function _run(){
      //exeception in one call should not affect others
      sendHeartBeat();
      markAbstracts();
      setupNoteEditor();
      sendDebugLog();
      checkCRMLoggedIn();
      return _run;
    }(), 1500);

    $(window).on('hashchange', function(e){
      setupNoteEditor();
      // markAbstracts();
    });

    //throw new Error("my custom error");
    //setTimeout(pullNotesCatchingError, 0);
    //setInterval(pullNotesCatchingError, 2000);

    //better not to overlapp to much with the above one
    //setInterval(setupNoteEditorCatchingError, 1770); 
    //setInterval(sendDebugLog, 3000); //update debug info to background

    //======= INTERFACE TO EXPOSE =====
    SGNC.silentShareCallBack = silentShareCallBack;
    SGNC.commentNoteCallBack = commentNoteCallBack;
    SGNC.deleteNoteCallBack = deleteNoteCallBack;
    SGNC.checkCRMLoggedInCallBack = checkCRMLoggedInCallBack;
    SGNC.crmLoggedInCallBack = crmLoggedInCallBack;
    SGNC.crmLoggedOutCallBack = crmLoggedOutCallBack;
    SGNC.getCRMEmailDetailCallBack = getCRMEmailDetailCallBack;
    SGNC.batchPullNotesCallBack = batchPullNotesCallBack;
    SGNC.dummyCallBack = dummyCallBack;
    SGNC.loadTinymceScript = loadTinymceScript;
    SGNC.tinymceInit = tinymceInit;


    //======= FOR DEBUG =======
    SGNC._sgnGmailDom = sgnGmailDom;
    SGNC._sgnGmailPage = sgnGmailPage;
    SGNC._sendPreference = sendPreferences;
    SGNC._resetPreferences = resetPreferences;
    SGNC._deleteNote = deleteNote;
    SGNC._sendDebugLog = sendDebugLog;
  };

  main();


}(window.SimpleGmailNotes = window.SimpleGmailNotes || 
                            {}, jQuery));

}; //end of SimpleGmailNotes.start

SimpleGmailNotes.executeCatchingError(function(){
    SimpleGmailNotes.start();
});

SimpleGmailNotes.sendPageDebugLog();

