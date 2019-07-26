let config = require('../config.js')
let db = require('knex')(config.database)
let utils = require('./utilsController.js')
let encoding
if(config.allowEncoding) encoding = require('./encodingController')
const s3 = require('../routes/s3.js')
const path = require('path')
const multer = require('multer')
const randomstring = require('randomstring')
const crypto = require('crypto')
const fs = require('fs')
const bcrypt = require('bcrypt')

const uploadsController = {}

// Let's default it to only 1 try
const maxTries = config.uploads.maxTries || 1
const uploadDir = path.join(__dirname, '..', config.uploads.folder)

uploadsController.reloadModules = function () {
  require.cache = new Array()
  config = require('../config.js')
  db = require('knex')(config.database)
  utils = require('./utilsController.js')
  encoding = require('./encodingController')
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const access = i => {
      const name = randomstring.generate(config.uploads.fileLength) + path.extname(file.originalname).toLowerCase()
	  if (s3.enabledCheck()) {
		  let _ex = false
		  s3.files.forEach(function (vl) {
			  if (vl['Key'] === `${s3.options.uploadsFolder}/${name}`) _ex = true
		  })
		  if (!_ex) return cb(null, name)
		   console.log(`A file named "${name}" already exists (${++i}/${maxTries}).`)
		   if (i < maxTries) return access(i)
		   return cb('Could not allocate a unique file name. Try again?')
	  } else {
		  fs.access(path.join(uploadDir, name), err => {
          if (err) return cb(null, name)
          console.log(`A file named "${name}" already exists (${++i}/${maxTries}).`)
          if (i < maxTries) return access(i)
          return cb('Could not allocate a unique file name. Try again?')
		  })
	  }
    }
    access(0)
  }
})

const upload = multer({
  storage: storage,
  limits: { fileSize: config.uploads.maxSize },
  fileFilter: function (req, file, cb) {
    if (config.blockedExtensions !== undefined) {
      if (config.blockedExtensions.some(extension => path.extname(file.originalname).toLowerCase() === extension)) {
        return cb('This file extension is not allowed')
      }
      return cb(null, true)
    }
    return cb(null, true)
  }
}).array('files[]')

uploadsController.fileInfo = async (req, res, next) => {
  const user = req.user
  const fileId = req.params.id
  const file = await db.table('files').where('name', fileId).first()
  if (!file) return res.json({ success: false, description: 'File not found'})
  const _usrUpl = await db.table('users').where('id', file.userid).first()
  if (!_usrUpl) _usrUpl = '<UNKNOWN>'
  let _fileInfo = {
    'File': `<a href="${config.domain}/${file.name}" target="_blank">${file.name}</a>`,
    'Uploader': _usrUpl.username,
    'File Type': file.type
    // 'Timestamp Upload': new Date(file.timestamp)
  }
  if (typeof (file.timestampExpire) === 'number') _fileInfo['Timestamp Expire'] = new Date(file.timestampExpire)

  if (utils.isAdmin(user.username) || file.userid === user.id) {
    _fileInfo['Original File Name'] = file.original
    if (file.deletekey) _fileInfo['Delete Key'] = file.deletekey
    if (file.encodeVersion) _fileInfo['Encoding Version'] = file.encodeVersion
    if (file.encodedString) _fileInfo['Encoded String'] = file.encodedString
  }
  if (utils.isAdmin(user.username)) {
    _fileInfo['Uploader\'s IP'] = file.ip
    _fileInfo['Hash'] = file.hash
    _fileInfo['Size'] = file.size
    if(typeof(file.timestamp) === 'number') _fileInfo['Upload Date'] = new Date(file.timestamp)
    if (file.albumid) _fileInfo['Album ID'] = file.albumid
  }

  return res.json({ success: true, fileData: _fileInfo})
}

uploadsController.upload = async (req, res, next) => {
  if (config.private === true) {
    const _checkuser = await utils.authorize(req, res)
    if (!_checkuser.id) return
  }

  let encodeVersion = req.headers.encodeversion || 0
  if (!utils.isNumeric(encodeVersion)) encodeVersion = 0
  if (!config.useAlternateViewing || !config.allowEncoding) encodeVersion = 0
  encodeVersion = parseInt(encodeVersion)

  const token = req.headers.token || ''
  const user = await db.table('users').where('token', token).first()
  if (user && (user.enabled === false || user.enabled === 0)) return res.status(401).json({ success: false, description: 'This account has been disabled'})

  const albumid = req.headers.albumid || req.params.albumid

  if (albumid && user) {
    let test = await db.table('albums')
    const album = await db.table('albums').where({ id: albumid, userid: user.id }).first()
    if (!album) return res.status(401).json({ success: false, description: 'Album doesn\'t exist or it doesn\'t belong to the user' })

    return uploadsController.actuallyUpload(req, res, user, albumid, encodeVersion)
  }
  return uploadsController.actuallyUpload(req, res, user, albumid, encodeVersion)
}

uploadsController.actuallyUpload = async (req, res, userid, albumid, encodeVersion) => {
  upload(req, res, async err => {
    if (err) {
      // console.error(err)
      return res.json({ success: false, description: err })
    }

    if (req.files.length === 0) return res.json({ success: false, description: 'no-files' })
    let userAdmin = false
    if (userid !== undefined) userAdmin = utils.isAdmin(userid.username)
    const files = []
    const existingFiles = []
    let iteration = 1
    req.files.forEach(async file => {
      // Check if the file exists by checking hash and size
      let hash = crypto.createHash('md5')
      let stream = fs.createReadStream(path.join(__dirname, '..', config.uploads.folder, file.filename))

      stream.on('data', data => {
        hash.update(data, 'utf8')
      })

      stream.on('end', async () => {
        const fileHash = hash.digest('hex')
        const dbFile = await db.table('files')
          .where(function () {
            if (userid === undefined) this.whereNull('userid')
            else this.where('userid', userid.id)
          })
          .where({
            hash: fileHash,
            size: file.size
          })
          .first()
        let encodeString = ''
        if (encodeVersion > 0 && config.allowEncoding) encodeString = encoding.encode(file.filename, encodeVersion)
        let now = new Date()
        let txtHash = `${file.filename}-${now}-${userid.id}-${userid.username}-${userid.token}`
        bcrypt.hash(txtHash, 10, async (err, hash) => {
          let deletekey = ''
          if (err) {
			  console.log(err)
          } else {
			  deletekey = hash.toLowerCase().split('/').join('')
          }

          if (!dbFile) {
            files.push({
              name: file.filename,
              original: file.originalname,
              type: file.mimetype,
              size: file.size,
              hash: fileHash,
              ip: req.ip,
              albumid: albumid,
              userid: userid !== undefined ? userid.id : null,
              timestamp: Math.floor(Date.now() / 1000),
              timestampExpire: 0,
              encodeVersion: encodeVersion,
              encodedString: encodeString,
              deletekey: deletekey
            })
          } else {
            uploadsController.deleteFile(file.filename).then(() => {}).catch(err => console.error(err))
	    dbFile.deletekey = deletekey;
            existingFiles.push(dbFile);
          }

          if (iteration === req.files.length) {
            return uploadsController.processFilesForDisplay(req, res, files, existingFiles, albumid, encodeVersion, encodeString, deletekey, userAdmin)
          }
          iteration++
        })
      })
    })
  })
}

uploadsController.processFilesForDisplay = async (req, res, files, existingFiles, albumid, encodeVersion = 0, encodeString = '', deleteKey = '', userAdmin = false) => {
  let basedomain = config.domain
  if (files.length === 0) {
    return res.json({
      success: true,
      files: existingFiles.map(file => {
        return {
          name: file.name,
          size: file.size,
          url: `${basedomain}/${file.name}`,
		  deleteUrl: `${basedomain}/api/gdelete/${deleteKey}`,
          encodeVersion: encodeVersion,
          encodeString: encodeString,
		  deleteKey: deleteKey
        }
      })
    })
  }

  await db.table('files').insert(files)
  for (let efile of existingFiles) files.push(efile)

  for (let file of files) {
    let ext = path.extname(file.name).toLowerCase()

    if (config.uploads.generateThumbnails === true) {
      if ((utils.imageExtensions.includes(ext) || utils.videoExtensions.includes(ext)) && !utils.noThumbnail.includes(ext)) {
		  file.thumb = `${basedomain}/thumbs/${file.name.slice(0, -ext.length)}.png`
		  // console.log(`Start thumb ${file.name}`);
		  await utils.generateThumbs(file)
		  // console.log(`Done thumb ${file.name}`);
      }
    }
    const pathUploads = `${path.join(__dirname, '..', config.uploads.folder)}/${file.name}`
    // console.log(`Uploading file ${file.name}`);
	if (s3.enabledCheck()) {
		let fin = await s3.convertFile(s3.options.bucket, pathUploads, file.name, file.name, userAdmin)
	}
  }

  let albumSuccess = true
  if (albumid) {
    const editedAt = Math.floor(Date.now() / 1000)
    albumSuccess = await db.table('albums')
      .where('id', albumid)
      .update('editedAt', editedAt)
      .then(() => true)
      .catch(error => {
        console.log(error)
        return false
      })
  }

  return res.json({
    success: albumSuccess,
    description: albumSuccess ? null : 'Warning: Error updating album.',
    files: files.map(file => {
      return {
        name: file.name,
        size: file.size,
        url: `${basedomain}/${file.name}`,
        deleteUrl: `${basedomain}/api/gdelete/${deleteKey}`,
        encodeVersion: encodeVersion,
        encodeString: encodeString,
        deleteKey: deleteKey
      }
    })
  })
}

uploadsController.delete = async (req, res) => {
  let property = 'id'
  let user
  let id = req.body.id || ''
  let deleteKey = req.params.deletekey || ''
  if (deleteKey !== '') { id = deleteKey; property = 'deletekey' }
  if (deleteKey === '') {
    user = await utils.authorize(req, res)
    if (!user.id) return
  }
  if (id === undefined || id === '') {
    return res.json({ success: false, description: 'No file specified' })
  }

  /* if(deleteKey !== '') {
	const filesdel = await db.table('files')
		.whereNotNull('deletekey')
		.whereNot('deletekey', '')
	let fl = filesdel.find(function(el) {
		console.log(`${deleteKey} | ${el.deletekey}`)
		return el.deletekey === deleteKey;
	});
	console.log(fl);

  } */

  const file = await db.table('files')
    .where(property, id)
    .where(function () {
      if (deleteKey === '' && !utils.isAdmin(user.username)) this.where('userid', user.id)
    })
    .first()
  if (!file) return res.json({ success: false, description: 'No file found' })
  try {
    await uploadsController.deleteFile(file.name)
    await db.table('files').where(property, id).del()
    if (file.albumid) {
	  id = file.id
      await db.table('albums').where('id', file.albumid).update('editedAt', Math.floor(Date.now() / 1000))
    }
  } catch (err) {
    console.log(err)
  }

  return res.json({ success: true })
}

uploadsController.deleteFile = function (file) {
  const ext = path.extname(file).toLowerCase()
  return new Promise(async function (resolve, reject) {
    let _s3 = false
    if (s3.enabledCheck()) {
      let _ex = await s3.fileExists(s3.options.bucket, file)
      if (_ex) _s3 = true
    }

    if (_s3) {
      s3.deleteFiles(s3.options.bucket, [file, `thumbs/${file}`]).then(() => {
        resolve()
      }).catch(e => {
        reject()
      })
    } else {
      // Nothing from S3 found
	  
      fs.access(path.join(__dirname, '..', config.uploads.folder, file), (err) => {
		  // Just resolve promise if file doesn't exist
		  if (err && err.code === 'ENOENT') { return resolve() }
		  
		  if (err) { return reject(err) }
		  
		  fs.unlink(path.join(__dirname, '..', config.uploads.folder, file), err => {
          if (err) { return reject(err) }
          if (!utils.imageExtensions.includes(ext) && !utils.videoExtensions.includes(ext)) {
			  return resolve()
          }
		  
          file = file.substr(0, file.lastIndexOf('.')) + '.png'
          fs.access(path.join(__dirname, '..', config.uploads.folder, 'thumbs/', file), (err) => {
			  if (err) {
              return resolve()
			  }
			  fs.unlink(path.join(__dirname, '..', config.uploads.folder, 'thumbs/', file), err => {
              if (err) { return reject(err) }
              return resolve()
			  })
          })
		  })
      })
    }
  })
}

uploadsController.list = async (req, res) => {
  // const user = await utils.authorize(req, res)
  // if (!user.id) return
  const user = req.user
  let offset = req.params.page
  if (offset === undefined) offset = 0

  const files = await db.table('files')
    .where(function () {
      if (req.params.id === undefined) this.where('id', '<>', '')
      else this.where('albumid', req.params.id)
    })
    .where(function () {
      if (!utils.isAdmin(user.username)) this.where('userid', user.id)
    })
    .orderBy('id', 'DESC')
    .limit(25)
    .offset(25 * offset)
    .select('id', 'albumid', 'timestamp', 'name', 'userid')

  const albums = await db.table('albums')
  let basedomain = config.domain
  let userids = []

  for (let file of files) {
    file.file = `${basedomain}/${file.name}`
    file.date = new Date(file.timestamp * 1000)
    file.date = utils.getPrettyDate(file.date)

    file.album = ''

    if (file.albumid !== undefined) {
      for (let album of albums) {
        if (file.albumid === album.id) {
          file.album = album.name
        }
      }
    }

    // Only push usernames if we are root
    if (utils.isAdmin(user.username)) {
      if (file.userid !== undefined && file.userid !== null && file.userid !== '') {
        userids.push(file.userid)
      }
    }

    let ext = path.extname(file.name).toLowerCase()
    if (utils.imageExtensions.includes(ext) || utils.videoExtensions.includes(ext)) {
      file.thumb = `${basedomain}/thumbs/${file.name.slice(0, -ext.length)}.png`
    }
  }

  // If we are a normal user, send response
  if (!utils.isAdmin(user.username)) return res.json({ success: true, files })

  // If we are root but there are no uploads attached to a user, send response
  if (userids.length === 0) return res.json({ success: true, files })

  const users = await db.table('users').whereIn('id', userids)
  for (let dbUser of users) {
    for (let file of files) {
      if (file.userid === dbUser.id) {
        file.username = dbUser.username
      }
    }
  }

  return res.json({ success: true, files })
}

module.exports = uploadsController
