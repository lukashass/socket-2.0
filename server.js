const WebSocket = require('ws')
const mysql = require('mysql')
const cmd = require('node-cmd')
const schedule = require('node-schedule')
const SunCalc = require('suncalc')
const CONFIG = require('./config.json')
const mysqlCon = {
    host     : CONFIG.db.host,
    user     : CONFIG.db.user,
    password : CONFIG.db.password,
    database : CONFIG.db.name
}

var db = connectMysql(mysqlCon)

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

    updateJobs()
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

// refresh Jobs regularly because sunTimes change
var refresh = schedule.scheduleJob(CONFIG.jobRefresh, function(){
    updateJobs()
})

function connectMysql(connection) {

    var result = mysql.createConnection(connection)

    result.on('error', function(err) {
    	if(err.code == 'PROTOCOL_CONNECTION_LOST') {
    		db = connectMysql(connection)
    	}
    	console.log(err.code) // 'ER_BAD_DB_ERROR'
    })

    return result
}

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
                console.log(data.timers);
                updateTimers(data.timers)
                updateJobs()
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
            if(data.password === CONFIG.auth.password || data.password === CONFIG.auth.cookie) {
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
    if(ws.auth) {
        sendConnection(ws, {
            'type': 'auth',
            'auth': ws.auth,
            'cookie': CONFIG.auth.cookie
        })
    }

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

function updateJobs() {
    clearJobs()
    var sunTimes
    timers.forEach( function(timer, i) {

        // set sunTimes once
        if(timer.mode != 'time' && sunTimes == null){
            sunTimes = SunCalc.getTimes(new Date(), CONFIG.loc.lat, CONFIG.loc.lng)
        }

        jobs[i] = schedule.scheduleJob(jobTime(timer, sunTimes), function(){
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

function jobTime(timer, sunTimes) {

    if (timer.mode == 'time') {
        var result = timer.minute + ' ' + timer.hour + ' ' + timer.dom + ' ' + timer.month + ' ' + timer.dow
    } else {
        var offsetDate = addMinutes(sunTimes[timer.mode], timer.offset)
        var result = offsetDate.getMinutes() + ' ' + offsetDate.getHours() + ' * * *'
    }
console.log(result);
    return result
}

function updateTimers(data) {
    data.forEach( function(timer, i) {
        if(timer != timers[i]){
            if(i >= timers.length){
                db.query('INSERT INTO timers (socket_id, action, mode, offset, minute, hour, dom, month, dow) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [timer.socket_id, timer.action, timer.mode, timer.offset, imer.minute, timer.hour, timer.dom, timer.month, timer.dow, timer.id], function (error, results, fields) {
                    if (error) throw error
                })
            } else {
                db.query('UPDATE timers SET socket_id = ?, action = ?, mode = ?, offset = ?, minute = ?, hour = ?, dom = ?, month = ?, dow = ? WHERE id = ?', [timer.socket_id, timer.action, timer.mode, timer.offset, timer.minute, timer.hour, timer.dom, timer.month, timer.dow, timer.id], function (error, results, fields) {
                    if (error) throw error
                })
            }
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

function addMinutes(date, minutes) {
   return new Date(date.getTime() + minutes * 60000);
}
