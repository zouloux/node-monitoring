const fetch = require('node-fetch');

const config = require('./config');
const upTimeNames = Object.keys( config.upTimes );

// Les données des sites récupérés pour détecter les changements
const contents = {};

module.exports = {
	/**
	 * Récupérer l'état up-time de toutes les adresses de la config
	 */
	getUpTimeStats : () => new Promise( resolve =>
	{
		// Les données à afficher
		const upTimes = { };

		// Validation d'un up-time
		let waitingUpTimes = upTimeNames.length;
		function validate ( url, content, ping )
		{
			// S'il n'y a pas de contenu, c'est juste un séparateur
			if (content == '')
			{
				upTimes[url] = '';
			}
			else
			{
				// L'état down
				let state;
				if ( content == null )
					state = 'down';
				// L'état a changé (changement de contenu)
				else if ( url in contents && contents[url] != content )
					state = 'updated';
				// L'état est OK
				else
					state = 'up';

				// Enregistrer le contenu pour détecter les changements
				if ( content != null )
					contents[ url ] = content;

				// L'objet stats à retourner
				upTimes[ url ] = {
					state,
					ping
				};
			}

			// Comptabiliser et resoudre si terminé
			if ( -- waitingUpTimes == 0 ) resolve( upTimes );
		}

		// Parcourir les up-times à vérifier
		upTimeNames.map( upTimeName =>
		{
			// L'URL a vérifier
			const url = config.upTimes[ upTimeName ];

			// Si c'est un séparateur
			if ( url == '' )
			{
				validate( url, '' );
				return;
			}

			// Chronométrer le temps de réponse total
			const requestTime = Date.now();
			const timeout = config.timeout * 1000;

			// Faire la requête
		    fetch( url, {
		    	timeout: timeout
		    })
		    // Attraper les erreurs
		    .catch( error => validate( url, null, timeout ) )
		    // Réponse
		    .then( async response =>
		    {
		    	// Ne pas continuer si c'est une erreur
		    	if ( response == null ) return;
		    	
		    	// Récupérer le texte
		    	const text = await response.text();

		    	// Valider cette réponse
		    	validate( url, text, Date.now() - requestTime );
		    });
		});
	})
};