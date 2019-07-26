let init = async function(db){


	// Table defs
	const tables = {
		'albums': {
			'incrementid': true,
			'columns': {
				'userid': 'integer',
				'name': 'string',
				'identifier': 'string',
				'enabled': 'integer',
				'timestamp': 'integer',
				'editedAt': 'integer',
				'zipGeneratedAt': 'integer',
			},
			'functions': {
			},
		},
		'files': {
			'incrementid': true,
			'columns': {
				'userid': 'integer',
				'name': 'string',
				'original': 'string',
				'type': 'string',
				'size': 'string', 
				'hash': 'string',
				'ip': 'string',
				'albumid': 'integer',
				'timestamp': 'integer',
				'timestampExpire': 'integer',
				'encodeVersion': 'integer',
				'encodedString': 'string',
				'deletekey': 'string',
			},
			'functions': {
			},
			'indexes': ['hash', 'encodeVersion', 'encodedString', 'deletekey'],
		},
		'users': {
			'incrementid': true,
			'columns': {
				'username': 'string',
				'password': 'string',
				'token': 'string',
				'enabled': 'integer',
				'timestamp': 'integer',
			},
			'functions': {
				'update': function(tableName) {
					db.table(tableName).where({username: 'root'}).then((user) => {
						if(user.length > 0) return;
						require('bcrypt').hash('root', 10, function(err, hash) {
							if(err) console.error('[DB] Error generating password hash for root');

							db.table(tableName).insert({
								username: 'root',
								password: hash,
								token: require('randomstring').generate(64),
								timestamp: Math.floor(Date.now() / 1000)
							}).then(() => {
								console.log(`[DB] Created root account with password 'root'`);
							}).catch(e => {
								console.error(e);
							});
						});
					});
				},
			},
		}
	};
	
	for(let tableName in tables) {
		const tableDef = tables[tableName];
		let actions = {
			'update': true,
			'create': false,
			'delete': false,
		};
		
		function handleActions(tableName) {
			for(var _key in actions) {
				if(actions[_key] === true && typeof(tableDef['functions'][_key]) === 'function') {
					console.log(`[DB] Running table function ${_key} on table ${tableName} `);
					tableDef['functions'][_key](tableName);
				}
			}
		}
		
		// Handle missing tables
		let tableExists = await db.schema.hasTable(tableName);
		if(!tableExists) {
			actions.create = true;
			await db.schema.createTable(tableName, function(tableObject) {
				if(tableDef['incrementid'] === true) {
					tableObject.increments();
					console.log(`[DB] ${tableName} - Adding ID increments`);
				}
				for(let columnName in tableDef.columns) {
					const columnType = tableDef.columns[columnName];
					tableObject[columnType](columnName);
					console.log(`[DB] ${tableName} - Adding column ${columnName}(${columnType})`);
				}
				console.log(`[DB] (re)Created table ${tableName}`);
			});
		}
		
		// Handle missing columns
		for(let columnName in tableDef.columns) {
			const columnType = tableDef.columns[columnName];
			let hasColumn = await db.schema.hasColumn(tableName, columnName);
			//console.log(`Checking ${tableName}/${columnName} (${columnType})`);
			if(!hasColumn && typeof(columnType) === 'string') {
				actions.update = true;
				await db.schema.table(tableName, function(tableObject) {
					tableObject[columnType](columnName);
					console.log(`[DB] ${tableName} - Adding missing column ${columnName}(${columnType})`);
				});
			}
		}
		
		// Do indexes
		if(typeof(tableDef['indexes']) === 'object' && tableDef['indexes'].length > 0) {
			await db.schema.table(tableName, function(tableObject) {
				//tableObject.index(tableDef['indexes']);
				//console.log(`[DB] ${tableName} - Adding indexes`);
			});
		}
		
		handleActions(tableName);
	}
	
	/*
	// Create the tables we need to store galleries and files
	let _ex = await db.schema.hasTable('albums')
	if(!_ex) db.schema.createTable('albums', function (table) {
		table.increments();
		table.integer('userid');
		table.string('name');
		table.string('identifier');
		table.integer('enabled');
		table.integer('timestamp');
		table.integer('editedAt');
		table.integer('zipGeneratedAt');
	}).then(() => {});

	_ex = await db.schema.hasTable('files')
	if(!_ex) db.schema.createTableIfNotExists('files', function (table) {
		table.increments();
		table.integer('userid');
		table.string('name');
		table.string('original');
		table.string('type');
		table.string('size');
		table.string('hash');
		table.string('ip');
		table.integer('albumid');
		table.integer('timestamp');
		table.integer('timestampExpire');
		table.integer('encodeVersion');
		table.string('encodedString');
	}).then(() => {});
	
	_ex = await db.schema.hasTable('users')
	if(!_ex) db.schema.createTableIfNotExists('users', function (table) {
		table.increments();
		table.string('username');
		table.string('password');
		table.string('token');
		table.integer('enabled');
		table.integer('timestamp');
	}).then(() => {
		db.table('users').where({username: 'root'}).then((user) => {
			if(user.length > 0) return;

			require('bcrypt').hash('root', 10, function(err, hash) {
				if(err) console.error('Error generating password hash for root');

				db.table('users').insert({
					username: 'root',
					password: hash,
					token: require('randomstring').generate(64),
					timestamp: Math.floor(Date.now() / 1000)
				}).then(() => {});
			});
		});
	});
	*/
};

module.exports = init;
