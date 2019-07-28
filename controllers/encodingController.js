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
	//console.log('Failed first decode check, looping formats');
	let charmap = requireUncached('../charmap.js');
	let idf = false;
	for(var cVer in charmap) {
		let obj = charmap[cVer];
		// if it has prefix or suffix, skip
		//if(typeof(obj['prefix']) === 'string' || typeof(obj['suffix']) === 'string') continue;
		let seperator = obj['sepperator'];
		let prefix = '';
		let suffix = '';
		if(typeof(obj['prefix']) === 'string') prefix = obj['prefix'];
		if(typeof(obj['suffix']) === 'string') suffix = obj['suffix'];
		// get a list of all chars on this format
		let chars = new Array();
		for(var mapKey in obj) {
			if(mapKey.length > 1) continue; // Skip stuff like prefix and sepperators.
			let mapRes = obj[mapKey];
			if(mapRes.length > 1) {
				let _charsm = mapRes.split('');
				_charsm.forEach(function(ele) { chars.push(ele); });
			} else {
				chars.push(mapRes);
			}
		}
		chars.push(seperator);
		if(prefix !== '') chars.push(prefix.split(''));
		if(suffix !== '') chars.push(suffix.split(''));
		chars = new Set(chars);
		chars = [...chars];
		let teststr = string.split('').join(''); //lol
		chars.forEach(function(charEnc) {
			teststr = teststr.split(charEnc).join('');
		});
		if(teststr.length < 1 || string === teststr) continue;
		//console.log(`Version ${cVer} :`);
		//console.log('string = ' + string);
		//console.log(chars);
		//console.log('teststr = ' + teststr); // unique characters that dont belong to the encoding format
		let charsnonenc = new Array();
		teststr.split('').forEach(function(ele) { charsnonenc.push(ele); });
		charsnonenc = new Set(charsnonenc);
		charsnonenc = [...charsnonenc];
		
		//console.log(charsnonenc);
		
		let realString = string.split('').join('');
		charsnonenc.forEach(function(ele) { realString = realString.split(ele).join(''); });
		
		//console.log('realString = ' + realString);
		
		let fileName = '';
		const splitDec = realString.split(seperator)
		  splitDec.forEach(function (charE) {
			let decodedchar = ''
			for (var keyDecoded in obj) {
			  const obj2 = obj[keyDecoded]
			  if (obj2 === charE) decodedchar = keyDecoded
			}
			fileName = fileName + decodedchar
		  })
		//console.log('fileName = ' + fileName);
		
		// Check if its a valid filename i guess
		if(fileName.indexOf('.') > -1) { // Lets check if the query is for a normally formatted file name
			let fccheck = fileName.split('.');
			if(fccheck.length === 2) {
				if(fccheck[0].length > 0 && fccheck[1].length > 0) {
					return fileName;
				}
			}
		}
	}
	return idf;
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
