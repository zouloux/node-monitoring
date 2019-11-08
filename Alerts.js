const fetch = require('node-fetch');
const { URLSearchParams } = require('url');

const config = require('./config');
const deviceNames = Object.keys( config.devices );
const upTimeNames = Object.keys( config.upTimes );

// Liste des états pour détecter les changements
const states = {
	'device' : { },
	'upTime' : { }
};

// Faire des emojis
const randomGoodEmoji = () => ( Math.random() > .5 ? ':sunglasses:' : ':thumbsup:' );
const randomCatastrophicEmoji = () => ( Math.random() > .5 ? ':scream:' : ':rotating_light:' );

function sendSlackMessage ( message )
{
	// Jolie date vite fait
	const date = (new Date()).toString().split(' ');
	const niceDate = `${date[2]} ${date[1]} ${date[3]}`;

	// Générer le payload à passer au hook slack
	const params = new URLSearchParams();
	params.append('payload', JSON.stringify({
		username: 'Monitoring',
		text: niceDate + ' - ' + message
	}));

	// Envoyer le hook slack 
	fetch(
		config.slackHook,
		{ method: 'POST', body: params }
	)
	.catch( e =>
	{
		console.error('  Unable to send slack payload.');
		process.stdout.write('\x07'); // BIP
	})
	.then( () => {} );
}


/**
 * Envoyer une état dans la messagerie slack
 */
function send ( type, url, state )
{
	// Le sujet selon le type
	const subject = (
		type == 'device'
		? "La machine"
		: "Le site"
	);

	// Le nom selon le type
	let name = url;
	(type == 'device')
	? deviceNames.map( key => {
		if (config.devices[key] == url) name = key;
	})
	: upTimeNames.map( key => {
		if (config.devices[key] == url) name = key;
	});

	// Un message expliquant ce qu'il se passe, selon l'état
	let whatHappened = '';

	// Tout va re-bien
	if ( state == null )
		whatHappened = `est revenu ${randomGoodEmoji()}`;

	// Ne répond pas ou erreur fatale
	else if ( state == 'down' || state == 'ssh' || state == 'request' )
		whatHappened = `est hors ligne ou ne répond pas ! ${randomCatastrophicEmoji()} (${state})`;
	
	// Disque plein
	else if ( state == 'disk' )
		whatHappened = `va être bientôt pleine et aurait besoin d'un bon nettoyage ou d'un peu plus d'espace disque ! :dusty_stick:`;

	// Mémoire pleine
	else if ( state == 'ram' )
		//whatHappened = `est un peu à bout de souffle. Il y a une fuite mémoire dans l'application ou alors il faut un peu plus de RAM. :exploding_head:`;
		return;

	// Processeur a fond
	else if ( state == 'cpu' )
		//whatHappened = `est un peu à bout de souffle. L'application est trop gourmande ou alors il faut un peu plus de CPU. :exploding_head:`;
		return;

	// Long à répondre
	else if ( state == 'ping' )
		//whatHappened = `met du temps à répondre. Le serveur est peut-être sous une forte charge ou alors l'application manque d'optimisation. :zzz:`;
		return;
	
	// Le site vient d'être actualisé
	else if ( state == 'update' )
		//whatHappened = `vient d'être actualisé :eyes:`;
		return;

	// Erreur inconnue
	else
		whatHappened = `a une erreur inconnue ! ${randomCatastrophicEmoji()} (${state})`;

	// Envoyer le message
	sendSlackMessage( `${subject} ${name} ${whatHappened}` );
	
	// On lance quelques BIP en cas de gros soucis
	if ( state == 'down' || state == 'ssh' || state == 'request' )
	{
		// BIP BIP BIP
		process.stdout.write('\x07');
		process.stdout.write('\x07');
		process.stdout.write('\x07');
	}
	else if ( state == 'disk' )
	{
		// BIP
		process.stdout.write('\x07');
	}
}

module.exports = {

	sendSlackMessage: sendSlackMessage,

	/**
	 * Définir un nouvel état d'alerte
	 */
	setAlert: function ( type, url, state )
	{
		// Cibler l'état pour ce type
		const typeStates = states[ type ];
		let lastSend;

		// Si c'est le premier envoi
		if ( !(url in typeStates) && state != null )
		{
			// Alors envoyer directement
			send( type, url, state );
			lastSend = Date.now();
		}

		// Si c'est un changement d'état
		if ( url in typeStates && typeStates[ url ].state != state )
		{
			// Ne pas prendre après un changement de contenu le retour à la normale
			if (
				(
					typeStates[ url ].state == 'update'
					||
					typeStates[ url ].state == 'cpu'
					||
					typeStates[ url ].state == 'ram'
					||
					typeStates[ url ].state == 'disk'
				)
				&&
				state == null
			) return;

			// Alors envoyer directement
			send( type, url, state );
			lastSend = Date.now();
		}

		// Enregistrer l'état pour cette alerte
		typeStates[ url ] = {
			state,
			url,
			// La date du dernier envoi pour éviter les spams
			lastSend: (
				// Si on a envoyé alors enregistrer cette date
				lastSend != null ? lastSend
				// Sinon on récupère la dernière
				: ( url in typeStates ? typeStates[ url ].lastSend : 0 )
			)
		};
	},

	/**
	 * Envoyer les alertes qui ont besoin d'être ré-envoyer
	 */ 
	send : function ()
	{
		// Parcourir les types d'états
		Object.keys( states ).map( type =>
		{
			// Parcourir les entitées pour ce type (devices / up-times)
			Object.keys( states[type] ).map( key =>
			{
				// Cibler l'objet état pour cette entitée
				const stateObject = states[type][key];

				// Si l'état n'est pas OK et que le dernier envoi date
				if ( stateObject.state != null && Date.now() > stateObject.lastSend + config.repeatSend * 1000 )
				{
					// Alors re-envoyer
					send( type, stateObject.url, stateObject.state );
					stateObject.lastSend = Date.now();
				}
			});
		});
	}
}


















