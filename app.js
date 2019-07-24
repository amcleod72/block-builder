'use strict';
var express         = require('express');
var path            = require('path');
var http            = require('http');
var app             = express();
var bodyParser      = require('body-parser');
var cookieParser    = require('cookie-parser');
var jwt             = require('jsonwebtoken');
var request         = require('request');
var axios           = require('axios');

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

app.use('/login', function(req, res){
    console.log('Login hit');
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

                try {
                    axios({
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        url: jwtData.request.rest.authEndpoint,
                        data: {
                            "clientId": APIKeys.clientId,
                            "clientSecret": APIKeys.clientSecret,
                            "refreshToken": jwtData.request.rest.refreshToken,
                            "accessType": 'offline'
                        }
                    })
                    .then(function (response) {
                        console.log('Response',response);
                        res.status(200).send('<script>window.parent.0.tokenCallback("' + response.data.accessToken + '");</script>');
                        //res.status(200).send('<script>console.log("Parent",window.parent);</script>');
                    })
                    .catch(function (error) {
                        console.log(error);
                        res.status(401).send({'message':'Not Authorized'});
                    });;
                } catch (error) {
                    res.status(500).send({'message':'Internal Server Error'});
                    console.log(error);
                }
            }
        });
    } else {
        console.log("No jwt supplied");
        return res.status(401).send();
    }
});

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
