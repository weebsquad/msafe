/* eslint-disable no-tabs */
module.exports = {

	autoRestart: '00 00 00 * * * ', // A cronjob pattern, default restarts every day @ midnight
	autoReload: 1 * 60 * 60 * 1000, // 0 to disable autoReload
	/*
		If set to true the user will need to specify the auto-generated token
		on each API call, meaning random strangers wont be able to use the service
		unless they have the token lolisafe provides you with.
		If it's set to false, then upload will be public for anyone to use.
	*/
	private: true,

	// If true, users will be able to create accounts and access their uploaded files
	enableUserAccounts: true,

	/*
		Here you can decide if you want lolisafe to serve the files or if you prefer doing so via nginx.
		The main difference between the two is the ease of use and the chance of analytics in the future.
		If you set it to `true`, the uploaded files will be located after the host like:
			https://lolisafe.moe/yourFile.jpg

		If you set it to `false`, you need to set nginx to directly serve whatever folder it is you are serving your
		downloads in. This also gives you the ability to serve them, for example, like this:
			https://files.lolisafe.moe/yourFile.jpg

		Both cases require you to type the domain where the files will be served on the `domain` key below.
		Which one you use is ultimately up to you.
	*/
	serveFilesWithNode: false,
	useAlternateViewing: false, // idk
	allowEncoding: false, // Allow clients to use encoding
	listen: '0.0.0.0',
	domain: 'https://lolisafe.moe',
	ssl: {
		port: 443,
		cert: '',
		key: ''
	},

	/*
		S3 Options
	*/
	s3: {
		use: false,
		accessKey: '',
		secretAccessKey: '',
		region: 'eu-west-2',
		bucket: 'metalruller',
		uploadsFolder: 'uploads',
		proxyFiles: false, // acts as a middleman proxy between s3 and the client, so that we can serve files on our own domain. otherwise redirects to s3
		merge: true, // Convert files from disk to s3 on startup
		expireUnits: 'year', // days, months, years
		expireValue: 1, // Value of units // 0 = never delete
		listRequestsOnFileChanges: false // True = do a list request to S3 whenever a file is changed // False = maintain a local cache of files (more economic)
	},

	obfuscateClJs: false, // Should we obfuscate all clientside js before sending it to the clients?
	obfuscatorOptions: {

	},

	// Port on which to run the server
	port: 9999,

	// Pages to process for the frontend
	pages: ['home', 'auth', 'dashboard', 'faq', 'privacy'],

	// Add file extensions here which should be blocked
	blockedExtensions: [
		'.jar',
		'.exe',
		'.msi',
		'.com',
		'.bat',
		'.cmd',
		'.nt',
		'.scr',
		'.ps1',
		'.psm1',
		'.sh',
		'.bash',
		'.bsh',
		'.csh',
		'.bash_profile',
		'.bashrc',
		'.profile',
		'.jpg_large'
	],

	imageExtensions: ['.jpg', '.jpeg', '.bmp', '.gif', '.png'],
	videoExtensions: ['.webm', '.mp4', '.wmv', '.avi', '.mov', 'webp'],
	noThumbnail: ['.mp3'],

	// Uploads config
	uploads: {

		// Folder where images should be stored
		folder: 'uploads',

		/*
			Max file size allowed. Needs to be in MB
			Note: When maxSize is greater than 1 MiB, you must set the client_max_body_size to the same as maxSize.
		*/
		maxSize: '512MB',

		// The length of the random generated name for the uploaded files
		fileLength: 32,

		/*
			This option will limit how many times it will try to generate random names
			for uploaded files. If this value is higher than 1, it will help in cases
			where files with the same name already exists (higher chance with shorter file name length).
		*/
		maxTries: 1,

		/*
			NOTE: Thumbnails are only for the admin panel and they require you
			to install a separate binary called graphicsmagick (http://www.graphicsmagick.org)
			for images and ffmpeg (https://ffmpeg.org/) for video files
		*/
		generateThumbnails: false,

		/*
			Allows users to download a .zip file of all files in an album.
			The file is generated when the user clicks the download button in the view
			and is re-used if the album has not changed between download requests
		*/
		generateZips: true
	},

	// Folder where to store logs
	logsFolder: 'logs',

	/*
		Setup ratelimits for different API endpoints
	*/
	rateLimits: {
		'/api/admins': { windowMs: 60 * 1000, max: 100, autoDelays: true },
		'/api/account': { windowMs: 2 * 60 * 1000, max: 20, autoDelays: true },
		'/api/upload': { windowMs: 3 * 60 * 1000, max: 20, autoDelays: true },
		'/api/login/': { windowMs: 5 * 60 * 1000, max: 5, delayMs: 1000, delayAfter: 1 },
		'/api/register/': { windowMs: 15 * 60 * 1000, max: 5, delayMs: 2000, delayAfter: 1 },
		'/api/tokens/': { windowMs: 2 * 60 * 1000, max: 40, autoDelays: true },
		'/api/': { windowMs: 2 * 60 * 1000, max: 250, autoDelays: true }
	},
	skipFails: false, // Error requests won't be counted towards ratelimiting, can still allow people to spam the api

	/*
		Add other admin accounts here!
	*/
	admins: ['root'],

	// Wether or not admins should bypass all ratelimits
	adminsBypassRatelimiting: false,

	// Users that should bypass ratelimiting
	usersBypassRateLimiting: [],

	/*
		Whitelisted files when using alternateViewing mode
	*/

	whitelistedQueries: {
		sharex: 'public/sharex.txt'
	},

	// The following values shouldn't be touched
	database: {
		client: 'sqlite3',
		connection: { filename: './database/db' },
		useNullAsDefault: true
	}
};
