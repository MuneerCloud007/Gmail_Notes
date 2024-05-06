$(document).ready(function(){
  var SGNP = SimpleGmailNotes;

  SGNC.getBrowser().browserAction.setBadgeText({"text": ""});

  $(".sgn-menu-table a").attr("target", "_blank");
  $("#open_options").click(function(){
    openTab("options.html");
    return false;
  });

  $("#write_reivew").click(function(){
    var url = SGNP.getReviewUrl();

    window.open(url, "_blank");
    return false;
  });

  $("#donation").click(function(){
    var url = SGNP.getDonationUrl("po");

    window.open(url, "_blank");
    return false;
  });

  $("#bart_logo").attr("href", SGNP.getOfficalSiteUrl("po"));
  $("#bart_logo img").attr("src", SGNP.getBartLogoImageSrc("po"));

  $("#hire_us").attr("href", SGNP.getContactUsUrl("po"));

  if (!settings.SHOW_REVIEW_URL) {
    $("#support-review-container").hide();
  }

  if (!settings.SHOW_SUBSCRIPTION_URGE) {
    $("#support-subscribe-container").hide();
  }

});
