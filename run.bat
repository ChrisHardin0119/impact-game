cd /d "C:\Users\Chris\impact-deploy"
"C:\Program Files\Git\bin\git.exe" log --oneline -5 > "C:\Users\Chris\impact-deploy\git_output.txt" 2>&1
"C:\Program Files\Git\bin\git.exe" status --short >> "C:\Users\Chris\impact-deploy\git_output.txt" 2>&1
"C:\Program Files\Git\bin\git.exe" diff --stat HEAD >> "C:\Users\Chris\impact-deploy\git_output.txt" 2>&1
