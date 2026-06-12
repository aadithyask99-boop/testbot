#!/bin/bash
# Run with: bash curl_commands.sh
# Writes each payload to a temp .json file, then posts with -d @file
# This avoids ALL shell-quoting issues with apostrophes (Trading 212's, etc.)

echo '--- Trading 212 (Cam_03) ---'
curl -s -X POST https://testbot-two-psi.vercel.app/admin/campaign -H "Content-Type: application/json" -d @payload_Cam_03.json | python3 -m json.tool
echo

echo '--- interactive investor ISA (camp_005) ---'
curl -s -X POST https://testbot-two-psi.vercel.app/admin/campaign -H "Content-Type: application/json" -d @payload_camp_005.json | python3 -m json.tool
echo

echo '--- Oppo (Camp_006) ---'
curl -s -X POST https://testbot-two-psi.vercel.app/admin/campaign -H "Content-Type: application/json" -d @payload_Camp_006.json | python3 -m json.tool
echo

echo '--- E*TRADE (Cam_04) ---'
curl -s -X POST https://testbot-two-psi.vercel.app/admin/campaign -H "Content-Type: application/json" -d @payload_Cam_04.json | python3 -m json.tool
echo

echo '--- Smart Pension (Cam_SmarPension) ---'
curl -s -X POST https://testbot-two-psi.vercel.app/admin/campaign -H "Content-Type: application/json" -d @payload_Cam_SmarPension.json | python3 -m json.tool
echo

echo '--- Xiaomi (Cam_Xiaomi) ---'
curl -s -X POST https://testbot-two-psi.vercel.app/admin/campaign -H "Content-Type: application/json" -d @payload_Cam_Xiaomi.json | python3 -m json.tool
echo

echo '--- Moneybox (Cam_02) ---'
curl -s -X POST https://testbot-two-psi.vercel.app/admin/campaign -H "Content-Type: application/json" -d @payload_Cam_02.json | python3 -m json.tool
echo

echo '--- Express VPN (Cam_ExpressVPN) ---'
curl -s -X POST https://testbot-two-psi.vercel.app/admin/campaign -H "Content-Type: application/json" -d @payload_Cam_ExpressVPN.json | python3 -m json.tool
echo

echo '--- NordVPN (Cam_Nord) ---'
curl -s -X POST https://testbot-two-psi.vercel.app/admin/campaign -H "Content-Type: application/json" -d @payload_Cam_Nord.json | python3 -m json.tool
echo

echo '--- Freetrade (Cam_01) ---'
curl -s -X POST https://testbot-two-psi.vercel.app/admin/campaign -H "Content-Type: application/json" -d @payload_Cam_01.json | python3 -m json.tool
echo

