@echo on

curl -X PUT "https://qdrant.weifu.heiyu.space/collections/KnoVa_Raw_Pages/points?wait=true" ^
     -H 'Content-Type: application/json' ^
     --data-binary "@qdrant-points-test.json"

echo.
echo Upsert complete.


