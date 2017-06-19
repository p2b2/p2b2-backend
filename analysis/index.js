const mongoConnector = require("../dataextractor/connectors/mongodb/index.js")
const winston = require("winston")
const Web3 = require("web3")
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"))
let Promise = require("es6-promise").Promise

var mapFromAddressesToGas = function(){
    for (var i = 0; i < this.transactions.length; i++) {
        emit(this.transactions[i].from, this.transactions[i].gas);
    }
}

var mapFromAddressToValue = function(){
    for (var i = 0; i < this.transactions.length; i++) {
        if(this.transactions[i].value > 0){
            emit(this.transactions[i].from, this.transactions[i].value);
        }
    }
}

var reduceToValueSum = function(key, values){
    return Array.sum(values);
}

var valueFromWeiToEther = function(arr, callback){
    for (var i = 0; i < arr.length; i++) {
        arr[i].value = web3.fromWei(arr[i].value, 'ether') + ' ether';
    }
    callback(null, arr)
}

var getEntries = function(options, callback){
    let collection = mongoConnector.getCollection(options.collection)
    let result = collection.find()
    if(options.sortObject){
        result = result.sort(options.sortObject)
    }
    if(options.limit){
        result = result.limit(options.limit)
    }
    result.toArray(callback)
}

let jobFromAddressToGasSum = {
    map: mapFromAddressesToGas,
    reduce: reduceToValueSum,
    options: {
        out: {
            replace: 'addressToGasSum'
        },
        limit: 100000
    },
    resultHandler: getEntries,
    resultHandlerOptions: {
        collection: 'addressToGasSum',
        sortObject: {
            value: -1
        },
        limit: 3
    }
}

let jobFromAddressToValueSum = {
    map: mapFromAddressToValue,
    reduce: reduceToValueSum,
    options: {
        out: {
            replace: 'addressToValueSum'
        },
        limit: 100000
    },
    resultHandler: getEntries,
    resultHandlerOptions: {
        collection: 'addressToValueSum',
        sortObject: {
            value: -1
        },
        limit: 3
    },
    postProcessor: valueFromWeiToEther
}

let jobs = [
    jobFromAddressToGasSum,
    jobFromAddressToValueSum
];

let runAnalysis = function(cb) {
    mongoConnector.connect().then(res => {
        for (var i = 0; i < jobs.length; i++) {
            let job = jobs[i]
            mongoConnector.mapReduce(job.map, job.reduce, job.options)
            .then(job.resultHandler(job.resultHandlerOptions, (error, result) => {
                if(job.postProcessor){
                    job.postProcessor(result, cb)
                } else {
                    cb(error, result)
                }
            }))
            .catch(cb)
        }
    }).catch(error => {
        cb(error)
    })
}

runAnalysis((err, res) => {
    if(err){
        winston.log('error', err)
    } else {
        winston.log('info', 'Got result(', res.length, ')', res)
    }
})