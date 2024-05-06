set -x

rm ff-sgn.zip
cd simple-gmail-notes.firefox
#cd simple-gmail-notes.firefox.webextension
#../../clean_up.sh
7za a ff-sgn.zip *

mv ff-sgn.zip ..
cd ..
7za l ff-sgn.zip
