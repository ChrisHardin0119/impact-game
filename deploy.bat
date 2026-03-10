@echo off
cd /d "C:\Users\Chris\impact-deploy"
"C:\Program Files\Git\bin\git.exe" add -A
"C:\Program Files\Git\bin\git.exe" status > "C:\Users\Chris\impact-deploy\gitlog.txt" 2>&1
"C:\Program Files\Git\bin\git.exe" commit --allow-empty -m "v12.1: Fix tutorial text, force redeploy" >> "C:\Users\Chris\impact-deploy\gitlog.txt" 2>&1
"C:\Program Files\Git\bin\git.exe" push origin main >> "C:\Users\Chris\impact-deploy\gitlog.txt" 2>&1
echo DONE >> "C:\Users\Chris\impact-deploy\gitlog.txt"
