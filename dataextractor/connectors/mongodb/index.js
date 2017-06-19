'use strict';

let Promise = require("es6-promise").Promise
let mongoclient = require("mongodb").MongoClient
let winston = require("winston")
let mongoDBURL = "mongodb://localhost:27017/p2b2"
let mongoDatabase
let currentBatch = []
let batchSize = 1000;

let isFunction = function(f){
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
				winston.log("info", "Connected successfully to mongodb.")
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
			winston.log('debug', doc)
			if(err){
				callback(null, -1)
			} else {
				callback(null, doc.number)
			}
		})
	}
}

MongoDBConnector.prototype.getCollection = function(name){
	return mongoDatabase.collection(name)
}

MongoDBConnector.prototype.insertBatch = function(batch, callback) {
	if(!isFunction(callback)){
		throw new Error("missing callback function parameter");
	} else {
		let collection = mongoDatabase.collection('blocks');
		collection.insertMany(batch, (err, result) => {
			if(err){
				callback(err)
			} else {
				winston.log('info', 'inserted batch of size', batch.length, '| last block:', batch[batch.length-1].number)
				callback(null, result)
			}
		})
	}
}

MongoDBConnector.prototype.insert = function(object, callback) {
	if(!isFunction(callback)){
		throw new Error("missing callback function parameter")
	} else {
		currentBatch.push(object);
		if(currentBatch.length >= batchSize){
			this.insertBatch(currentBatch, callback)
			currentBatch = []
		} else {
			callback(null, true)
		}
	}
};

MongoDBConnector.prototype.mapReduce = function(map, reduce, options){
	if(!isFunction(map) || !isFunction(reduce)){
		throw new Error("map and reduce must be functons!")
	} else {
		return mongoDatabase.collection('blocks').mapReduce(map, reduce, options)
	}
}

module.exports = new MongoDBConnector();