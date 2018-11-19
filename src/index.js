import http from 'http';
import express from 'express';
import bodyParser from 'body-parser';
import passport from 'passport';
import path from 'path'
import logger from 'morgan'
import socket from 'socket.io';
import Message from './model/message';
import Channel from './model/channel';

const LocalStrategy  = require('passport-local').Strategy;

import config from './config';
import routes from './routes';

const apn = require('apn');

console.log("hello")
console.log(__dirname)

let options = {
    token: {
        key: __dirname + "/AuthKey_44FX93V4UB.p8",
        keyId: "44FX93V4UB",
        teamId: "78TPJ6Q7L6"
    },
    production: false
};
let apnProvider = new apn.Provider(options);
let deviceToken = "1cc19290ef02d0238d49e3cf34928050f0870627a1a5a8297c8ffd20e80e217d";
let notification = new apn.Notification();
notification.expiry = Math.floor(Date.now() / 1000) + 24 * 3600; // will expire in 24 hours from now
notification.badge = 2;
notification.sound = "ping.aiff";
notification.alert = "Hello from solarianprogrammer.com";
notification.payload = {'messageFrom': 'Solarian Programmer'};

notification.topic = "com.sultankarybaev.smack";

let app = express();
app.server = http.createServer(app);
let io = socket(app.server);

//middleware
//parse application/json
app.use(logger('dev'))
app.use(express.static(path.join(__dirname)));
app.use(bodyParser.json({limit: config.bodyLimit}));

//passport config
app.use(passport.initialize());

let Account = require('./model/account');
passport.use(new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
},
  Account.authenticate()
));
passport.serializeUser(Account.serializeUser());
passport.deserializeUser(Account.deserializeUser());

//api routes v1
app.use('/v1', routes);

// Base URL test endpoint to see if API is running
app.get('/', (req, res) => {
  res.json({ message: 'Chat API is ALIVE! Sultan Karybaev vseh udelal' })
});

app.get('/sultan', (req, res) => {
    res.send('Hello Almaty')
});

/*||||||||||||||||SOCKET|||||||||||||||||||||||*/
//Listen for connection
var typingUsers = {};

io.on('connection', function(client) {
  console.log('a user connected');
  //Listens for a new chat message
  client.on('newChannel', function(name, description) {
    //Create channel
    let newChannel = new Channel({
    name: name,
    description: description,
  });
    //Save it to database
    newChannel.save(function(err, channel){
      //Send message to those connected in the room
      console.log('new channel created');
      io.emit("channelCreated", channel.name, channel.description, channel.id);
    });
  });

  //Listens for user typing.
  client.on("startType", function(userName, channelId){
    console.log("User " + userName + " is writing a message...");
    typingUsers[userName] = channelId;
    io.emit("userTypingUpdate", typingUsers, channelId);
  });

  client.on("stopType", function(userName){
    console.log("User " + userName + " has stopped writing a message...");
    delete typingUsers[userName];
    io.emit("userTypingUpdate", typingUsers);
  });

  //Listens for a new chat message
  client.on('newMessage', function(messageBody, userId, channelId, userName, userAvatar, userAvatarColor) {
    //Create message

    console.log(messageBody);

    let newMessage = new Message({
    messageBody: messageBody,
    userId: userId,
    channelId: channelId,
    userName: userName,
    userAvatar: userAvatar,
    userAvatarColor: userAvatarColor
  });
    //Save it to database
    newMessage.save(function(err, msg){
      //Send message to those connected in the room
      console.log('new message sent');

      io.emit("messageCreated",  msg.messageBody, msg.userId, msg.channelId, msg.userName, msg.userAvatar, msg.userAvatarColor, msg.id, msg.timeStamp);
        notification.alert = msg.messageBody
        apnProvider.send(notification, deviceToken).then( result => {
            console.log(result);
        });
        apnProvider.shutdown();
    });
  });
});
/*||||||||||||||||||||END SOCKETS||||||||||||||||||*/

app.server.listen(config.port);
console.log(`Started on port ${app.server.address().port}`);

module.exports = {
  app,
  io
}
