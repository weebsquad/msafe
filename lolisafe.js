const config = require('./config.js')
const api = require('./routes/api.js')
const album = require('./routes/album.js')
const express = require('express')
const helmet = require('helmet')
const bodyParser = require('body-parser')
const RateLimit = require('express-rate-limit')
const db = require('knex')(config.database)
const fs = require('fs')
const exphbs = require('express-handlebars')
const safe = express()
const path = require('path')

require('./database/db.js')(db)

fs.existsSync('./pages/custom') || fs.mkdirSync('./pages/custom')
fs.existsSync('./' + config.logsFolder) || fs.mkdirSync('./' + config.logsFolder)
fs.existsSync('./' + config.uploads.folder) || fs.mkdirSync('./' + config.uploads.folder)
fs.existsSync('./' + config.uploads.folder + '/thumbs') || fs.mkdirSync('./' + config.uploads.folder + '/thumbs')
fs.existsSync('./' + config.uploads.folder + '/zips') || fs.mkdirSync('./' + config.uploads.folder + '/zips')

safe.use(helmet())
safe.set('trust proxy', 1)

safe.engine('handlebars', exphbs({ defaultLayout: 'main' }))
safe.set('view engine', 'handlebars')
safe.enable('view cache')

async function rateLimitKey (req, res) {
  let key = req.ip
  const token = req.headers.token
  if (token) {
    const user = await db.table('users').where('token', token).first()
    if (user && (!config.enableUserAccounts || !config.private)) key = user.id // Should probably store ips/ids on a array and compare them, make a matching key for them and match it here but too fucking lazy lmao
  }
  return key
}

async function rateLimitSkip (req, res) {
  const token = req.headers.token
  if (token && config.adminsBypassRatelimiting) {
    const user = await db.table('users').where('token', token).first()
    if (user && config.admins.indexOf(user.username) > -1) return true
  }
  return false
}

function handleRateLimit (options, req, res, next) {
  let retrya = Math.ceil(options.windowMs / 1000)
  if (options.headers) {
    res.setHeader('Retry-After', retrya)
  }
  let json = { success: false, description: options.message, retryAfter: retrya }
  res.format({
    html: function () {
      res.status(options.statusCode).end(JSON.stringify(json))
    },
    json: function () {
      res.status(options.statusCode).json(json)
    }
  })
  res.end()
}

// Load ratelimits
for (let key in config.rateLimits) {
  let obj = config.rateLimits[key]
  let _a = function (req, res, next) {
    handleRateLimit(obj, req, res, next)
  }
  obj['handler'] = _a
  obj['keyGenerator'] = rateLimitKey
  obj['skip'] = rateLimitSkip;
  let rl = new RateLimit(obj)
  safe.use(key, rl)
}

safe.use(bodyParser.json({limit: '50mb'}))
safe.use(bodyParser.urlencoded({ limit: '50mb', extended: true }))

if (config.serveFilesWithNode && !config.useAlternateViewing) {
  safe.use('/', express.static(config.uploads.folder))
}

safe.use('/', express.static('./public'))
safe.use('/', album)
safe.use('/api', api)

/*

		Load our pages

*/

for (let page of config.pages) {
  let root = './pages/'
  if (fs.existsSync(`./pages/custom/${page}.html`)) {
    root = './pages/custom/'
  }
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
  safe.get('/thumbs/:id', async (req, res, next) => {
    const id = req.params.id
    const _path = path.join(__dirname, config.uploads.folder) + '/thumbs'
    const file = `${_path}/${id}`
    const ex = fs.existsSync(file)
    if (!ex) return res.status(404).sendFile('404.html', { root: './pages/error/' })

    res.sendFile(id, { root: _path })
  })

  safe.get('/:id', async (req, res, next) => {
    let id = req.params.id
    // Check blacklisted files first
    for (let key in config.whitelistedQueries) {
      let obj = config.whitelistedQueries[key]
      if (id === key) return res.sendFile(path.join(__dirname, obj))
    }

    const _path = path.join(__dirname, config.uploads.folder)

    // Check encoding
    const encFile = await db.table('files')
      .where(function () { this.where('encodeVersion', '>', 0).andWhereNot('encodedString', '').andWhere('encodedString', id) }).first()
    if (encFile) id = encFile['name']

    // Finally handle the actual ID
    const file = `${_path}/${id}`
    const ex = fs.existsSync(file)
    if (!ex) return res.status(404).sendFile('404.html', { root: './pages/error/' })

    res.sendFile(id, { root: _path })
  })
}

safe.use((req, res, next) => res.status(404).sendFile('404.html', { root: './pages/error/' }))
safe.use((req, res, next) => res.status(500).sendFile('500.html', { root: './pages/error/' }))

safe.listen(config.port, () => console.log(`uploader started on port ${config.port}`))
