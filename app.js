'use strict';
var express         = require('express');
var path            = require('path');
var http            = require('http');
var app             = express();
var expressLogging  = require('express-logging');
var logger          = require('logops');

app.use(express.static(path.join(__dirname, 'Public')));
app.set('port', process.env.PORT || 4000);
app.use(expressLogging(logger));

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
