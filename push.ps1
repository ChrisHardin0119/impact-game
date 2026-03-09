Set-Location "C:\Users\Chris\impact-deploy"
& "C:\Program Files\Git\cmd\git.exe" push -u origin main --force 2>&1 | Out-File "C:\Users\Chris\impact-deploy\push-output.txt" -Encoding ascii
