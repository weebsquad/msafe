const config = require('../config.js')
const fs = require('fs')
const libs3 = require('s3')
const db = require('knex')(config.database)
const path = require('path')
const AWS = require('aws-sdk')
const request = require('request')
const http = require('http')

let initialized = false
let s3 = {}
const optionsS3 = config.s3
s3.imageExtensions = config.imageExtensions
s3.videoExtensions = config.videoExtensions
s3.noThumbnail = config.noThumbnail

const clientOpts = {
  maxAsyncS3: 30, // this is the default
  s3RetryCount: 5, // this is the default
  s3RetryDelay: 200, // this is the default
  multipartUploadThreshold: 104857600, // this is the default (20 MB) // 100mb
  multipartUploadSize: 15728640, // this is the default (15 MB)
  s3Options: {
    accessKeyId: optionsS3.accessKey,
    secretAccessKey: optionsS3.secretAccessKey,
    region: optionsS3.region,
    signatureVersion: 'v3',
    s3DisableBodySigning: true,
    // s3ForcePathStyle: true,
    // endpoint: 's3.yourdomain.com',
    sslEnabled: true
    // any other options are passed to new AWS.S3()
    // See: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Config.html#constructor-property
  }
}

s3.options = optionsS3
s3.awsS3Client = new AWS.S3(clientOpts['s3Options'])

s3.enabledCheck = function () {
  if (optionsS3.use !== true || optionsS3.accessKey === '' || optionsS3.secretAccessKey === '') return false
  return true
}

s3.getExpireDate = function (start, adminFile = false) {
  start = new Date(start)
  let expdate = new Date(start.setFullYear(start.getFullYear() + optionsS3.expireValue))
  if (adminFile) expdate = new Date(start.setFullYear(start.getFullYear() + 100))
  return expdate
}

s3.getFiles = async function (bucket) {
  var params = {
    'Bucket': bucket,
    'MaxKeys': 99999999999,
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
        // console.log(vl);
        flnew.push(vl)
      })
    })
    objects.on('error', function (err) {
	  console.error(err)
      reject(err)
    })
  })
}

s3.uploadFile = async function (bucket, fileName, localPath, dbId = '', adminFile = false) {
  return new Promise(function (resolve, reject) {
    let expdate
    expdate = s3.getExpireDate(new Date(), adminFile)
    let params = {
      localFile: localPath,

      s3Params: {
        Bucket: bucket,
        Key: `${optionsS3.uploadsFolder}/${fileName}`,
        ACL: 'public-read',
        // Body: fs.createReadStream(localPath),
        ServerSideEncryption: 'AES256'
        // ContentType: 'application/octet-stream',
	    }
    }

    if (typeof (expdate) !== 'undefined') params.s3Params.Expires = expdate

    // console.log(params)
    let uploader = s3.client.uploadFile(params)
    uploader.on('error', function (err) {
		  console.error('unable to upload:', err.stack)
		  reject(err)
    })
    uploader.on('end', async function () {
		  // console.log('done uploading')
		  if (optionsS3.listRequestsOnFileChanges === true) await s3.getFiles(s3.options.bucket)
		  if (!optionsS3.listRequestsOnFileChanges) {
			  let p = {
				  'Key': `${optionsS3.uploadsFolder}/${fileName}`
			  }
			  s3.files.push(p)
		  }
		  let fl = await db.table('files').where('name', dbId)
		  if (fl && fl.length > 0) {
			  await await db.table('files').where('name', dbId).update({ timestampExpire: expdate })
			  fl = await db.table('files').where('name', dbId).first()
			  // console.log(fl);
		  }
		  resolve(true)
    })
  })
}

s3.convertFile = async function (bucket, localPath, remotePath, id, adminFile = false) {
  return new Promise(function (resolve, reject) {
    // const fileName = localPath.split('.').reverse().splice(1).reverse().join('.')
    s3.uploadFile(bucket, remotePath, localPath, id, adminFile).then(r => {
      fs.unlinkSync(localPath)
      resolve(r)
    }).catch(e => { reject(e) })
  })
}

let cacheChecks = {};
s3.fileExists = async function (bucket, fileName) {
  return new Promise(function (resolve, reject) {
	  function cachedCheck () {
		  // console.log('Returning cached answer to fileExists!');
		  let exists = false
		  s3.files.forEach(function (fl) { if (fl.Key === `${optionsS3.uploadsFolder}/${fileName}`) exists = true })
		  return exists
	  }
    if (optionsS3.permanentInternalCache) {
      resolve(cachedCheck())
    } else {
	  let _resolveNoCache = function () {
		s3.client.s3.headObject({
		  Bucket: bucket,
		  Key: `${optionsS3.uploadsFolder}/${fileName}`
		  }, function (err, data) {
			  if (err) {
			  // file does not exist (err.statusCode == 404)
			  // reject(false);
			  resolve(false)
			  }
			  // file exists
			  resolve(true)
		  })
	  }
	  let _resolveCached = function() {
		resolve(cachedCheck())
	  }
	  if(cacheChecks[fileName]) {
		let diff = new Date() - cacheChecks;
		if (diff < 60 * 1000) { _resolveCached(); } else { _resolveNoCache(); }
	  } else {
		_resolveNoCache();
	  }
	  cacheChecks[fileName] = new Date()
    }
  })
}

s3.deleteFiles = async function (bucket, files) {
  return new Promise(function (resolve, reject) {
    let flbuild = new Array()
    files.forEach(function (vl) {
      let _ex = false
      s3.files.forEach(function (vl2) { if (vl2['Key'] === `${optionsS3.uploadsFolder}/${vl}`) _ex = true })
      if (_ex) {
        flbuild.push({ 'Key': `${optionsS3.uploadsFolder}/${vl}` })
      }
    })
    const flnew = flbuild
    const params = {
      Delete: {
        Objects: flnew,
        Quiet: false
      },
      Bucket: bucket
    }

    // console.log(params);
    let deleter = s3.client.deleteObjects(params)
    deleter.on('error', function (err) {
		  console.error('unable to delete:', err.stack)
		  reject(err)
    })
    deleter.on('end', async function () {
		  // console.log('done deleting')
		  if (optionsS3.listRequestsOnFileChanges === true) await s3.getFiles(bucket)
		  if (!optionsS3.listRequestsOnFileChanges) {
			  // console.log(s3.files.length)
			  for (var i = 0; i < s3.files.length; i++) {
				  let vl = s3.files[i]
				  let _del = false
				  flnew.forEach(function (vl2) { if (vl['Key'] === vl2['Key']) _del = true })
				  if (_del) s3.files.splice(i, 1)
			  }
			  // console.log(s3.files.length)
		  }

		  resolve(true)
    })
  })
}

s3.fixDb = async function () {
  let files = await db.table('files').select('name', 'id', 'userid', 'original', 'timestamp', 'timestampExpire')
  if (s3.enabledCheck()) {
    // Check S3 files
	if(optionsS3.queryAllOnBoot) {
		files.forEach(async function (file) {
		  let inS3 = false
		  s3.files.forEach(function (fl) { if (fl.Key === `${optionsS3.uploadsFolder}/${file.name}`) inS3 = true })
		  if (!inS3) return await db.table('files').where('id', file.id).del()
		})
	}
  } else {
    // Check files
    // todo
  }

  // Handle file expire no db value
  let filesNoExpire = await db.table('files').where('timestampExpire', 0).select('name', 'id', 'userid', 'original', 'timestamp', 'timestampExpire')

  if (filesNoExpire && filesNoExpire.length > 0) {
	  let allUsers = await db.table('users').select('id', 'username')
	  let adminIds = new Array()
	  allUsers.forEach(function (vl) { if (config.admins.indexOf(vl.username) > -1) adminIds.push(vl.id) })
	  for (var i = 0; i < filesNoExpire.length; i++) {
		  let obj = filesNoExpire[i]
		  if (adminIds.indexOf(obj.userid) > -1) filesNoExpire.splice(i, 1)
	  }
  }

  if (filesNoExpire && filesNoExpire.length > 0) {
	  console.log(`Found ${filesNoExpire.length} files with no expire dates set!`)
		  filesNoExpire.forEach(async function (vl) {
			  let expd = s3.getExpireDate(vl.timestamp)
			  await db.table('files').where('id', vl.id).update({ timestampExpire: expd })
			  console.log(`Fixed ${vl.name}'s expire date!`)
		  })
  }
}

s3.mergeFiles = async function (bucket, files, uploadsFolder) {
  if (!s3.options.merge) return
  files.forEach(async function (file) {
    const pathch = path.join(uploadsFolder, file.name)
    let ex = fs.existsSync(pathch)
    let ext = path.extname(file.name).toLowerCase()
    let fid = file.name.split(ext).join('')
    // if(s3.videoExtensions.includes(ext) || ext === '.gif') ext = '.png'
    // fid = `${fid}${ext}`;
    fid = `${fid}.png` // Apparently thumbnails are always png? ok
    const paththumb = path.join(uploadsFolder, 'thumbs', fid)
	if (!ex && fs.existsSync(paththumb)) {
		const thumb = `thumbs/${fid}`
		if(config.uploads.generateThumbnails) await s3.convertFile(bucket, paththumb, thumb) // Convert thumbnail
	} else {
		if (ex && !s3.noThumbnail.includes(ext)) ex = fs.existsSync(paththumb)
		if (ex) {
		  await s3.convertFile(bucket, pathch, file.name) // Convert normal
		  const thumb = `thumbs/${fid}`
		  if (!s3.noThumbnail.includes(ext) && config.uploads.generateThumbnails) await s3.convertFile(bucket, paththumb, thumb) // Convert thumbnail
		}
	}
  })
  
  // handle stuck files
}



let ports = new Array()
s3.proxyPipe = async function (req, res, next, fileId) {
  let _url = `${s3.url}/${fileId}`
  _url = _url.split('https://').join('http://')
  try {
    if (s3.options.proxyFiles) {
      let reqUrl = request(_url);
	  reqUrl.pipe(res);
    } else {
      res.redirect(_url)
    }
  } catch (e) { /* */ }

  /*
	let nextp = 8080;
	for(var i = 0; i < 2000; i++) {
		if(ports.indexOf(nextp) > -1) {
			nextp++
		} else {
			break;
		}
	}
	console.log(nextp);
	ports.push(nextp);
	setTimeout(function() {
		ports.slice(1);
	}, 1000*60*5);
	console.log(_url);
	http.createServer(function(req, res) {
		res.setHeader("content-disposition", `attachment; filename=${fileId}`);
		request(_url).pipe(res);
	}).listen(nextp);
	*/
}

let internalFileCache = {};
s3.getFile = async function(req, res, next, fileId) {
	await s3.proxyPipe(req, res, next, fileId)
}

s3.initialize = async function (upldir, files) {
  if (!s3.enabledCheck() || initialized === true) return
  initialized = true
  console.log('[S3] Startup - Initializing');
  delete clientOpts['s3Options']
  clientOpts['s3Client'] = s3.awsS3Client
  s3['client'] = libs3.createClient(clientOpts)
  s3['url'] = libs3.getPublicUrl(optionsS3.bucket, optionsS3.uploadsFolder, optionsS3.region)
  if(optionsS3.queryAllOnBoot) {
	console.log('[S3] Startup - Getting Files');
	await s3.getFiles(optionsS3.bucket)
  } else {
	  s3.files = new Array();
  }
  // await s3.deleteFiles(optionsS3.bucket, ['pagebg.jpg']);
  console.log('[S3] Startup - Merging Files');
  await s3.mergeFiles(s3.options.bucket, files, upldir)
  console.log('[S3] Startup - Fixing Database');
  await s3.fixDb()
}

module.exports = s3
