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
    --conference, -c   filter by conference
    --ap               show AP top 25 teams
    --tv               show televised games

	Examples
	  $ cbb --conference big-ten
	  $ cbb --tv
`,
  {
    flags: {
      conference: {
        type: 'string',
        alias: 'c'
      },
      ap: {
        type: 'boolean'
      }
    }
  }
);

const cbb = async flags => {
  const table = new Table({
    head: ['Teams', 'Score'].map(text => clc.bold.magenta(text)),
    colWidths: [20, 20]
  });

  const response = await fetch(
    `https://data.ncaa.com/casablanca/scoreboard/basketball-men/d1/${format(
      new Date(),
      'YYYY/MM/DD'
    )}/scoreboard.json`
  );

  if (response.status >= 400) {
    console.log("\n Couldn't fetch any games.\n");
    return;
  }

  const { games } = await response.json();

  if (!games && !games.length) {
    console.log('\n  No scheduled games for today. :(\n');
    return;
  }

  const formattedGames = games
    .filter(
      game =>
        filterByNetwork(game) &&
        filterByRanking(game) &&
        filterGamesByConference(game)
    )
    .map(formatGameOutput);

  function filterByRanking({ game: { home, away } }) {
    return flags.ap
      ? parseInt(home.rank) <= 25 || parseInt(away.rank) <= 25
      : true;
  }

  function filterGamesByConference({ game: { home, away } }) {
    return (
      !flags.conference ||
      home.conferenceNames.conferenceName.toLowerCase() === flags.conference ||
      home.conferenceNames.conferenceSeo.toLowerCase() === flags.conference ||
      away.conferenceNames.conferenceName.toLowerCase() === flags.conference ||
      away.conferenceNames.conferenceSeo.toLowerCase() === flags.conference
    );
  }

  function filterByNetwork({ game }) {
    return !flags.tv || !!game.network;
  }

  function formatGameOutput({
    game: {
      home,
      away,
      gameState,
      startTimeEpoch,
      contestClock,
      network,
      currentPeriod
    }
  }) {
    const team = isWinner => text => (isWinner ? clc.green.bold(text) : text);
    const ranking = rank => (rank ? `(${rank})` : '');
    const awayTeam = team(away.winner);
    const homeTeam = team(home.winner);

    const details =
      gameState === 'pre'
        ? `${format(parseInt(startTimeEpoch) * 1000, 'h:mm A')} ${network}`
        : `${awayTeam(away.score)}   ${currentPeriod}\n${homeTeam(
            home.score
          )}   ${gameState === 'live' ? contestClock : ''}`;

    return [
      `${awayTeam(
        `${away.names.short} ${ranking(away.seed || away.rank)}`
      )}\n${homeTeam(
        `${home.names.short} ${ranking(home.seed || home.rank)}`
      )}`,
      details
    ];
  }

  table.push(...formattedGames);

  if (!table.length) {
    console.log(`\n  No games scheduled.\n`);
  } else {
    console.log(table.toString());
  }
};

cbb(cli.flags);
