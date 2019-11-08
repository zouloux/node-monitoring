const exec = require('child_process').exec;
const config = require('./config');
const deviceNames = Object.keys( config.devices );

const makeCommand = ( host ) =>
{
	// La commande top a 2 itérations pour que le CPU fonctionne
	const cpuAndMemoryCommand = `top -bn 2 | egrep 'Mem|Cpu'`;
	const diskCommand = `df -h`;
	return `ssh -o StrictHostKeyChecking=no ${host} "${cpuAndMemoryCommand} && ${diskCommand}"`;
}

const promiseExec = command => new Promise( ( resolve, reject ) =>
{
	exec( command, { timeout: config.timeout * 1000 }, ( error, stdout, stderr ) =>
	{
		error
		? reject( [error, stderr] )
		: resolve( [stdout, stderr] )
	});
})

module.exports = {

	/**
	 * Récupérer les stats de machines virtuelles
	 */
	getdevicesStates : () => new Promise( resolve =>
	{
		// Les résultats à envoyer une fois fini
		const states = {};

		// Valider les données d'une VM
		let waitingFor = deviceNames.length;
		function validate ( device, state, error )
		{
			// Enregistrer ces données
			states[ device ] = state == null ? error : state;

			// Résoudre une fois que tout est fini
			if ( --waitingFor == 0 ) resolve( states );
		}

		// Parcourir les machines
		deviceNames.map( deviceName =>
		{
			// Ligne séparateur
			const device = config.devices[ deviceName ];
			if ( device == '' )
			{
				validate( device, null );
				return;
			}

			// Générer la commande à exécuter en SSH
			const command = makeCommand( device );

			// Exécuter la command
			promiseExec( command )

			// Réponse
			.catch( res => validate( device, null, 'ssh' ) )
			.then( res =>
			{
				if (res == null) return;

				// Récupérer les lignes
				const buffer = (res[0] || '').toString();
				const lines = buffer.split('\n');

				// Vérifier si la réponse a du sens
				if ( buffer.indexOf('%Cpu(s)') != 0 || lines.length < 5)
				{
					validate( device, null, 'request' );
					return;
				}

				// Supprimer les 3 premières lignes de la première commande top qui ne fonctionne pas
				lines.shift();
				lines.shift();
				lines.shift();

				// Parser la ligne CPU
				const cpuLineParts = lines[0].split(' ');
				const cpuIdleIndex = cpuLineParts.indexOf('id,') - 1;
				let cpuRaw = cpuLineParts[cpuIdleIndex];
				if (cpuRaw.indexOf('ni,') !== -1) cpuRaw = cpuRaw.split('ni,')[1];
				const cpuDot = cpuRaw.split(',').join('.');
				const cpuUsageValue = 100 - parseFloat( cpuDot );

				// Parser la ligne RAM
				const memoryLineParts = lines[1].split(' ');
				const memoryTotalIndex = memoryLineParts.indexOf('total,') - 1;
				let memoryUsedIndex = memoryLineParts.indexOf('used,') - 1;
				if (memoryUsedIndex === -2) memoryUsedIndex = memoryLineParts.indexOf('util,') - 1;

				// Calculer la RAM
				const memoryUsedValue = (
					parseFloat( memoryLineParts[memoryUsedIndex] )
					/
					parseFloat( memoryLineParts[memoryTotalIndex] )
				) * 100;

				// Parser la ligne Swap
				const swapLineParts = lines[2].split(' ');
				const swapTotalIndex = swapLineParts.indexOf('total,') - 1;
				let swapUsedIndex = swapLineParts.indexOf('used.') - 1;
				if (swapUsedIndex === -2) swapUsedIndex = swapLineParts.indexOf('util.') - 1;

				// Calculer la Swap
				const swapUsedValue = (
					parseFloat( swapLineParts[swapUsedIndex] )
					/
					parseFloat( swapLineParts[swapTotalIndex] )
				) * 100;

				// Parcourir les lignes pour trouver la ligne du disk principal
				let diskUsageValue = 0;
				lines.map( line =>
				{
					// Ne récupérer que la ligne du disque principal
					if (line.indexOf('/dev/sda') === -1) return;

					// Cleaner la ligne pour avoir un nombre fixe d'éléments
					const diskLineParts = line.split(' ').filter( v => v != '' );

					// Récupérer la ligne du pourcentage utilisé et convertir en nombre
					diskUsageValue = parseFloat( diskLineParts[4].split('%')[0] );
				});

				// Valider avec les données
				validate( device, {
					cpu : cpuUsageValue,
					ram : memoryUsedValue,
					swap: swapUsedValue,
					disk: diskUsageValue
				});
			});

		});
	})
}