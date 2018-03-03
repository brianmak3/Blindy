
var mongoose = require('mongoose');

var message = new mongoose.Schema({
    fromname: String,
    toname: String,
    lastMessage: String,
    date: String,
    time: String,
    dateMic: Number,
    status: String,
    deleteFrom: Boolean,
    deleteTo: Boolean,
    index: Number
});
module.exports = mongoose.model('message', message);



