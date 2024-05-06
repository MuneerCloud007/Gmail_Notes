This is a simple architecture file per [recommendation](https://news.ycombinator.com/item?id=26048784).

## Authorization
The authorization uses [launchWebAuthFlow of web extension api](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/identity/launchWebAuthFlow).

This is a [basic flow for Google OAuth](https://developers.google.com/identity/protocols/oauth2#clientside).

The chrome API of `getAuthToken` is much easier, but the `launchWebAuthFlow` is supposed to be more browser neutral (though not supported by Safari now). 

For some unknown reasons, this flow does not work for some Chrome users. So after the first login attempt failed, there will be alternate login URL in the login screen, which will use a server for the intermediate token collection, and pass back token to the browser.

All API requests come with a token authentication, per recommendation by Google.

## Basic Note Flow

After a new email is opened, the text area will be enabled first (`enable_edit`).

Meanwhile there is a request to collect notes from Google Drive, and push back the notes 
to the text area (`update_content`). That's why sometimes the note will need a few seconds to come out.

After the text area is blurred, the note content will be pushed to the background script (`post_note`),
which will submit the note to Google Drive.

Most interactions are directly between the extension with Google Drive API, without server in the middle.

If Simple Mobile CRM is enabled, the note, email title and email abstract will be pushed to the CRM server.
However, full email content and email attachments are never sent.

## Heart Beat

For every 1.5 seconds, there will be a heart beat request sent out from page script, go to content 
script and then background script.  In return, a heart beat response is sent from backgroun to content
and then page script.

page.js --(heart beat request)--> content.js --(heart beat request)--> background.js --(heart beat response)--> 
content.js --(heart heat response)--> page.js

The heat beat makes sure the page script could detect when the background script is dead (many reasons).  Also 
this makes sure latest UI preferences are pushed back to front end.

Only minium JS logic are included in the heart beat.

## Integration with CRM

CRM is only enabled when user explicitly logged in once.

There should be ZERO CRM related traffic when:

1. CRM is not logged in
2. Already logged out, or
3. CRM button is disabled in preferences page.

CRM API call are done via CORS JSONP requests now, otherwise we need to explicilty put hardcode 
CRM site (mobilecrm.io) inside manifest.JSON, which seems inconvenient to strict SGN users.

[Incremental permissions](https://developer.chrome.com/docs/extensions/reference/permissions/) seems 
an ideal solution, yet currently it's impossible to open the permission dialog from content script in
Firefox.

CRM has some major advantages over strict SGN:

1. allow team collaboration
2. can view the notes in mobile phone
3. allow multiple comments appended to the note

However, CRM notes will be stored in CRM servers otherwise it's impossible to do things like
team collaboration.

## Cross Browser

So far this exension works on Chrome, Brave, Firefox, Edge and Safari.
