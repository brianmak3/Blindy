var mongoose = require('mongoose');

var blockSchema = new mongoose.Schema({
    blockby: String,
    blockto: String
});
module.exports = mongoose.model('blocks', blockSchema);