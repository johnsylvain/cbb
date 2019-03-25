#!/usr/bin/env node
'use strict';

const fetch = require('node-fetch');
const clc = require('cli-color');
const Table = require('cli-table');
const { format } = require('date-fns');
const meow = require('meow');

const cli = meow(
  `
	Usage
	  $ cbb

	Options
	  --conference, -c  filter by conference

	Examples
	  $ cbb --conference big-ten
`,
  {
    flags: {
      conference: {
        type: 'string',
        alias: 'c'
      }
    }
  }
);

const cbb = async flags => {
  const table = new Table({
    head: ['Teams', 'Score'].map(text => clc.bold.white(text)),
    colWidths: [20, 20]
  });

  const response = await fetch(
    `https://data.ncaa.com/casablanca/scoreboard/basketball-men/d1/${format(
      new Date(),
      'YYYY/MM/DD'
    )}/scoreboard.json`
  );

  if (response.status > 299) {
    console.log("\n Couldn't fetch any games.\n");
    return;
  }

  const { games } = await response.json();

  if (!games && !games.length) {
    console.log('\n  No scheduled games for today. :(\n');
    return;
  }

  const formattedGames = games
    .filter(filterGamesByConference)
    .map(formatGameOutput);

  function filterGamesByConference({ game }) {
    return (
      !flags.conference ||
      game.home.conferenceNames.conferenceName.toLowerCase() ===
        flags.conference ||
      game.home.conferenceNames.conferenceSeo.toLowerCase() ===
        flags.conference ||
      game.away.conferenceNames.conferenceName.toLowerCase() ===
        flags.conference ||
      game.away.conferenceNames.conferenceSeo.toLowerCase() === flags.conference
    );
  }

  function formatGameOutput({ game }) {
    const team = isWinner => text => (isWinner ? clc.green.bold(text) : text);
    const awayTeam = team(game.away.winner);
    const homeTeam = team(game.home.winner);

    const details =
      game.gameState === 'pre'
        ? `${format(parseInt(game.startTimeEpoch) * 1000, 'h:mm A')} ${
            game.network
          }`
        : `${awayTeam(game.away.score)}   ${game.currentPeriod}\n${homeTeam(
            game.home.score
          )}   ${game.gameState === 'live' ? game.contestClock : ''}`;

    const ranking = rank => (rank ? `(${rank})` : '');

    return [
      `${awayTeam(
        `${game.away.names.short} ${ranking(game.away.seed || game.away.rank)}`
      )}\n${homeTeam(
        `${game.home.names.short} ${ranking(game.home.seed || game.home.rank)}`
      )}`,
      details
    ];
  }

  table.push(...formattedGames);

  if (!table.length) {
    console.log(`\n  No games scheduled for ${flags.c}\n`);
  } else {
    console.log(table.toString());
  }
};

cbb(cli.flags);
