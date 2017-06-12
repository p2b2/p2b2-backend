# Data extractor

Extracts data from given database connectors.

Each connector needs at least the following exported methods:

```javascript
function insert(object, callback){
    ...
    //insert object into db
    cb(null, success);
}
```

```javascript
function getLastBlock(){
    //check db for highest block number inserted
    //return blocknumber or -1 if nothing is inserted yet.
}
