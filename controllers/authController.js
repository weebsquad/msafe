let config = require('../config.js')
let db = require('knex')(config.database)
let utils = require('./utilsController.js')
let uploadController = require('./uploadController.js')
const bcrypt = require('bcrypt')
const randomstring = require('randomstring')

let alpha = 'qwertyuiopasdfghjklzxcvbnm'
alpha = alpha + alpha.toUpperCase()
const num = '0123456789'
const symbols = '!@#$%^&*()_-+=?/>.<,;:}]{[~|'
const pwchars = (alpha + num + symbols).split('')
const usrchars = (alpha + num).split('')

let authController = {}

authController.reloadModules = function () {
  require.cache = new Array()
  config = require('../config.js')
  utils = require('./utilsController.js')
  uploadController = require('./uploadController.js')
  db = require('knex')(config.database)
}

authController.listAdmins = async (req, res, next) => {
  const user = await utils.authorize(req, res)
  if (!user.id) return
  return res.json({ success: true, admins: config.admins })
}

authController.verify = async (req, res, next) => {
  const username = req.body.username
  const password = req.body.password

  if (username === undefined) return res.json({ success: false, description: 'No username provided' })
  if (password === undefined) return res.json({ success: false, description: 'No password provided' })

  const user = await db.table('users').where('username', username).first()
  if (!user) return res.json({ success: false, description: 'Username doesn\'t exist' })
  if ((user.enabled === false || user.enabled === 0) && !utils.isAdmin(user.username)) return res.json({ success: false, description: 'This account has been disabled' })

  bcrypt.compare(password, user.password, (err, result) => {
    if (err) {
      console.log(err)
      return res.json({ success: false, description: 'There was an error' })
    }
    if (result === false) return res.json({ success: false, description: 'Wrong password' })
    return res.json({ success: true, token: user.token })
  })
}

authController.listAccounts = async (req, res, next) => {
  const user = await utils.authorize(req, res)
  if (!user.id) return
  if (!utils.isAdmin(user.username)) return res.json({ success: false, description: 'No permission!' })
  let users = await db.table('users').select('id', 'username', 'enabled', 'timestamp')
  let files = await db.table('files').select('userid')
  users.forEach(function (vl) {
	  vl.admin = utils.isAdmin(vl.username)
	  vl.filecount = 0
	  files.forEach(function (vl2) {
		  if (vl2.userid === vl.id) vl.filecount++
	  })
  })
  return res.json({ success: true, users })
}

authController.disableAccount = async (req, res, next) => {
  let bypassEnable = false
  const user = await utils.authorize(req, res)
  if (!user.id) return
  if (user && utils.isAdmin(user.username)) bypassEnable = true

  const username = req.body.username
  const password = req.body.password
  let state = req.body.state
  if (typeof (state) !== 'boolean' && typeof (state) !== 'number') return res.json({ success: false, description: 'No disable state provided!' })
  if (state === 0) state = false
  if (state === 1) state = true

  if (username === undefined) return res.json({ success: false, description: 'No username provided' })
  if (password === undefined) return res.json({ success: false, description: 'No password provided' })

  if (username === user.username && utils.isAdmin(user.username)) {
    return res.json({ success: false, description: 'Cannot disable admin accounts!' })
  }
  bcrypt.compare(password, user.password, async (err, result) => {
    if (err) {
      console.log(err)
      return res.json({ success: false, description: 'There was an error' })
    }
    if (result === false) return res.json({ success: false, description: 'Wrong password' })
    let targ = user
    if (bypassEnable) {
      targ = await db.table('users').where('username', username).first()
      if (!targ) return res.json({ success: false, description: 'Couldn\'t find the target user!' })
	  if (user.id !== targ.id && utils.isAdmin(targ.username)) return res.json({ success: false, description: 'No permission to disable this user' })
    }
    if (!bypassEnable && username !== user.username) return res.json({ success: false, description: 'No permission to disable other users' })

    await db.table('users').where('id', targ.id).update({ enabled: state })
    if (!state) {
      /* const newtoken = randomstring.generate(64)
      await db.table('users').where('token', targ.token).update({
        token: newtoken,
        timestamp: Math.floor(Date.now() / 1000)
      }) */
    }

    return res.json({success: true })
  })
}

authController.deleteAccount = async (req, res, next) => {
  let bypassEnable = false
  const user = await utils.authorize(req, res)
  if (!user.id) return
  if (user && utils.isAdmin(user.username)) bypassEnable = true

  const username = req.body.username
  const password = req.body.password
  const filesOnly = req.body.filesonly || false

  if (username === undefined) return res.json({ success: false, description: 'No username provided' })
  if (password === undefined) return res.json({ success: false, description: 'No password provided' })

  if (username === user.username && utils.isAdmin(user.username) && !filesOnly) {
    return res.json({ success: false, description: 'Cannot delete admin accounts!' })
  }
  bcrypt.compare(password, user.password, async (err, result) => {
    if (err) {
      console.log(err)
      return res.json({ success: false, description: 'There was an error' })
    }
    if (result === false) return res.json({ success: false, description: 'Wrong password' })
    let targ = user
    if (bypassEnable) {
      targ = await db.table('users').where('username', username).first()
      if (!targ) return res.json({ success: false, description: 'Couldn\'t find the target user!' })
	  if (user.id !== targ.id && utils.isAdmin(targ.username)) return res.json({ success: false, description: 'No permission to delete this user' })
    }
    if (!bypassEnable && username !== user.username) return res.json({ success: false, description: 'No permission to delete other users' })

    const newtoken = randomstring.generate(64)
    if (!filesOnly) {
      await db.table('users').where('id', targ.id).update({ enabled: 0 })
      await db.table('users').where('token', targ.token).update({
        token: newtoken,
        timestamp: Math.floor(Date.now() / 1000)
      })
    }
    const userFiles = await db.table('files')
      .where(function () {
        this.where('userid', targ.id)
      })
    for (let key in userFiles) {
      let obj = userFiles[key]
      if (obj['userid'] === targ.id) {
        uploadController.deleteFile(obj['name'])
      }
    }
    await db.table('files').where('userid', targ.id).del()
    if (!filesOnly) {
      await db.table('users').where('id', targ.id).del()
	    await db.table('albums').where('userid', targ.id).del()
    }

    return res.json({success: true })
  })
}

authController.register = async (req, res, next) => {
  let bypassEnable = false
  const token = req.headers.token || ''
  const _user = await db.table('users').where('token', token).first()
  if (_user && utils.isAdmin(_user.username)) bypassEnable = true
  if (config.enableUserAccounts === false && !bypassEnable) {
    return res.json({ success: false, description: 'Register is disabled at the moment' })
  }

  const username = req.body.username
  const password = req.body.password
  let adminpw = req.body.adminpw || ''

  if (username === undefined) return res.json({ success: false, description: 'No username provided' })
  if (password === undefined) return res.json({ success: false, description: 'No password provided' })

  if (username.length < 4 || username.length > 32) {
    return res.json({ success: false, description: 'Username must have 4-32 characters' })
  }
  if (password.length < 6 || password.length > 64) {
    return res.json({ success: false, description: 'Password must have 6-64 characters' })
  }

  // Check username chars
  let valid = true
  const _checkusr = username.split('')
  _checkusr.forEach(function (ch) {
	  if (!(usrchars.indexOf(ch) > -1)) valid = false
  })
  if (!valid) return res.json({ success: false, description: 'Username contains illegal characters. Only alphanumeric characters may be used' })

  // Check password chars
  const _checkpw = password.split('')
  _checkpw.forEach(function (ch) {
	  if (!(pwchars.indexOf(ch) > -1)) valid = false
  })
  if (!valid) return res.json({ success: false, description: `Password contains illegal characters. Only alphanumeric characters and  ${symbols}  may be used` })

  const user = await db.table('users').where('username', username).first()
  if (user) return res.json({ success: false, description: 'Username already exists' })
  return res.json({ success: false, description: 'sorry nob' })
  bcrypt.hash(password, 10, async (err, hash) => {
    if (err) {
      console.log(err)
      return res.json({ success: false, description: 'Error generating password hash (╯°□°）╯︵ ┻━┻' })
    }
    async function finalize () {
      const token = randomstring.generate(64)
      await db.table('users').insert({
		  username: username,
		  password: hash,
		  token: token,
		  enabled: 1
      })
      return res.json({ success: true, token: token })
    }
    if (!bypassEnable) return await finalize()

    bcrypt.compare(adminpw, _user.password, async (err, result) => {
      if (err) {
			  console.log(err)
			  return res.json({ success: false, description: 'There was an error' })
      }
      if (result === false) return res.json({ success: false, description: 'Wrong password' })
      return await finalize()
    })
  })
}

authController.changePassword = async (req, res, next) => {
  const user = await utils.authorize(req, res)
  if (!user.id) return
  let username = req.body.username
  if (username === undefined) username = ''
  let password = req.body.password
  let adminpw = req.body.adminpw || ''
  let random = req.body.random || false
  let currpw = req.body.currpw || ''
  if (random === 0) random = false
  if (random === 1) random = true
  if (password === undefined && random === false) return res.json({ success: false, description: 'No password provided' })
  if (random) password = randomstring.generate(8)
  if (password.length < 6 || password.length > 64) {
    return res.json({ success: false, description: 'Password must have 6-64 characters' })
  }

  if (!random) {
  // Check password chars
    let valid = true
    const _checkpw = password.split('')
    _checkpw.forEach(function (ch) {
	  if (pwchars.indexOf(ch) < 0) valid = false
    })
    if (!valid) return res.json({ success: false, description: `Password contains illegal characters. Only alphanumeric characters and " ${symbols} " may be used` })
  }
  let bypassEnable = false
  if (user && utils.isAdmin(user.username)) bypassEnable = true
  bcrypt.hash(password, 10, async (err, hash) => {
    if (err) {
      console.log(err)
      return res.json({ success: false, description: 'Error generating password hash (╯°□°）╯︵ ┻━┻' })
    }
    let targ = user
    if (bypassEnable) {
      targ = await db.table('users').where('username', username).first()
      if (!targ) return res.json({ success: false, description: 'Couldn\'t find the target user!' })
	  if (utils.isAdmin(targ.username) && user.username !== targ.username) return res.json({ success: false, description: 'You may not reset passwords of admins!' })
    }

    if (bypassEnable && targ.id !== user.id) {
      bcrypt.compare(adminpw, user.password, async (err, result) => {
        if (err) {
			  console.log(err)
			  return res.json({ success: false, description: 'There was an error' })
        }
        if (result === false) return res.json({ success: false, description: 'Wrong password' })
        await db.table('users').where('id', targ.id).update({ password: hash })
        let ret = { success: true }
        if (random) ret['newpw'] = password
        return res.json(ret)
      })
    } else {
	  bcrypt.compare(currpw, targ.password, async (err, result) => {
        if (err) {
          console.log(err)
          return res.json({ success: false, description: 'There was an error' })
        }
        if (result === false) return res.json({ success: false, description: 'Old password is wrong' })
		  await db.table('users').where('id', targ.id).update({ password: hash })
		  let ret = { success: true }
		  if (random) ret['newpw'] = password
		  return res.json(ret)
	  })
    }
  })
}

module.exports = authController
