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
app.set('port', process.env.PORT);
app.use(bodyParser.json());
app.use(bodyParser.raw({type: 'application/jwt'}));
app.use(bodyParser.urlencoded({extended: true}));

app.options("/*", function(req, res, next){
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
    res.send(200);
});

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

app.get('/folders/:SelectorType/:ParentID', async function(req, res){
    var cookies = new Cookies(req, res, { keys: APIKeys.appSignature });
    var token = JSON.parse(cookies.get('sfmc_token'));
    let response = [];

    let fOpts = {
        "ObjectType":"DataFolder",
        "Token":token.accessToken,
        "Endpoint":token.soapEndpoint,
        "Filter":{
            "Property":"ParentFolder.ID",
            "SimpleOperator":"equals",
            "Value":req.params['ParentID']
        }
    };

    let fTask = getFolders(fOpts);

    fTask.then(function(folders) {
        folders.forEach(function (folder) {
            response.push(
                {
                    "Id":folder.ID,
                    "Name":folder.Name,
                    "ContentType":folder.ContentType,
                    "Type":"folder"
                }
            );
        });
    });

    let iOpts = {
        "ObjectType":req.params['SelectorType'],
        "token":token,
        "Filter":{
            "Property":"CategoryID",
            "SimpleOperator":"equals",
            "Value":req.params['ParentID']
        }
    };

    let iTask = getItems(iOpts);

    iTask.then(function(items) {
        items.forEach(function (item) {
            response.push(
                {
                    "Id":item.Id,
                    "Name":item.Name,
                    "ContentType":item.ContentType,
                    "Type":item.Type
                }
            );
        });
        console.log('iTask','Completed');
    });

    let promise = Promise.all([fTask,iTask]);

    promise.then(function(data) {
        return res.status(200).send(response);
    });
});

async function getFolders(options){
    var folders;

    return new Promise(async function(resolve, reject) {
        try {
            folders = await api.retrieve(options);
            folders.sort((a, b) => (a.Name > b.Name) ? 1 : -1);
            resolve(folders);
        } catch (e){
            reject(e);
        }
    });
}

async function getItems(options){
    var items;
    var cookies = new Cookies(req, res, { keys: APIKeys.appSignature });
    var token = JSON.parse(cookies.get('sfmc_token'));

    return new Promise(async function(resolve, reject) {
        if (options.ObjectType == 'dataextension'){
            options.ObjectType = 'DataExtension'
            try {
                items = await api.retrieve(options);
                for (var i=0;i<items.length;i++) {
                    if (items[i].Name.substr(0,1) == '_'){
                        items.splice(i, 1);
                    } else {
                        items[i].Id = items[i].ObjectID,
                        items[i].ContentType = 'DataExtension';
                        items[i].Type = 'item';
                    }
                }
                items.sort((a, b) => (a.Name > b.Name) ? 1 : -1);
                resolve(items);
            } catch (e){
                reject(e);
            }
        } else if (options.SelectorType == 'asset'){
            try {
                options.parameters = {
                    "$page":1,
                    "$pagesize":1000,
                    "$filter":"category.id eq " + options.Filter.Value;
                };
                options.path = 'asset/v1/content/assets';
                items = await api.restRequest(options);
                console.log(items)
                items.sort((a, b) => (a.name > b.name) ? 1 : -1);
                resolve(items);
            } catch (e){
                reject(e);
            }
            resolve([]);
        } else {
            resolve([]);
        }
    });
}

function compareName( a, b ) {
    console.log('a',a);
    console.log('b',b);
  if ( a.Name < b.Name ){
    return -1;
  }
  if ( a.Name > b.Name ){
    return 1;
  }
  return 0;
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
