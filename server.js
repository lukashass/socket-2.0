const WebSocket = require('ws');
const mysql = require('mysql');
const cmd = require('node-cmd');
const CONFIG = require('./config.json');
const mysqlCon = {
        host     : CONFIG.dbHost,
        user     : CONFIG.dbUser,
        password : CONFIG.dbPassword,
        database : CONFIG.dbName
}

var db = mysql.createConnection(mysqlCon);

const wss = new WebSocket.Server({ port: CONFIG.wsPort });

var data;

db.query('SELECT * FROM sockets', function (error, results, fields) {
	if (error) throw error;

	data = results;


	/*data[0].name = 'not tv';
	console.log(fields);*/
	//console.log(data);



});

wss.on('connection', function connection(ws) {

	ws.on('error', () => console.log('errored'));

	ws.on('message', function incoming(message) {
		console.log('received: %s', message);

		// temp var to find changes
		var old = data;

		try {
			// hopefully message is always as expected :p
			data = JSON.parse(message);
		} catch(e) {
			console.log(e);
		}


		if(data.length == old.length) { // test not really good enough
			data.forEach( function(item, i) {
				// data[i] === item
				if(data[i] != old[i]) {

					db.query('UPDATE sockets SET status = ? WHERE id = ?', [item.status, item.id], function (error, results, fields) {
						if (error) throw error;
					});

					if(data[i].status != old[i].status) {
						cmd.run("sudo ./codesendRoot " + (item.status == 1 ? parseInt(item.code_on, 10) : parseInt(item.code_off, 10)) + " " + parseInt(item.protocol, 10));
					}
				}
			});
		}

		// process new data

		wss.clients.forEach( function(client) {
			if(client !== ws){
				client.send(JSON.stringify(data));
			}
		});
	});

	// initial data for client
	ws.send(JSON.stringify(data));

  //ws.send('something from server');
});

db.on('error', function(err) {
	if(err.code == 'PROTOCOL_CONNECTION_LOST') {
		db = mysql.createConnection(mysqlCon);
	}
	console.log(err.code); // 'ER_BAD_DB_ERROR'
});
