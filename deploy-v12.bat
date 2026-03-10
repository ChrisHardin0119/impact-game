@echo off
cd /d C:\Users\Chris\impact-deploy

REM Copy source files from impact-source (excluding android, node_modules, out, .next, package.json)
robocopy "C:\Users\Chris\CLAUDE OVERWORLD\impact-source\app" "C:\Users\Chris\impact-deploy\app" /MIR /NFL /NDL /NJH /NJS
robocopy "C:\Users\Chris\CLAUDE OVERWORLD\impact-source\lib" "C:\Users\Chris\impact-deploy\lib" /MIR /NFL /NDL /NJH /NJS
robocopy "C:\Users\Chris\CLAUDE OVERWORLD\impact-source\hooks" "C:\Users\Chris\impact-deploy\hooks" /MIR /NFL /NDL /NJH /NJS
robocopy "C:\Users\Chris\CLAUDE OVERWORLD\impact-source\components" "C:\Users\Chris\impact-deploy\components" /MIR /NFL /NDL /NJH /NJS
robocopy "C:\Users\Chris\CLAUDE OVERWORLD\impact-source\public" "C:\Users\Chris\impact-deploy\public" /MIR /NFL /NDL /NJH /NJS

REM Copy config files (but NOT package.json - keep deploy version)
copy /Y "C:\Users\Chris\CLAUDE OVERWORLD\impact-source\next.config.ts" "C:\Users\Chris\impact-deploy\next.config.ts"
copy /Y "C:\Users\Chris\CLAUDE OVERWORLD\impact-source\tsconfig.json" "C:\Users\Chris\impact-deploy\tsconfig.json"
copy /Y "C:\Users\Chris\CLAUDE OVERWORLD\impact-source\postcss.config.mjs" "C:\Users\Chris\impact-deploy\postcss.config.mjs"

REM Git add, commit, push
"C:\Program Files\Git\bin\git.exe" add -A
"C:\Program Files\Git\bin\git.exe" status
"C:\Program Files\Git\bin\git.exe" commit -m "v12: Energy rebalance, 29 achievements, gravity/density UI, Supabase feedback"
"C:\Program Files\Git\bin\git.exe" push origin main