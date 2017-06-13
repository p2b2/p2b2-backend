const Web3 = require("web3");
const Promise = require("es6-promise").Promise;
const neo4jConnect = require("./index.js");

neo4jConnect.connect().then(res => {
    neo4jConnect.insert("", (err, res)=> {
        if (err) {
            console.log("insert err");
            console.log(err);
        } else {
            console.log("insert success");
            console.log(res);
        }

        neo4jConnect.disconnect();
    })

}).catch(err => {
    console.log("connection refused");
    console.error(err)
});
