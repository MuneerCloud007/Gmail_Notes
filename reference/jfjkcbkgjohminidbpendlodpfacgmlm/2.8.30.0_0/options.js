function showSavedPrompt(){
  $("#status").html("Preferences saved.<br/><br/>" +
                      "Please refresh browser to make the changes effective." +
                      "<br/><br/>");
  //clean up the text after 0.75 seconds
  setTimeout(function() { 
    $("#status").text("");
  }, 3000);
}

function getPreferenceFromUI() {
  var preferences = {};
  for (var i=0; i < gPreferenceTypes.length; i++) {
    var preferencesName = gPreferenceTypes[i]["name"];
    var jsPreferencesName = "#" + preferencesName;
    var type = gPreferenceTypes[i]["type"];
    if (type === "select" || type === "color" || type === "textarea" || type === "text") {
      preferences[preferencesName] = $(jsPreferencesName).val(); 
    } else if (type === "checkbox") {
      preferences[preferencesName] = String($(jsPreferencesName).is(":checked"));
    }
  }
  var disabledAccounts = [];
  $("#disabled_accounts input").each(function(){
    if($(this).is(":checked")){
      var email = $(this).attr("data-email");
      disabledAccounts.push(email);
    }
  });
  preferences["disabledAccounts"] = JSON.stringify(disabledAccounts);

  return preferences;
}

function savePreferences() {
  //var hideListingNotes = $("#hide_listing_notes").is(":checked");
  //localStorage["hideListingNotes"] = hideListingNotes;
  var preferences = getPreferenceFromUI();

  pushPreferences(preferences);

  showSavedPrompt();
}


function resetToDefaultValues() {
  resetPreferences();
  setTimeout(pullPreferences, 400);  //get the default values
  setTimeout(showSavedPrompt, 600);
}

function updateControls(preferences){
  for (var i=0; i < gPreferenceTypes.length; i++) {
    var preferencesName = gPreferenceTypes[i]["name"];
    if (!(preferencesName in preferences)) {
      continue;
    }

    var jsPreferencesName = "#" + preferencesName;
    var type = gPreferenceTypes[i]["type"];
    var preferencesVal = String(preferences[preferencesName]);
    if (type === "color" || type === "select" || type === "textarea" || type === "text") {
      if (type === "color") {
        $(jsPreferencesName).setColor(preferencesVal.toUpperCase());
      }
      $(jsPreferencesName).val(preferencesVal);
    } else if (type === "checkbox") {
      $(jsPreferencesName).prop("checked", (preferencesVal !== "false"));
    }
  }
  var disabledAccounts = JSON.parse(preferences["disabledAccounts"]);
  updateDisableAccountUI(disabledAccounts);

  /*
  $("#debug_page_info").text(String(preferences["debugPageInfo"]));
  $("#debug_content_info").text(String(preferences["debugContentInfo"]));
  $("#debug_background_info").text(String(preferences["debugBackgroundInfo"]));
  $("#debug_gdrive_info").text(String(preferences["debugGdriveInfo"]));
  */
}

function updateDisableAccountUI(disabledAccounts) {

  if(disabledAccounts){
    $("#disabled_accounts label").remove();
    for(var i=0; i < disabledAccounts.length; i++){
      var disable_email = disabledAccounts[i];
      $("#disabled_accounts").append("<label>" +
                                      "<input type=checkbox data-email='" + 
                                        disable_email + "' checked='checked'> " +
                                      disable_email + 
                                      "</label>");
    }
  }

  if(!disabledAccounts.length){
    $("#disabled_accounts input").prop("checked", false);
    $("#disabled_accounts_container").hide();
  }
}

function pullPreferences(){
  var preferences = getPreferences();

  updateControls(preferences);
}

function initPreferencesText(preferencesName, title, index) {
  var htmlCheckbox = "<tr>" +
    "<td>" +
      "<label for=" + preferencesName + ">" + title + "</label>" +
    "</td>" +
    "<td>" +
      "<input id=" + preferencesName + ">" +
    "</td>" +
  "</tr>";
  return htmlCheckbox;
}

function initPreferencesSelect(preferencesName, title, index) {
  var option = gPreferenceTypes[index]["option"];
  var htmlOption = "";
  for (var i=0; i< option.length; i++) {
    var optionValue = option[i]["value"];
    var optionText =  option[i]["text"];
    if (optionValue) {
      htmlOption += "<option value=\"" + optionValue + "\">" + optionText + "</option>";
    } else {
      htmlOption += "<option>" + optionText + "</option>";
    }
  }
  var htmlSelect = "<tr>" +
    "<td>" +
      title +
    "</td>" +
    "<td>" +
      "<div class=select>" +
        "<select id=" + preferencesName + ">" +
          htmlOption +
        "</select>" +
      "</div>" +
    "</td>" +
    "</tr>";
  return htmlSelect;
}

function initPreferencesCheckbox(preferencesName, title, index) {
  var htmlCheckbox = "<tr>" +
    "<td>" +
      "<label for=" + preferencesName + ">" + title + "</label>" +
    "</td>" +
    "<td>" +
      "<input type='checkbox' id=" + preferencesName + ">" +
    "</td>" +
  "</tr>";
  return htmlCheckbox;
}


function initPreferencesInputText(preferencesName, title, index) {
  var htmlInputText = "<tr>" +
    "<td>" +
      title +
    "</td>" +
    "<td>" +
      "<input type=text id=" + preferencesName + ">" +
    "</td>" +
  "</tr>";
  return htmlInputText;
}

function initPreferences(){
  var i;
  var gPreferencePanelNameDict = {"notesAppearance": "", "advancedFeatures": "", "simpleMobileCRM": "", "subscriberOptions": ""};
  for (i=0; i < gPreferenceTypes.length; i++) {
    var preferencesName = gPreferenceTypes[i]["name"];
    var type = gPreferenceTypes[i]["type"];
    var title = gPreferenceTypes[i]["title"];
    var panelName = gPreferenceTypes[i]["panelName"];
    var htmlContent = "";
    if (type === 'textarea') {
      continue;
    } else if (type === "select") {
      htmlContent = initPreferencesSelect(preferencesName, title, i);
    } else if (type === "color") {
      htmlContent = initPreferencesInputText(preferencesName, title, i);
    } else if (type === "checkbox") {
      htmlContent = initPreferencesCheckbox(preferencesName, title, i);
    } else if (type === "text") {
      htmlContent = initPreferencesText(preferencesName, title, i);
    } 

    gPreferencePanelNameDict[panelName] += htmlContent;
    var htmlDescription = gPreferenceTypes[i]["htmlDescription"];
    if(htmlDescription){
      gPreferencePanelNameDict[panelName] += htmlDescription;
    }
  }
  var gPreferencePanelNameList =  Object.keys(gPreferencePanelNameDict);
  for (i =0; i < gPreferencePanelNameList.length; i++) {
    var gPreferencePanelName = "#" + gPreferencePanelNameList[i];
    $(gPreferencePanelName).append(gPreferencePanelNameDict[gPreferencePanelNameList[i]]);
  }
  for(i=2; i<=10; i++){
    $("#abstractStyle").append("<option value=" + i + ">First " + i + " Characters</option>");
  }

  for(i=3; i<=10; i++){
    $("#abstractStyle").append("<option value=" + i*5 + ">First " + i*5 + " Characters</option>");
  }
  
  for(i=1; i<=30; i++){
    $("#noteHeight").append("<option>" + i + "</option>");
  }


  for(i=8; i<=20; i++){
    $("#abstractFontSize").append("<option>" + i + "</option>");
    $("#printFontSize").append("<option>" + i + "</option>");
  }

  for(i=8; i<=32; i++){
    if ((i <= 20) || (i > 20 && i % 2 === 0)) {
      $("#fontSize").append("<option>" + i + "</option>");
    }
  }

  $("#subscriptionEmail").attr("readonly", true);
}

function initDebugMessage(){
  background = SimpleGmailNotes.getBrowser().extension.getBackgroundPage();
  var sgno = background.SimpleGmailNotes;
  var pageInfo = sgno.getLog(background.debugPageScope);
  var contentInfo = sgno.getLog(background.debugContentScope);
  var backgroundInfo = sgno.getLog(background.debugBackGroundScope);
  var gdriveInfo = sgno.getLog(background.debugGdriveScope);

  $("#debug_page_info").text(pageInfo);
  $("#debug_content_info").text(contentInfo);
  $("#debug_background_info").text(backgroundInfo);
  $("#debug_gdrive_info").text(gdriveInfo);
  //$("#debug_gdrive_info").text(String(preferences["debugGdriveInfo"]));


}

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
    pushSubscribedInfo(email, paid);
    initSubscribedInfo(true);
    savePreferences();
  }
}

function initSubscribedInputForManualVerification(userEmails){
  var node = "<tr>" +
              "<td colspan='2'>" +
                "The following options are for SGN subscribers, please " +
                "<a target='_blank' href='https://www.bart.com.hk/simple-gmail-notes-support-package/?f=op'>subscribe</a> first:" +
              "</td>" +
             "</tr>" +
             "<tr>" + 
              "<td>" +
                "<select id='subscribedEmails'>";
  
  for(var i = 0; i<userEmails.length; i++){
    var userEmail = userEmails[i];
    node += "<option value='" + userEmail+ "'>" + userEmail + "</option>";
  }
  node = node + "</select>" +
              "</td>" + 
              "<td>" + 
                "<button id='subscribedVerifyForSgnAccount'>Verify</button>" +
              "</td>" + 
             "</tr>";
  $('#subscriberOptions').prepend(node);
  $('#subscribedVerifyForSgnAccount').click(function(){
    SimpleGmailNotes.getBrowser().permissions.request({
      origins: [getPortalBaseUrl()]
    }, function(granted) {
      if (granted) {
        updateSubscribedInfoAjax($('#subscribedEmails').val(), true);
      }else {
        console.log('No permissions');
      }
    });
  });
}


function exportSettings() {
  var settings = {"version": 1};
  var preferences = getPreferenceFromUI();
  delete preferences['isPaid'];
  settings = Object.assign({}, settings, preferences);
  var textFile = null,
  makeTextFile = function (text) {
    // var data = new Blob([text], {type: 'application/x-please-download-me'});
    var data = new Blob([text], {type: 'text/csv, charset=UTF-8'});

    if (textFile !== null) {
      window.URL.revokeObjectURL(textFile);
    }
    textFile = window.URL.createObjectURL(data);

    return textFile;
  };
  var now = new Date();
  var dateString = now.toISOString().slice(0,10);
  var fileName = "sgn-settings-" + dateString + ".yaml";
  var csvData =  'data:attachment/csv;charset=utf-8,' + encodeURIComponent(jsyaml.dump(settings, {forceQuotes: true}));
  $("a#download_settings").attr({
    target: '_blank',
    // "href": makeTextFile(jsyaml.dump(settings, {forceQuotes: true})),
    "href": csvData,
    "download": fileName
  });
  $("a#download_settings").get(0).click();
}


function importSettingsFromFile(file, _this) {
  var result = window.confirm("Warning! All existing preferences will be overwritten, please confirm to proceed.");
  if (!result) {
    return;
  }
  var fr = new FileReader();
  fr.onload = function() {
    _this.val('');
    var importPreferences = {};
    try {
      importPreferences = jsyaml.load(fr.result);
    } catch(error) {
      alert("Failed to load settings file: " + SGNC.getErrorMessage(error));
      return;
    }
    var hasVersion = 'version' in importPreferences;
    if (!hasVersion) {
      alert("Invalid settings file found");
      return;
    }
    delete importPreferences['version'];
    delete importPreferences['isPaid'];
    updateControls(importPreferences);
    $("#save").click();
  };
  fr.readAsText(file);
}

function setupPreferences(){
  initPreferences();
  //updateSubscribedInfoAjax();
  var SGNO = SimpleGmailNotes;

  for (var i=0; i < gPreferenceTypes.length; i++) {
    var type = gPreferenceTypes[i]["type"];
    if (type === "color") {
      var preferencesName = gPreferenceTypes[i]["name"];
      var jsPreferencesName = "#" + preferencesName;
      $(jsPreferencesName).simpleColor({ displayColorCode: true, chooserCSS: {'z-index': '999'}}); 
    }
  }

  $("#save").click(savePreferences);
  $("#reset").click(resetToDefaultValues);

  $("#review_invoice").click(function(){
    window.open(getPortalBaseUrl(), "_blank");
  });

  $("#revoke").click(function(){
    window.open("https://accounts.google.com/IssuedAuthSubTokens", "_blank");
  });
  $("#review").click(function(){
    window.open(SGNO.getReviewUrl(), "_blank");
  });

  $("#donation").attr("href", SGNO.getDonationUrl("pr"));
  $("#contact_us").attr("href", SGNO.getOfficalSiteUrl("pr"));
  $("#bart_logo").attr("href", SGNO.getOfficalSiteUrl("pr"));

  pullPreferences();

  initSubscribedInfo();

  initDebugMessage();

  SGNO.getBrowser().runtime.onMessageExternal.addListener(handleSubscribedMessage);

  if(!SGNC.isChrome()){
    $('#isPaid').prop('disabled', true);
    var userEmails = getUserEmails();
    initSubscribedInputForManualVerification(userEmails);
  }else{
    $('#isPaid').change(function(){
      var email = '';
      var paid = false;
      if($(this).is(":checked")){ 
        $('#isPaid').prop('checked', false);
        SGNO.getBrowser().permissions.request({
          origins: [getPortalBaseUrl()]
        }, function(granted) {
          if (granted) {
            var url = getPortalBaseUrl() + "portal/subscribed_info/?id=" + SGNC.getExtensionID();
            if(SGNO.isChrome()){
              window.open(url, "subscribe","width=1000,height=700");
            }else{
              SGNO.getBrowser().tabs.create({url: url});
            }
          } else {
            $('#showLogo').prop('checked', true);
            $('#useAdvancedColors').prop('checked', false);
            console.log('No permissions');
            $(this).prop('checked', false);
          }
        });
      }else{
        pushSubscribedInfo(email, paid);
        initSubscribedInfo();
        savePreferences();
      }
    });
  }

  if (!settings.SHOW_REVIEW_URL) {
    $("#review").hide();
  }

  if (!settings.SHOW_SUBSCRIPTION_URGE) {
    $("div.support-subscription-container").hide();
  }

  if (!settings.SHOW_SUBSCRIBER_OPTIONS) {
    $("#subscriberPanel").hide();
  }

  $(document).on("click", "#export_settings", function(e) {
    exportSettings();
  });

  $(document).on("change", "#import_settings", function(e) {
    var settingsFile = e.target.files[0];
    var _this = $(this);
    importSettingsFromFile(settingsFile, _this);
  });
}

$(document).ready(function(){
  if(!SGNC.isSafari()){
    setupPreferences();
  }

  updateSubscribedInfoIfNeeded(true)

  // safari set up is triggered inside background.js
});

