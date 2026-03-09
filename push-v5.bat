@echo off
cd /d C:\Users\Chris\impact-deploy
set GIT_TERMINAL_PROMPT=0
"C:\Program Files\Git\bin\git.exe" add -A > push-log.txt 2>&1
"C:\Program Files\Git\bin\git.exe" commit -m "v5: buy mode fix, tutorial reset fix, mobile text sizing" >> push-log.txt 2>&1
"C:\Program Files\Git\bin\git.exe" -c credential.helper=manager push origin main >> push-log.txt 2>&1
echo EXIT_CODE=%ERRORLEVEL% >> push-log.txt
