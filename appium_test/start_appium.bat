@echo off

REM --relaxed-security enables certain Appium features that are disabled by default for security reasons.
REM --use-plugins=inspector enables the Appium Inspector plugin for inspecting app elements.
REM --allow-cors allows cross-origin requests to the Appium server.

appium --relaxed-security --use-plugins=inspector --allow-cors

