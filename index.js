const realClear = require('clear');
const CLI = require('clui');
const Color = require('cli-color');

// Charger les modules
const DeviceStats = require('./DeviceStats');
const UpTime = require('./UpTime');
const Alerts = require('./Alerts');

// Récupérer la config
const config = require('./config');
const deviceNames = Object.keys( config.devices );
const upTimeNames = Object.keys( config.upTimes );

function clear ()
{
	process.stdout.write("\u001b[2J\u001b[0;0H");
	realClear();
}

// -----------------------------------------------------------------------------

// Initialiser le loader
const refreshSpinner = new CLI.Spinner('Refreshing ...')

// Les largeurs de colonnes pour le terminal
const columnsWidths = [
	16,
	25,
	16
];

// Les derniers uptimes à afficher et la date de la dernière actualisation
let upTimes;
let lastUpTimeDate = 0;

// Etat de récupération
let running = false;
let firstRun = true;

// Date de lancement pour le redémarrage auto
let startTime = Date.now();

/**
 * Rafraichir les données
 */
async function refresh ()
{
	// Quitter le process tous les X heures. Pour éviter les soucis de mémoire.
	// Ceci va redémarrer le process node via le script.
	if ( Date.now() > startTime + config.restartEvery * 1000 * 60 * 60 )
	{
		console.log('Restarting process ...');
		process.exit(0);
	}

	// Ne pas continuer si on a déjà une tâche de récupération en cours
	if (running) return;

	// Faire tourner un loader sous la sortie
	console.log(' ');
	running = true;
	refreshSpinner.start();

	// Récupérer l'état des machines virtuelles
	let devicesStates;
	try
	{
		devicesStates = await DeviceStats.getdevicesStates();
	}
	catch ( error )
	{
		console.error('DeviceStats error');
		console.error( error );
		process.exit(1)
	}

	// Récupérer les up times
	if ( upTimes == null || Date.now() > lastUpTimeDate + config.upTimesRefresh * 1000 )
	{
		try
		{
			upTimes = await UpTime.getUpTimeStats();
		}
		catch ( error )
		{
			console.error('UpTimes error');
			console.error( error );
			process.exit(1)
		}
		
		lastUpTimeDate = Date.now();
	}
	
	// Arrêter le loader
	refreshSpinner.stop();

	// Vider l'écran
	clear();

	// Afficher Les colonnes pour les VM
	console.log('');
	new CLI.Line()
	  .padding(2)
	  .column( 'Device', columnsWidths[0] )
	  .column( 'CPU', columnsWidths[1] )
	  .column( 'RAM', columnsWidths[1] )
	  .column( 'SWAP', columnsWidths[1] )
	  .column( 'DISK', columnsWidths[1] )
	  .fill().output();
  	console.log('');

  	// Parcourir les VM par nom, pour qu'elles soient toujours dans le même ordre
	deviceNames.map( deviceName =>
	{
		// Cibler les données de cette machine
		const deviceAddr = config.devices[ deviceName ];
		const deviceData = devicesStates[ deviceAddr ];

		// Si c'est une ligne vide
		if ( deviceAddr == '' )
		{
			console.log('');
			return;
		}

		// S'il n'y a pas eu de data pour cette machine
		if ( deviceData == null || typeof deviceData == 'string' )
		{
			// Une idée sur le soucis ?
			const reason = deviceData == null ? 'Unknown' : deviceData;

			// Afficher l'erreur
			new CLI.Line().padding(2)
		  	.column( deviceName, columnsWidths[0], [Color.cyan] )
			.column( 'Unable to connect'.toUpperCase(), columnsWidths[1] * 2, [Color.red] )
			.column( reason, columnsWidths[1], [Color.red] )
			.fill().output();

			// Définir l'état pour les alertes
			Alerts.setAlert( 'device', deviceAddr, reason );
			return;
		}

		// Les alertes de ressources
		if ( deviceData.disk >= config.thresholds.disk )
			Alerts.setAlert( 'device', deviceAddr, 'disk' );

		// Pour la mémoire, il faut que la ram et le swap dépassent en même temps
		else if ( deviceData.ram >= config.thresholds.ram && deviceData.swap >= config.thresholds.swap )
			Alerts.setAlert( 'device', deviceAddr, 'ram' );

		else if ( deviceData.cpu >= config.thresholds.cpu )
			Alerts.setAlert( 'device', deviceAddr, 'cpu' );

		// Pas d'alerte
		else
			Alerts.setAlert( 'device', deviceAddr );

		// Afficher la ligne de cette machine
		new CLI.Line()
		  .padding(2)
		  // Le nom de la machine
		  .column( deviceName, columnsWidths[0], [Color.cyan] )
		  // CPU / RAM / SWAP / DISK
		  .column( CLI.Gauge( deviceData.cpu,  100, columnsWidths[2], config.thresholds.cpu,  Math.round(deviceData.cpu) + '%'),  columnsWidths[1] )
		  .column( CLI.Gauge( deviceData.ram,  100, columnsWidths[2], config.thresholds.ram,  Math.round(deviceData.ram) + '%'),  columnsWidths[1] )
		  .column( CLI.Gauge( deviceData.swap, 100, columnsWidths[2], config.thresholds.swap,  Math.round(deviceData.swap) + '%'), columnsWidths[1] )
		  .column( CLI.Gauge( deviceData.disk, 100, columnsWidths[2], config.thresholds.disk, Math.round(deviceData.disk) + '%'), columnsWidths[1] )
		  // Afficher
		  .fill().output();
	});

	// Afficher Les colonnes pour les VM
	console.log('');
	console.log('');
	new CLI.Line()
	  .padding(2)
	  .column( 'Endpoint', columnsWidths[0] )
	  .column( 'State', columnsWidths[1] )
	  .column( 'Ping', columnsWidths[1] )
	  .fill()
	  .output();
  	console.log('');

  	// Parcourir les VM par nom, pour qu'elles soient toujours dans le même ordre
	upTimeNames.map( upTimeName =>
	{
		// Cibler les données de cette machine
		const upTimeAddr = config.upTimes[ upTimeName ];
		const upTimeData = upTimes[ upTimeAddr ];

		// Si c'est une ligne vide
		if ( upTimeData == null || typeof upTimeData == 'string' )
		{
			console.log('');
			return;
		}

		// La couleur selon l'état
		let color;
		if ( upTimeData.state == 'down' )
		{
			color = Color.red;
			Alerts.setAlert( 'upTime', upTimeAddr, 'down' );
		}
		else if ( upTimeData.state == 'updated' )
		{
			color = Color.cyan;
			Alerts.setAlert( 'upTime', upTimeAddr, 'update' );
		}
		else if ( upTimeData.state == 'up' )
		{
			color = Color.green;
			
			// Si le ping est un peu long ...
			if ( upTimeData.ping > config.timeout * 1000 * config.thresholds.ping / 100 )
				Alerts.setAlert( 'upTime', upTimeAddr, 'ping' );
			else
				Alerts.setAlert( 'upTime', upTimeAddr );
		}

		// Afficher la ligne de cette machine
		new CLI.Line()
		  .padding(2)
		  // Le nom de la machine
		  .column( upTimeName, columnsWidths[0], [Color.cyan] )
		  
		  // Afficher l'état de la machine en couleur
		  .column( upTimeData.state.toUpperCase(), columnsWidths[1], [color] )

		  // Afficher le ping
		  .column( CLI.Gauge( upTimeData.ping, config.timeout * 1000, columnsWidths[2], config.timeout * 1000 * .7, upTimeData.ping + 'ms'), columnsWidths[1] )

		  // Afficher l'URL si ce n'est pas up
		  .column( upTimeData.state != 'up' ? config.upTimes[ upTimeName ] : '' )

		  // Afficher
		  .fill() .output();
	});

	// Signaler le démarrage sur slack
	if ( firstRun )
	{
		firstRun = false;
		Alerts.sendSlackMessage('Monitoring prêt.');
	}

	// Envoyer les alertes sur slack
	Alerts.send();

	// On a terminé
	running = false;
}

// Démarrer l'affichage
clear();
refresh();

setInterval( refresh, config.devicesRefresh * 1000 );


























