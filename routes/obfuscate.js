const config = require('../config.js')
const fs = require('fs')
const jsObfuscator = require('javascript-obfuscator')
const db = require('knex')(config.database)
const path = require('path')

let obfuscation = {}

let fileCache = {}

obfuscation.configGen = function (options) {
  let ret = options
  ret['domainLock'] = new Array(config.domain)
  ret['disableConsoleOutput'] = false // So we can get error logs from clients
  ret['config'] = '' // We're not using a config file.
  ret['debugProtection'] = false // Again, we want error logs.
  ret['inputFileName'] = '' // We're not using external files
  ret['log'] = false // No clue
  ret['renameGlobals'] = false // Lets not break our code
  ret['target'] = 'browser' // This only runs on browsers
  return ret
}

obfuscation.fetchOptions = function () {
  let _h = config.obfuscatorOptions
  _h = configGen(_h)
  return _h
}

obfuscation.obfuscateRun = function (source, options) {
  return jsObfuscator.obfuscate(source, options).getObfuscatedCode()
}

obfuscation.obfuscate = function (source) {
  return obfuscation.obfuscateRun(source, obfuscation.fetchOptions())
}

obfuscation.obfuscateFile = function (filePath) {
  if (typeof (fileCache[filePath]) === 'string') return fileCache[filePath]
  const source = fs.readFileSync(filePath)
  fileCache[filePath] = obfuscation.obfuscate(source)
  return fileCache[filePath]
}

module.exports = obfuscation
