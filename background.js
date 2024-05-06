// Inject content scripts when the URL matches Gmail or changes within Gmail's single-page interface
let count=0;

function injectContentScripts(tabId,index) {
    // Inject the content scripts into the tab
    chrome.tabs.sendMessage(tabId, { message: 'ScriptsInjected', dataLoaded: true,count:index });
   
}

// // Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Check if the tab has completed loading and if the URL matches Gmail
    if (changeInfo.url && changeInfo.url.includes('https://mail.google.com/')) {
        console.log("I am inside onUpdate")
        console.log(tabId);
        
        injectContentScripts(tabId,count)
        ++count;

    }
});

chrome.runtime.onMessage.addListener(async (req, sender, senderResponse) => {
  


    if (req.message == "log_out") {

        chrome.storage.local.get("auth_token", function (result) {
            var auth_token = result["auth_token"];
            fetch('https://oauth2.googleapis.com/revoke?token=' + auth_token, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            })
                .then(response => {
                    if (response.ok) {
                        console.log("Access token revoked successfully");
                    } else {
                        console.log(response);
                        console.error("Failed to revoke access token:", response.status);
                    }
                })
                .catch(error => {
                    console.error("Error revoking access token:", error.message);
                });
        });
    }

    if (req.message === "auth_code") {
        const redirectUri = chrome.identity.getRedirectURL();
        console.log(redirectUri);

        try {
            function launchAuthorizer() {
                console.log("Trying to login Google Drive.");
                const clientId = "408564813280-vvn4gnid8dfi8miv9ol9ijdms2qgpdrt.apps.googleusercontent.com";
                const scope = "https://www.googleapis.com/auth/drive";
                const queryParams = new URLSearchParams({
                    client_id: clientId,
                    scope: scope,
                    redirect_uri: "https://jfjkcbkgjohminidbpendlodpfacgmlm.chromiumapp.org",
                    response_type: "code",
                    access_type: "offline",
                    prompt: "consent select_account"
                });
                const authUrl = "https://accounts.google.com/o/oauth2/auth?" + queryParams.toString();
chrome.storage.local.remove('auth_token', function() {

                chrome.identity.launchWebAuthFlow(
                    { url: authUrl, interactive: true },
                    function (redirectURL) {
                        console.log(location.href);
                        console.log(redirectURL);
                        handleGoogleAuthCode(redirectURL);
                    }
                );
            }
        
                   ) 
                      
                   
                }
                launchAuthorizer();




        }
        catch (err) {
            console.error(err);
        }
        return true;
    }
    if (req.message === "api_code") {
        chrome.identity.getAuthToken({ interactive: false }, function(token) {
            console.log(token);
            chrome.storage.local.set({ "api_token": token }, function() {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError.message);
                    // Reject the promise with the error
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    // Resolve the promise if token is set successfully
                    resolve();
                }
            });
        });
    }
    



});

function handleGoogleAuthCode(redirectUrl) {
    console.log("Redirect URL:", redirectUrl);
    let code = "";
    if (redirectUrl && redirectUrl.includes("=")) {
        code = redirectUrl.split("=")[1];
        code = code.split("&")[0];
        code = code.replace("%2F", "/");
        code = code.replace(/[#]/g, "");
    }
    if (!code) {

        console.log("Invalid ");
    }
    else {
        // Exchange authorization code for access token
        const clientId = "408564813280-vvn4gnid8dfi8miv9ol9ijdms2qgpdrt.apps.googleusercontent.com";
        const scope = "https://www.googleapis.com/auth/drive";
        const clientSecret = "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";
        const redirectUri = "https://jfjkcbkgjohminidbpendlodpfacgmlm.chromiumapp.org";
        const tokenUrl = "https://oauth2.googleapis.com/token";

        const requestBody = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
            redirect_uri: redirectUri,
            grant_type: "authorization_code"
        });

        fetch(tokenUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: requestBody
        })
            .then(response => response.json())
            .then(async (data) => {
                console.log("Access token:", data.access_token);
                // Use the access token as needed
                await new Promise((resolve, reject) => {
                    chrome.storage.local.set({ "auth_token": data.access_token }, () => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(data.access_token);
                        }
                    });
                })
            
            })
            .catch(error => {
                console.error("Error exchanging authorization code for access token:", error);
            });
    }

}
