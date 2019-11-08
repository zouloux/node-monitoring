module.exports = {
	// Rafraichissement des statistiques machines, en secondes
	devicesRefresh : 60 * 10,	// 10 minutes

	// Rafraichissement des up times, en secondes
	upTimesRefresh : 60 * 60, 	// 1 heure

	// Redémarrer tous les X heures
	restartEvery: 24,

	// Durée de connexion max tolérée en secondes
	// Appliqué au machines SSH et aux up times
	timeout: 10,

	// Ne pas envoyer de message trop souvent (en secondes)
	repeatSend: 60 * 60,		// 1 heure

	// Les déclanchements d'alertes, en pourcentage
	thresholds : {
		// Si un serveur répond après plus de xx% du timeout
		ping: 50,
		// Si un serveur a son CPU chargé au dessus de xx%
		cpu: 99,
		// Si un serveur a sa ram et sa swap au dessus de xx%
		ram: 60,
		swap: 80,
		// Si un serveur a son disk plein au dessus de xx%
		disk: 80
	},
	
	// Liste des machines linux dont il faut récupérer l'état
	// NOTE : Peut-être un SSH de serveur de production
	devices : {
		// Machines SSH locales
		'Nginx' 	: 'user@linux-machine',
		'Gitlab' 	: 'user@linux-machine',
		//'---1'		: '',
		// Machine SSH en production ...
	},

	// Liste des adresses à tester
	upTimes : {
		// Services locaux
		'Nginx' 		: 'https://endpoint',
		'Gitlab' 		: 'https://endpoint',
		//'---1'			: '',
		// Services en production
		'My website'	: 'https://expoint',
		//'---2'			: '',
		//'Unknown'		: 'http://...',
	},

	// Hook slack sur lequel publier
	// Ajoutez l'app "Slack WebHook" puis collez l'URL du webhook ici
	slackHook: 'https://hooks.slack.com/services/......'
};