let config = require('../config.js')
let uploadController = require('../controllers/uploadController')
let albumsController = require('../controllers/albumsController')
let tokenController = require('../controllers/tokenController')
let authController = require('../controllers/authController')
let route = require('express').Router()


function shallowCopy(obj) {
    var result = {};
    for (var i in obj) {
        result[i] = obj[i];
    }
    return result;
}

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



const map = {
  'get': {
    'check': {
		'function': check,
		'auth': false,
	},
    'admins': {
		'function': authController.listAdmins,
		'auth': true,
		'admin': true,
	},
	'admincheck': {
		'function': authController.adminCheck,
		'auth': true,
	},
    'account/list': {
		'function': authController.listAccounts,
		'auth': true,
		'admin': true,
	},
    'uploads': {
		'function': uploadController.list,
		'auth': true,
	},
    'uploads/:page': {
		'function': uploadController.list,
		'auth': true,
	},
    'gdelete/:deletekey': {
		'function': uploadController.delete,
	},
    'album/get/:identifier': {
		'function': albumsController.get,
	},
    'album/zip/:identifier': {
		'function': albumsController.generateZip,
		'disabled': true,
	},
    'album/:id': {
		'function': uploadController.list,
		'auth': true,
	},
    'album/:id/:page': {
		'function': uploadController.list,
		'auth': true,
	},
    'albums': {
		'function': albumsController.list,
		'auth': true,
	},
    'albums/:sidebar': {
		'function': albumsController.list,
		'auth': true,
	},
    'tokens': {
		'function': tokenController.list,
		'auth': true,
	},
	
	// base call
    '': {
		'function': function (req, res, next) {
		  return res.send('Nothing here!')
		}
	},
	
  },
  'post': {
    'login': {
		'function': authController.verify,
		'auth': false,
	},
    'register': {
		'function': authController.register,
		'auth': false,
	},
    'account/delete': {
		'function': authController.deleteAccount,
		'auth': true,
	},
    'account/disable': {
		'function': authController.disableAccount,
		'auth': true,
	},
    'password/change': {
		'function': authController.changePassword,
		'auth': true,
	},
    'upload': {
		'function': uploadController.upload,
		'auth': config.private,
	},
    'upload/delete': {
		'function': uploadController.delete,
		'auth': true,
	},
    'upload/:albumid': {
		'function': uploadController.upload,
		'auth': true,
	},
    'albums': {
		'function': albumsController.create,
		'auth': true,
	},
    'albums/delete': {
		'function': albumsController.delete,
		'auth': true,
	},
    'albums/rename': {
		'function': albumsController.rename,
		'auth': true,
	},
    'tokens/verify': {
		'function': tokenController.verify,
	},
    'tokens/change': {
		'function': tokenController.change,
		'auth': true,
	}
  }
}
const defaults = {
	'admin': false,
	'auth': false,
	'disabled': false,
};


const callHandlers = {
	'success': function (req, res, next, callbackFunction, user) {
		if(typeof(user) !== 'undefined') req.user = user;
		callbackFunction(req, res, next);
	},
	'disabled': function(req, res, next) {
		return res.json({ 'success': false, 'description': 'This API call is disabled' })
	},
	'adminOnly': function(req, res, next, user) {
		if (config.admins.indexOf(name) > -1) return true
		return false
	},
};

function setRoutes (routes, log = true) {
  let i = 0
  for (let type in map) {
	  for (let key in map[type]) {
		  let obj = map[type][key]
		  let _objc = shallowCopy(obj);

		  for(var key2 in defaults) { 
			if(typeof(_objc[key2]) !== typeof(defaults[key2])) _objc[key2] = defaults[key2]; 
		  }

		  _objc.function = obj.function;
		  obj = _objc;
		  
				  
		  if(typeof(obj['function']) === 'function') {
			  
			  let _handleCall = async function(req, res, next, _callbackFunction, _options) {
				  
				  // Handle disabled
				  if(_options.disabled === true) return callHandlers.disabled(req, res, next);
				  
				  // Handle auth
				  let user;
				  if(_options.auth === true || _options.admin === true) { 
					user = await utils.authorize(req, res)
					if(!user.id) return;
				  }
				  
				  if(_options.admin === true) {
					if(callHandlers.adminOnly(req, res, next, user)) return;
				  }

				  callHandlers.success(req, res, next, _callbackFunction, user);
			  }
			  
			  let _opts = shallowCopy(obj);
			  delete _opts['function'];
			  
			  routes[type](`/${key}`, (req, res, next) => _handleCall(req, res, next, obj['function'], _opts))
			  if (log) console.log(`Loaded API ${type.toUpperCase()} route '/${key}'`)
			  i++
		  } else {
			  console.log(`Error with API call ${type.toUpperCase()} - '/${key}' - No callback func defined!`);
			}
	  }
  }
  console.log(`Loaded ${i} API routes!`)
  api.routes = routes
}

api.reloadModules = function () {
  require.cache = new Array()
  config = require('../config.js')
  uploadController = require('../controllers/uploadController')
  uploadController.reloadModules()
  albumsController = require('../controllers/albumsController')
  albumsController.reloadModules()
  tokenController = require('../controllers/tokenController')
  tokenController.reloadModules()
  authController = require('../controllers/authController')
  authController.reloadModules()
  route = require('express').Router()
  setRoutes(route, false)
  console.log('Reloaded')
}

setRoutes(route, true)
module.exports = api
