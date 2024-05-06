# make pk7zip and jq are installed
# brew install p7zip
# brew install jq

set -x
timestamp=$(date +%Y%m%d%H%M%S)

rm -rf simple-gmail-notes.firefox simple-gmail-notes.chrome simple-gmail-notes.chrome.production simple-gmail-notes.firefox.production simple-gmail-notes.chrome.preview simple-gmail-notes.chrome.appstore-preview simple-gmail-notes.chrome.naihbr-crm simple-gmail-notes.naihbr-crm-appstore-preview simple-gmail-notes.firefox.appstore-preview simple-gmail-notes.edge.production

# cp -rf ~/app/simple-gmail-notes.chrome simple-gmail-notes.chrome
rsync -av --progress ~/app/simple-gmail-notes.chrome .  --exclude=.git

cp -rf simple-gmail-notes.chrome simple-gmail-notes.chrome.production
cd simple-gmail-notes.chrome.production
jq '.optional_permissions = ["https://portal.simplegmailnotes.com/*"]' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
jq '.externally_connectable = {"matches": ["https://portal.simplegmailnotes.com/*"]}' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
sed -i.bak "s/IS_DEBUG:.*/IS_DEBUG: false,/" settings.js
sed -i.bak "s/NOTIFICATION_DURATION:.*,/NOTIFICATION_DURATION: 5 \* 24 \* 60 \* 60,/" settings.js
sed -i.bak "s/CLIENT_ID: .*/CLIENT_ID: \"38131814991-p4u809qrr5ee1bsehregd4os69jf2n7i.apps.googleusercontent.com\",/" settings.js
sed -i.bak "s/CLIENT_SECRET: .*/CLIENT_SECRET: \"mdA0U_jSkAjI_1x8pdgtrx02\",/" settings.js
sed -i.bak "s/CRM_BASE_URL: .*/CRM_BASE_URL: \"https:\/\/sgn.mobilecrm.io\",/" settings.js
sed -i.bak "s/CRM_API_BASE_URL: .*/CRM_API_BASE_URL: \"https:\/\/sgn.mobilecrm.io\",/" settings.js
sed -i.bak "s/SGN_WEB_LOGIN_BASE_URL: .*/SGN_WEB_LOGIN_BASE_URL: \"https:\/\/app.simplegmailnotes.com\",/" settings.js
sed -i.bak "s/SUBSCRIBER_PORTAL_BASE_URL: .*/SUBSCRIBER_PORTAL_BASE_URL: \"https:\/\/portal.simplegmailnotes.com\/\",/" settings.js
rm *.bak
cd ..


SAFARI_DIR="$HOME/app/simple-gmail-notes-safari"
if [ -d "$SAFARI_DIR" ]; then
    rsync -avz simple-gmail-notes.chrome.production ~/app/simple-gmail-notes-safari/release.apple/
    cd ~/app/simple-gmail-notes-safari/release.apple/simple-gmail-notes.chrome.production
    sed -i.bak "s/SHOW_SUBSCRIBER_OPTIONS:.*,/SHOW_SUBSCRIBER_OPTIONS: true,/" settings.js
    sed -i.bak "s/SHOW_SUBSCRIPTION_URGE:.*,/SHOW_SUBSCRIPTION_URGE: false,/" settings.js
    sed -i.bak "s/Simple Gmail Notes/Simple Notes for Gmail/" background.js
    sed -i.bak "s/\"value\": \"Simple Notes for Gmail\"/\"value\": \"Simple Gmail Notes\"/" background.js
    sed -i.bak "s/Simple Gmail Notes/Simple Notes for Gmail/" manifest.json
    sed -i.bak "s/BROWSER_NAME: .*/BROWSER_NAME: \"safari\",/" settings.js
    #sed -i.bak "s/SHOW_REVIEW_URL:.*,/SHOW_REVIEW_URL: false,/" settings.js
    sh ~/app/simple-gmail-notes.releases/clean_up.sh
else
    echo "Warning, safari extension will not be generated because corresponding folder is not found!"
fi
