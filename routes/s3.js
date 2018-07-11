const config = require('../config.js')
const fs = require('fs')
const libs3 = require('s3')
const db = require('knex')(config.database)
const path = require('path')

const optionsS3 = config.s3;
const clientOpts = {
  maxAsyncS3: 30,     // this is the default
  s3RetryCount: 5,    // this is the default
  s3RetryDelay: 200, // this is the default
  multipartUploadThreshold: 20971520, // this is the default (20 MB)
  multipartUploadSize: 15728640, // this is the default (15 MB)
  s3Options: {
    accessKeyId: optionsS3.accessKey,
    secretAccessKey: optionsS3.secretAccessKey,
    region: optionsS3.region,
    // endpoint: 's3.yourdomain.com',
    // sslEnabled: false
    // any other options are passed to new AWS.S3()
    // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Config.html#constructor-property
  },
};

let s3 = {};


s3.enabledCheck = function() {
	if(optionsS3.use !== true || optionsS3.accessKey === '' || optionsS3.secretAccessKey === '') return false;
	return true;
};




s3.getFiles = async function(bucket) {
	if(!s3.enabledCheck()) return;
	var params = {
		'Bucket': bucket,
		'MaxKeys': 999999999,
		'Prefix': optionsS3.uploadsFolder + '/',
	};
	return new Promise(function(resolve, reject) {
		let flnew = new Array();
		let objects = s3.client.listObjects({ s3Params: params });
		objects.on('end', function(f) {
			s3['files'] = flnew;
			resolve();
		});
		objects.on('data', function(f) {
			const contents = f['Contents'];
			contents.forEach(function(vl) {
				if(vl.Key === optionsS3.uploadsFolder + '/') return;
				flnew.push(vl);
			});
		});
	});
};






s3.initialize = async function() {
	if(!s3.enabledCheck()) return;
	s3['client'] = libs3.createClient(clientOpts);
	s3['url'] = libs3.getPublicUrl(optionsS3.bucket, optionsS3.secretAccessKey);
	await s3.getFiles(optionsS3.bucket);
	console.log(s3.files);
};

module.exports = s3;