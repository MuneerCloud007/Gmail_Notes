set -x
timestamp=$(date +%Y%m%d%H%M%S)

rm -rf *
#rm -rf simple-gmail-notes.chrome
#rm simple-gmail-notes.chrome.*.zip

cp -rf /app/simple-gmail-notes.chrome simple-gmail-notes.chrome.firefox
cd simple-gmail-notes.chrome.firefox
sh ../../clean_up.sh

cd ..

#rm -rf simple-gmail-notes.firefox.webextension
#rm simple-gmail-notes.firefox.*.zip

#cp -rf simple-gmail-notes.chrome simple-gmail-notes.firefox.webextension
#cp -rf simple-gmail-notes.firefox.webextension/firefox-webextension/*.js simple-gmail-notes.firefox.webextension
#rm -rf simple-gmail-notes.firefox.webextension/firefox-webextension
#rm -rf simple-gmail-notes.chrome/firefox-webextension

7za a simple-gmail-notes.chrome.firefox.$timestamp.zip simple-gmail-notes.chrome.firefox
#7za a simple-gmail-notes.firefox.$timestamp.zip simple-gmail-notes.firefox.webextension
