var upload = {}

upload.isPrivate = true
upload.token = localStorage.token
upload.maxFileSize
// add the album var to the upload so we can store the album id in there
upload.album
upload.myDropzone

upload.stringifyError = function (err, filter, space) {
  var plainObject = {}
  Object.getOwnPropertyNames(err).forEach(function (key) {
    plainObject[key] = err[key]
  })
  return JSON.stringify(plainObject, filter, space)
}

upload.errorHandler = async function (err) {
  const _handlers = {
    'This account has been disabled': function () {
      localStorage.removeItem('token')
      delete axios.defaults.headers.common['token']
      if (location.location === '/') { location.reload() } else {
        location.location = '/'
        window.location = '/'
      }
    },
    'Username doesn\'t exist': function () {
      localStorage.removeItem('token')
      delete axios.defaults.headers.common['token']
      if (location.location === '/') { location.reload() } else {
        location.location = '/'
        window.location = '/'
      }
    },
    'Invalid token': function () {
      localStorage.removeItem('token')
      delete axios.defaults.headers.common['token']
      if (location.location === '/') { location.reload() } else {
        location.location = '/'
        window.location = '/'
      }
    }
  }
  if (typeof (err) === 'object') {
    const _strerror = JSON.parse(panel.stringifyError(err, null, '\t'))
    if (typeof (_strerror) === 'object' && typeof (_strerror.response) === 'object' && typeof (_strerror.response.data) === 'object') {
      if (_strerror.response.data.success === false && typeof (_strerror.response.data.description) === 'string') {
        swal({
          title: 'Error(1)',
          text: _strerror.response.data.description,
          type: 'error',
          confirmButtonText: 'Ok',
          timer: _strerror.response.data.description.length * 750
				 },
				 function () {
          if (typeof (_handlers[_strerror.response.data.description]) === 'function') _handlers[_strerror.response.data.description]()
				 })
      }
    } else {
      swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error')
      console.log(err)
    }
  } else if (typeof (err) === 'string') {
    if (typeof (_handlers[err]) === 'function') {
      swal({
        title: 'Error(2)',
        text: err,
        type: 'error',
        confirmButtonText: 'Ok',
        timer: err.length * 750
				 },
				 function () {
        _handlers[err]()
				 })
    }
  } else {
    console.log(err)
  }
}

upload.checkIfPublic = function () {
  axios.get('/api/check')
    .then(function (response) {
      upload.isPrivate = response.data.private
      upload.maxFileSize = response.data.maxFileSize
      upload.preparePage()
    })
    .catch(function (error) {
      upload.errorHandler(error)
    })
}

upload.preparePage = function () {
  if (!upload.isPrivate) return upload.prepareUpload()
  if (!upload.token) return document.getElementById('loginToUpload').style.display = 'inline-flex'
  document.getElementById('authButton2').href = '/dashboard'
  upload.verifyToken(upload.token, true)
}

upload.verifyToken = function (token, reloadOnError) {
  if (reloadOnError === undefined) { reloadOnError = false }

  axios.post('/api/tokens/verify', {
    token: token
  })
    .then(function (response) {
      if (response.data.success === false) {
        document.getElementById('authButton2').href = '/auth'
        upload.errorHandler(response.data.description)
        return
      }

      localStorage.token = token
      upload.token = token
      return upload.prepareUpload()
    })
    .catch(function (error) {
	  document.getElementById('authButton2').href = '/auth'
      upload.errorHandler(error)
    })
}

upload.prepareUpload = function () {
  // I think this fits best here because we need to check for a valid token before we can get the albums
  if (upload.token) {
    var select = document.getElementById('albumSelect')

    select.addEventListener('change', function () {
      upload.album = select.value
    })

    axios.get('/api/albums', { headers: { token: upload.token }})
      .then(function (res) {
        var albums = res.data.albums

        // if the user doesn't have any albums we don't really need to display
        // an album selection
        if (albums.length === 0) return

        // loop through the albums and create an option for each album
        for (var i = 0; i < albums.length; i++) {
          var opt = document.createElement('option')
          opt.value = albums[i].id
          opt.innerHTML = albums[i].name
          select.appendChild(opt)
        }
        // display the album selection
        document.getElementById('albumDiv').style.display = 'block'
      })
      .catch(function (e) {
        upload.errorHandler(error)
      })
  }

  div = document.createElement('div')
  div.id = 'dropzone'
  div.innerHTML = 'Click here or drag and drop files'
  div.style.display = 'flex'

  document.getElementById('maxFileSize').innerHTML = 'Maximum upload size per file is ' + upload.maxFileSize
  document.getElementById('loginToUpload').style.display = 'none'

  if (upload.token === undefined) { document.getElementById('loginLinkText').innerHTML = 'Create an account and keep track of your uploads' }

  document.getElementById('uploadContainer').appendChild(div)

  upload.prepareDropzone()
}

upload.prepareDropzone = function () {
  var previewNode = document.querySelector('#template')
  previewNode.id = ''
  var previewTemplate = previewNode.parentNode.innerHTML
  previewNode.parentNode.removeChild(previewNode)

  var dropzone = new Dropzone('div#dropzone', {
    url: '/api/upload',
    paramName: 'files[]',
    maxFilesize: upload.maxFileSize.slice(0, -2),
    parallelUploads: 3,
    uploadMultiple: false,
    previewsContainer: 'div#uploads',
    previewTemplate: previewTemplate,
    createImageThumbnails: false,
    maxFiles: 75,
    autoProcessQueue: true,
    headers: {
      'token': upload.token
    },
    init: function () {
      upload.myDropzone = this
      this.on('addedfile', function (file) {
        document.getElementById('uploads').style.display = 'block'
      })
      // add the selected albumid, if an album is selected, as a header
      this.on('sending', function (file, xhr) {
        if (upload.album) {
          xhr.setRequestHeader('albumid', upload.album)
        }
      })
    }
  })

  // Update the total progress bar
  dropzone.on('uploadprogress', function (file, progress) {
    file.previewElement.querySelector('.progress').setAttribute('value', progress)
    file.previewElement.querySelector('.progress').innerHTML = progress + '%'
  })

  dropzone.on('success', function (file, response) {
    // Handle the responseText here. For example, add the text to the preview element:
	console.log(response.description);
    if (response.success === false) {
      var p = document.createElement('p')
      p.innerHTML = response.description
      file.previewTemplate.querySelector('.link').appendChild(p)
	  file.previewTemplate.querySelector('.progress').style.display = 'none'
	  return
    }

    if (response.files[0].url) {
      a = document.createElement('a')
      a.href = response.files[0].url
      a.target = '_blank'
      a.innerHTML = response.files[0].url
      file.previewTemplate.querySelector('.link').appendChild(a)

      file.previewTemplate.querySelector('.progress').style.display = 'none'
    }
  })

  upload.prepareShareX()
}

upload.prepareShareX = function () {
  if (upload.token) {
    var sharex_element = document.getElementById('ShareX')
    var sharex_file = '{\r\n\
  "Name": "' + location.hostname + '",\r\n\
  "DestinationType": "ImageUploader, FileUploader",\r\n\
  "RequestType": "POST",\r\n\
  "RequestURL": "' + location.origin + '/api/upload",\r\n\
  "FileFormName": "files[]",\r\n\
  "Headers": {\r\n\
    "token": "' + upload.token + '"\r\n\
  },\r\n\
  "ResponseType": "Text",\r\n\
  "URL": "http://' + location.hostname + '/$json:files[0].name$",\r\n\
  "ThumbnailURL": "$json:files[0].url$"\r\n\
}'
    var sharex_blob = new Blob([sharex_file], {type: 'application/octet-binary'})
    sharex_element.setAttribute('href', URL.createObjectURL(sharex_blob))
    sharex_element.setAttribute('download', location.hostname + '.sxcu')
  }
}

// Handle image paste event
window.addEventListener('paste', function (event) {
  var items = (event.clipboardData || event.originalEvent.clipboardData).items
  for (index in items) {
    var item = items[index]
    if (item.kind === 'file') {
      var blob = item.getAsFile()
      console.log(blob.type)
      var file = new File([blob], 'pasted-image.' + blob.type.match(/(?:[^\/]*\/)([^;]*)/)[1])
      file.type = blob.type
      console.log(file)
      upload.myDropzone.addFile(file)
    }
  }
})

window.onload = function () {
  upload.checkIfPublic()
}
