'use strict';
var express         = require('express');
var path            = require('path');
var http            = require('http');
var app             = express();
var bodyParser      = require('body-parser');
var cookieParser    = require('cookie-parser');

app.use(express.static(path.join(__dirname, 'Public')));
app.set('port', process.env.PORT || 4000);
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(bodyParser.json());
app.use(bodyParser.raw({type: 'application/jwt'}));
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());

app.use('/login', tokenFromJWT, function(req, res){
    console.log('Login hit');
    return res.status(200).send();
    //res.render('index',{data:req.session.jwt.request.user});
});

// Simple custom middleware
function tokenFromJWT (req,res,next){
    let jwtToken;
    let jwtData;

    console.log('Body',req.body);
    next();
}

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
