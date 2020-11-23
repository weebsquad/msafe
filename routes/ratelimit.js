/* eslint-disable no-mixed-spaces-and-tabs */
/* eslint-disable no-unused-vars */
const config = require('../config.js');
const RateLimit = require('../lib/express-rate-limit');
const db = require('knex')(config.database);

let rateLimiting = {};
let userCache = [];

rateLimiting.keyGen = async function (req, res) {
	let key = req.ip;
	const token = req.headers.token;
	if (token) {
		const user = await db.table('users').where('token', token).first();
		if (user && (!config.enableUserAccounts && config.private)) key = user.id; // Should probably store ips/ids on a array and compare them, make a matching key for them and match it here but too fucking lazy lmao
	}

	return key;
};

/*
rateLimiting.updateCache = async function (token) {
  const usr = await db.table('users').where('token', token).first()
  if (userCache[token] !== usr) userCache[token] = usr
}
*/

/*
rateLimiting.skipHandler = function (req, res) {
  const token = req.headers.token
  if (token && (config.adminsBypassRatelimiting === true || config.usersBypassRateLimiting.length > 0)) {
    const user = userCache[token]
    if (user !== undefined && (config.usersBypassRateLimiting.indexOf(user.username) > -1 || (config.adminsBypassRatelimiting === true && config.admins.indexOf(user.username) > -1))) return true
    rateLimiting.updateCache(token)
  }
  return false
}
*/

rateLimiting.skipHandler = async function (req, res) {
	const token = req.headers.token;
	if (token && (config.adminsBypassRatelimiting === true || config.usersBypassRateLimiting.length > 0)) {
		const usr = await db.table('users').where('token', token).first();
		if (usr !== undefined && (config.usersBypassRateLimiting.indexOf(usr.username) > -1 || (config.adminsBypassRatelimiting === true && config.admins.indexOf(usr.username) > -1))) return true;
	}
	return false;
};

rateLimiting.limitedHandler = function (options, req, res, next) {
	let retrya = Math.ceil(options.windowMs / 1000);
	if (req.rateLimit) {
	  let diff = new Date(req.rateLimit.lastReset);
	  retrya = req.rateLimit.lastReset - new Date();
	  retrya = options.windowMs + retrya;
	  retrya = Math.floor(retrya / 1000);
	  retrya = Math.max(retrya, 0);
	}
	// if(req.rateLimit) retrya = Math.max(options.max - req.rateLimit.current, 0)
	if (options.headers) {
		res.setHeader('Retry-After', retrya);
	}
	let json = { success: false, description: options.message, retryAfter: retrya };
	res.format({
		html: function () {
			res.status(options.statusCode).end(JSON.stringify(json));
		},
		json: function () {
			res.status(options.statusCode).json(json);
		}
	});
	res.end();
};

rateLimiting.load = function (safe, nolog = false) {
	let i = 0;
	for (let key in config.rateLimits) {
	  let obj = config.rateLimits[key];
	  let _a = function (req, res, next) {
			rateLimiting.limitedHandler(obj, req, res, next);
	  };
	  obj['handler'] = _a;
	  obj['keyGenerator'] = rateLimiting.keyGen;
	  obj['skip'] = rateLimiting.skipHandler;
	  obj['skipFailedRequests'] = config.skipFails;
	  if (obj['autoDelays'] === true) {
		  delete obj['autoDelays'];
		  let delayAft = Math.round((obj['max']) * 0.75);
		  let delayMs = Math.round((obj['windowMs'] / delayAft) * 0.9);
		  obj['delayMs'] = delayMs;
		  obj['delayAfter'] = delayAft;
	  }
	  let rl = new RateLimit(obj);
	  safe.use(key, rl);
	  i++;
	}
	if (!nolog) console.log(`[RL] Loaded ${i} ratelimits!`);
};

module.exports = rateLimiting;
