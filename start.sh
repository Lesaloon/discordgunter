#!/usr/bin/env bash
cd /discordbot/discordgunter
while 1; do
	node server.js
	git pull
done