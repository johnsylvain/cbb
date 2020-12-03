#!/usr/bin/env node
'use strict';

const fetch = require('node-fetch');
const clc = require('cli-color');
const Table = require('cli-table');
const { format } = require('date-fns');
const meow = require('meow');
const inquirer = require('inquirer');
const clear = require('clear');

const cli = meow(
  `
  Usage
    $ cbb

  Options
    --conference, -c   filter by conference
    --ap               show AP top 25 teams
    --name             filter by team name

  Commands
    $ cbb              list games/scores
    $ cbb watch        watch game live

  Examples
    $ cbb --conference big-ten
    $ cbb --ap
    $ cbb --name purdue
`,
  {
    flags: {
      conference: {
        type: 'string',
        alias: 'c'
      },
      ap: {
        type: 'boolean'
      },
      name: {
        type: 'string',
        alias: 'n'
      }
    }
  }
);

const watchGame = async () => {
  const response = await fetch(
    `https://data.ncaa.com/casablanca/scoreboard/basketball-men/d1/${format(
      new Date(),
      'YYYY/MM/DD'
    )}/scoreboard.json`
  );
  const { games } = await response.json();
  const choices = games
    .filter(game => {
      return game.game.gameState === 'live';
    })
    .map(game => {
      return {
        value: game.game.url.split('/')[2],
        name: `${game.game.away.names.short} vs ${game.game.home.names.short}`
      };
    });

  if (!choices.length) {
    console.log('\n\tThere are no live games right now.');
    return;
  }

  const prompt = await inquirer.prompt([
    {
      type: 'list',
      name: 'game',
      message: 'What game do you want to watch?',
      choices
    }
  ]);

  const url = `https://data.ncaa.com/casablanca/game/${
    prompt.game
    // 5761249
  }/gameInfo.json`;

  const createTable = async () => {
    const res = await fetch(url);
    const game = await res.json();
    clear();
    const table = new Table();
    table.push([
      `${clc.bold(game.away.score)}\n${game.away.names.short} ${
        game.away.record
      }`,
      `${clc.bold(game.home.score)}\n${game.home.names.short} ${
        game.home.record
      }`
    ]);
    table.push([
      game.status.clock
        ? `${clc.yellow.bold(game.status.clock)}`
        : clc.bold(game.status.finalMessage),
      game.status.clock
        ? `${clc.yellow.bold(game.status.finalMessage)}`
        : clc.bold(game.status.finalMessage)
    ]);
    console.log(table.toString());
    if (game.status.finalMessage === 'FINAL') {
      return true;
    }
  };

  poll(async stop => {
    const shouldStop = await createTable();
    if (shouldStop) {
      stop();
    }
  }, 5000);
  createTable();
};

const poll = (cb, interval) => {
  const id = setInterval(() => cb(() => clearInterval(id)), interval);
  return () => clearInterval(id);
};

const cbb = async (flags, input) => {
  if (input === 'watch') {
    await watchGame();
    return;
  }

  const table = new Table({
    head: ['Teams', 'Score'].map(text => clc.bold.magenta(text))
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

  if (flags.conference === '') {
    const conferences = games.reduce((acc, { game }) => {
      const home = game.home.conferences[0].conferenceSeo;
      const away = game.away.conferences[0].conferenceSeo;

      return {
        ...acc,
        [home]: true,
        [away]: true
      };
    }, {});
    console.log(
      `\nPlease specify a conference: \n\n${Object.keys(conferences)
        .sort()
        .join('\n')}`
    );
    return;
  }

  const formattedGames = games
    .filter(
      game =>
        filterByName(game) &&
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
    const predicate = conference =>
      conference.conferenceSeo.toLowerCase() === flags.conference ||
      conference.conferenceSeo.toLowerCase() === flags.conference;

    return (
      !flags.conference ||
      home.conferences.some(predicate) ||
      away.conferences.some(predicate)
    );
  }

  function filterByName({ game }) {
    const match = team =>
      team.names.full.toLowerCase().includes(flags.name.toLowerCase());
    return !flags.name || match(game.home) || match(game.away);
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
        : `${awayTeam(away.score)}   ${currentPeriod}${network &&
            ` - ${network}`}\n${homeTeam(home.score)}   ${
            gameState === 'live' ? contestClock : ''
          }`;

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

cbb(cli.flags, cli.input[0]);
