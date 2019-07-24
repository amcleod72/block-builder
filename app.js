'use strict';
var express         = require('express');
var path            = require('path');
var http            = require('http');
var app             = express();

app.use(express.static(path.join(__dirname, 'Public')));
app.set('port', process.env.PORT || 4000);
app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.use('/login', tokenFromJWT, function(req, res){
    console.log('Login hit');
    //res.render('index',{data:req.session.jwt.request.user});
});

// Simple custom middleware
function tokenFromJWT (req,res,next){
    let jwtToken;
    let jwtData;

    console.log('Body',req);
}

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
