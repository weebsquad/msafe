var page = {}

page.stringifyError = function (err, filter, space) {
  var plainObject = {}
  Object.getOwnPropertyNames(err).forEach(function (key) {
    plainObject[key] = err[key]
  })
  return JSON.stringify(plainObject, filter, space)
}

page.errorHandler = async function (err) {
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
    const _strerror = JSON.parse(page.stringifyError(err, null, '\t'))
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

page.do = function (dest) {
  var user = document.getElementById('user').value
  var pass = document.getElementById('pass').value

  if (user === undefined || user === null || user === '') { return swal('Error', 'You need to specify a username', 'error') }
  if (pass === undefined || pass === null || pass === '') { return swal('Error', 'You need to specify a username', 'error') }

  axios.post('/api/' + dest, {
    username: user,
    password: pass
  })
    .then(function (response) {
      if (response.data.success === false) { page.errorHandler(response.data.description) } else {
		  localStorage.token = response.data.token
		  window.location = '/dashboard'
	  }
    })
    .catch(function (error) {
      page.errorHandler(error)
    })
}

page.load = function () {
  if (page.registering === true) {
    document.getElementById('registerBtn').style.display = 'block'
    document.getElementById('mainTitle').innerHTML = 'Login or register'
  } else {
    document.getElementById('registerBtn').style.display = 'none'
    document.getElementById('mainTitle').innerHTML = 'Login'
  }
}

page.getPublicVars = function () {
  axios.get('/api/check')
    .then(function (response) {
      page.isPrivate = response.data.private
      page.maxFileSize = response.data.maxFileSize
      page.registering = response.data.register
	  page.load()
    })
    .catch(function (error) {
      page.errorHandler(error)
    })
}

page.verify = function () {
  page.getPublicVars()
  page.token = localStorage.token
  if (page.token === undefined) return

  axios.post('/api/tokens/verify', {
    token: page.token
  })
    .then(function (response) {
      if (response.data.success === false) { page.errorHandler(response.data.description) } else {
        window.location = '/dashboard'
	  }
    })
    .catch(function (error) {
      page.errorHandler(error)
    })
}

window.onload = async function () {
  page.verify()
  const input = document.getElementById('pass')
  const input2 = document.getElementById('user')
  input.addEventListener('keyup', function (event) {
	  event.preventDefault()
	  if (event.keyCode === 13) {
      document.getElementById('loginBtn').click()
	  }
  })
  input2.addEventListener('keyup', function (event) {
	  event.preventDefault()
	  if (event.keyCode === 13) {
      document.getElementById('loginBtn').click()
	  }
  })
}
