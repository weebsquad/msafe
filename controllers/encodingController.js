let config = require('../config.js')
const requireUncached = require('require-uncached')
const fs = require('fs');
let db = require('knex')(config.database)
const encodingController = {}

encodingController.decode = async function (string, version, checkmysql = false) {
  if(!fs.existsSync('./charmap.js')) {
	  console.error(`Can't accept encoded uploads, charmap.js does not exist`);
	  return;
  }
  let decoded = ''
  if(checkmysql || typeof(version) !== 'number') {
	const encFile = await db.table('files').where(function () { this.where('encodeVersion', '>', 0).andWhereNot('encodedString', '').andWhere('encodedString', string) }).first()
	if (encFile) return encFile['name'];
	/*
	const encFile2 = await db.table('files').where(function () { 
		this.where('encodeVersion', '>', 0).andWhereNot('encodedString', '').andWhere('encodedString', 'like', `%${string}%`) 
	}).first()
	
	console.log(encFile2);*/
	let charmap = requireUncached('../charmap.js');
	let idf
	for(var cVer in charmap) {
		let obj = charmap[cVer];
		// if it has prefix or suffix, skip
		if(typeof(obj['prefix']) === 'string' || typeof(obj['suffix'])) continue;
		let seperator = obj['sepperator'];
		// get a list of all chars on this format
		let chars = new Array();
		for(var mapKey in obj) {
			if(mapKey.length > 1) continue; // Skip stuff like prefix and sepperators.
			let mapRes = obj[mapKey];
			let toAdd = new Array();
			if(mapRes.length > 1) {
				let _charsm = mapRes.split('');
				_charsm.forEach(function(ele) { toAdd.push(ele); });
			} else {
				toAdd.push(mapRes);
			}
			for(var i = 0; i < toAdd.length; i++) {
				let _ex = chars.find(function(ele) {
					if(ele === toAdd[i]) return true;
				});
				if(_ex !== true) chars.push(toAdd[i]);
			}
		}
		console.log(`Version ${cVer} :`);
		console.log(chars);
	}	
  } else {
	  let charmap = requireUncached('../charmap.js');
	  const vchar = charmap[version]
	  let prefix = vchar['prefix']
	  let suffix = vchar['suffix']
	  const sepp = vchar['sepperator']
	  if (typeof (prefix) !== 'string') prefix = ''
	  if (typeof (suffix) !== 'string') suffix = ''

	  if (prefix !== '' && string.indexOf(prefix) > -1) {
		// Has prefix
	  }
	  if (suffix !== '' && string.indexOf(suffix) > -1) {
		// Has suffix
	  }

	  const split = string.split(sepp)
	  split.forEach(function (char) {
		let decodedchar = ''
		for (var key in vchar) {
		  const obj = vchar[key]
		  if (obj === char) decodedchar = key
		}
		decoded = decoded + decodedchar
	  })
  }
  return decoded
}

encodingController.encode = function (string, version) {
  if(!fs.existsSync('./charmap.js')) {
	console.error(`Can't accept encoded uploads, charmap.js does not exist`);
	return;
  }
  let charmap = requireUncached('../charmap.js');
  let encoded = ''
  let sepperator = ''
  let vchar = charmap[version]
  if (typeof (vchar) !== 'object') return string
  const sepp = vchar['sepperator']
  let prefix = vchar['prefix']
  let suffix = vchar['suffix']
  if (typeof (prefix) !== 'string') prefix = ''
  if (typeof (suffix) !== 'string') suffix = ''

  let splitq = string.split('')
  splitq.forEach(function (char) {
    encoded = encoded + sepperator + vchar[char]
    sepperator = sepp
  })

  encoded = prefix + encoded + suffix
  return encoded
}

module.exports = encodingController
