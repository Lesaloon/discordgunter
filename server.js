#!/usr/bin/env node
"use strict";
// this is a discord bot
// this bot is a bot that is used by authors to help them with their writing
// authors can use the command /start [in (time in minutes)] [of (time in minutes)] to start a writing session
// authors can join the session by using the command /join
// authors can leave the session by using the command /leave
// once the session start all the authors that joined will be notified
// when the session ends all the authors that joined will be notified and asked to submit the word count that they wrote during the session
// the bot will then make a leaderboard of the authors and their word count

// import the discord.js module
const { REST, Routes, PermissionsBitField } = require('discord.js');
const env = require('dotenv').config();
// the token of your bot - https://discordapp.com/developers/applications/me
// the prefix for the bot
let session = false; // if there is a session going on
let sessionInCountdown = false; // if the session is in the countdown
let submitTime = false; // if the time to submit the word count has started
let sessionTime = 0; // the time in minutes that the session will last
let sessionAuthors = []; // a list of the authors that joined the session
let words = {}; // a dictionary of the authors and their word count
let currentTimeout = null; // the current timeout that is running

const clamp = function(value, min, max) {
	return Math.min(Math.max(value, min), max);
};

const MINCOUNTDOWN = 2; // the minimum time in minutes that the countdown can be
const MAXCOUNTDOWN = 10; // the maximum time in minutes that the countdown can be
const MINSESSION = 15; // the minimum time in minutes that the session can be
const MAXSESSION = 10*60; // the maximum time in minutes that the session can be
const SUBMITCOUNTDOWN = 5; // the time in minutes that the bot will wait before asking the authors to submit their word count
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_APP_ID;
const NOTIF_ROLE = "<@&1075905783306408039> "; // the role that will be pinged when a session starts do not forget the space at the end
const CHANNEL_ID = "1061343432594948176"
// the bot lines of text
const botLines = {
    "START_SESSION": [
        "Une session d'écriture va commencer %s minutes pour %s minutes",
        "Dacodac, une session d'écriture va commencer %s minutes pour %s minutes",
        "Et voilà, une session d'écriture va commencer %s minutes pour %s minutes",
        "Range ton bureau, on commence la session d'écriture %s minutes pour %s minutes",
        "T'es prêt ? T'es prêt ? T'es prêt ? Ben attends, la session d'écriture ne commence que %s minutes ! Et elle durera %s minutes !",
        "On attend les carvilloux, et on lance la session d'écriture %s minutes pour %s minutes",
    ],
    "SESSION_STARTED": [
        "Ici, pas de page blanche : écris ce que tu as sur le cœur, dans les tripes, dans la tête ! Go, la session a commencé ! Elle finira %s !",
        "La session d'écriture a commencé, bon courage. Elle finira %s !",
        "La session d'écriture a commencé, bonne chance. Elle finira %s !",
        "Vas-y, fonce Alphonse ! La session a commencé. Elle finira %s !",
        "Allez, arrête de chouiner : t'es pas si nul.le que tu crois ! Choppe ton clavier et mets-toi à écrire, maintenant ! Elle finira %s !",
        "Dis, c'est le moment d'écrire : tu la sens ma grosse inspiration ? Elle finira %s !"
    ],
    "SESSION_ALREADY_STARTED": [
        "Une session d'écriture est déjà en cours, vous ne pouvez pas en démarrer une autre, attendez que la session actuelle se termine",
    ],
    "SESSION_ENDED": [
        "La session d'écriture est terminée",
        "La session d'écriture est terminée, merci d'avoir participé, vous avez tous été fantastiques",
        "Pose douuuuucement ce stylo sur ton bureau et lève les mains ! La session d'écriture est terminée.",
        "La session d'écriture est terminée : tu veux un mouchoir ?",
        "Allez, on s'est fait plaisir, mais toutes les bonnes choses ont une fin... et c'est le cas pour cette session d'écriture.",
        "Session d'écriture finie ! Alors, heureux.se ?"
    ],
    "SESSION_JOINED": [
        "%s a rejoint la session d'écriture, bonne chance",
        "%s rejoint la session d'écriture. Il est un peu bruyant en s'installant à son bureau, vous ne trouvez pas ?",
        "%s a le courage de rejoindre la session d'écriture en cours. Accueillez-le comme il se doit !",
        "%s vient vous rejoindre, et il paraît qu'il a des chocolats... #jefousmamerde",
        "Putain, mais c'est à cette heure-là que t'arrives %s ?! Dépêche-toi de te mettre à écrire !"
    ],
    "ALREADY_IN_SESSION": [
        "Vous êtes déjà dans une session d'écriture"
    ],
	"NOT_IN_SESSION": [
		"Vous n'êtes pas dans la session d'écriture ou il n'y a pas de session d'écriture en cours"
	],
	"NOT_SUBMIT_TIME": [
		"Ce n'est pas encore le moment d'envoyer ton nombre de mots, un peu de patience !!"
	],
	"NO_SESSION": [
		"Il n'y a pas de session d'écriture en cours"
	],
	"WORDS_SUBMITTED": [
		"Tu as écrit %s mots : ah, tu vois que tu pouvais le faire !",
		"Tu as écrit %s mots : bien joué !",
		"Dis donc tu as écrit %s mots : je suis scotché !"
	],
	"SESSION_LEFT": [
		"Tu nous quittes déjà",
		"Bah, c'est quoi ça ? Tu pars où ?",
		"Hé !! Tu reviens bientôt, hein ?",
		"Allez, des bisous (même si tu ne le mérites pas !)"
	],
	"SESSION_STOPPED": [
		"La session d'écriture a été stoppée"
	],
	"NOT_ADMIN": [
		"Vous n'avez pas les droits pour faire ça"
	],
}

const commands = [
	{
		name: 'ping',
		description: 'Répond pong!',
	},
	{
		name: 'session',
		description: 'Démarre une session d\'écriture',
		options: [
			{
				name: 'dans',
				description: 'Le temps avant que la session commence',
				type: 4,
				required: true,
			},
			{
				name: 'pour',
				description: 'Le temps que la session durera',
				type: 4,
				required: true,
			},
		],
	},
	{
		name: 'join',
		description: 'Rejoint une session d\'écriture',
	},
	{
		name: 'leave',
		description: 'Quite une session d\'écriture',
	},
	{
		name: 'mots',
		description: 'Soumet le nombre de mots que vous avez écrit pendant la session',
		options: [
			{
				name: 'nombre',
				description: 'Le nombre de mots que vous avez écrit pendant la session',
				type: 4,
				required: true,
			},
		],
	},
	{
		name: 'stop',
		description: 'Arrête la session d\'écriture en cours',
	},
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
	console.log('Started refreshing application (/) commands.');

	await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

	console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
	console.error(error);
  }
})();

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}
function getRandomLine(lines) {
	return lines[getRandomInt(lines.length)];
}
function notifAuthor() {
	let msg = ""
	for (let e of sessionAuthors) {
		msg += `${e}, `
	}
	return msg
}

function genTime(time) {
	// renvoie le temps en minutes sous la forme d'une string discord
	// la string discord est de la forme <t:temps:R>
	// elle sera visualisée par discord comme un temps restant
	// exemple : <t:1620000000:R> sera affiché comme "dans 3 jours"
	return `<t:${Math.floor(Date.now() / 1000) + time * 60}:R>`
}

async function startingSession(interaction) {
	// get the time in minutes that the session will last
	sessionTime = interaction.options.get('pour').value;
	// get the time in minutes before the session starts
	let countdownTime = interaction.options.get('dans').value;
	// if the countdown time is less than 2 minute
	countdownTime = clamp(countdownTime, MINCOUNTDOWN, MAXCOUNTDOWN);
	// if the session time is less than 15 minute
	sessionTime = clamp(sessionTime, MINSESSION, MAXSESSION);
	// set the session in countdown to true
	sessionInCountdown = true;
	// send a message to the channel
	await interaction.reply(NOTIF_ROLE + getRandomLine(botLines["START_SESSION"]).replace("%s", genTime(countdownTime)).replace("%s", sessionTime));

	// make the user join the session
	sessionAuthors.push(interaction.user);

	// set the session timer
	currentTimeout = setTimeout( startgSession(interaction),
		countdownTime * 60000); // convert the countdown time to milliseconds
}
function startgSession(interaction){
	// set the session in countdown to false
	sessionInCountdown = false;
	// set the session to true
	session = true;
	// send a message to the channel
	interaction.channel.send(notifAuthor() + getRandomLine(botLines["SESSION_STARTED"]).replace("%s", genTime(sessionTime)));
	// set the session timer
	currentTimeout = setTimeout( endingSession(interaction)
		, sessionTime * 60000); // convert the session time to milliseconds
}
function endingSession(interaction){
	// set the session to false
	session = false;
	// send a message to the channel
	interaction.channel.send(notifAuthor() + getRandomLine(botLines["SESSION_ENDED"]));
	interaction.channel.send(`le temps pour soumettre votre nombre de mots se finira ${genTime(SUBMITCOUNTDOWN)}, pour me dire combien de mots vous avez écrit en utilisant la commande /mots`);
	submitTime = true

	currentTimeout = setTimeout( endingSubmitTime(interaction)
		, SUBMITCOUNTDOWN*60000); // convert the session time to milliseconds
}
function endingSubmitTime(interaction){
	// set the submit time to false
	submitTime = false;

	// if there are more than 2 authors
	console.log(words.length);
	if (words.length > 1) {
		// get podium
		let podium = []
		for (let [key, value] of words) {
			podium.push([key, value])
		}
		podium.sort((a, b) => b[1] - a[1])

		let msg = ` :trophy: **Podium** :trophy: \n\n`
		// if there are more than 3 authors in the session make the podium of 3 if not make it of the number of authors
		let numberOfpodium = podium.length;
		for (let i = 0; i < numberOfpodium; i++) {
			msg += `**${i + 1}** - ${podium[i][0]} : ${podium[i][1]} mots \n`
		}
		// send a message to the channel
		interaction.channel.send(NOTIF_ROLE + msg);
	} else {
		// send a message to the channel
		interaction.channel.send(`Pas assez de participants pour faire un podium`);
	}
	// reset the sessionAuthors array
	sessionAuthors = [];
	// reset the words array
	words = new Map();
}
const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on('interactionCreate', async interaction => {
	// only listen to commands that are in the channel
	if (interaction.channelId !== CHANNEL_ID) { return; }


	if (interaction.commandName === 'ping') {
		await interaction.reply('Pong!');
	}
	else if (interaction.commandName === 'session') {
		// if there is already a session going on
		if (session || sessionInCountdown || submitTime) {
			await interaction.reply(getRandomLine(botLines["SESSION_ALREADY_STARTED"]));
		}
		// if there is no session going on
		else {
			await startingSession(interaction);
		}
	}
	else if (interaction.commandName === 'join') {
		// you can only join a session if its on the countdown or if its already started
		if (sessionInCountdown || session) {
			// if the user is already in the sessionAuthors array
			if (sessionAuthors.includes(interaction.user)) {
				// send a message to the channel
				await interaction.reply(getRandomLine(botLines["ALREADY_IN_SESSION"]));
			}
			// if the user is not in the sessionAuthors array
			else {
				// add the user to the sessionAuthors array
				sessionAuthors.push(interaction.user);
				// send a message to the channel
				await interaction.reply(getRandomLine(botLines["SESSION_JOINED"]).replace("%s",`${interaction.user}`));
			}
		} else {
			// send a message to the channel
			await interaction.reply(getRandomLine(botLines["NO_SESSION"]));
		}
	}
	else if (interaction.commandName === 'leave') {
		// if the user is not in the sessionAuthors array
		if (!sessionAuthors.includes(interaction.user)) {
			// send a message to the channel
			await interaction.reply(getRandomLine(botLines["NOT_IN_SESSION"]));
		}
		// if the user is in the sessionAuthors array
		else {
			// remove the user from the sessionAuthors array
			sessionAuthors = sessionAuthors.filter(e => e !== interaction.user);
			// send a message to the channel
			await interaction.reply(getRandomLine(botLines["SESSION_LEFT"]).replace("%s", interaction.user.username));
		}
	}
	else if (interaction.commandName === 'mots') {
		// if the user is not in the sessionAuthors array
		if (!sessionAuthors.includes(interaction.user)) {
			// send a message to the channel
			await interaction.reply(getRandomLine(botLines["NOT_IN_SESSION"]));
			return
		}
		if (!submitTime) {
			await interaction.reply(getRandomLine(botLines["NOT_SUBMIT_TIME"]));
			return
		}
		words[interaction.user.username] = interaction.options.get('nombre').value
		if (interaction.options.get('nombre').value < 100) {
			await interaction.reply(`Heu... Tu as écrit seulement ${interaction.options.get('nombre').value} mots, tu veux un câlin ?... ou un coup de fouet ?! 😈`);
		} else if (interaction.options.get('nombre').value > 1000) {
			await interaction.reply(`Oh punaise !! Tu as écrit plus de ${interaction.options.get('nombre').value} mots ! Tu veux un petit massage des phalanges ? Ou une petite dose de paillettes de Moutmout pour te remettre ? :Moutmout112x112:`);
		} else {
			await interaction.reply( getRandomLine(botLines["WORDS_SUBMITTED"]).replace("%s", interaction.options.get('nombre').value) );
		}
	} else if (interaction.commandName === 'stop') {
		// check if the user is an admin
		if (interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
			clearTimeout(currentTimeout);
			// tell the users that the session has been stopped
			await interaction.reply(getRandomLine(botLines["SESSION_STOPPED"]));
			// reset the sessionAuthors array
			sessionAuthors = [];
			// reset the words array
			words = new Map();
			// reset the session variable
			session = false;
			// reset the sessionInCountdown variable
			sessionInCountdown = false;
			// reset the sessionInSubmission variable
			submitTime = false;
		} else {
			// tell the user that he is not an admin
			await interaction.reply(getRandomLine(botLines["NOT_ADMIN"]));
		}
	}
});
client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.login(TOKEN);