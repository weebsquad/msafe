/* eslint-disable no-unused-vars */
/* eslint-disable no-async-promise-executor */
/* eslint-disable no-mixed-spaces-and-tabs */
let config = require('../config.js');
let db = require('knex')(config.database);
const s3 = require('../routes/s3.js');
const path = require('path');
const fs = require('fs');
const gm = require('gm');
const ffmpeg = require('fluent-ffmpeg');

const utilsController = {};
utilsController.imageExtensions = config.imageExtensions;
utilsController.videoExtensions = config.videoExtensions;
utilsController.noThumbnail = config.noThumbnail;

utilsController.reloadModules = function (require) {
	require.cache = new Array();
	config = require('../config.js');
	db = require('knex')(config.database);
};

utilsController.getPrettyDate = function (date) {
	return date.toGMTString();
	/*return date.getFullYear() + '-' +
		(date.getMonth() + 1) + '-' +
		date.getDate() + ' ' +
		(date.getHours() < 10 ? '0' : '') +
		date.getHours() + ':' +
		(date.getMinutes() < 10 ? '0' : '') +
		date.getMinutes() + ':' +
		(date.getSeconds() < 10 ? '0' : '') +
		date.getSeconds();*/
};

utilsController.isAdmin = function (name) {
	if (config.admins.indexOf(name) > -1) return true;
	return false;
};

utilsController.authorize = async (req, res) => {
	const token = req.headers.token;
	if (token === undefined) return res.status(401).json({ success: false, description: 'No token provided' });

	const user = await db.table('users').where('token', token).first();
	if (!user) return res.status(401).json({ success: false, description: 'Invalid token' });
	if ((user.enabled === 0 || user.enabled === false) && !utilsController.isAdmin(user.username)) return res.status(401).json({ success: false, description: 'This account has been disabled' });
	return user;
};

utilsController.generateThumbs = async function (file, basedomain) {
	if (config.uploads.generateThumbnails !== true) return;
	const ext = path.extname(file.name).toLowerCase();
	await new Promise(async function (resolve) {
		async function tryS3 (_extension) {
		  if (s3.enabledCheck()) {
				let extt = `${_extension}`;
		  		if (utilsController.noThumbnail.includes(_extension) || (!utilsController.videoExtensions.includes(_extension) && !utilsController.imageExtensions.includes(_extension))) {resolve(); return;}
		  		// if (utilsController.videoExtensions.includes(_extension) || _extension === '.gif') extt = '.png'
		  		extt = '.png'; // Apparently it's always png lol
		  		let fn = file.name.split('.')[0];
		  		fn = `${fn}${extt}`;
		  		const _thumbs = path.join(__dirname, '..', config.uploads.folder, 'thumbs') + `/${fn}`;
				if (fs.existsSync(_thumbs)) {
					await s3.convertFile(s3.options.bucket, _thumbs, `thumbs/${fn}`);
				}
				resolve();
			} else {
				resolve();
			}
	  }

	  let thumbname = path.join(__dirname, '..', config.uploads.folder, 'thumbs', file.name.slice(0, -ext.length) + '.png');
	  fs.access(thumbname, err => {
			if (err && err.code === 'ENOENT') {
		  		if (utilsController.videoExtensions.includes(ext)) {
					ffmpeg(path.join(__dirname, '..', config.uploads.folder, file.name))
			  			.thumbnail({
							timestamps: [0],
							filename: '%b.png',
							folder: path.join(__dirname, '..', config.uploads.folder, 'thumbs'),
							size: '200x?'
			  			})
			  			.on('error', error => { console.log('FFMPEG Error - ', error.message); return; })
			  			.on('end', async function () {
							await tryS3(ext);
			  			});
		  		} else {
					const size = {
			  			width: 200,
			  			height: 200
					};
					gm(path.join(__dirname, '..', config.uploads.folder, file.name))
			  			.resize(size.width, size.height + '>')
			  			.gravity('Center')
			  			.extent(size.width, size.height)
			  			.background('transparent')
			  			.write(thumbname, async function (error) {
							if (error) { console.log('GM Error - ', error); return; }
							await tryS3(ext);
			  			});
		 		}
			}
		});
	});
};

utilsController.isNumeric = function (n) {
	return !isNaN(n);
};

module.exports = utilsController;
