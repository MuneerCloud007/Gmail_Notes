# make pk7zip and jq are installed
# brew install p7zip
# brew install jq

set -x
timestamp=$(date +%Y%m%d%H%M%S)

rm -rf simple-gmail-notes.firefox simple-gmail-notes.chrome simple-gmail-notes.chrome.production simple-gmail-notes.firefox.production simple-gmail-notes.chrome.preview simple-gmail-notes.chrome.appstore-preview simple-gmail-notes.chrome.naihbr-crm simple-gmail-notes.naihbr-crm-appstore-preview simple-gmail-notes.firefox.appstore-preview simple-gmail-notes.edge.production

# cp -rf ~/app/simple-gmail-notes.chrome simple-gmail-notes.chrome
rsync -av --progress ~/app/simple-gmail-notes.chrome .  --exclude=.git

cd simple-gmail-notes.chrome
jq '.optional_permissions = ["https://portal-dev.simplegmailnotes.com:443/*"]' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
jq '.externally_connectable = {"matches": ["https://portal-dev.simplegmailnotes.com:443/*"]}' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
sed -i.bak "s/CRM_BASE_URL: .*/CRM_BASE_URL: \"https:\/\/dev.mobilecrm.io:553\",/" settings.js
sed -i.bak "s/CRM_API_BASE_URL: .*/CRM_API_BASE_URL: \"https:\/\/dev.mobilecrm.io:553\",/" settings.js
sed -i.bak "s/SGN_WEB_LOGIN_BASE_URL: .*/SGN_WEB_LOGIN_BASE_URL: \"https:\/\/dev.mobilecrm.io:553\",/" settings.js
sed -i.bak "s/SUBSCRIBER_PORTAL_BASE_URL: .*/SUBSCRIBER_PORTAL_BASE_URL: \"https:\/\/portal-dev.simplegmailnotes.com:443\/\",/" settings.js
sed -i.bak "s/BROWSER_NAME: .*/BROWSER_NAME: \"chrome\",/" settings.js
sh ../../clean_up.sh
cd ..


cp -rf simple-gmail-notes.chrome simple-gmail-notes.firefox
cp -rf simple-gmail-notes.chrome simple-gmail-notes.chrome.preview
#cp -rf simple-gmail-notes.chrome simple-gmail-notes.chrome.naihbr-crm

cp -rf simple-gmail-notes.chrome simple-gmail-notes.chrome.production
cd simple-gmail-notes.chrome.production
jq '.optional_permissions = ["https://portal.simplegmailnotes.com/*"]' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
jq '.externally_connectable = {"matches": ["https://portal.simplegmailnotes.com/*"]}' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
sed -i.bak "s/IS_DEBUG:.*/IS_DEBUG: false,/" settings.js
sed -i.bak "s/NOTIFICATION_DURATION:.*,/NOTIFICATION_DURATION: 3 \* 24 \* 60 \* 60,/" settings.js
sed -i.bak "s/CLIENT_ID: .*/CLIENT_ID: \"38131814991-p4u809qrr5ee1bsehregd4os69jf2n7i.apps.googleusercontent.com\",/" settings.js
sed -i.bak "s/CLIENT_SECRET: .*/CLIENT_SECRET: \"mdA0U_jSkAjI_1x8pdgtrx02\",/" settings.js
sed -i.bak "s/CRM_BASE_URL: .*/CRM_BASE_URL: \"https:\/\/sgn.mobilecrm.io\",/" settings.js
sed -i.bak "s/CRM_API_BASE_URL: .*/CRM_API_BASE_URL: \"https:\/\/sgn.mobilecrm.io\",/" settings.js
sed -i.bak "s/SGN_WEB_LOGIN_BASE_URL: .*/SGN_WEB_LOGIN_BASE_URL: \"https:\/\/app.simplegmailnotes.com\",/" settings.js
sed -i.bak "s/SUBSCRIBER_PORTAL_BASE_URL: .*/SUBSCRIBER_PORTAL_BASE_URL: \"https:\/\/portal.simplegmailnotes.com\/\",/" settings.js
rm *.bak
cd ..

cp -rf simple-gmail-notes.chrome.production simple-gmail-notes.chrome.appstore-preview
cp -rf simple-gmail-notes.chrome.production simple-gmail-notes.firefox.appstore-preview
#cp -rf simple-gmail-notes.chrome.production simple-gmail-notes.chrome.naihbr-crm-appstore-preview

#exit 1

#cp -rf ~/app/simple-gmail-notes.chrome simple-gmail-notes.chrome.production
cd simple-gmail-notes.firefox
version=$(cat manifest.json | jq '.version')
version="${version%\"}"
version="${version#\"}"
jq 'del(.options_page)' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
jq '.options_ui = {"page": "options.html"}' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
jq 'del(.key)' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
jq 'del(.key)' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
sed -i.bak "s/BROWSER_NAME: .*/BROWSER_NAME: \"firefox\",/" settings.js
#sed -i.bak "s/https:\/\/.*:553/https:\/\/dev.mobilecrm.io:553/" common/shared-common.js
sh ../../clean_up.sh
cd ..

cd simple-gmail-notes.firefox.appstore-preview
#sed -i.bak "s/https:\/\/.*:553/https:\/\/sgn.mobilecrm.io/" common/shared-common.js
jq '.name = "Simple Gmail Notes"' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
sed -i.bak "s/BROWSER_NAME: .*/BROWSER_NAME: \"firefox\",/" settings.js
sh ../../clean_up.sh
cd ..

cp -rf simple-gmail-notes.firefox.appstore-preview simple-gmail-notes.firefox.production
cd simple-gmail-notes.firefox.production
#sed -i.bak "s/https:\/\/.*:553/https:\/\/sgn.mobilecrm.io/" common/shared-common.js
jq 'del(.applications.gecko.id)' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
jq '.name = "Simple Gmail Notes"' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
sed -i.bak "s/BROWSER_NAME: .*/BROWSER_NAME: \"firefox\",/" settings.js
sh ../../clean_up.sh
cd ..

cp -rf simple-gmail-notes.firefox.production simple-gmail-notes.edge.production
cd simple-gmail-notes.edge.production
jq 'del(.applications)' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
jq 'del(.key)' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
jq '.name = "Simple Gmail Notes"' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
# sed -i.bak "s/SHOW_SUBSCRIBER_OPTIONS:.*,/SHOW_SUBSCRIBER_OPTIONS: false,/" settings.js
sed -i.bak "s/BROWSER_NAME: .*/BROWSER_NAME: \"edge\",/" settings.js
#delete all locales except en
#mv _locales/en .
#rm -rf _locales/*
#mv en _locales/

cd simple-gmail-notes.chrome
#jq 'del(.options_ui)' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
jq 'del(.applications)' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
sh ../../clean_up.sh
cd ..

cd simple-gmail-notes.chrome.preview
jq 'del(.options_ui)' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
jq 'del(.applications)' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
jq '.key = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAiXPVkqbHbhaJU5Bh+oo/kCfiL81sWSg31Xe1QhoPh2RVVslGFT0Bj67uE60vU/m8YBQ+dYAwPfWxKywkMlrYWBofZ/yz9GB9CZbA0EaF8x0R1XmUp7s46DOVqvPgki18t5zpfiasXbt9e081E+OpvH5EGWq0UDtyBtyU/KyxQoHNyzlnGk8ShIkuMp3ugKr8ZYsYAIpet/Y0I7Jdek4gQx1WWN5vZrpcU3thTTchUc/t0yqzpQa5NVGteRkbvvSNuruZJEnJa0moj+gUzt4U2dos48TdGU8+oOlo9de6HC+unupkry8/WRbbHt7bXjKLR5V7mfd0idb2ONKqVYTmrQIDAQAB"' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
#sed -i.bak "s/https:\/\/.*:553/https:\/\/dev.mobilecrm.io:553/" common/shared-common.js
jq '.name = "Simple Gmail Notes (Preview)"' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
sh ../../clean_up.sh
cd ..

cd simple-gmail-notes.chrome.appstore-preview
jq 'del(.options_ui)' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
jq 'del(.applications)' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
jq '.key = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnQKQlvU0mBOqh5XCvmPw/9EH7zTrygzzPxdb7V4uK6fY4nEpvH5HR7n0hrHHgEWycAIW2Df8nBRqrBpi0XdpDKyAiNBs9NU5mFfNZmpSEPe5IpAEk6JalmLwg9x7kEaQ5rCK5uW5k+/g+P1swvZiGcy7J1LF58tbaFDxtsPNvSK8sE/XJXevv5cJuUQjYmsAqVLdXZnjnogTjD7EDDTS9gEZtu6W8tyCoyVEGSXCJqC8QEtKQRN8EY6Ezm3CflYfKd+Daxiyhq8MJp/pSwnxlYPkjFX+1/gocWTfzzKSB7eXAinNqrgJN6jw3X/ntO+tCs+MpnZ2wb5EOsw0E2q4ZwIDAQAB"' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
#sed -i.bak "s/https:\/\/.*:553/https:\/\/sgn.mobilecrm.io/" common/shared-common.js
jq '.name = "Simple Gmail Notes (AppStore Preview)"' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
sh ../../clean_up.sh
cd ..

cd simple-gmail-notes.chrome.production
jq 'del(.options_ui)' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
jq 'del(.applications)' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
jq '.key = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAgyUBS53d5P2ograP4JKK656jrrauipHsAdgcTZyL1j5MKBMD4yBmHl9BcmS+sfhmOE5fS38ng7XRZIErp8SrWbJwwstMWx+FTDKlrFS3J5so85CgOpRNge+Ge8UyhxAkPB7zui1AU3wD/XieaGN2L9pmT4MN1u6pPs2Lf/8i96Vp8YjUKaKIWmevKeqsGr1HNHZt41/dcBBIr6vW6OoWlViI1bae+p4Cv6VertdadkuW4hc7z8jVrlC0Lyu43oETmXWflUhw/hCctktI+KwJNk47Pm9vX2Bgw7EdovukrYPV+iNzzE49jirbQkZvMGuNV3fA+NbUwmo7c9dypCAweQIDAQAB"' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
jq '.name = "Simple Gmail Notes"' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
sh ../../clean_up.sh
cd ..

cp -rf simple-gmail-notes.firefox.production/* ../github/simple-gmail-notes.chrome/

7za a simple-gmail-notes.$version.firefox.$timestamp.zip simple-gmail-notes.firefox
7za a simple-gmail-notes.$version.firefox.appstore-preview.$timestamp.zip simple-gmail-notes.firefox.appstore-preview

7za a simple-gmail-notes.$version.chrome.$timestamp.zip simple-gmail-notes.chrome
7za a simple-gmail-notes.$version.chrome.production.$timestamp.zip simple-gmail-notes.chrome.production
7za a simple-gmail-notes.$version.chrome.preview.$timestamp.zip simple-gmail-notes.chrome.preview
7za a simple-gmail-notes.$version.chrome.appstore-preview.$timestamp.zip simple-gmail-notes.chrome.appstore-preview

#7za a simple-gmail-notes.$version.chrome.naihbr-crm.$timestamp.zip simple-gmail-notes.chrome.naihbr-crm
#7za a simple-gmail-notes.$version.chrome.naihbr-crm-appstore-preview.$timestamp.zip simple-gmail-notes.chrome.naihbr-crm-appstore-preview

#firefox production zip is a bit special
cd simple-gmail-notes.firefox.production
7za a simple-gmail-notes.$version.firefox.production.$timestamp.zip *
mv simple-gmail-notes.$version.firefox.production.$timestamp.zip ..
cd ..

cd simple-gmail-notes.edge.production
7za a simple-gmail-notes.$version.edge.production.$timestamp.zip *
mv simple-gmail-notes.$version.edge.production.$timestamp.zip ..
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
    sed -i.bak "s/jQuery.noConflict(true)/jQuery/" page.js
    jq '.content_scripts[0].js += [
        "lib/lru.js",
        "settings.js",
        "common/gmail-sgn-page.js",
        "common/gmail-sgn-dom.js",
        "page.js"
    ]' manifest.json > tmp.$$.json && mv tmp.$$.json manifest.json
    #sed -i.bak "s/SHOW_REVIEW_URL:.*,/SHOW_REVIEW_URL: false,/" settings.js
    sh ~/app/simple-gmail-notes.releases/clean_up.sh
else
    echo "Warning, safari extension will not be generated because corresponding folder is not found!"
fi
