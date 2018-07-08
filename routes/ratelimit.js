const config = require('../config.js')
const routes = require('express').Router()
const express = require('express')
const RateLimit = require('express-rate-limit')
const db = require('knex')(config.database)
const path = require('path')

let rateLimiting = {};

rateLimiting.keyGen = async function (req, res) {
  let key = req.ip
  const token = req.headers.token
  if (token) {
    const user = await db.table('users').where('token', token).first()
    if (user && (!config.enableUserAccounts || !config.private)) key = user.id // Should probably store ips/ids on a array and compare them, make a matching key for them and match it here but too fucking lazy lmao
  }
  return key
}


rateLimiting.updateCache = async function(token) {
	const usr = await db.table('users').where('token', token).first()
	if(userCache[token] !== usr) userCache[token] = usr;
}

let userCache = [];
rateLimiting.skipHandler = function(req) {
  const token = req.headers.token
  if (token && (config.adminsBypassRatelimiting === true || config.usersBypassRateLimiting.length > 0)) {
    const user = userCache[token];
    if (user !== undefined && (config.usersBypassRateLimiting.indexOf(user.username) > -1 || (config.adminsBypassRatelimiting === true && config.admins.indexOf(user.username) > -1))) return true
	updateCache(token);
  }
  return false
}


rateLimiting.limitedHandler = function(options, req, res, next) {
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


rateLimiting.load = function(safe) {
	for (let key in config.rateLimits) {
	  let obj = config.rateLimits[key]
	  let _a = function (req, res, next) {
		rateLimiting.limitedHandler(obj, req, res, next)
	  }
	  obj['handler'] = _a
	  obj['keyGenerator'] = rateLimiting.keyGen
	  obj['skip'] = rateLimiting.skip
	  let rl = new RateLimit(obj)
	  safe.use(key, rl)
	}
}


module.exports = rateLimiting;