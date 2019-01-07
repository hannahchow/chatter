
var socket = io.connect();
var mynickname;

//handles idling and moving away
$(window).blur(function(e) {
    socket.emit('idling', mynickname);
});
$(window).focus(function(e) {
    socket.emit('idling2', mynickname);
});

// fired when the page has loaded
$(document).ready(function(){

    //get the unique room name
    var roomName = meta('roomName');

    //begin to act on any sent messages
    var messageForm = $('#messageForm').submit(sendMessage);

    var newnickname;

   //prompt the user for their username
    mynickname = prompt('pick a username!', 'ex: jcarberr');

    //sets certain field as global nickname
    document.getElementById('nicknameField').value = mynickname;

    //begins to act on changed name
    var changeNicknameForm = $('#nicknameForm').submit(changeName);

    // handle incoming messages
    socket.on('message', function(nickname, message, time){
        var ul = $('#messages');
            // for each message, graphically display the username and the message
            if (nickname === mynickname){
                var li = $('<li class="me"></li>');
                li.html('<strong>' + nickname + ":" + '</strong>' + message);
                ul.append(li);
            } else {
                var li = $('<li class="others"></li>');
                li.html('<strong>' + nickname + ":" + '</strong>' + message);
                ul.append(li);
            }
        });

    //handles nicknames when user joins a room
    socket.on('joinNickname', function(nicknames){
        var ul = $('#members');
        ul.empty();
        // graphically displays the usernames
        for(i = 0; i < nicknames.length; i++){
            var li = $('<li></li>');
            li.html(nicknames[i].nickname);
            ul.append(li);
        }
    });

    //handles nicknames when user leaves a room
    socket.on('leaveNickname', function(nickname){
        var listitem = $('#members li');
        listitem.each(function(index, li){
            var user = $(li);
            if (user.html() === nickname) {
                user.remove();
            }
        });
    });

    //handles graphically displaying nicknames when user changes their nickname
    socket.on('changeNickname', function(nicknames, oldnickname, newnickname){
        var ul = $('#members');
        ul.empty();
        for(i = 0; i < nicknames.length; i++){
            var li = $('<li></li>');
            li.html(nicknames[i].nickname);
            ul.append(li);
        }
        var messages = $('#messages');
        var li = $('<li class="alerts"></li>');
        li.html('<i>' + "user " + oldnickname + "'s name has been changed to " + newnickname + '</i>');
        messages.append(li);
        
    });

    //handles idling when user is away
    socket.on('idlingHandler', function(nickname){
        if (nickname !== mynickname) {
            var ul = $('#messages');
            var li = $('<li class="alerts"></li>');
            li.html('<i>' + "user " + nickname + " is away" + '</i>');
            ul.append(li);
        }
    });

    //handles idling when user comes back
    socket.on('idlingHandler2', function(nickname){
        if (nickname !== mynickname) {
            var ul = $('#messages');
            var li = $('<li class="alerts"></li>');
            li.html('<i>' + "user " + nickname + " is back" + '</i>');
            ul.append(li);
        }
    });

    // displays messages previously sent when new user joins the room
    socket.emit('join', meta('roomName'), mynickname, function(messages){
        // process the list of messages the server sent back
        if (messages !== null){
            for(i = 0; i < messages.length; i++){
                var ul = $('#messages');
                if (messages[i].nickname === mynickname){
                    var li = $('<li class="me"></li>');
                    li.html('<strong>' + messages[i].nickname + ":" + '</strong>' + messages[i].body);
                    ul.append(li);
                } else {
                    var li = $('<li class="others"></li>');
                    li.html('<strong>' + messages[i].nickname + ":" + '</strong>' + messages[i].body);
                    ul.append(li);
                }
            }
        }
    });
});


// records the message in the database
function sendMessage(event) {

    // prevent the page from redirecting
    event.preventDefault();

    // get the parameters of current username and message
    var nickname = document.getElementById("nicknameField").value;
    var message = document.getElementById("messageField").value;
   
    //emits message to all users in the room
    socket.emit('message', nickname, message);
}

// records the message in the database
function changeName(event) {
    // prevent the page from redirecting
    event.preventDefault();

    // get the changed nickname
    newnickname = document.getElementById("newnicknameField").value;

    // changes current nickname to the new nickname
    document.getElementById('nicknameField').value = newnickname;
    
    // emits this change to all other users in the room
    socket.emit('nickname', newnickname);

    //graphically handles nickname changes
    var ul = $('#members');
    var newname = $('<li></li>');
    newname.html(newnickname);
    if (newnickname !== mynickname){
        var listitem = $('#members li');
        listitem.each(function(index, li){
            var user = $(li);
            if (user.html() === mynickname) {
                user.remove();
                ul.append(newname);
                mynickname = newnickname;
            }
        });
    }
}

// meta function for room number
function meta(name) {
	var tag = document.querySelector('meta[name=' + name + ']');
	if(tag != null) {
		return tag.content;
	}
	return '';
}

