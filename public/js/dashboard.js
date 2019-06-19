let panel = {}

panel.page
panel.username
panel.token = localStorage.token
panel.filesView = localStorage.filesView
panel.onAdminP = false
panel.loadedAt
panel.adminacc = false
panel.fetchedAdmin = false

panel.stringifyError = function (err, filter, space) {
  var plainObject = {}
  Object.getOwnPropertyNames(err).forEach(function (key) {
    plainObject[key] = err[key]
  })
  return JSON.stringify(plainObject, filter, space)
}

panel.errorHandler = async function (err) {
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
    } else {
      swal('Error(3)', err, 'error')
    }
  } else {
    console.log(err)
  }
}

panel.admins = new Array()
panel.isAdmin = async function (name) {
  if (!panel.fetchedAdmin) {
    await panel.checkAdmin()
    await panel.fetchAdmins()
    panel.fetchedAdmin = true
  }
  if (name === panel.username) return panel.adminacc
  if (panel.admins.length < 1) await panel.fetchAdmins()
  if (panel.admins.indexOf(name) > -1) return true
  return false
}

panel.fetchAdmins = async function () {
  panel.admins = new Array()
  return new Promise(function (resolve) {
    axios.get('/api/admins').then(function (response) {
      if (response.data.success === false) {
        // panel.errorHandler(response.data.description)
        resolve()
        return
      }
      response.data.admins.forEach(function (vl) { panel.admins.push(vl) })
      resolve()
    }).catch(function (error) {
      panel.errorHandler(error)
      resolve()
    })
  })
}

panel.checkAdmin = async function () {
  panel.adminacc = false
  return new Promise(function (resolve) {
    axios.get('/api/admincheck').then(function (response) {
      if (response.data.success === false) {
        panel.errorHandler(response.data.description)
        resolve()
        return
      }
	  panel.adminacc = response.data.admin
      resolve()
    }).catch(function (error) {
      panel.errorHandler(error)
      resolve()
    })
  })
}

panel.preparePage = function () {
  if (!panel.token) return window.location = '/auth'
  panel.verifyToken(panel.token, true)
}

panel.verifyToken = function (token, reloadOnError = false) {
  axios.post('/api/tokens/verify', {
    token: token
  })
    .then(function (response) {
      if (response.data.success === false) {
        panel.errorHandler(response.data.description)
        return
      }

      axios.defaults.headers.common['token'] = token
      localStorage.token = token
      panel.token = token
      panel.username = response.data.username
      return panel.prepareDashboard()
    })
    .catch(function (error) {
	  panel.errorHandler(error)
    })
}

panel.prepareDashboard = async function () {
  panel.page = document.getElementById('page')
  document.getElementById('auth').style.display = 'none'
  document.getElementById('dashboard').style.display = 'block'
  const _adm = await panel.isAdmin(panel.username)
  if (_adm) { // adminstuff
    document.getElementById('itemAdmin').style.display = 'block'
  }

  const mapTabs = ['itemUploads', 'itemManageGallery', 'itemTokens', 'itemPassword', 'itemLogout', 'itemAdmin', 'itemAccount', 'itemLookup']

  mapTabs.forEach(function (vlx) {
	  const vl = vlx
	  const _obj = document.getElementById(vl)
	  function _f (elem) {
		  elem.addEventListener('click', function () {
        panel.setActiveMenu(this)
        panel.onAdminP = true
        if (vl !== 'itemAdmin') panel.onAdminP = false
		  })
	  }
	  if (!_obj) {
		  const _int = setInterval(function () {
			  const _check = document.getElementById(vl)
			  if (_check) {
				  clearInterval(_int)
				  _f(_check)
			  }
		  }, 75)
	  } else {
		  _f(_obj)
	  }
  })

  document.getElementById('itemLogout').innerHTML = `Logout ( ${panel.username} )`

  panel.getAlbumsSidebar()
}

panel.logout = function () {
  localStorage.removeItem('token')
  location.reload('/')
}

let tmsearch = false
panel.searchbarUpdated = function () {
  document.getElementById('uploadsSearch').innerHTML = ``
  if (typeof (tmsearch) !== 'boolean') { clearTimeout(tmsearch); tmsearch = false }
  tmsearch = setTimeout(function () {
    panel.getUploads(undefined, undefined, document.getElementById('uploadsSearch').value)
    clearTimeout(tmsearch)
    tmsearch = false
  }, 1500)
}

panel.getUploads = function (album = undefined, page = undefined, search = undefined) {
  if (page === undefined) page = 0

  let url = '/api/uploads/' + page
  if (album !== undefined) { url = '/api/album/' + album + '/' + page }

  axios.get(url).then(async function (response) {
    if (response.data.success === false) {
      if (response.data.description === 'No token provided') return panel.verifyToken(panel.token)
      else return swal('An error ocurred', response.data.description, 'error')
    }

    var prevPage = 0
    var nextPage = page + 1

    let nextDisp = nextPage + 1
    let txtNext = `Next (${nextDisp})`

    if (response.data.files.length < 25) {
      nextPage = page
      txtNext = ''
    }

    let txtPrev = ''
    if (page > 0) {
      prevPage = page - 1
      let prevDisp = prevPage + 1
      txtPrev = `Previous (${prevDisp})`
    }

    let _valSearch = ''
    if (search) _valSearch = search

    let _evenPrev = ` onclick="panel.getUploads(${album}, ${prevPage}, ${search} )"`
    let _evenNext = ` onclick="panel.getUploads(${album}, ${nextPage}, ${search} )"`
    if (txtPrev === '') _evenPrev = ''
    if (txtNext === '') _evenNext = ''

    panel.page.innerHTML = ''
    var container = document.createElement('div')
    var pagination = `<nav class="pagination is-centered">
					  		<a class="pagination-previous" id="paginate-prev"${_evenPrev}>${txtPrev}</a>
					  		<a class="pagination-next" id="paginate-next"${_evenNext}>${txtNext}</a>
						</nav>`
    var listType = `
		<div class="columns">
			<div class="column">
				<a class="button is-small is-outlined is-danger" title="List view" onclick="panel.setFilesView('list', ${album}, ${page})">
					<span class="icon is-small">
						<i class="fa fa-list-ul"></i>
					</span>
				</a>
				<a class="button is-small is-outlined is-danger" title="List view" onclick="panel.setFilesView('thumbs', ${album}, ${page})">
					<span class="icon is-small">
						<i class="fa fa-th-large"></i>
					</span>
				</a>
			</div>
		</div>`

    if (panel.filesView === 'thumbs') {
      container.innerHTML = `
				${pagination}
				<hr>
				${listType}
				<div class="columns is-multiline is-mobile" id="table">

				</div>
				${pagination}
			`

      panel.page.appendChild(container)
      var table = document.getElementById('table')

      for (var item of response.data.files) {
        var div = document.createElement('div')
        div.className = 'column is-2'
        if (item.thumb !== undefined) { div.innerHTML = `<a href="${item.file}" target="_blank"><img src="${item.thumb}"/></a><a class="button is-small is-danger is-outlined" title="Delete file" onclick="panel.deleteFile(${item.id})"><span class="icon is-small"><i class="fa fa-trash-o"></i></span></a>` } else { div.innerHTML = `<a href="${item.file}" target="_blank"><h1 class="title">.${item.file.split('.').pop()}</h1></a><a class="button is-small is-danger is-outlined" title="Delete file" onclick="panel.deleteFile(${item.id})"><span class="icon is-small"><i class="fa fa-trash-o"></i></span></a>` }
        table.appendChild(div)
      }
    } else {
      var albumOrUser = 'Album'
	  const _adm = await panel.isAdmin(panel.username)
      if (_adm) { albumOrUser = 'User' }

	  let _thehtml = `
				${pagination}
				<br><input id="uploadsSearch" class="input is-centered" type="text" placeholder="Search" oninput="panel.searchbarUpdated()" value="${_valSearch}"></input>
				<hr>
				${listType}
				<table class="table is-striped is-narrow is-left">
					<thead>
						<tr>
							  <th>File</th>
							  <th>${albumOrUser}</th>
							  <th>Date</th>
							  <th></th>
						</tr>
					</thead>
					<tbody id="table">
					</tbody>
				</table>
				<hr>
				${pagination}
			`
	  container.innerHTML = _thehtml
      panel.page.appendChild(container)
      var table = document.getElementById('table')

      for (var item of response.data.files) {
        var tr = document.createElement('tr')

        var displayAlbumOrUser = item.album
        const _adm = await panel.isAdmin(panel.username)
        if (_adm) {
          displayAlbumOrUser = ''
          if (item.username !== undefined) { displayAlbumOrUser = item.username }
        }

        tr.innerHTML = `
					<tr>
						<th><a href="${item.file}" target="_blank">${item.file}</a></th>
						<th>${displayAlbumOrUser}</th>
						<td>${item.date}</td>
						<td>
							<a class="button is-small is-danger is-outlined" title="Delete" onclick="panel.deleteFile(${item.id})">
								<span class="icon is-small">
									<i class="fa fa-trash-o"></i>
								</span>
							</a>
						</td>
					</tr>
					`

        table.appendChild(tr)
      }
    }
  })
    .catch(function (error) {
	  panel.errorHandler(error)
    })
}

panel.setFilesView = function (view, album, page) {
  localStorage.filesView = view
  panel.filesView = view
  panel.getUploads(album, page)
}

panel.deleteFile = function (id) {
  swal({
    title: 'Are you sure?',
    text: 'You wont be able to recover the file!',
    type: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ff3860',
    confirmButtonText: 'Yes, delete it!',
    closeOnConfirm: false
  },
  function () {
    axios.post('/api/upload/delete', {
      id: id
    })
      .then(function (response) {
        if (response.data.success === false) {
          if (response.data.description === 'No token provided') return panel.verifyToken(panel.token)
          else return swal('An error ocurred', response.data.description, 'error')
        }

        swal('Deleted!', 'The file has been deleted.', 'success')
        panel.getUploads()
      })
      .catch(function (error) {
        panel.errorHandler(error)
      })
  }
  )
}

panel.getAlbums = function () {
  axios.get('/api/albums').then(function (response) {
    if (response.data.success === false) {
      if (response.data.description === 'No token provided') return panel.verifyToken(panel.token)
      else return swal('An error ocurred', response.data.description, 'error')
    }

    panel.page.innerHTML = ''
    var container = document.createElement('div')
    container.className = 'container'
    container.innerHTML = `
			<h2 class="subtitle">Create new album</h2>

			<p class="control has-addons has-addons-centered">
				<input id="albumName" class="input" type="text" placeholder="Name">
				<a id="submitAlbum" class="button is-primary">Submit</a>
			</p>

			<h2 class="subtitle">List of albums</h2>

			<table class="table is-striped is-narrow">
				<thead>
					<tr>
						  <th>ID</th>
						  <th>Name</th>
						  <th>Files</th>
						  <th>Created At</th>
						  <th>Public link</th>
						  <th></th>
					</tr>
				</thead>
				<tbody id="table">
				</tbody>
			</table>`

    panel.page.appendChild(container)
    var table = document.getElementById('table')

    for (var item of response.data.albums) {
      var tr = document.createElement('tr')
      tr.innerHTML = `
				<tr>
					<th>${item.id}</th>
					<th>${item.name}</th>
					<th>${item.files}</th>
					<td>${item.date}</td>
					<td><a href="${item.identifier}" target="_blank">Album link</a></td>
					<td>
						<a class="button is-small is-primary is-outlined" title="Edit name" onclick="panel.renameAlbum(${item.id})">
							<span class="icon is-small">
								<i class="fa fa-pencil"></i>
							</span>
						</a>
						<a class="button is-small is-danger is-outlined" title="Delete album" onclick="panel.deleteAlbum(${item.id})">
							<span class="icon is-small">
								<i class="fa fa-trash-o"></i>
							</span>
						</a>
					</td>
				</tr>
				`

      table.appendChild(tr)
    }

    document.getElementById('submitAlbum').addEventListener('click', function () {
      panel.submitAlbum()
    })
  })
    .catch(function (error) {
	  panel.errorHandler(error)
    })
}

panel.renameAlbum = function (id) {
  swal({
    title: 'Rename album',
    text: 'New name you want to give the album:',
    type: 'input',
    showCancelButton: true,
    closeOnConfirm: false,
    animation: 'slide-from-top',
    inputPlaceholder: 'My super album'
  }, function (inputValue) {
    if (inputValue === false) return false
    if (inputValue === '') {
      swal.showInputError('You need to write something!')
      return false
    }

    axios.post('/api/albums/rename', {
      id: id,
      name: inputValue
    })
      .then(function (response) {
        if (response.data.success === false) {
          if (response.data.description === 'No token provided') return panel.verifyToken(panel.token)
          else if (response.data.description === 'Name already in use') swal.showInputError('That name is already in use!')
          else swal('An error ocurred', response.data.description, 'error')
          return
        }

        swal('Success!', 'Your album was renamed to: ' + inputValue, 'success')
        panel.getAlbumsSidebar()
        panel.getAlbums()
      })
      .catch(function (error) {
        panel.errorHandler(error)
      })
  })
}

panel.deleteAlbum = function (id) {
  swal({
    title: 'Are you sure?',
    text: "This won't delete your files, only the album!",
    type: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ff3860',
    confirmButtonText: 'Yes, delete it!',
    closeOnConfirm: false
  },
  function () {
    axios.post('/api/albums/delete', {
      id: id
    })
      .then(function (response) {
        if (response.data.success === false) {
          if (response.data.description === 'No token provided') return panel.verifyToken(panel.token)
          else return swal('An error ocurred', response.data.description, 'error')
        }

        swal('Deleted!', 'Your album has been deleted.', 'success')
        panel.getAlbumsSidebar()
        panel.getAlbums()
      })
      .catch(function (error) {
        panel.errorHandler(error)
      })
  }
  )
}

panel.submitAlbum = function () {
  axios.post('/api/albums', {
    name: document.getElementById('albumName').value
  })
    .then(function (response) {
      if (response.data.success === false) {
        if (response.data.description === 'No token provided') return panel.verifyToken(panel.token)
        else return swal('An error ocurred', response.data.description, 'error')
      }

      swal('Woohoo!', 'Album was added successfully', 'success')
      panel.getAlbumsSidebar()
      panel.getAlbums()
    })
    .catch(function (error) {
	  panel.errorHandler(error)
    })
}

panel.getAlbumsSidebar = function () {
  axios.get('/api/albums/sidebar')
    .then(function (response) {
      if (response.data.success === false) {
        if (response.data.description === 'No token provided') return panel.verifyToken(panel.token)
        else return swal('An error ocurred', response.data.description, 'error')
      }

      var albumsContainer = document.getElementById('albumsContainer')
      albumsContainer.innerHTML = ''

      if (response.data.albums === undefined) return

      for (var album of response.data.albums) {
        li = document.createElement('li')
        a = document.createElement('a')
        a.id = album.id
        a.innerHTML = album.name

        a.addEventListener('click', function () {
          panel.getAlbum(this)
        })

        li.appendChild(a)
        albumsContainer.appendChild(li)
      }
    })
    .catch(function (error) {
	  panel.errorHandler(error)
    })
}

panel.getAlbum = function (item) {
  panel.onAdminP = false
  panel.setActiveMenu(item)
  panel.getUploads(item.id)
}

panel.changeToken = function () {
  panel.onAdminP = false
  axios.get('/api/tokens')
    .then(function (response) {
      if (response.data.success === false) {
        if (response.data.description === 'No token provided') return panel.verifyToken(panel.token)
        else return swal('An error ocurred', response.data.description, 'error')
      }

      panel.page.innerHTML = ''
      var container = document.createElement('div')
      container.className = 'container'
      container.innerHTML = `
			<h2 class="subtitle">Manage your token</h2>

			<label class="label">Your current token:</label>
			<p class="control has-addons">
				<input id="token" readonly class="input is-expanded" type="text" placeholder="Your token" value="${response.data.token}">
				<a id="getNewToken" class="button is-primary">Request new token</a>
			</p>
		`

      panel.page.appendChild(container)

      document.getElementById('getNewToken').addEventListener('click', function () {
        panel.getNewToken()
      })
    })
    .catch(function (error) {
	  panel.errorHandler(error)
    })
}

panel.getNewToken = function () {
  axios.post('/api/tokens/change')
    .then(function (response) {
      if (response.data.success === false) {
        if (response.data.description === 'No token provided') return panel.verifyToken(panel.token)
        else return swal('An error ocurred', response.data.description, 'error')
      }

      swal({
        title: 'Woohoo!',
        text: 'Your token was changed successfully.',
        type: 'success'
      }, function () {
        localStorage.token = response.data.token
        location.reload()
      })
    })
    .catch(function (error) {
	  panel.errorHandler(error)
    })
}

panel.changePassword = function () {
  panel.onAdminP = false
  panel.page.innerHTML = ''
  var container = document.createElement('div')
  container.className = 'container'
  container.innerHTML = `
		<h2 class="subtitle">Change your password</h2>
		<br>
		<label class="label">Current password:</label>
		<p class="control has-addons">
			<input id="passwordOld" class="input is-expanded" type="password" placeholder="Your current password">
		</p>
		<label class="label">New password:</label>
		<p class="control has-addons">
			<input id="password" class="input is-expanded" type="password" placeholder="Your new password">
		</p>
		<label class="label">Confirm password:</label>
		<p class="control has-addons">
			<input id="passwordConfirm" class="input is-expanded" type="password" placeholder="Verify your new password">
			<a id="sendChangePassword" class="button is-primary">Set new password</a>
		</p>
	`

  panel.page.appendChild(container)

  document.getElementById('sendChangePassword').addEventListener('click', function () {
    if (document.getElementById('passwordOld').value.length > 1 && document.getElementById('password').value === document.getElementById('passwordConfirm').value) {
      panel.sendNewPassword(document.getElementById('password').value, panel.username, false, '', document.getElementById('passwordOld').value)
    } else {
      swal({
        title: 'Password mismatch!',
        text: 'Your passwords do not match, please try again.',
        type: 'error'
      }, function () {
        panel.changePassword()
      })
    }
  })
}

panel.sendNewPassword = function (pass, username = panel.username, random = false, adminpw = '', currpw = '') {
  axios.post('/api/password/change', {username: username, password: pass, random: random, adminpw: adminpw, currpw: currpw})
    .then(function (response) {
      if (response.data.success === false) {
        if (response.data.description === 'No token provided') return panel.verifyToken(panel.token)
        else return swal('An error ocurred', response.data.description, 'error')
      }
      let _r = 'Password was changed successfully.'
      if (random) _r = 'User\'s new password: ' + response.data.newpw

      swal({
        title: 'Success!',
        text: _r,
        type: 'success'
      }, async function () {
        const _adm = await panel.isAdmin(panel.username)
        if (!_adm) return location.reload()
        if (panel.onAdminP) panel.adminTab()
      })
    })
    .catch(function (error) {
	  panel.errorHandler(error)
    })
}

panel.updateAdminPage = function (pw = '') {
  if (!panel.onAdminP) return
  panel.page.innerHTML = ''
  var container = document.createElement('div')
  container.className = 'container'
  container.innerHTML = `
		<h2 class="subtitle">Create new account</h2>

		<label class="label">Username</label>
		<p class="control has-addons">
			<input id="username" class="input is-expanded" type="text" placeholder="Account username">
		</p>
		<label class="label">Password</label>
		<p class="control has-addons">
			<input id="password" class="input is-expanded" type="text" placeholder="Account password">
		</p>
		<a id="sendNewAccount" class="button is-primary">Create</a>
		<br><br>
		<br>
		
	`

  let url = '/api/account/list'

  axios.get(url).then(async function (response) {
    if (!panel.onAdminP) return
    if (response.data.success === false) {
      if (response.data.description === 'No token provided') return panel.verifyToken(panel.token)
      else return swal('An error ocurred', response.data.description, 'error')
    }

    container.innerHTML = container.innerHTML + `
			<hr>
			<label class="label">Your password</label>
			<input id="passwordRoot" class="input is-expanded" type="password" placeholder="Account password - needed for administrative actions">
			<hr>
			
			<table class="table is-striped is-narrow is-left">
				<thead>
					<tr>
						  <th>ID</th>
						  <th>Admin</th>
						  <th>Name</th>
						  <th>File Count</th>
						  <th>Disabled</th>
							 <th></th>
					</tr>
				</thead>
				<tbody id="table">
				</tbody>
			</table>
		`

    var table = document.getElementById('table')

    for (var item of response.data.users) {
	  // if(item.username === panel.username) continue;

	  if (typeof (item.admin) !== 'boolean') item.admin = await panel.isAdmin(item.username)
      var tr = document.createElement('tr')
      let disabledTxt = 'Enable'
      let disableButtonType = 'is-success'
	  let enabledisp = ''
	  if (item.enabled === 1) item.enabled = true
	  if (item.enabled === 0) item.enabled = false
      if (item.enabled === 1 || item.enabled === true) { disabledTxt = 'Disable'; disableButtonType = 'is-warning' }
	  if (item.enabled === false) enabledisp = '<i class="fa fa-check fa-2x"></i>'
	  if (item.enabled === true) enabledisp = '<i class="fa fa-times-circle fa-2x"></i>'

	  let buttons = `
						<a class="button is-primary is-small is-outlined is-rounded" title="Reset Password" onclick="panel._sendAdminAction(panel.resetUserPw, 'reset password of', '${item.username}')">
							<span class="icon is-small">
								<i class="fa fa-address-card"></i>
							</span>
						</a>
						<a class="button is-small is-info is-outlined is-rounded" title="Erase Files" onclick="panel._sendAdminAction(panel.deleteFilesOfUser, 'delete files of', '${item.username}')">
							<span class="icon is-small">
								<i class="fa fa-trash-o"></i>
							</span>
						</a>
						<a class="button is-small ${disableButtonType} is-outlined is-rounded" title="${disabledTxt}" onclick="panel._sendAdminAction(panel.disableUser, '${disabledTxt.toLowerCase()}', '${item.username}', !${item.enabled})">
							<span class="icon is-small">
								<i class="fa fa-archive"></i>
							</span>
						</a>
						<a class="button is-small is-danger is-outlined is-rounded" title="Delete" onclick="panel._sendAdminAction(panel.deleteUser, 'delete', '${item.username}')">
							<span class="icon is-small">
								<i class="fa fa-ban"></i>
							</span>
						</a>
	  `
	  	  let enableButton = `
	  <a title="${disabledTxt}" onclick="panel._sendAdminAction(panel.disableUser, '${disabledTxt.toLowerCase()}', '${item.username}', !${item.enabled})">
		${enabledisp}
	</a>
	  `
	  enabledisp = enableButton

	  if (item.admin === true) {
        buttons = ''
        item.admin = '<i class="fa fa-check fa-2x"></i>'
        enabledisp = ''
	  }

	  if (item.admin === false) item.admin = '<i class="fa fa-times-circle fa-2x"></i>'

	  if (item.username === panel.username) item.username = `(self) ${item.username}`

      tr.innerHTML = `
				<tr>
					<th>${item.id}</th>
					<th>${item.admin}</th>
					<th>${item.username}</th>
					<th>${item.filecount}</th>
					<td>${enabledisp}</td>
					<td>
						${buttons}
					</td>
				</tr>
				`
	  if (!panel.onAdminP) return
	  try {
        table.appendChild(tr)
	  } catch (e) { /* */ }
    }
  })
    .catch(function (error) {
      swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error')
      console.log(error)
    })
  panel.page.appendChild(container)

  const _waitmaps = {
	  'passwordRoot': function (key, rootpw) {
		   if (pw !== '' && rootpw) { rootpw.value = pw }
	  },
	  'sendNewAccount': function (key, obj) {
		  document.getElementById(key).addEventListener('click', function () {
        panel.registerNewUser(document.getElementById('username').value, document.getElementById('password').value, document.getElementById('passwordRoot').value)
		  })
	  }
  }
  for (let key in _waitmaps) {
	  let obj = _waitmaps[key]
	  const _int = setInterval(function () {
		  const _test = document.getElementById(key)
		  if (_test) {
			  clearInterval(_int)
			  setTimeout(function () { obj(key, _test) }, 150)
			  //obj(key, _test)
		  }
	  }, 100)
  }
}

panel.loadAdminTab = function () {
  if (panel.onAdminP) return
  panel.onAdminP = true
  panel.updateAdminPage()
}

panel.adminTab = function () {
  const rootpw = document.getElementById('passwordRoot')
  if (rootpw) return panel.updateAdminPage(rootpw.value)
  panel.updateAdminPage()
}

panel._sendAdminAction = function (func, txt, username, state = '') {
  let args = new Array(username)
  if (state !== '') args.push(state)
  args.push(document.getElementById('passwordRoot').value)
  panel.adminAction(func, txt, args)
}
panel.adminAction = function (_func, txt, args) {
  swal({
    title: 'Are you sure?',
    text: `Are you sure you want to ${txt} this user `,
    type: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ff3860',
    confirmButtonText: 'Yes',
    closeOnConfirm: false
  },
  function () {
    _func(args)
  })
}

panel.deleteUser = function (mem) {
  let _x = mem
  let user = _x[0]
  let pw = _x[1]
  panel.deleteAccount(pw, user, false)
}

panel.disableUser = function (mem) {
  let _x = mem
  let user = _x[0]
  let state = _x[1]
  let pw = _x[2]
  panel.disableAccount(pw, user, state)
}

panel.deleteFilesOfUser = function (mem) {
  let _x = mem
  let user = _x[0]
  let pw = _x[1]
  panel.deleteAccount(pw, user, true)
}
panel.resetUserPw = function (mem) {
  let _x = mem
  let user = _x[0]
  let pw = _x[1]
  panel.sendNewPassword('', user, true, pw)
}
panel.registerNewUser = function (username, pass, adminpw = '') {
  axios.post('/api/register', {username: username, password: pass, adminpw: adminpw})
    .then(function (response) {
      if (response.data.success === false) {
        return swal('An error ocurred', response.data.description, 'error')
      }

      swal({
        title: 'Yay',
        text: `User account added\n\n-Login info-\nUsername: ${username}\nPassword: ${pass}`,
        type: 'success',
        closeOnEsc: false,
        closeOnClickOutside: false
      }, async function () {
		  const _adm = await panel.isAdmin(panel.username)
        if (!_adm) return location.reload()
		  if (panel.onAdminP) panel.adminTab()
      })
    })
    .catch(function (error) {
	  panel.errorHandler(error)
    })
}

panel.lookupFile = function (txt = '') {
  document.getElementById('filedata').innerHTML = ``
  if (txt.length < 4 || txt.indexOf('.') < 1) return
  axios.get(`/api/uploads/info/${txt}`).then(function (response) {
    if (response.data.success === false) {
		  if (response.data.description === 'No token provided') return panel.verifyToken(panel.token)
		  else return swal('An error ocurred', response.data.description, 'error')
    }
    if (typeof (response.data.fileData) !== 'undefined') {
      let tables = {}
      let itemcount = 0
      let tablecount = 1
      const itemsPerTable = 9999
      for (var key in response.data.fileData) {
			    let obj = response.data.fileData[key]
        itemcount++
        if (typeof (tables[tablecount]) !== 'object') {
          tables[tablecount] = {
            'headers': '',
            'body': '',
            'rows': ''
          }
        }
        tables[tablecount][key] = obj
        tables[tablecount]['headers'] = tables[tablecount]['headers'] + `<th>${key}</th>`
        tables[tablecount]['body'] = tables[tablecount]['body'] + `<td>${obj}</td>`
        tables[tablecount]['rows'] = tables[tablecount]['rows'] + `<tr><th>${key}</th><td>${obj}</td></tr>`
        if (itemcount % itemsPerTable === 0) {
          tablecount++
        }
      }
      // console.log(tables);

      let txt = `<br><br><h2 class="subtitle"><u>File Info</u></h2><br>
				<hr>
			`
      for (var key in tables) {
        let obj = tables[key]
        let headers = obj['headers']
        let body = obj['body']
        body = obj['rows']
        headers = `<th><b>Key</b></th><th>Value</th>`
        let _tablehtml = `
				<table class="table is-striped is-narrow is-left is-fullwidth is-hoverable is-bordered">
				<thead>
					<tr>
						  ${headers}
					</tr>
				</thead>
				<tbody>
					${body}
				</tbody>
				</table>
				`

        txt = `${txt} ${_tablehtml}`
      }

      for (var key in response.data.fileData) {
        let obj = response.data.fileData[key]
        // txt = `${txt}<br><label class="label"><b><u>${key}</b></u></label>${obj}`;
      }
      txt = `${txt}</table>`
      document.getElementById('filedata').innerHTML = txt
      /* let _tbody = document.getElementById('tableLookup');
			var tr = document.createElement('tr');
			tr.innerHTML = `
				<tr>
				${_txtbody}
				</tr>
			`
			_tbody.appendChild(tr); */
    }
  }).catch(function (error) {
    panel.errorHandler(error)
  })
}

let _tm = false
panel.lookupBoxUpdated = function () {
  document.getElementById('filedata').innerHTML = ``
  if (typeof (_tm) !== 'boolean') { clearTimeout(_tm); _tm = false }
  _tm = setTimeout(function () {
    panel.lookupFile(document.getElementById('filelookupid').value)
    clearTimeout(_tm)
    _tm = false
  }, 1500)
}

panel.fileLookupScreen = function () {
  panel.onAdminP = false
  panel.page.innerHTML = ''
	  var container = document.createElement('div')
	  container.className = 'container'
	  container.innerHTML = `
			<h2 class="subtitle">Lookup some file infos</h2>

			<p class="control has-addons">
				<input id="filelookupid" class="input is-expanded" type="text" placeholder="name.extension" oninput="panel.lookupBoxUpdated()">
			</p>
			
			<div id="filedata"></div>
		`
  panel.page.appendChild(container)
}

panel.accountScreen = function () {
  panel.onAdminP = false
  panel.page.innerHTML = ''
  var container = document.createElement('div')
  container.className = 'container'
  container.innerHTML = `
		<h2 class="subtitle">Manage your account</h2>

		<label class="label">Enter your password</label>
		<p class="control has-addons">
			<input id="password" class="input is-expanded" type="password" placeholder="Your password">
		</p>
		<label class="label">Action:</label>
		<a id="sendDeleteFiles" class="button is-primary">Delete Files</a>
		<a id="sendDeleteAcc" class="button is-primary">Delete Account</a>
	`

  panel.page.appendChild(container)

  document.getElementById('sendDeleteAcc').addEventListener('click', function () {
    if (document.getElementById('password')) {
      swal({
        title: 'Are you sure you want to delete your account?',
        text: 'You wont be able to recover it!',
        type: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff3860',
        confirmButtonText: 'Yes, delete',
        closeOnConfirm: false,
        dangerMode: true,
        closeOnClickOutside: true
		  },
		  function () {
        panel.deleteAccount(document.getElementById('password').value)
		  })
    }
  })

  document.getElementById('sendDeleteFiles').addEventListener('click', function () {
    if (document.getElementById('password')) {
      swal({
        title: 'Are you sure you want to delete your files?',
        text: 'You wont be able to recover your files!',
        type: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff3860',
        confirmButtonText: 'Yes, delete',
        closeOnConfirm: false,
        dangerMode: true,
        closeOnClickOutside: true
		  },
		  function () {
        panel.deleteAccount(document.getElementById('password').value, panel.username, true)
      })
    }
  })
}

panel.disableAccount = function (password, username = panel.username, state) {
  if (typeof (state) !== 'boolean') state = false
  axios.post('/api/account/disable', {username: username, password: password, state: state})
    .then(function (response) {
      if (response.data.success === false) {
        return swal('An error ocurred', response.data.description, 'error')
      }
	  let _st = 'disabled'
	  if (state) _st = 'enabled'
      swal({
        title: 'Done',
        text: `Account ${_st}`,
        type: 'success',
        timer: 3000,
        closeOnEsc: true,
        closeOnClickOutside: true
      }, async function () {
        if (username === panel.username && !filesOnly) {
          localStorage.removeItem('token')
          location.reload('/')
        } else {
		  const _adm = await panel.isAdmin(panel.username)
          if (!_adm) return location.reload()
          if (panel.onAdminP) panel.adminTab()
        }
      })
    })
    .catch(function (error) {
	  panel.errorHandler(error)
    })
}

panel.deleteAccount = function (password, username = panel.username, filesOnly = false) {
  axios.post('/api/account/delete', {username: username, password: password, filesonly: filesOnly})
    .then(function (response) {
      if (response.data.success === false) {
        return swal('An error ocurred', response.data.description, 'error')
      }
      let _t = 'Account & data deleted!'
      if (filesOnly) _t = 'files deleted!'
      swal({
        title: 'Done',
        text: _t,
        type: 'success',
        timer: 3000,
        closeOnEsc: true,
        closeOnClickOutside: true
      }, async function () {
        if (username === panel.username && !filesOnly) {
          localStorage.removeItem('token')
          location.reload('/')
        } else {
		  const _adm = await panel.isAdmin(panel.username)
          if (!_adm) location.reload()
          if (panel.onAdminP) panel.adminTab()
        }
      })
    })
    .catch(function (error) {
	  panel.errorHandler(error)
    })
}

panel.setActiveMenu = function (item) {
  var menu = document.getElementById('menu')
  var items = menu.getElementsByTagName('a')
  for (var i = 0; i < items.length; i++) { items[i].className = '' }

  item.className = 'is-active'
}

window.onload = function () {
  panel.preparePage()
}
