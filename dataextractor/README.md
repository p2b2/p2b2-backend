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
function getNextBlockNumber(){
    //check db for highest block number inserted
    //return blocknumber + 1 or 0 if nothing is inserted.
}