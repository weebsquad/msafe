const requireUncached = require('require-uncached');
const charmap = requireUncached('../charmap.js');

const encodingController = {};

/*

	



*/



encodingController.decode = function(string, version) {
	let decoded = '';
	const vchar = charmap[version];
	let prefix = vchar['prefix'];
	let suffix = vchar['suffix'];
	const sepp = vchar['sepperator'];
	if(typeof(prefix) !== 'string') prefix = '';
	if(typeof(suffix) !== 'string') suffix = '';
	
	if(prefix !== '' && string.indexOf(prefix) > -1) {
		// Has prefix
	}
	if(suffix !== '' && string.indexOf(suffix) > -1) {
		// Has suffix
	}
	
	const split = string.split(sepp);
	split.forEach(function(char) {
		let decodedchar = '';
		for(var key in vchar) {
			const obj = vchar[key];
			if(obj === char) decodedchar = key;
		}
		decoded = decoded + decodedchar;
	});
	
	return decoded;
};


encodingController.encode = function(string, version) {
	//console.log(`Encoding ${string} with version ${version}`);
	let encoded = '';
	let sepperator = '';
	let vchar = charmap[version];
	const sepp = vchar['sepperator'];
	let prefix = vchar['prefix'];
	let suffix = vchar['suffix'];
	if(typeof(prefix) !== 'string') prefix = '';
	if(typeof(suffix) !== 'string') suffix = '';
	

	let splitq = string.split('');
	splitq.forEach(function(char) {
		encoded = encoded + sepperator + vchar[char];
		sepperator = sepp;
	});

	encoded = prefix + encoded + suffix;
	return encoded;
};








module.exports = encodingController;