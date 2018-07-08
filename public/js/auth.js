var page = {}


page.errorHandler = async function(err) {
	if(typeof(err) !== 'string') {
		swal('An error ocurred', 'There was an error with the request, please check the console for more information.', 'error')
		console.log(error)
		return;
	}
	console.log(err);
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
      if (response.data.success === false) { return swal('Error', response.data.description, 'error') }

      localStorage.token = response.data.token
      window.location = '/dashboard'
    })
    .catch(function (error) {
      page.errorHandler(error);
    })
}

page.load = function() {
	if(page.registering === true) {	
		document.getElementById('registerBtn').style.display = 'block';
		document.getElementById('mainTitle').innerHTML = 'Login or register';
	} else {
		document.getElementById('registerBtn').style.display = 'none';
		document.getElementById('mainTitle').innerHTML = 'Login';
	}
}

page.getPublicVars = function () {
  axios.get('/api/check')
    .then(function (response) {
      page.isPrivate = response.data.private
      page.maxFileSize = response.data.maxFileSize
      page.registering = response.data.register
	  page.load();
    })
    .catch(function (error) {
      page.errorHandler(error);
    })
}

page.verify = function () {
  page.token = localStorage.token
  if (page.token === undefined) return

  axios.post('/api/tokens/verify', {
    token: page.token
  })
    .then(function (response) {
      if (response.data.success === false) { return swal('Error', response.data.description, 'error') }

      window.location = '/dashboard'
    })
    .catch(function (error) {
      page.errorHandler(error);
    })
}

window.onload = async function () {
  page.verify()
  const input = document.getElementById('pass')
  input.addEventListener('keyup', function (event) {
	  event.preventDefault()
	  if (event.keyCode === 13) {
      document.getElementById('loginBtn').click()
	  }
  })
}
