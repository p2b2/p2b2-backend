'use strict';

var mongoclient = require("mongodb").MongoClient
var mongoDBURL = "mongodb://localhost:27017/p2b2"
var mongoDatabase

var isFunction = function(f){
	return (typeof f === 'function');
}

var MongoDBConnector = function(){};

MongoDBConnector.prototype.connect = function(cb) {
	mongoclient.connect(mongoDBURL, (err, db) => {
		if(err){
			cb(err)
		} else {
			mongoDatabase = db
			console.log("Connected successfully to mongodb.")
			cb(null, true)
		}
	})
}

MongoDBConnector.prototype.getLastBlock = function(callback){
	if(!isFunction(callback)){
		throw new Error("missing callback function parameter")
	} else {
		callback(null, -1);
	}
}

MongoDBConnector.prototype.insert = function(object, callback) {
	if(!isFunction(callback)){
		throw new Error("missing callback function parameter")
	} else {
		var collection = mongoDatabase.collection('blocks');
		collection.insert(object, (err, result) => {
			if(err){
				callback(err)
			} else {
				callback(null, result)
			}
		})
	}
};

module.exports = new MongoDBConnector();