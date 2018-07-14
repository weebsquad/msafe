const config = require('../config.js')
const routes = require('express').Router()
const uploadController = require('../controllers/uploadController')
const albumsController = require('../controllers/albumsController')
const tokenController = require('../controllers/tokenController')
const authController = require('../controllers/authController')

function check (req, res, next) {
  return res.json({
    private: config.private,
    maxFileSize: config.uploads.maxSize,
    register: config.enableUserAccounts
  })
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
    'tokens': tokenController.list
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

for (let type in map) {
  for (let key in map[type]) {
    let obj = map[type][key]
    routes[type](`/${key}`, (req, res, next) => obj(req, res, next))
  }
}

routes.get('/', (req, res, next) => {
  return res.send('Nothing here!')
})

module.exports = routes
