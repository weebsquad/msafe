'use strict';
function MemoryStore (windowMs) {
	var hits = {};
	let lastreset = new Date();
	this.incr = function (key, cb) {
		if (hits[key]) {
			hits[key]++;
		} else {
			hits[key] = 1;
		}

		cb(null, hits[key]);
	};

	this.decrement = function (key) {
		if (hits[key]) {
			hits[key]--;
		}
	};

	// export an API to allow hits all IPs to be reset
	this.resetAll = function () {
		hits = {};
	};

	// export an API to allow hits from one IP to be reset
	this.resetKey = function (key) {
		delete hits[key];
	};

	this.lastReset = function () {
		return lastreset;
	};
	// simply reset ALL hits every windowMs
	var interval = setInterval(this.resetAll, windowMs);
	if (interval.unref) {
		interval.unref();
		lastreset = new Date();
	}
}

module.exports = MemoryStore;
