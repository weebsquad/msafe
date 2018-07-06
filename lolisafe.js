const config = require('./config.js');
const api = require('./routes/api.js');
const album = require('./routes/album.js');
const express = require('express');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const RateLimit = require('express-rate-limit');
const db = require('knex')(config.database);
const fs = require('fs');
const exphbs = require('express-handlebars');
const safe = express();
const path = require('path');

require('./database/db.js')(db);

fs.existsSync('./pages/custom' ) || fs.mkdirSync('./pages/custom');
fs.existsSync('./' + config.logsFolder) || fs.mkdirSync('./' + config.logsFolder);
fs.existsSync('./' + config.uploads.folder) || fs.mkdirSync('./' + config.uploads.folder);
fs.existsSync('./' + config.uploads.folder + '/thumbs') || fs.mkdirSync('./' + config.uploads.folder + '/thumbs');
fs.existsSync('./' + config.uploads.folder + '/zips') || fs.mkdirSync('./' + config.uploads.folder + '/zips')

safe.use(helmet());
safe.set('trust proxy', 1);

safe.engine('handlebars', exphbs({ defaultLayout: 'main' }));
safe.set('view engine', 'handlebars');
safe.enable('view cache');

let limiter = new RateLimit({ windowMs: 5000, max: 2 });
safe.use('/api/login/', limiter);
safe.use('/api/register/', limiter);

safe.use(bodyParser.urlencoded({ extended: true }));
safe.use(bodyParser.json());

if (config.serveFilesWithNode && !config.useAlternateViewing) {
	safe.use('/', express.static(config.uploads.folder));
}

safe.use('/', express.static('./public'));
safe.use('/', album);
safe.use('/api', api);

for (let page of config.pages) {
	let root = './pages/';
	if (fs.existsSync(`./pages/custom/${page}.html`)) {
		root = './pages/custom/';
	}
	function checkHost(req, res, next) {
		const host = req.get('host');
		const dom = config.domain.split('https://').join('').split('http://').join('');
		if(host !== dom) return res.redirect(config.domain);
		res.sendFile(`${page}.html`, { root: root });
	}
	if (page === 'home') {
		safe.get('/', (req, res, next) => checkHost(req,res,next));
	} else {
		safe.get(`/${page}`, (req, res, next) => checkHost(req,res,next));
	}
}

if (config.serveFilesWithNode && config.useAlternateViewing) {
	safe.get('/thumbs/:id', async (req, res, next) => {
		const id = req.params.id;
		const _path = path.join(__dirname, config.uploads.folder) + '/thumbs';
		const file = `${_path}/${id}`;
		const ex = fs.existsSync(file);
		if(!ex) return res.status(404).sendFile('404.html', { root: './pages/error/' });
		
		res.sendFile(id, { root: _path });
	});
	
	safe.get('/:id', async (req, res, next) => {
		const id = req.params.id;
		const _path = path.join(__dirname, config.uploads.folder);
		// Encoding
		const dbFiles = await db.table('files')
		.where(function () {
			this.where('encodeVersion', '>', 0)
		})
		console.log(dbFiles);
		const file = `${_path}/${id}`;
		const ex = fs.existsSync(file);
		if(!ex) return res.status(404).sendFile('404.html', { root: './pages/error/' });
		
		res.sendFile(id, { root: _path });
	});
}

safe.use((req, res, next) => res.status(404).sendFile('404.html', { root: './pages/error/' }));
safe.use((req, res, next) => res.status(500).sendFile('500.html', { root: './pages/error/' }));



safe.listen(config.port, () => console.log(`uploader started on port ${config.port}`));
