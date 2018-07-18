let config = require('../config.js')
let uploadController = require('../controllers/uploadController')
let albumsController = require('../controllers/albumsController')
let tokenController = require('../controllers/tokenController')
let authController = require('../controllers/authController')
let route = require('express').Router()

let api = {}

function check (req, res, next) {
  return res.json({
    private: config.private,
    maxFileSize: config.uploads.maxSize,
    register: config.enableUserAccounts,
    encoding: config.allowEncoding,
    usingS3: config.s3.use,
    blockedExtensions: config.blockedExtensions
  })
}

function nothingFunc (req, res, next) {
  return res.send('Nothing here!')
}

const map = {
  'get': {
    'check': check,
    'admins': authController.listAdmins,
    'account/list': authController.listAccounts,
    'uploads': uploadController.list,
    'uploads/:page': uploadController.list,
    'album/get/:identifier': albumsController.get,
    'album/zip/:identifier': albumsController.generateZip,
    'album/:id': uploadController.list,
    'album/:id/:page': uploadController.list,
    'albums': albumsController.list,
    'albums/:sidebar': albumsController.list,
    //		'albums/test': albumsController.test,
    'tokens': tokenController.list,
    '': nothingFunc
  },
  'post': {
    'login': authController.verify,
    'register': authController.register,
    'account/delete': authController.deleteAccount,
    'account/disable': authController.disableAccount,
    'password/change': authController.changePassword,
    'upload': uploadController.upload,
    'upload/delete': uploadController.delete,
    'upload/:albumid': uploadController.upload,
    'albums': albumsController.create,
    'albums/delete': albumsController.delete,
    'albums/rename': albumsController.rename,
    'tokens/verify': tokenController.verify,
    'tokens/change': tokenController.change
  }
}

function setRoutes (routes) {
  for (let type in map) {
	  for (let key in map[type]) {
      let obj = map[type][key]
      routes[type](`/${key}`, (req, res, next) => obj(req, res, next))
      console.log(`Loaded API ${type.toUpperCase()} route '/${key}'`)
	  }
  }
  api.routes = routes
}

api.reloadModules = function (requireUncached) {
  console.log('Reloading API');
  config = requireUncached('../config.js')
  uploadController = requireUncached('../controllers/uploadController')
  uploadController.reloadModules(requireUncached)
  albumsController = requireUncached('../controllers/albumsController')
  albumsController.reloadModules(requireUncached)
  tokenController = requireUncached('../controllers/tokenController')
  tokenController.reloadModules(requireUncached)
  authController = requireUncached('../controllers/authController')
  authController.reloadModules(authController)
  route = require('express').Router()
  setRoutes(route)
  console.log('Done!');
}

setRoutes(route)
module.exports = api
