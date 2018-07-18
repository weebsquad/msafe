let config = require('../config.js')
let db = require('knex')(config.database)
let utils = require('./utilsController.js')
const randomstring = require('randomstring')

const tokenController = {}
tokenController.reloadModules = function () {
  require.cache = new Array();
  config = require('../config.js')
  db = require('knex')(config.database)
  utils = require('./utilsController.js')
}

tokenController.verify = async (req, res, next) => {
  const token = req.body.token
  if (token === undefined) return res.status(401).json({ success: false, description: 'No token provided' })

  const user = await db.table('users').where('token', token).first()
  if (!user) return res.status(401).json({ success: false, description: 'Invalid token' })
  if ((user.enabled === false || user.enabled === 0) && !utils.isAdmin(user.username)) return res.json({ success: false, description: 'This account has been disabled' })
  return res.json({ success: true, username: user.username })
}

tokenController.list = async (req, res, next) => {
  const user = await utils.authorize(req, res)
  if (!user.id) return
  return res.json({ success: true, token: user.token })
}

tokenController.change = async (req, res, next) => {
  const user = await utils.authorize(req, res)
  if (!user.id) return
  const newtoken = randomstring.generate(64)

  await db.table('users').where('token', user.token).update({
    token: newtoken,
    timestamp: Math.floor(Date.now() / 1000)
  })

  res.json({ success: true, token: newtoken })
}

module.exports = tokenController
