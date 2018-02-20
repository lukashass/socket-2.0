var vm = new Vue({
	el: '#app',
	data: {
		drawer: false,
		connected: false,
		auth: false,
		sockets: {}
	},
	methods: {
		power: function(id, action) {
			this.sockets.forEach( function(socket) {
				if(socket.id == id) {
					socket.status = action
				}
			})
			ws.send(JSON.stringify(this.sockets))
		}
	}
})

// Create WebSocket connection.
const ws = new WebSocket('wss://' + window.location.hostname + '/websocket/')

// Connection opened
ws.onopen = function (event) {
	console.log('WebSocket: connected')
	vm.connected = true
	vm.auth = false
}

// Listen for messages
ws.onmessage = function (event) {
	incoming(event.data)
}

ws.onclose = function (e) {
	console.log('WebSocket: disconnected')
	vm.connected = false
	/*setTimeout(() => {
		socket = connectWebsocket(url)
	}, 1000)*/
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
	}
	console.log(vm.sockets)
}
Vue.config.devtools = true