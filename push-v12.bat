@echo off
cd /d C:\Users\Chris\impact-deploy
"C:\Program Files\Git\bin\git.exe" add -A > deploy-out2.txt 2>&1
"C:\Program Files\Git\bin\git.exe" status >> deploy-out2.txt 2>&1
"C:\Program Files\Git\bin\git.exe" commit -m "v12: Energy rebalance, 29 achievements, gravity/density UI, Supabase feedback ready" >> deploy-out2.txt 2>&1
"C:\Program Files\Git\bin\git.exe" push origin main >> deploy-out2.txt 2>&1