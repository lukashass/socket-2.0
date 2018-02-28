Vue.config.devtools = true

var vm = new Vue({
	el: '#app',
	data: {
        // UI
		drawer: null,
        view: 'socket',
        dialog: false,

        // websocket
		connected: false,
		auth: false,
        password: '',
        pwVis: true,

        // backend
		sockets: [],
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
            socket_id: 0,
            action: 0,
            minute: '*',
            hour: '*',
            dom: '*',
            month: '*',
            dow: '*'
        },
        defaultTimer: {
            socket_id: 0,
            action: 0,
            minute: '*',
            hour: '*',
            dom: '*',
            month: '*',
            dow: '*'
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
            this.drawer = window.innerWidth > 1024 // 1024px = Responsive level laptop
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
            this.send({'type': 'timers', 'timers': this.timers})
        },
        login: function(password) {
			this.send({'type': 'login', 'password': password})
            this.password = ''
        },
        logout: function() {
            this.sockets = {}
            this.timers = []
            vm.auth = false
            document.cookie = "auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            this.send({'type': 'logout'})
        }
	},
    computed: {
        formTitle () {
            return this.editedIndex === -1 ? 'New Timer' : 'Edit Timer'
        }
    },

    watch: {
        dialog (val) {
            val || this.close()
        }
    }
})

// Create WebSocket connection.
if (window.location.protocol === "https:") {
    var protocol = "wss:"
} else {
    var protocol = "ws:"
}

var ws = connectWebsocket(protocol + '//' + window.location.hostname + '/websocket/')

function connectWebsocket(url) {

    var result = new WebSocket(url)

    // Connection opened
    result.onopen = function (event) {
    	console.log('WebSocket: connected')
    	vm.connected = true
    	vm.auth = false
        vm.login(getCookie('auth'))
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
        case 'auth':
            vm.auth = data.auth
            if (vm.auth) {
                setCookie('auth', data.cookie, 3000)
            }
            break
	}
	console.log('received: ' + data.type)
}

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    var expires = "expires="+d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for(var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}
