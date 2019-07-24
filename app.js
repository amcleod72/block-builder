'use strict';
var express         = require('express');
var path            = require('path');
var http            = require('http');
var app             = express();
var audit = require('express-requests-logger');

app.use(express.static(path.join(__dirname, 'Public')));
app.set('port', process.env.PORT || 4000);

app.use(audit({
    logger: logger, // Existing bunyan logger
    excludeURLs: [‘health’, ‘metrics’], // Exclude paths which enclude 'health' & 'metrics'
    request: {},
    response: {}
}));

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
