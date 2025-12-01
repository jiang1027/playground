@echo on

curl -X POST "https://qdrant.weifu.heiyu.space/collections/KnoVa_Raw_Pages/points/scroll" ^
     -H 'Content-Type: application/json' ^
     --data-binary "@qdrant-points-scroll.json"

echo.
echo scroll complete.


