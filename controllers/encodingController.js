const charmap = require('../charmap.js');

const encodingController = {};

/*

	

	function map_encode($string, $version, $charmapFile) {
		$sepperator = '';
		
		$charmap = json_decode(file_get_contents($charmapFile), true);
		$charmap = $charmap[$version];
		$sepp = $charmap["sepperator"];
		$prefix = $charmap['prefix'];
		$suffix = $charmp['suffix'];
		if(!isset($prefix)) $prefix = '';
		if(!isset($suffix)) $suffix = '';

		$encoded = '';
		$splitq = str_split($string);
		foreach ($splitq as $char) {
			$encoded = $encoded . $sepperator . $charmap[$char];
			$sepperator = $sepp; // Restore the sepperator just so its not used in the first iteration
		}
		
		$encoded = $prefix . $encoded . $suffix;
		return $encoded;
	}
	


*/



encodingController.decode = function(string, version) {
	let decoded = '';
	const vchar = charmap[version];
	const prefix = vchar['prefix'];
	const suffix = vchar['suffix'];
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
	
	return '';
};








module.exports = encodingController;