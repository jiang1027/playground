@echo off


curl -X POST "https://qdrant.weifu.heiyu.space/collections/KnoVa_Raw_Pages/points/delete?wait=true" ^
     -H 'Content-Type: application/json' ^
     --data-binary "@qdrant-points-delete.json"


echo.
echo delete points complete.
