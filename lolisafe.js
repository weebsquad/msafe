let config = require('./config.js')
let api = require('./routes/api.js')
let album = require('./routes/album.js')
let rateLimiting = require('./routes/ratelimit.js')
let obfuscation = require('./routes/obfuscate.js')
let s3 = require('./routes/s3.js')
let db = require('knex')(config.database)
const fs = require('fs')
const exphbs = require('express-handlebars')
const express = require('express')
let safeog = express()
const path = require('path')
const MimeLookup = require('mime-lookup')
const mime = new MimeLookup(require('mime-db'))
const helmet = require('helmet')
const bodyParser = require('body-parser')
const requireUncached = require('require-uncached');
const CronJob=require('cron').CronJob;
let encoding
if(config.allowEncoding) encoding = require('./controllers/encodingController')
let serv;
let boot = new Date();


fs.existsSync('./pages/custom') || fs.mkdirSync('./pages/custom')
fs.existsSync('./' + config.logsFolder) || fs.mkdirSync('./' + config.logsFolder)
fs.existsSync('./' + config.uploads.folder) || fs.mkdirSync('./' + config.uploads.folder)
fs.existsSync('./' + config.uploads.folder + '/thumbs') || fs.mkdirSync('./' + config.uploads.folder + '/thumbs')
fs.existsSync('./' + config.uploads.folder + '/zips') || fs.mkdirSync('./' + config.uploads.folder + '/zips')

let setupExpress = function(safe, reload = false) {
	safe.use(helmet())
	safe.set('trust proxy', 1)

	safe.engine('handlebars', exphbs({ defaultLayout: 'main' }))
	safe.set('view engine', 'handlebars')
	safe.enable('view cache')

	rateLimiting.load(safe, reload) // Initialize ratelimits

	safe.use(bodyParser.json({limit: '50mb'}))
	safe.use(bodyParser.urlencoded({ limit: '50mb', extended: true }))

	if (config.serveFilesWithNode && !config.useAlternateViewing) safe.use('/', express.static(config.uploads.folder))

	if (config.obfuscateClJs) {
	  safe.get('/js/:id', async (req, res, next) => {
		const id = req.params.id
		const _p = path.join(__dirname, 'public') + `/js/${id}`
		if (fs.existsSync(_p)) {
		  res.setHeader('Content-Type', mime.lookup(req.url))
		  return res.send(obfuscation.obfuscateFile(_p))
		}
		res.status(404).sendFile('404.html', { root: './pages/error/' })
	  })
	}
	safe.use('/', express.static('./public'))
	safe.use('/', album)
	safe.use('/api', api.routes)

	/*

			Load our pages

	*/

	for (let page of config.pages) {
	  let root = './pages/'
	  if (fs.existsSync(`./pages/custom/${page}.html`)) root = './pages/custom/'

	  function checkHost (req, res, next) {
		const host = req.get('host')
		const dom = config.domain.split('https://').join('').split('http://').join('')
		let pagered = ''
		if (page !== 'home') pagered = page
		if (host !== dom) return res.redirect(config.domain + '/' + pagered)
		res.sendFile(`${page}.html`, { root: root })
	  }
	  if (page === 'home') {
		safe.get('/', (req, res, next) => checkHost(req, res, next))
	  } else {
		safe.get(`/${page}`, (req, res, next) => checkHost(req, res, next))
	  }
	}

	if (config.serveFilesWithNode && config.useAlternateViewing) {
	  let normalHandles = ['thumbs', 'zips']
	  normalHandles.forEach(function (vl) {
		  safe.get(`*/${vl}/:id`, async (req, res, next) => {
		  const id = req.params.id
		  const _path = `${path.join(__dirname, config.uploads.folder)}/${vl}`
		  const file = `${_path}/${id}`
		  const ex = fs.existsSync(file)
		  // Handle S3
		  let _s3 = false
		  if (!ex) {
			if (s3.enabledCheck()) {
			  let _testex = await s3.fileExists(config.s3.bucket, `${vl}/${id}`)
			  if (_testex) {
				_s3 = true
				await s3.getFile(req, res, next, `${vl}/${id}`)
			  }
			}
			if (!_s3) return res.status(404).sendFile('404.html', { root: './pages/error/' })
		  }

		  if (!_s3) res.sendFile(id, { root: _path })
		  })
	  })

	  safe.get('*/:id', async (req, res, next) => {
		let id = req.params.id

		// Check whitelisted files first
		for (let key in config.whitelistedQueries) {
		  let obj = config.whitelistedQueries[key]
		  if (id === key) return res.sendFile(path.join(__dirname, obj))
		}

		const _path = path.join(__dirname, config.uploads.folder)
		const host = req.get('host')
		
		
		let skipEncoding = false;
		const fileExtSeperator = '.';
		if(id.indexOf(fileExtSeperator) > -1) { // Lets check if the query is for a normally formatted file name
			let idcheck = id.split(fileExtSeperator);
			if(idcheck.length === 2) {
				if(idcheck[0].length > 0 && idcheck[1].length > 0) {
					skipEncoding = true;
				}
			}
		}
			
		// Check encoding
		if(config.allowEncoding && !skipEncoding) {

			/*const encFile = await db.table('files')
			  .where(function () { this.where('encodeVersion', '>', 0).andWhereNot('encodedString', '').andWhere('encodedString', id) }).first()
			if (encFile) id = encFile['name']*/
			let _encodetest = await encoding.decode(id, 0, true);
			if(typeof(_encodetest) === 'string' && _encodetest.indexOf('.') > 0 && _encodetest.length >= 3) id = _encodetest
		}

		// Finally handle the actual ID
		const file = `${_path}/${id}`
		const ex = fs.existsSync(file)
		// Handle S3
		let _s3 = false
		if (!ex) {
		  if (s3.enabledCheck()) {
			let _testex = await s3.fileExists(config.s3.bucket, id)
			if (_testex) {
			  _s3 = true
			  await s3.getFile(req, res, next, id)
			}
		  }
		  if (!_s3) return res.status(404).sendFile('404.html', { root: './pages/error/' })
		}

		if (!_s3) res.sendFile(id, { root: _path })
	  })
	}

	safe.use((req, res, next) => res.status(404).sendFile('404.html', { root: './pages/error/' }))
	safe.use((req, res, next) => res.status(500).sendFile('500.html', { root: './pages/error/' }))
}

let reloadModules = function() {
	require.cache = new Array();
	config = require('./config.js')
	api = require('./routes/api.js')
	album = require('./routes/album.js')
	rateLimiting = require('./routes/ratelimit.js')
	obfuscation = require('./routes/obfuscate.js')
	//s3 = requireUncached('./routes/s3.js')
	db = requireUncached('knex')(config.database)
	api.reloadModules();
	init(true);
};

let restart = function() {
	console.log('[CORE] AUTO RESTARTING!');
	serv.close();
	delete serv;
	delete safeog;
	setTimeout(function() {
		process.exit(0);
	}, 2000);
}


function doCrons() {
	if(config.autoRestart !== '') {
		try{
		let cronJob1 = new CronJob({
			cronTime: config.autoRestart,
			onTick: restart,
			start: true,
			runOnInit: false
		});
		} catch(e) { console.error(e); }
	}
}

let init = async function (reload = false) {
  let _safenew = express();
  if(!reload) {
	  if(config.autoReload > 0) setInterval(reloadModules, config.autoReload);
	  doCrons();
  }
  await require('./database/db.js')(db)
  console.log('[CORE] Loaded DB');
  const _path = path.join(__dirname, config.uploads.folder)
  let fl = await db.table('files').select('name')
  await s3.initialize(_path, fl)
  console.log('[CORE] Loaded S3');
  setupExpress(_safenew, reload);
  if(reload && serv) { serv.close(); delete serv; delete safeog; }
  safeog = _safenew
  let diffboot = ((new Date() - boot)/1000).toFixed(2);
  serv = safeog.listen(config.port, () => { if(!reload) console.log(`[CORE] Started within ${diffboot}s on port ${config.port}`) })
}
init()
