const WebSocket = require('ws')
const mysql = require('mysql')
const mqtt = require('mqtt')
const schedule = require('node-schedule')
const SunCalc = require('suncalc')
const CONFIG = require('./config.json')
const mysqlCon = {
  host: CONFIG.db.host,
  user: CONFIG.db.user,
  password: CONFIG.db.password,
  database: CONFIG.db.name
}

var sockets = []
var timers
var jobs = []

// ////////////////
// mqtt
// ////////////////

var mqttClient = mqtt.connect(CONFIG.mqtt.host, {
  username: CONFIG.mqtt.user,
  password: CONFIG.mqtt.password
})

mqttClient.on('connect', function () {
  mqttClient.subscribe(CONFIG.mqtt.path + 'rx/')
})

mqttClient.on('message', function (topic, message) {
  // message is Buffer
  var received = JSON.parse(message)
  sockets.some(function (item) {
    if (item.code_on.includes(received.code)) {
      if (toggleSocket(item.id, 1)) {
        broadcastAll({
          'type': 'sockets',
          'sockets': sockets
        })
      }
      return true
    } else if (item.code_off.includes(received.code)) {
      if (toggleSocket(item.id, 0)) {
        broadcastAll({
          'type': 'sockets',
          'sockets': sockets
        })
      }
      return true
    }
  })
})

// ////////////////
// mysql
// ////////////////

var db = connectMysql(mysqlCon)

function connectMysql (connection) {
  var result = mysql.createConnection(connection)

  result.on('error', function (err) {
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      db = connectMysql(connection)
    }
    console.log(err.code) // 'ER_BAD_DB_ERROR'
  })

  return result
}

db.query('SELECT * FROM sockets', function (error, results, fields) {
  if (error) throw error
  results.forEach((result) => {
    result.code_on = JSON.parse(result.code_on)
    result.code_off = JSON.parse(result.code_off)
  })
  sockets = results
})

db.query('SELECT * FROM timers', function (error, results, fields) {
  if (error) throw error

  timers = results

  updateJobs()
})

// ////////////////
// websocket
// ////////////////

const wss = new WebSocket.Server({
  port: CONFIG.wsPort
})

wss.on('connection', function connection (ws) {
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
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate()

    ws.isAlive = false
    ws.ping(() => {})
  })
}, 30000)

function initConnection (ws) {
  ws.isAlive = true
  ws.auth = false
}

function initialData (ws) {
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

function incoming (ws, message) {
  // temp var to find changes
  var data

  try {
    // hopefully message is always as expected :p
    data = JSON.parse(message)
  } catch (e) {
    console.log(e)
  }

  if (ws.auth) {
    switch (data.type) {
      case 'toggle':
        toggleSocket(data.id, data.action)
        broadcastOthers(ws, {
          'type': 'sockets',
          'sockets': sockets
        })
        break
      case 'sockets':
        updateSockets(data.sockets)
        broadcastOthers(ws, {
          'type': 'sockets',
          'sockets': sockets
        })
        break
      case 'timers':
        updateTimers(data.timers)
        updateJobs()
        broadcastAll({
          'type': 'timers',
          'timers': timers
        })
        break
      case 'logout':
        authConnection(ws, false)
        break
    }
  }
  switch (data.type) {
    case 'login':
      if (data.password === CONFIG.auth.password || data.password === CONFIG.auth.cookie) {
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

function authConnection (ws, state) {
  ws.auth = state
  if (ws.auth) {
    sendConnection(ws, {
      'type': 'auth',
      'auth': ws.auth,
      'cookie': CONFIG.auth.cookie
    })
  }
}

function broadcastOthers (ws, raw) {
  wss.clients.forEach((client) => {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      sendConnection(client, raw)
    }
  })
}

function broadcastAll (raw) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      sendConnection(client, raw)
    }
  })
}

// ////////////////
// sockets
// ////////////////

function updateSockets (data) {
  var old = sockets
  sockets = data
  if (sockets.length === old.length) { // test not really good enough
    sockets.forEach((item, i) => {
      // sockets[i] === item
      // if(sockets[i] != old[i]) {
      if (item.status !== old[i].status) { // okay for now, only changing status anyway
        db.query('UPDATE sockets SET status = ? WHERE id = ?', [item.status, item.id], function (error, results, fields) {
          if (error) throw error
        })
      }
    })
  }
}

function toggleSocket (id, action) {
  var socket = objectWithID(sockets, id)
  if (socket.status === action) {
    return false
  }

  socket.status = action

  db.query('UPDATE sockets SET status = ? WHERE id = ?', [action, id], function (error, results, fields) {
    if (error) throw error
  })

  // TODO: will also be executed when called by external remote
  mqttClient.publish(CONFIG.mqtt.path + 'tx/', JSON.stringify({
    'code': (socket.status === 1 ? socket.code_on[0] : socket.code_off[0]),
    'protocol': socket.protocol,
    'pulseLength': socket.pulseLength
  }))

  return true
}

function objectWithID (array, id) {
  var res
  array.some(function (item) {
    if (item.id === id) {
      res = item
      return true
    }
  })
  return res
}

// ////////////////
// jobs
// ////////////////

function updateJobs () {
  clearJobs()
  var sunTimes
  timers.forEach((timer, i) => {
    // set sunTimes once
    if (timer.mode !== 'time' && sunTimes == null) {
      sunTimes = SunCalc.getTimes(new Date(), CONFIG.loc.lat, CONFIG.loc.lng)
    }

    jobs[i] = schedule.scheduleJob(jobTime(timer, sunTimes), function () {
      if (toggleSocket(timer.socket_id, timer.action)) {
        broadcastAll({
          'type': 'sockets',
          'sockets': sockets
        })
      }
    })
  })
}

function clearJobs () {
  jobs.forEach((job) => {
    job.cancel()
  })
  jobs = []
}

function jobTime (timer, sunTimes) {
  if (timer.mode === 'time') {
    return timer.time
  } else {
    var offsetDate = addMinutes(sunTimes[timer.mode], timer.offset)
    timer.time = offsetDate.getHours() + ':' + offsetDate.getMinutes()
    return offsetDate.getMinutes() + ' ' + offsetDate.getHours() + ' * * *'
  }
}

function addMinutes (date, minutes) {
  return new Date(date.getTime() + minutes * 60000)
}

// refresh Jobs regularly because sunTimes change
schedule.scheduleJob(CONFIG.jobRefresh, function () {
  updateJobs()
})

// ////////////////
// timers
// ////////////////

function updateTimers (data) {
  data.forEach((timer, i) => {
    if (timer !== timers[i]) {
      if (i >= timers.length) {
        db.query('INSERT INTO timers (socket_id, action, mode, offset, time) VALUES (?, ?, ?, ?, ?)', [timer.socket_id, timer.action, timer.mode, timer.offset, timer.time], function (error, results, fields) {
          if (error) throw error
        })
      } else {
        db.query('UPDATE timers SET socket_id = ?, action = ?, mode = ?, offset = ?, time = ? WHERE id = ?', [timer.socket_id, timer.action, timer.mode, timer.offset, timer.time, timer.id], function (error, results, fields) {
          if (error) throw error
        })
      }
    }
  })
  timers = data
}
