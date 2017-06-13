'use strict';

var Promise = require("es6-promise").Promise
var mongoclient = require("mongodb").MongoClient
var mongoDBURL = "mongodb://localhost:27017/p2b2"
var mongoDatabase

var isFunction = function(f){
	return (typeof f === 'function');
}

var MongoDBConnector = function(){};

MongoDBConnector.prototype.connect = function() {
	return new Promise((resolve, reject) => {
		mongoclient.connect(mongoDBURL, (err, db) => {
			if(err){
				reject(err)
			} else {
				mongoDatabase = db
				console.log("Connected successfully to mongodb.")
				resolve(true)
			}
		})
	})
}

MongoDBConnector.prototype.disconnect = function() {
	mongoDatabase.close()
}

MongoDBConnector.prototype.getLastBlock = function(callback){
	if(!isFunction(callback)){
		throw new Error("missing callback function parameter")
	} else {
		mongoDatabase.collection('blocks').find({}).sort({number: -1}).limit(1).next((err, doc) => {
			console.log(doc)
			if(err){
				callback(null, -1)
			} else {
				callback(null, doc.number)
			}
		})
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