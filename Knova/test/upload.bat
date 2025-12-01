@echo off

if "%1"=="" (
    echo Usage: upload.bat ^<path_to_json_file^>
    exit /b 1
)

curl -X POST -H "Content-Type: application/json" --data-binary "@%1" "https://n8n.weifu.heiyu.space/webhook-test/knova-upload"

echo.
echo Upload complete.

