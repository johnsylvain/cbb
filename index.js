#!/usr/bin/env node
'use strict';

const fetch = require('node-fetch')
const clc = require('cli-color')
const Table = require('cli-table')
const { format } = require('date-fns')
const meow = require('meow')

const cli = meow(`
	Usage
	  $ ncaa

	Options
	  --conference, -c  filter by converence

	Examples
	  $ ncaa --conference big-ten
`, {
    flags: {
      conference: {
        type: 'string',
        alias: 'c'
      }
    }
  });

const ncaa = async (flags) => {
  const date = format(new Date(), 'YYYY/MM/DD')
  const table = new Table({
    head: ['Teams', 'Score'].map(text => clc.bold.white(text)),
    colWidths: [20, 20]
  })
  const res = await fetch(`https://data.ncaa.com/casablanca/scoreboard/basketball-men/d1/${date}/scoreboard.json`)
  const { games } = await res.json();

  if (!games && !games.length) {
    console.log('\n  No scheduled games for today. :(\n')
    return
  }

  games
    .filter(({ game }) =>
      !flags.conference ||
      game.home.conferenceNames.conferenceName.toLowerCase() === flags.conference ||
      game.home.conferenceNames.conferenceSeo.toLowerCase() === flags.conference ||
      game.away.conferenceNames.conferenceName.toLowerCase() === flags.conference ||
      game.away.conferenceNames.conferenceSeo.toLowerCase() === flags.conference
    )
    .map(({ game }) => {
      const {
        away,
        home,
        currentPeriod,
        contestClock,
        gameState,
        startTime,
        network
      } = game;

      const team = isWinner => text => isWinner
        ? clc.green.bold(text)
        : text
      const awayTeam = team(away.winner)
      const homeTeam = team(home.winner)
      const details = gameState === 'pre'
        ? `${startTime} ${network}`
        : `${awayTeam(away.score)}   ${currentPeriod}\n${homeTeam(home.score)}   ${
        gameState === 'live' ? contestClock : ''
        }`
      const ranking = rank => rank ? `(${rank})` : '';
      table.push([`${
        awayTeam(`${away.names.short} ${ranking(away.seed || away.rank)}`)
        }\n${
        homeTeam(`${home.names.short} ${ranking(home.seed || home.rank)}`)
        }`, details])
    })

  console.log(table.toString())
}

ncaa(cli.flags)
