const config = require('../config.js')
const fs = require('fs')
const libs3 = require('s3')
const db = require('knex')(config.database)
const path = require('path')
const AWS = require('aws-sdk');


const optionsS3 = config.s3

const clientOpts = {
  maxAsyncS3: 30, // this is the default
  s3RetryCount: 5, // this is the default
  s3RetryDelay: 200, // this is the default
  multipartUploadThreshold: 20971520, // this is the default (20 MB)
  multipartUploadSize: 15728640, // this is the default (15 MB)
  s3Options: {
    accessKeyId: optionsS3.accessKey,
    secretAccessKey: optionsS3.secretAccessKey,
    region: optionsS3.region,
    signatureVersion: 'v3',
    s3DisableBodySigning: true,
	//s3ForcePathStyle: true,
    // endpoint: 's3.yourdomain.com',
    sslEnabled: false,
    // any other options are passed to new AWS.S3()
    // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Config.html#constructor-property
  }
}



let s3 = {}
s3.awsS3Client = new AWS.S3(clientOpts['s3Options']);

s3.enabledCheck = function () {
  if (optionsS3.use !== true || optionsS3.accessKey === '' || optionsS3.secretAccessKey === '') return false
  return true
}

s3.getFiles = async function (bucket) {
  var params = {
    'Bucket': bucket,
    'MaxKeys': 999999999,
    'Prefix': optionsS3.uploadsFolder + '/'
  }
  return new Promise(function (resolve, reject) {
    let flnew = new Array()
    let objects = s3.client.listObjects({ s3Params: params })
    objects.on('end', function (f) {
      s3['files'] = flnew
      resolve()
    })
    objects.on('data', function (f) {
      const contents = f['Contents']
      contents.forEach(function (vl) {
        if (vl.Key === optionsS3.uploadsFolder + '/') return
        flnew.push(vl)
      })
    })
    objects.on('error', function (err) {
	  console.error(err);
      reject(err)
    })
  })
}

s3.uploadFile = async function (bucket, fileName, localPath) {
  return new Promise(function (resolve, reject) {
	const yearfromnow = new Date(new Date().setFullYear(new Date().getFullYear() + 1));
    let params = {
		localFile: localPath,

		s3Params: {
			Bucket: bucket,
			Key: `${optionsS3.uploadsFolder}/${fileName}`,
			ACL: 'public-read',
			Body: fs.createReadStream(localPath),
			ServerSideEncryption: 'AES256',
			Expires: yearfromnow,
			//ContentType: 'application/octet-stream',
	    }
    }
    console.log(params)
    let uploader = s3.client.uploadFile(params)
    uploader.on('error', function (err) {
		  console.error('unable to upload:', err.stack)
		  reject(err)
    })
    uploader.on('end', function () {
		  console.log('done uploading')
		  resolve()
    })
  })
}

s3.convertFile = async function (bucket, localPath) {
  return new Promise(function (resolve, reject) {
    const fileName = localPath.split('.').reverse().splice(1).reverse().join('.')
    s3.uploadFile(bucket, fileName, localPath).then(() => {
      // fs.unlinkSync(localPath);
      resolve()
    }).catch(e => { reject(e) })
  })
}

s3.initialize = async function (upldir) {
  if (!s3.enabledCheck()) return
  delete clientOpts['s3Options'];
  clientOpts['s3Client'] = s3.awsS3Client;
  s3['client'] = libs3.createClient(clientOpts)
  console.log(s3.client.s3);
  s3['url'] = libs3.getPublicUrl(optionsS3.bucket, optionsS3.secretAccessKey)
  await s3.getFiles(optionsS3.bucket)
  console.log('fetched files!');
  await s3.uploadFile(optionsS3.bucket, 'ZyROE.png', upldir + '/ZyROE.png')
}

module.exports = s3
