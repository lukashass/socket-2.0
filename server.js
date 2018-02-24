const WebSocket = require('ws')
const mysql = require('mysql')
const cmd = require('node-cmd')
const schedule = require('node-schedule')
const CONFIG = require('./config.json')
const mysqlCon = {
    host     : CONFIG.dbHost,
    user     : CONFIG.dbUser,
    password : CONFIG.dbPassword,
    database : CONFIG.dbName
}

var db = mysql.createConnection(mysqlCon)

const wss = new WebSocket.Server({ port: CONFIG.wsPort })

var sockets = []
var timers
var jobs = []

db.query('SELECT * FROM sockets', function (error, results, fields) {
	if (error) throw error
    results.forEach( function(result) {
        sockets[result.id] = result
    })

});

db.query('SELECT * FROM timers', function (error, results, fields) {
	if (error) throw error

	timers = results

    initJobs()
})

wss.on('connection', function connection(ws) {

	ws.on('error', () => console.log('errored'))

	initConnection(ws)

	ws.on('message', (msg) => {
		incoming(ws, msg)
	})

	ws.on('pong', () => {
      		ws.isAlive = true
    })
})

// WebSocket keep alive pings
setInterval(() => {
	wss.clients.forEach(function each (ws) {
		if (ws.isAlive === false) return ws.terminate()

		ws.isAlive = false
		ws.ping(() => {})
	})
}, 30000)

db.on('error', function(err) {
	if(err.code == 'PROTOCOL_CONNECTION_LOST') {
		db = mysql.createConnection(mysqlCon);
	}
	console.log(err.code); // 'ER_BAD_DB_ERROR'
});


function initConnection(ws) {
	ws.isAlive = true
    ws.auth = false
}

function incoming(ws, message) {

	// temp var to find changes
	var data

	try {
		// hopefully message is always as expected :p
		data = JSON.parse(message)
	} catch(e) {
		console.log(e)
	}

    if (ws.auth) {
    	switch (data.type) {
    		case 'sockets':
    			updateSockets(data.sockets)
                var raw = {
                    'type': 'sockets',
                    'sockets': sockets
                }
                broadcastOthers(ws, raw)
    			break
            case 'timers':
                console.log(timers);
                updateTimers(data.timers)
                initJobs()
                var raw = {
                    'type': 'timers',
                    'timers': timers
                }
                broadcastOthers(ws, raw)
                break
            case 'logout':
                authConnection(ws, false)
                break
        }
    }
    switch (data.type) {
        case 'login':
            if(data.password === CONFIG.wsPassword) {
                authConnection(ws, true)
                initialData(ws)
            }
            break
	}

    console.log('received: ' + data.type)
}

function sendConnection (ws, data) {
	if (ws.readyState === ws.OPEN) {
		ws.send(JSON.stringify(data))
	}
}

function authConnection(ws, state) {
    ws.auth = state
    sendConnection(ws, {
        'type': 'auth',
        'auth': ws.auth
    })
}

function updateSockets(data){
	var old = sockets
	sockets = data
    if (sockets.length == old.length) { // test not really good enough

        sockets.forEach( function(item, i) {
            // sockets[i] === item
            //if(sockets[i] != old[i]) {
            if(item.status != old[i].status) { // okay for now, only changing status anyway

				db.query('UPDATE sockets SET status = ? WHERE id = ?', [item.status, item.id], function (error, results, fields) {
					if (error) throw error
				})

				if(sockets[i].status != old[i].status) {
					cmd.run("sudo ./codesendRoot " + (item.status == 1 ? parseInt(item.code_on, 10) : parseInt(item.code_off, 10)) + " " + parseInt(item.protocol, 10))
				}
			}
		})
    }
}

function broadcastOthers(ws, raw) {
    wss.clients.forEach( function(client) {
        if(client !== ws && client.readyState === WebSocket.OPEN){
            sendConnection(client, raw)
        }
    })
}

function broadcastAll() {
    wss.clients.forEach( function(client) {
        if (client.readyState === WebSocket.OPEN) {
            sendConnection(client, {
                'type': 'sockets',
                'sockets': sockets
            })
        }
    })
}

function initJobs() {
    clearJobs()
    timers.forEach( function(timer, i) {
        jobs[i] = schedule.scheduleJob(timer.minute + ' ' + timer.hour + ' * * *', function(){
            if(sockets[timer.socket_id].status != timer.action) {

                var data = JSON.parse(JSON.stringify(sockets)) // deep copy of sockets
                data[timer.socket_id].status = timer.action

                updateSockets(data)
                broadcastAll()

            }
        })
    })
}

function clearJobs(){
    jobs.forEach( function(job) {
        job.cancel()
    })
    jobs = []
}

function updateTimers(data) {
    data.forEach( function(timer, i) {
        if(timer != timers[i]){
            db.query('UPDATE timers SET socket_id = ?, action = ?, minute = ?, hour = ?, dom = ?, month = ?, dow = ? WHERE id = ?', [timer.socket_id, timer.action, timer.minute, timer.hour, timer.dom, timer.month, timer.dow, timer.id], function (error, results, fields) {
                if (error) throw error
            })
        }
    })
    timers = data
}

function initialData(ws) {
    // initial data for client
    sendConnection(ws, {
        'type': 'sockets',
        'sockets': sockets
    })

    sendConnection(ws, {
        'type': 'timers',
        'timers': timers
    })
}
