var mongoose = require('mongoose');
var bcrypt = require('bcrypt');
var userSchema = new mongoose.Schema({
    User_id:{type:Number,require:true},
    Email:{type:String,require:true},
    Password: {type:String,require:true},
    Profile_pic:{type:String},
    userName: String,
    Status: String,
    PassCode: Number,
    friends: [{
        name: String,
        image: String,
        status: String,
        date: String,
        time: String
    }],
    chats: [{
        image: String,
        fromname: String,
        toname: String,
        lastMessage: String,
        time: String,
        date: String,
        dateMic: Number,
        unreadTexts: Number,
        block: Boolean,
        lastMessNumber: Number
    }],
    age: String,
    gender: String,
    orientation: String,
    intention: String,
    country: String,
    city: String,
    calls: [{
        from: String,
        to: String,
        date: String,
        time: String,
        status: String
    }]
});
userSchema.methods.generatHarsh = function (password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(9));
};
userSchema.methods.validPassword =function (password) {
    return bcrypt.compareSync(password,this.Password);
};
module.exports = mongoose.model('users', userSchema);