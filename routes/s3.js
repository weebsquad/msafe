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




s3.test = function(bucket) {
	if(!s3.enabledCheck()) return;
	var params = {
		Bucket: 'metalruller',
		bucket: 'metalruller',
		maxkeys: 0,
		MaxKeys: 0,
	};
	s3.client.listObjects(params, function(err, data) {
		if (err) console.log(err, err.stack); // an error occurred
		else console.log(data);
	});
};






s3.initialize = function() {
	if(!s3.enabledCheck()) return;
	s3['client'] = libs3.createClient(clientOpts);
	s3['url'] = libs3.getPublicUrl(optionsS3.bucket, optionsS3.secretAccessKey);
	console.log(s3);
	s3.test(optionsS3.bucket);
};

module.exports = s3;