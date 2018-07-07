let panel = {}

panel.page
panel.username
panel.token = localStorage.token
panel.filesView = localStorage.filesView

panel.admins = new Array();
panel.isAdmin = async function(name) {
	if(panel.admins.length === 0) await fetchAdmins();
	if(panel.admins.indexOf(name) > -1) return true;
	return false;
}

panel.fetchAdmins = async function() {
	panel.admins = new Array();
	axios.get('/api/albums').then(function (response) {
		if (response.data.success === false) {
			if (response.data.description === 'No token provided') return panel.verifyToken(panel.token)
			else return swal('An error ocurred', response.data.description, 'error')
		}
		response.data.admins.forEach(function(vl) { panel.admins.push(vl); });
	});
}

panel.preparePage = function () {
  if (!panel.token) return window.location = '/auth'
  panel.verifyToken(panel.token, true)
}

panel.verifyToken = function (token, reloadOnError) {
  if (reloadOnError === undefined) { reloadOnError = false }

  axios.post('/api/tokens/verify', {
    token: token
  })
    .then(function (response) {
      if (response.data.success === false) {
        swal({
          title: 'An error ocurred',
          text: response.data.description,
          type: 'error'
        }, function () {
          if (reloadOnError) {
            localStorage.removeItem('token')
            location.location = '/auth'
          }
        })
        return
      }

      axios.defaults.headers.common['token'] = token
      localStorage.token = token
      panel.token = token
      panel.username = response.data.username
      return panel.prepareDashboard()
    })
    .catch(function (error) {
      return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error')
      console.log(error)
    })
}

panel.prepareDashboard = async function () {
  panel.page = document.getElementById('page')
  document.getElementById('auth').style.display = 'none'
  document.getElementById('dashboard').style.display = 'block'
  const _adm = await panel.isAdmin(panel.username);
  if (_adm) { // adminstuff
    document.getElementById('itemAdmin').style.display = 'block'
  }

  document.getElementById('itemUploads').addEventListener('click', function () {
    panel.setActiveMenu(this)
  })

  document.getElementById('itemManageGallery').addEventListener('click', function () {
    panel.setActiveMenu(this)
  })

  document.getElementById('itemTokens').addEventListener('click', function () {
    panel.setActiveMenu(this)
  })

  document.getElementById('itemPassword').addEventListener('click', function () {
    panel.setActiveMenu(this)
  })

  document.getElementById('itemLogout').innerHTML = `Logout ( ${panel.username} )`

  panel.getAlbumsSidebar()
}

panel.logout = function () {
  localStorage.removeItem('token')
  location.reload('/')
}

panel.getUploads = function (album = undefined, page = undefined) {
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

    if (response.data.files.length < 25) { nextPage = page }

    if (page > 0) prevPage = page - 1

    panel.page.innerHTML = ''
    var container = document.createElement('div')
    var pagination = `<nav class="pagination is-centered">
					  		<a class="pagination-previous" onclick="panel.getUploads(${album}, ${prevPage} )">Previous</a>
					  		<a class="pagination-next" onclick="panel.getUploads(${album}, ${nextPage} )">Next page</a>
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
	  const _adm = await panel.isAdmin(panel.username);
      if (_adm) { albumOrUser = 'User' }

      container.innerHTML = `
				${pagination}
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

      panel.page.appendChild(container)
      var table = document.getElementById('table')

      for (var item of response.data.files) {
        var tr = document.createElement('tr')

        var displayAlbumOrUser = item.album
		const _adm = await panel.isAdmin(panel.username);
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
      return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error')
      console.log(error)
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
        return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error')
        console.log(error)
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
      return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error')
      console.log(error)
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
        return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error')
        console.log(error)
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
        return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error')
        console.log(error)
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
      return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error')
      console.log(error)
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
        a.innerHTML = album.id + ' | ' + album.name

        a.addEventListener('click', function () {
          panel.getAlbum(this)
        })

        li.appendChild(a)
        albumsContainer.appendChild(li)
      }
    })
    .catch(function (error) {
      return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error')
      console.log(error)
    })
}

panel.getAlbum = function (item) {
  panel.setActiveMenu(item)
  panel.getUploads(item.id)
}

panel.changeToken = function () {
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
      return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error')
      console.log(error)
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
      return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error')
      console.log(error)
    })
}

panel.changePassword = function () {
  panel.page.innerHTML = ''
  var container = document.createElement('div')
  container.className = 'container'
  container.innerHTML = `
		<h2 class="subtitle">Change your password</h2>

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
    if (document.getElementById('password').value === document.getElementById('passwordConfirm').value) {
      panel.sendNewPassword(document.getElementById('password').value)
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

panel.sendNewPassword = function (pass, username = panel.username, random = false) {
  axios.post('/api/password/change', {username: username, password: pass, random: random})
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
		const _adm = await panel.isAdmin(panel.username);
        if(!_adm) return location.reload()
		panel.updateAdminPage();
      })
    })
    .catch(function (error) {
      return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error')
      console.log(error)
    })
}
panel.updateAdminPage = function (pw = '') {
  panel.page.innerHTML = ''
  var container = document.createElement('div')
  container.className = 'container'
  container.innerHTML = `
		<h2 class="subtitle">New account</h2>

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

  axios.get(url).then(function (response) {
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
						  <th>Name</th>
						  <th>Disabled</th>
							 <th></th>
					</tr>
				</thead>
				<tbody id="table">
				</tbody>
			</table>
			<hr>
		`

    var table = document.getElementById('table')
    for (var item of response.data.users) {
      var tr = document.createElement('tr')
      let disabledTxt = 'Enable'
      let disableButtonType = 'is-success'
      if (item.enabled === 1 || item.enabled === true) { disabledTxt = 'Disable'; disableButtonType = 'is-warning' }
      tr.innerHTML = `
				<tr>
					<th>${item.id}</th>
					<th>${item.username}</th>
					<td>${!item.enabled}</td>
					<td>
						<a class="button is-primary is-small is-outlined is-rounded" title="Reset Password" onclick="panel._sendAdminAction(panel.resetUserPw, 'reset password of', '${item.username}')">
							<span class="icon is-small">
								<i class="fa fa-address-card"></i>
							</span>
						</a>
						<a class="button is-small is-info is-outlined is-rounded" title="Erase Files/Albums" onclick="panel._sendAdminAction(panel.deleteFilesOfUser, 'delete files of', '${item.username}')">
							<span class="icon is-small">
								<i class="fa fa-trash-o"></i>
							</span>
						</a>
						<a class="button is-small ${disableButtonType} is-outlined is-rounded" title="${disabledTxt}" onclick="panel._sendAdminAction(panel.disableUser, '${disabledTxt}', '${item.username}', !${item.enabled})">
							<span class="icon is-small">
								<i class="fa fa-archive"></i>
							</span>
						</a>
						<a class="button is-small is-danger is-outlined is-rounded" title="Delete" onclick="panel._sendAdminAction(panel.deleteUser, 'delete', '${item.username}')">
							<span class="icon is-small">
								<i class="fa fa-ban"></i>
							</span>
						</a>
					</td>
				</tr>
				`

      table.appendChild(tr)
    }
  })
    .catch(function (error) {
      return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error')
      console.log(error)
    })
  panel.page.appendChild(container)
  let _int = setInterval(function () {
    let rootpw = document.getElementById('passwordRoot')
    if (pw !== '' && rootpw) { clearInterval(_int); rootpw.value = pw }
  }, 100)

  document.getElementById('sendNewAccount').addEventListener('click', function () {
    panel.registerNewUser(document.getElementById('username').value, document.getElementById('password').value)
  })
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
  panel.sendNewPassword('', user, true)
}
panel.registerNewUser = function (username, pass) {
  axios.post('/api/register', {username: username, password: pass})
    .then(function (response) {
      if (response.data.success === false) {
        return swal('An error ocurred', response.data.description, 'error')
      }

      swal({
        title: 'Yay',
        text: `User account added\n\n-Login info-\nUsername: ${username}\nPassword: ${password}`,
        type: 'success'
      }, async function () {
		  const _adm = await panel.isAdmin(panel.username);
          if (!p_adm) location.reload()
      })
    })
    .catch(function (error) {
      return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error')
      console.log(error)
    })
}

panel.accountScreen = function () {
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
      panel.deleteAccount(document.getElementById('password').value)
    }
  })

  document.getElementById('sendDeleteFiles').addEventListener('click', function () {
    if (document.getElementById('password')) {
      panel.deleteAccount(document.getElementById('password').value, panel.username, true)
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

      swal({
        title: 'Done',
        text: 'Account disabled',
        type: 'success'
      }, asyncfunction () {
        if (username === panel.username && !filesOnly) {
          localStorage.removeItem('token')
          location.reload('/')
        } else {
		  const _adm = await panel.isAdmin(panel.username);
          if (!_adm) return location.reload()
          panel.adminTab()
        }
      })
    })
    .catch(function (error) {
      return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error')
      console.log(error)
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
        type: 'success'
      }, async function () {
        if (username === panel.username && !filesOnly) {
          localStorage.removeItem('token')
          location.reload('/')
        } else {
		  const _adm = await panel.isAdmin(panel.username);
          if (!_adm) location.reload()
          panel.adminTab()
        }
      })
    })
    .catch(function (error) {
      return swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error')
      console.log(error)
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
