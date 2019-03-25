#!/usr/bin/env node
'use strict';

const fetch = require('node-fetch');
const clc = require('cli-color');
const Table = require('cli-table');

const date = '2019/03/24';

(async () => {
  const table = new Table({
    head: [clc.bold.white('Teams'), clc.bold.white('Score')],
    colWidths: [20, 20]
  })
  const res = await fetch(`https://data.ncaa.com/casablanca/scoreboard/basketball-men/d1/${date}/scoreboard.json`)
  const { games } = await res.json();
  games
    .map(({ game }) => {
      const { away, home, currentPeriod, contestClock, gameState } = game;
      const team = isWinner => text => isWinner
        ? clc.green.bold(text)
        : text
      const awayTeam = team(away.winner)
      const homeTeam = team(home.winner)
      const details = gameState === 'pre'
        ? `${game.startTime} ${game.network}`
        : `${awayTeam(away.score)}   ${currentPeriod}\n${homeTeam(home.score)}   ${
        gameState === 'live' ? contestClock : ''
        }`
      table.push([`${awayTeam(away.names.short)}\n${homeTeam(home.names.short)}`, details])
    })
  console.log(table.toString())
})()
