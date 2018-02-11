// Create WebSocket connection.
const ws = new WebSocket('wss://' + window.location.hostname + '/websocket/');

// Connection opened
ws.addEventListener('open', function (event) {
});


var vm = new Vue({
	el: '#app',
	data: {
		drawer: false,
		message: 'Hello Vue!',
		zug: 'nicht trello',
		trello: 0,
		field: 0,
		sockets: {}
	},
	methods: {
		foo: function (input) {
			this.trello += parseInt(input);
			console.log("string: " + input);
		},
		power: function(id, action) {
			this.sockets.forEach( function(socket) {
				if(socket.id == id) {
					socket.status = action;
				}
			});
			ws.send(JSON.stringify(this.sockets));
		}
	}
});


// Listen for messages
ws.addEventListener('message', function (event) {
	try {
		vm.sockets = JSON.parse(event.data);
	} catch(e) {
		alert(e);
	}
    console.log(vm.sockets);
});


Vue.config.devtools = true;

/*ws.on('message', (msg) => {
	try {
		msg = JSON.parse(msg);		
	} catch(e) {
		console.err(e);
	}
	if(msg.type == 'pong') {
		console.log(msg.content);
	} else if(str == 'toll') {
		app.$data.message = 'neue nachricht!';
		app.$data.zug = str;
	} else {
		ws.write('back: ' + str);
	}
});
*/
