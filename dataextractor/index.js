const Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
for (var i = 48000; i < 49000; i++) {
    web3.eth.getBlock(i, true, (error, result) => {
        if(error){
            console.error(error)
        } else {
            console.log(result)
        }
    })
}