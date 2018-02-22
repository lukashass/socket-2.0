var vm = new Vue({
	el: '#app',
	data: {
		drawer: false,
        view: 'socket',
		connected: false,
		auth: false,
		sockets: {},
        headers: [
            {
              text: 'Socket name',
              align: 'left',
              sortable: false,
              value: 'name'
            },
            { text: 'Action', value: 'action' },
            { text: 'Minute', value: 'minute' },
            { text: 'Hour', value: 'hour' },
            { text: 'Day of Month', value: 'dom' },
            { text: 'Month', value: 'month' },
            { text: 'Day of Week', value: 'dow' }
        ],
        timers: []

	},
	methods: {
		power: function(id, action) {
			this.sockets.forEach( function(socket) {
				if(socket.id == id) {
					socket.status = action
				}
			})
			var raw = {'type': 'sockets', 'sockets': this.sockets}
			ws.send(JSON.stringify(raw))
		},
        setView: function(view) {
            this.view = view
            drawer = false
        }
	}
})

// Create WebSocket connection.
var ws = connectWebsocket('wss://' + window.location.hostname + '/websocket/')

function connectWebsocket(url) {

    var result = new WebSocket(url)

    // Connection opened
    result.onopen = function (event) {
    	console.log('WebSocket: connected')
    	vm.connected = true
    	vm.auth = false
    }

    // Listen for messages
    result.onmessage = function (event) {
    	incoming(event.data)
    }

    result.onerror = (e) => {
    }

    result.onclose = function (e) {
    	console.log('WebSocket: disconnected')
    	vm.connected = false
    	setTimeout(() => {
    		ws = connectWebsocket(url)
    	}, 1000)
    }

    return result
}

function incoming(input) {
	var data
	try {
		data = JSON.parse(input);
	} catch(e) {
		alert(e)
	}
	switch(data.type) {
		case 'sockets':
			vm.sockets = data.sockets
			break
        case 'timers':
            vm.timers = data.timers
            break
	}
	console.log(vm.sockets)
}
Vue.config.devtools = true
