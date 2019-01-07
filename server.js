// dependencies!
var http = require('http'); // this is new
var express = require('express')
var app = express();

var server = http.createServer(app); // this is new
var bodyParser = require('body-parser');
var anyDB = require('any-db');
var engines = require('consolidate');

var io = require('socket.io').listen(server);

// changed from *app*.listen(8080);
server.listen(8080);

// your server code here

//creates the connection to SQlit3 chatroom database
var conn = anyDB.createConnection('sqlite3://chatroom.db');

app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());
app.engine('html', engines.hogan); // tell express to run .html files through Hogan
app.set('views', __dirname + '/templates'); // tell express where to find templates, in this case the '/templates' directory
app.use(express.static(__dirname + '/public')); // add in public domain for use
app.set('view engine', 'html'); //register .html extension as template engine so we can render .html pages 

//creates an array of the randomly generated ids for further use
var randIDs = [];

//creates the table of messages and users
conn.query('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT, nickname TEXT, body TEXT, time INTEGER)');
conn.query('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT, nickname TEXT)');

//gets the home page
app.get('/', function(request, response){
	//renders the home page's html code
	response.render('index.html');

});

//gets the temp page in between home and a chatroom page
app.get('/redirect', function(request, response){
	//creates randomized room id, adds it to array, redirects to the chatroom
	var id = generateRoomIdentifier();
	//ensures there are no repeats
	for (var i = 0; i < randIDs.length; i++) {
		if (randIDs[i] === id) {
			id = generateRoomIdentifier();
		}
	}
	randIDs.push(id);
	response.json({room: id});
});

//gets a current chatroom and renders the html
app.get('/:roomName', function(request, response){
	var room = request.params.roomName; 
	response.render('room.html', {roomName: room});
});

io.sockets.on('connection', function(socket){

    // clients emit this when they join new rooms
    socket.on('join', function(roomName, nickname, callback){
        socket.join(roomName); // this is a socket.io method
        socket.nickname = nickname; // yay JavaScript! see below
        socket.roomName = roomName;

        var messages = [];
    	messages.push(roomName);
        // get a list of messages currently in the room, then send it back
       	var getmessages = 'SELECT nickname, body, time FROM messages WHERE room=$1 ORDER BY time ASC';
   	 	
    	//makes a query for this chatroom's messages
    	var q = conn.query(getmessages, messages, function(error, result){
    		if(error) {
    			console.log('there was an error');
    		} else {
    			//one row represents one message
				callback(result.rows);
    		}
		});

		var insert = 'INSERT INTO users (room, nickname) VALUES ($1, $2)';
		var args = [];
		args.push(roomName);
		args.push(nickname);
		//queries with the proper args
		var q = conn.query(insert, args, function(error, result){
			if(error) {
				console.log('there was an error');
			} else {
				//success!!
				console.log('success');
			}
		});

		var users = [];
		users.push(roomName);
		var getusers = 'SELECT nickname FROM users WHERE room=$1';
		var q = conn.query(getusers, users, function(error, result){
			if(error){
				console.log('there was an error');
			} else {
				io.sockets.in(roomName).emit('joinNickname', result.rows);
			}
		});
    });

    // this gets emitted if a user changes their nickname
    socket.on('nickname', function(nickname, callback){

        var old = socket.nickname;
        socket.nickname = nickname;

        var args = [];
    	args.push(socket.roomName);
    	args.push(old);
    	var sql = 'DELETE FROM users WHERE room=$1 AND nickname=$2';
    	var q = conn.query(sql, args, function(error, result){
			if(error){
				console.log('there was an error');
			} else {
				console.log('success');
			}
		});

		var insert = 'INSERT INTO users (room, nickname) VALUES ($1, $2)';
		args = [];
		args.push(socket.roomName);
		args.push(nickname);
		var q = conn.query(insert, args, function(error, result){
			if(error) {
				console.log('there was an error');
			} else {
				//success!!
				console.log('success');
			}
		});

		var users = [];
		users.push(socket.roomName);
		var getusers = 'SELECT nickname FROM users WHERE room=$1';
		var q = conn.query(getusers, users, function(error, result){
			if(error){
				console.log('there was an error');
			} else {
				io.sockets.in(socket.roomName).emit('changeNickname', result.rows, old, socket.nickname);
			}
		});
    });

    //handles idling when user is away or present from the window
    socket.on('idling', function(nickname){
    	io.sockets.in(socket.roomName).emit('idlingHandler', nickname);
    });

    socket.on('idling2', function(nickname){
    	io.sockets.in(socket.roomName).emit('idlingHandler2', nickname);
    });

    // the client emits this when they want to send a message
    socket.on('message', function(nickname, message){
        var roomName = Object.keys(io.sockets.adapter.sids[socket.id])[1];
		var time = new Date();
		//inserts the current variables into proper slots in messages table
		var sql = 'INSERT INTO messages (room, nickname, body, time) VALUES ($1, $2, $3, $4)';
		var args = [];
		args.push(roomName);
		args.push(nickname);
		args.push(message);
		args.push(time);
		//queries with the proper args
		var q = conn.query(sql, args, function(error, result){
			if(error) {
				console.log('there was an error');
			} else {
				//success!!
				console.log('success');
			}
		});
        io.sockets.in(roomName).emit('message', nickname, message, time);
    });

    // the client disconnected/closed their browser window
    socket.on('disconnect', function(){
    	var args = [];
    	args.push(socket.roomName);
    	args.push(socket.nickname);
    	var sql = 'DELETE FROM users WHERE room=$1 AND nickname=$2';
    	var q = conn.query(sql, args, function(error, result){
			if(error){
				console.log('there was an error');
			} else {
				io.sockets.in(socket.roomName).emit('leaveNickname', socket.nickname);
			}
		});
    });

    // an error occured with sockets
    socket.on('error', function(){
       console.log("error occurred!");
       console.log(error);
    });

});

//generate random room id
function generateRoomIdentifier() {
  // make a list of legal characters
  // we're intentionally excluding 0, O, I, and 1 for readability
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  var result = '';
  for (var i = 0; i < 6; i++)
  	result += chars.charAt(Math.floor(Math.random() * chars.length));

  return result;
}


