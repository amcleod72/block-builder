'use strict';
var express         = require('express');
var path            = require('path');
var http            = require('http');
var app             = express();
var bodyParser      = require('body-parser');
var cookieParser    = require('cookie-parser');
var jwt             = require('jsonwebtoken');
var request         = require('request');

var APIKeys ={
    clientId        : process.env.clientId,
    clientSecret    : process.env.clientSecret,
    appId           : process.env.appId,
    appSignature    : process.env.appSignature
};

app.use(express.static(path.join(__dirname, 'Public')));
app.set('port', process.env.PORT || 4000);
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
    console.log('Body',req.body);

    let jwtToken;
    let jwtData;

    if (req.body.jwt){
        jwtToken = req.body.jwt;

        require('jsonwebtoken').verify(jwtToken, APIKeys.appSignature, {algorithm: 'HS256'}, (err, jwtData) => {
            if (err){
                console.log("JWT Error: " + JSON.stringify(err));
                return res.status(401).send();
            } else {
                console.log('jwtData',jwtData);

                let fetchData = async() => {
                    let accessToken = await getToken(jwdData.request.rest.authEndpoint, APIKeys.clientId,APIKeys.clientSecret,jwtData.request.rest.refreshToken,'offline');

                    if (accessToken){
                        return res.status(200).send({'accessToken':accessToken});
                        next();
                    } else {
                        return res.status(401).send();
                    }
                }
                fetchData();
            }
        });
    } else {
        console.log("No jwt supplied");
        return res.status(401).send();
    }

    next();
}

function getToken(endpoint,clientId,clientSecret,refreshToken,accessType){
    // Return new promise
    return new Promise(function(resolve, reject) {
        var payload =   {
            "clientId": clientId,
            "clientSecret": clientSecret,
            "refreshToken": refreshToken,
            "accessType": accessType
        };
        console.log('payload',payload);

        var restoptions = {
            "url":        endpoint,
            "method":     "POST",
            "headers":    {
                "content-type":"application/json"
            },
            "body": JSON.stringify(payload)
        };

    	// Do async job
        request.post(restoptions, function(err, response, body) {
            if (err) {
                console.log(JSON.stringify(err));
                reject(err);
            } else {
                //console.log("Access Token",body);
                var resp = JSON.parse(body);
                if (resp.accessToken){
                    resolve(resp);
                } else {
                    reject(new Error('Failed to get access token from SFMC'));
                }
            }
        })
    });
}

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
