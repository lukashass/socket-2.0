var vm = new Vue({
	el: '#app',
	data: {
		drawer: false,
        view: 'socket',
        dialog: false,
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
            { text: 'Day of Week', value: 'dow' },
            { text: 'Actions', value: 'name', sortable: false }
        ],
        timers: [],

        editedIndex: -1,
        editedTimer: {
            socket_id: -1,
            action: 0,
            minute: '*',
            hour: '*',
            dom: '*'
        },
        defaultTimer: {
            socket_id: -1,
            action: 0,
            minute: '*',
            hour: '*',
            dom: '*'
        }

	},
	methods: {
        send: function(raw) {
            ws.send(JSON.stringify(raw))
        },
		power: function(id, action) {
			this.sockets.forEach( function(socket) {
				if(socket.id == id) {
					socket.status = action
				}
			})
			var raw = {'type': 'sockets', 'sockets': this.sockets}
			this.send(raw)
		},
        setView: function(view) {
            this.view = view
            drawer = false
        },
        editTimer (item) {
            this.editedIndex = this.timers.indexOf(item)
            this.editedTimer = Object.assign({}, item)
            this.dialog = true
        },

        deleteItem (item) {
            const index = this.timers.indexOf(item)
            confirm('Are you sure you want to delete this item?') && this.timers.splice(index, 1)
        },

        close () {
            this.dialog = false
            setTimeout(() => {
                this.editedTimer = Object.assign({}, this.defaultTimer)
                this.editedIndex = -1
            }, 300)
        },

        save () {
            if (this.editedIndex > -1) {
                Object.assign(this.timers[this.editedIndex], this.editedTimer)
            } else {
                this.timers.push(this.editedTimer)
            }
            this.timer()
            this.close()
        },
        timer: function() {
            var raw = {'type': 'timers', 'timers': this.timers}
            this.send(raw)
        }
	},
    computed: {
        formTitle () {
            return this.editedIndex === -1 ? 'New Item' : 'Edit Item'
        }
    },

    watch: {
        dialog (val) {
            val || this.close()
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
	console.log('received: ' + data.type)
}
Vue.config.devtools = true
