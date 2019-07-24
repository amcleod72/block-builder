'use strict';
var express         = require('express');
var path            = require('path');
var http            = require('http');
var app             = express();
var bodyParser      = require('body-parser');
var Cookies         = require('cookies');
var jwt             = require('jsonwebtoken');
var request         = require('request');
var axios           = require('axios');
var sfmc            = require('sfmc');

var APIKeys ={
    clientId        : process.env.clientId,
    clientSecret    : process.env.clientSecret,
    appId           : process.env.appId,
    appSignature    : process.env.appSignature
};

let api = new sfmc();

app.use(express.static(path.join(__dirname, 'Public')));
app.set('port', process.env.PORT || 4000);
app.use(bodyParser.json());
app.use(bodyParser.raw({type: 'application/jwt'}));
app.use(bodyParser.urlencoded({extended: true}));

app.post('/login', function(req, res){
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
                        var cookies = new Cookies(req, res, { keys: APIKeys.appSignature });

                        response.data.apiEndpointBase = jwtData.request.rest.apiEndpointBase;
                        response.data.authEndpoint = jwtData.request.rest.authEndpoint;
                        response.data.soapEndpoint = response.data.apiEndpointBase.replace('rest','soap');

                        cookies.set('sfmc_token',JSON.stringify(response.data));
                        res.status(200).send('<script>window.parent.onRender();</script>');
                    })
                    .catch(function (error) {
                        console.log(error);
                        res.status(401).send({'message':'Not Authorized'});
                    });
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

app.get('/roots', async function(req, res){
    var cookies = new Cookies(req, res, { keys: APIKeys.appSignature });
    var token = JSON.parse(cookies.get('sfmc_token'));

    console.log('CookieToken',token);
    console.log('SoapEndpoint',token.soapEndpoint);
    console.log('accessToken',token.accessToken);

    let options = {
        "ObjectType":"DataFolder",
        "Token":token.accessToken,
        "Endpoint":token.soapEndpoint,
        "Filter":{
            "Property":"ParentId",
            "SimpleOperator":"equals",
            "Value":"0"
        }
    };

    folders = await api.retrieve(options);

    console.log('Folders',folders);

    return res.status(200).send({'message':'OK'});

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
