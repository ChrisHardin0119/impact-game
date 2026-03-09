@echo off
cd /d C:\Users\Chris\impact-deploy
"C:\Program Files\Git\bin\git.exe" add -A
"C:\Program Files\Git\bin\git.exe" commit -m "v5: buy mode fix, tutorial reset fix, mobile text sizing"
"C:\Program Files\Git\bin\git.exe" push origin main
echo DONE > push-result.txt
