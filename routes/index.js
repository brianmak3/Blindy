const nodemailer = require('nodemailer');
var http = require('http').Server();
var client = require('socket.io').listen(8080).sockets;
var User = require('./models/users');
var multer = require('multer');
var Block = require('./models/blocks');
var fs = require('fs');
var Message = require('./models/messages');
var http = require('http').Server();
var transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: 'blindyapp@gmail.com',
        pass: 'yveskm88'
    },
    tls:{
        rejectUnauthorized:false
    }
});
var storage =   multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, './public/uploads');
    },
    filename: function (req, file, callback) {
        var extArray = file.mimetype.split("/");
        var extension = extArray[1];


        callback(null, file.fieldname + '_'+Date.now()+'.'+extension);
    }

});
var upload = multer({ storage : storage}).single('ionicfile');
module.exports = function (app) {
    client.on('connection',function(socket)
    {

        socket.on('textsReady', function(data){
            User.update({'userName': data.by, chats: {$elemMatch:{fromname: data.from}}},
                {$set: {'chats.$.unreadTexts': 0}}, {"multi": true}, function (err) {
                    if (err)
                        console.log(err);
                });

        });
        socket.on('sentMessage',function (data) {
            User.aggregate([
                { "$match": {$or:[{'userName': data.fromname,'chats.fromname':data.fromname,'chats.toname':data.toname},
                    {'userName': data.fromname,'chats.fromname':data.toname, 'chats.toname':data.fromname}] } },
                {$unwind: "$chats"},
                { "$match": {$or:[{'userName': data.fromname,'chats.fromname':data.fromname,'chats.toname':data.toname},
                    {'userName': data.fromname,'chats.fromname':data.toname, 'chats.toname':data.fromname}] } },
                { "$group": {
                    "_id": "$_id._id",
                    "chats": {
                        "$push":  "$chats"
                    }
                }}
            ]).exec(function(err, found){
                if(err)
                    throw err;
                else{
                    if (found[0]) {
                        lastMessNumber = parseInt(parseInt(found[0].chats[0].lastMessNumber)+ 1);
                        var gettime = getTime();

                        var messages = [{
                            'image':data.friendImage,
                            'fromname': data.fromname,
                            'toname': data.toname,
                            'lastMessage': data.lastMessage,
                            'time': gettime[1],
                            'date': gettime[0],
                            'dateMic': gettime[2],
                            'unreadTexts': 0,
                            'block': false,
                            'lastMessNumber': lastMessNumber
                        }];

                        var messageStor = new Message();
                        messageStor.fromname = data.fromname;
                        messageStor.toname = data.toname;
                        messageStor.date = gettime[0];
                        messageStor.time = gettime[1];
                        messageStor.dateMic = gettime[2];
                        messageStor.deleteFrom = false ;
                        messageStor.deleteTo = false;
                        messageStor.index = lastMessNumber;
                        messageStor.lastMessage = data.lastMessage;
                        messageStor.save(function (err) {
                            if(err)
                                throw err;
                        });
                        User.update({'userName':data.fromname},
                            {$pull:{chats:{'fromname':data.toname}}},
                            function(err){
                                if(err)
                                    throw err;
                                else{
                                    socket.emit('addNewText', {messages: messages});
                                    User.update({'userName':data.fromname},
                                        {$pull:{chats:{'toname':data.toname}}},
                                        function(err){
                                            if(err)
                                                throw err;
                                            else {
                                                User.update({'userName': data.fromname}, {
                                                        $push: {
                                                            chats: messages[0]
                                                        }
                                                    },
                                                    function (err) {
                                                        if (err)
                                                            throw err;
                                                    });
                                            }});
                                }
                            });
                    }


                }
            });

            User.aggregate([
                { "$match": {$or:[{'userName': data.toname,'chats.fromname':data.fromname,'chats.toname':data.toname},
                    {'userName': data.toname,'chats.toname':data.fromname,'chats.toname':data.fromname}] } },
                {$unwind: "$chats"},
                { "$match": {$or:[{'userName': data.toname,'chats.fromname':data.fromname,'chats.toname':data.toname},
                    {'userName': data.toname,'chats.toname':data.fromname,'chats.toname':data.fromname}] } },
                { "$group": {
                    "_id": "$_id._id",
                    "chats": {
                        "$push":  "$chats"
                    }
                }}
            ]).exec(function (err, results) {
                if (err)
                    throw err;
                var unreadTexts;
                if (results[0]) {
                    unreadTexts = parseInt(parseInt(results[0].chats[0].unreadTexts)+ 1);
                    lastMessNumber = parseInt(parseInt(results[0].chats[0].lastMessNumber)+ 1);
                }
                var gettime = getTime();
                var messages2 = [{
                    'image':data.myImage,
                    'fromname': data.fromname,
                    'toname': data.toname,
                    'lastMessage': data.lastMessage,
                    'time': gettime[1],
                    'date': gettime[0],
                    'dateMic': gettime[2],
                    'unreadTexts': unreadTexts,
                    'block': false,
                    'lastMessNumber': lastMessNumber
                }];

                User.update({'userName': data.toname},
                    {$pull: {chats: {'fromname': data.fromname}}},
                    function (err) {
                        if (err)
                            throw err;
                        else {
                            User.update({'userName': data.toname},
                                {$pull: {chats: {'toname': data.fromname}}},
                                function (err) {
                                    if (err)
                                        throw err;
                                    else {
                                        User.update({'userName': data.toname}, {
                                                $push: {
                                                    chats: messages2[0],
                                                }
                                            },
                                            function (err) {
                                                if (err)
                                                    throw err;
                                                else {
                                                    socket.broadcast.emit('addNewText', {messages: messages2});
                                                }
                                            });
                                    }
                                });
                        }
                    });

            });


        });
        socket.on('fetchChats',function(data){
            User.aggregate([
                { "$match": {'userName': data.username}}]).sort({"_id": -1 }).exec(function (err, user) {
                if(err)
                    throw err;
                socket.emit('fetchedUsers', {chats: user[0].chats});
            });
        });
        socket.on('updateFriend',function(data){
            User.update({'userName': data.username, 'friends.name': data.friendName},
                { $set: { "friends.$.status" : 'friend' } },
                function(err){
                    if(err)
                        throw err;
                    else{
                        socket.emit('friendUpdated', {info: data});
                    }
                });
            User.update({'userName': data.friendName, 'friends.name': data.username},
                { $set: { "friends.$.status" : 'friend' } },
                function(err){
                    if(err)
                        throw err;
                    else{
                        socket.broadcast.emit('friendUpdated', {info: data});
                    }
                });


        });
        socket.on('NewMessage', function (data) {
            var gettime = getTime();
            var messageStor = new Message();
            messageStor.fromname = data.myInfo.user_username,
                messageStor.toname =data.friendInfo.userName,
                messageStor.date = gettime[0];
            messageStor.time = gettime[1];
            messageStor.lastMessage = data.message,
                messageStor.dateMic = gettime[2];
            messageStor.deleteFrom = false ;
            messageStor.deleteTo = false;
            messageStor.index = 0;
            messageStor.save(function (err) {
                if(err)
                    throw err;
            });


            var info = {
                image:data.friendInfo.Profile_pic,
                toname: data.friendInfo.userName,
                fromname: data.myInfo.user_username,
                lastMessage: data.message,
                time: gettime[1],
                date: gettime[0],
                unreadTexts: 0,
                lastMessNumber: 0

            };

            var data1 = {
                'image':data.friendInfo.Profile_pic,
                'toname':  data.friendInfo.userName,
                'fromname': data.myInfo.user_username,
                'lastMessage': data.message,
                'time': gettime[1],
                'date': gettime[0],
                'dateMic': gettime[2],
                'unreadTexts': 0,
                'block': false,
                'lastMessNumber': 0
            };
            User.update({'userName':info.fromname}, {$push: {chats:data1}},function(err){
                if(err)
                    throw err;
                socket.emit('addChat',info);

            });
            var info2 = {
                image:data.myInfo.user_profileImage,
                fromname: data.myInfo.user_username,
                toname: data.friendInfo.userName,
                lastMessage: data.message,
                time: gettime[1],
                date: gettime[0],
                unreadTexts: 1,
                lastMessNumber: 0
            };

            var data2={
                'image':data.myInfo.user_profileImage,
                'fromname': data.myInfo.user_username,
                'toname': data.friendInfo.userName,
                'lastMessage': data.message,
                'time': gettime[1],
                'date': gettime[0],
                'dateMic': gettime[2],
                'unreadTexts': 1,
                'block': false,
                'lastMessNumber': 0

            };
            User.update({'userName':info2.toname}, {$push: {chats:data2}},function(err){
                if(err)
                    throw err;
                socket.broadcast.emit('addChat',info2);
            });




        });
        //messages issue
        socket.on('fetchTexts2',function(data){
            Message.find({
                $or: [{'fromname': data.from, 'toname': data.friend, index: { $lt: data.lastMessNumber }},
                    {'toname': data.from, 'fromname': data.friend, index: { $lt: data.lastMessNumber } }]
            }, function (err, messages) {
                if (err)
                    throw err;

                socket.emit('foundMessages2', {
                    messages: messages,
                    messages2: true
                });
            }).sort({ $natural: -1 }).limit(20);
        });
        socket.on("fetchUserInfo",function (data) {
            User.findOne({'userName': data.username}, function (err, user) {
                if (err) {
                    throw err;
                }else{
                    socket.emit("userInfoFound", {infor: user});
                }
            })
        });
        socket.on('fetchTexts',function (data) {
            User.aggregate([
                { "$match": {'userName':data.from,'friends.name':data.friend}},
                {$unwind: "$friends"},
                { "$match": {'userName':data.from,'friends.name':data.friend}},
            ]).exec(function (err, FriendState) {
                if(err)
                    throw err;
                else{
                    Block.findOne({$or: [{'blockby':data.from,'blockto':data.friend},{'blockto':data.from,'blockby':data.friend}]},function(err, friendShip){
                        if(err)
                            throw err;
                        else
                            var friendStatus;
                        if(FriendState[0]){
                            friendStatus = FriendState[0].friends.status;
                        }else{
                            friendStatus = 'Not friend';
                        }
                        if(parseInt(data.lastMessNumber) == 0)
                        {
                            Message.find({
                                $or: [{'fromname': data.from, 'toname': data.friend},
                                    {'toname': data.from, 'fromname': data.friend}]
                            }, function (err, messages) {
                                if (err)
                                    throw err;
                                socket.emit('foundMessages', {
                                    messages: messages,
                                    friendStatus: friendStatus,
                                    friendShip: friendShip
                                });
                            });
                        }else if(parseInt(data.lastMessNumber) > 0) {
                            Message.find({
                                $or: [{'fromname': data.from, 'toname': data.friend, index: { $lte: data.lastMessNumber }},
                                    {'toname': data.from, 'fromname': data.friend, index: { $lte: data.lastMessNumber } }]
                            }, function (err, messages) {
                                if (err)
                                    throw err;
                                messages = messages.reverse();
                                socket.emit('foundMessages', {
                                    messages: messages,
                                    friendStatus: friendStatus,
                                    friendShip: friendShip
                                });
                            }).sort({ $natural: -1 }).limit(20);

                        }

                    });

                }
            });

        });

        //reported message
        socket.on('sendRport',function (data) {
            console.log(data);

        });
        socket.on('callResponse', function(data){
            console.log(data);
            socket.broadcast.emit('callAccepted',data);
        });
        socket.on('callsignal',function (data) {
            console.log(data);
            socket.broadcast.emit('newCallRequest',{data: data})
        });
        socket.on('fetchFriends',function (data) {
            User.aggregate([
                { "$match": {"userName": data.username}},
                {$unwind: "$friends"},
                { "$match": {"userName": data.username}},
                { "$group": {
                    "_id": "$_id._id",
                    "friends": {
                        "$push":  "$friends"
                    }
                }}
            ]).exec(function (err, results) {
                if(err)
                    throw err;
                else{
                    if(results[0]) {

                        socket.emit('foundFriends', {friends: results[0].friends});
                    }
                }

            });
        });
        socket.on('endCall', function(data){
            socket.emit('callEnd', {data: data});
            socket.broadcast.emit('callEnd', {data: data});
        });
        socket.on('frendManipulation',function(data) {
            var module = data.module;

            switch (module) {
                case 'Add friend' || 'Accept':
                    var gettime = getTime();
                    User.findOne({'userName': data.requestFrom}, function (err, results) {
                        if (err)
                            throw err;
                        else {
                            data.date = gettime[0];
                            data.time = gettime[1];
                            socket.emit('NewFriend', {Info: data, action: 'add'});
                            User.update({'userName': data.requestFrom}, {
                                $push: {
                                    friends: {
                                        'name': data.requestTo,
                                        image: data.image,
                                        status: "Waiting Acceptance",
                                        date: gettime[0],
                                        time: gettime[1]
                                    }
                                }
                            }, function (err) {
                                if (err)
                                    throw err;
                            });
                            data.image = results.Profile_pic;
                            socket.broadcast.emit('NewFriend', {Info: data, action: 'add'});
                            User.update({'userName': data.requestTo}, {
                                $push: {
                                    friends: {
                                        'name': data.requestFrom,
                                        image: data.image,
                                        status: "Accept",
                                        date: gettime[0],
                                        time: gettime[1]
                                    }
                                }
                            }, function (err) {
                                if (err)
                                    throw err;

                            });
                        }

                    });
                    break;
                case  'Unfriend':

                    removeFriend(data, socket);
                    break;
                case  'Remove request':

                    removeFriend(data, socket);
                    break;
                case 'Block':
                    updateBlock(data, socket);
                    break;
                case 'Unblock':
                    updateBlock(data, socket);
                    break;

            }
        });
        socket.on('profileImage', function(data){
            var imageName = data.image.split('uploads/');
            var image = 'uploads/'+imageName[1];
            User.update({  friends: { $elemMatch: { name: data.username } }},
                {$set: { "friends.$.image" : image }},
                { multi: true },
                function(err){
                    if(err)
                        throw err;
                })
            User.update({ 'userName': {$ne: data.username},
                    chats: { $elemMatch:  {$or:[{toname: data.username },{fromname: data.username }]} }},
                {$set: { "chats.$.image" : image }},
                { multi: true },
                function(err){
                    if(err)
                        throw err;
                })
            socket.broadcast.emit('updateProfileOfFriend',{info: [image, data.username]});
        });


    });
    function updateBlock(data, socket){

        if(data.module == 'Block'){
            var blocking = new Block() ;
            blocking.blockby = data.requestFrom;
            blocking.blockto = data.requestTo;
            blocking.save(function(err){
                if(err)
                    throw err;
            })
        }else if(data.module == 'Unblock'){
            Block.remove({'blockby': data.requestFrom, 'blockto': data.requestTo},function (err) {
                if(err)
                    throw err;
            });
        }
        socket.broadcast.emit('BlockFriend', {Info: data});
        socket.emit('BlockFriend', {Info: data});
    }
    function removeFriend(data, socket){
        User.update({'userName': data.requestFrom},
            {$pull:{friends:{'name':data.requestTo}}},function (err) {
                if(err)
                    throw err;
            });
        User.update({'userName': data.requestTo},
            {$pull:{friends:{'name':data.requestFrom}}},function (err) {
                if(err)
                    throw err;
            });
        socket.broadcast.emit('NewFriend', {Info: data, action: 'remove'});
        socket.emit('NewFriend', {Info: data, action: 'remove'});
        app.post('/imageUpload',function(req, res){
            console.log('okay');
        })
    }
    app.get('/', function(req, res){
        res.render('index',{
            title: 'Blindy Application page not found'
        })
    });
    app.post('/app_API', function (req, res) {
        if(module == 'login') {
            User.findOne({'Email': req.body.email.trim()}, function (err, user) {
                if (err) {
                    throw err;
                }else if (!user) {
                    res.json(["The email you entered is not registered."]);
                } else if (user) {
                    if (!user.validPassword(req.body.pass)) {
                        res.json(["Invalid password entry."]);
                    }else {
                        if(user.Status !== 'Active'){
                            res.json(["verifyEmail"]);
                        }else {
                            res.json(["SuccessLogin",user]);
                        }
                    }
                }
            });
        }else if( module == 'signup'){
            var email = req.body.email;
            console.log(email);
            var password = req.body.password;
            User.findOne({'Email': email}, function (err, user) {
                if (err)
                    throw err;
                else if (user) {
                    console.log('user');
                    res.json("Sorry, the email is already registered.");
                } else if (!user) {
                    User.findOne({'userName':req.body.username},function (err, results) {
                        if (err)
                            throw err;
                        if(results){
                            console.log('no usre');
                            res.json("Sorry, the username is already registered.");
                        }else {
                            console.log('user found');

                            User.find({}).exec(function (err, results2) {
                                if(err)
                                    throw err;
                                else {
                                    var user_id = results2.length + 1;
                                    var newUser = new User();
                                    var random_number = Math.floor((Math.random()) * (999999 - 100000)) + 100000;
                                    newUser.Email = email;
                                    newUser.User_id = user_id;
                                    newUser.Status = random_number;
                                    newUser.Password = newUser.generatHarsh(password);
                                    newUser.Profile_pic = 'images/bigAvatar.jpg';
                                    newUser.userName = req.body.username;
                                    newUser.save(function (err) {
                                        if (err)
                                            throw err;
                                        else {
                                            res.json("EmailConfirmation");
                                            var email_to = newUser.Email;
                                            var mailOptions = {
                                                from: 'Blindy dating platform',
                                                to: email_to,
                                                subject: 'Success registration to Blindy dating platform ✔',
                                                html:'You have successfully registered to our platform. <br/>Please enter this verification code in order to continue.<br/><strong>' + newUser.Status + '</strong>'
                                            };
                                            transporter.sendMail(mailOptions, function (error) {
                                                if (error) {
                                                    console.log(error);
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });


                }
            })
        }else if( module === 'resendEmailCode') {
            var random_number = Math.floor((Math.random()) * (999999 - 100000)) + 100000;
            var email = req.body.email;
            User.update({'Email': email}, {$set: {'Status': random_number}}, function (err) {
                if (err)
                    throw err;
                else {
                    res.json("VerifiactionSent");
                    var mailOptions = {
                        from: 'Blindy dating platform',
                        to: email,
                        subject: 'You new verification code has been sent.✔',
                        html: 'You requested for a new verification code.. <br/>Please enter this verification code in order to continue.<br/><strong>' + random_number + '</strong>'
                    };
                    transporter.sendMail(mailOptions, function (error) {
                        if (error) {
                            console.log(error);
                        }

                    });
                }
            })
        } else if (module === 'checkVerification') {
            User.findOne({'Email': req.body.email, 'Status': req.body.code}, function (err, user) {
                if (err)
                    throw err;
                else if (user) {
                    User.update({'Email': req.body.email}, {$set: {Status: 'Active'}}, function (err) {
                        if (err)
                            throw err;
                        else {
                            res.json(["SuccessVerification", user]);
                        }
                    })
                } else if (!user) {
                    res.json(["Invalid verification code."]);
                }
            })
        }else if(module === 'checkEmailAvailable'){
            User.findOne({'Email': req.body.email},function (err, result) {
                if(err)
                    throw err;
                else{
                    if(result){
                        res.json("EmailFound");
                        var random_number = Math.floor((Math.random()) * (999999 - 100000)) + 100000;
                        User.update({'Email': req.body.email},{$set: {'PassCode':random_number}},function(err){
                            if(err)
                                throw err;
                            else{
                                var mailOptions = {
                                    from: 'Blindy dating platform',
                                    to: req.body.email,
                                    subject: 'Account password reset.✔',
                                    html: 'You requested for a change in your password<br/>Please enter this verification code in order to reset your password.<br/><strong>' + random_number + '</strong>'
                                };
                                transporter.sendMail(mailOptions, function (error) {
                                    if (error) {
                                        console.log(error);
                                    }

                                });
                            }
                        });

                    }else{
                        res.json("The email you entered is not registered.");
                    }
                }
            })
        }else if(module === 'ChecKVErCode')
        {
            User.findOne({'Email':req.body.userEmail, 'PassCode': req.body.code},function (err, user) {
                if(err)
                    throw err;
                if(!user){
                    res.json('Invalid code submitted');
                }else{
                    res.json('EmailFound with Verification');
                }
            });
        }else if(module === 'updatePassword'){
            var newUser = new User();
            newUser.Password = newUser.generatHarsh(req.body.password);
            User.update({'Email':req.body.userEmail},{$set: {Password:  newUser.Password}},function (err) {
                if(err)
                    throw err;
                else{
                    User.findOne({'Email': req.body.userEmail},function (err, user) {
                        if(err)
                            throw err;
                        else{
                            res.json(user);
                        }
                    })
                }
            })
        }else if(module === 'updateProfile'){
            var info = req.body;
            if(info.age !== undefined  ) {
                User.update({'userName': info.userName}, {$set: {'age': info.age}}, function (err) {
                    if (err) {
                        throw err;
                    }
                })
            }
            if(info.gender !== undefined  ) {
                User.update({'userName': info.userName}, {$set: {'gender': info.gender}}, function (err) {
                    if (err) {
                        throw err;
                    }
                })
            }

            if(info.orientation !== undefined ) {
                User.update({'userName': info.userName}, {$set: {'orientation': info.orientation}}, function (err) {
                    if (err) {
                        throw err;
                    }
                })
            }

            if(info.intension !== undefined ) {
                User.update({'userName': info.userName}, {$set: {'intention': info.intension}}, function (err) {
                    if (err) {
                        throw err;
                    }
                })
            }

            if(info.country !== undefined ) {
                User.update({'userName': info.userName}, {$set: {'country': info.country}}, function (err) {
                    if (err) {
                        throw err;
                    }
                })
            }
            if(info.city !== 'null' ) {
                User.update({'userName': info.userName}, {$set: {'city': info.city}}, function (err) {
                    if (err) {
                        throw err;
                    }
                })
            }
            res.json("Information has been updated");



        }else if(module ==='fetchAny'){
            var friends = [];
            User.findOne({'userName': req.body.username}, function (err, user) {
                if (err) {
                    throw err;
                }
                if(user.chats) {
                    for (i = 0; i < user.chats.length; i++) {
                        if (user.chats[i].fromname != req.body.username) {
                            friends.push(user.chats[i].fromname);
                        } else if (user.chats[i].toname != req.body.username) {
                            friends.push(user.chats[i].toname);
                        }
                    }

                    User.aggregate([{
                        $match: {
                            'userName': {$ne: req.body.username, $nin: friends},
                            'gender': {$ne: user.gender}
                        }
                    }, {$sample: {size: 1}}]).exec(function (err, results) {
                        if(err)
                            throw err;
                        if (results.length>0) {
                            res.json(results[0]);
                        } else {
                            res.json("There is no match for the search");
                        }
                    })
                }else{
                    User.aggregate([{
                        $match: {
                            'userName': {$ne: req.body.username},
                            'gender': {$ne: user.gender}
                        }
                    }, {$sample: {size: 1}}]).exec(function (err, results) {
                        if(err)
                            throw err;
                        if (results.length>0) {
                            res.json(results[0]);
                        } else {
                            res.json("There is no match for the search");
                        }
                    })

                }
            })
        }else if(module == 'fetchSpecific'){
            var friends = [];
            var info = req.body;
            var userName = info.username;
            var country = info.country;
            var city = info.city;
            var age = info.age;
            var intention = info.intention;
            User.findOne({'userName':userName}, function (err, user) {
                if (err) {
                    throw err;
                }
                if(country == undefined){
                    country = user.country;
                }
                if(city == undefined){
                    city = user.city;
                }
                if(age == undefined){
                    age = user.age;
                }
                if(intention == undefined){
                    intention = user.intention;
                }
                if(user.chats) {
                    for (i = 0; i < user.chats.length; i++) {
                        if (user.chats[i].fromname != req.body.username) {
                            friends.push(user.chats[i].fromname);
                        } else if (user.chats[i].toname != req.body.username) {
                            friends.push(user.chats[i].toname);
                        }
                    }

                    User.aggregate([{

                        $match: {
                            'userName': {$ne: userName, $nin: friends},
                            'age': age,
                            'intention': intention,
                            'city': city,
                            'country': country
                        }
                    }, {$sample: {size: 1}}]).exec(function (err, results) {
                        if(err)
                            throw err;

                        if (results.length>0) {
                            res.json(results[0]);
                        } else {
                            res.json("There is no match for the search");
                        }
                    })
                }else{
                    User.aggregate([{
                        $match: {
                            'userName': {$ne: userName},
                            'age': age,
                            'intention': intention,
                            'city': city,
                            'country': country
                        }
                    }, {$sample: {size: 1}}]).exec(function (err, results) {
                        if(err)
                            throw err;
                        if (results.length>0) {
                            res.json(results[0]);
                        } else {
                            res.json("There is no match for the search");
                        }
                    })

                }
            });

        }
    });
    app.post('/imageUpload',function(req, res){
        upload(req,res,function(err) {
            if (err)
                console.log(err);
            else
                var profile_pic_url = 'uploads/'+req.file.filename;
            var userName = req.body.username.trim();
            console.log(userName);
            res.status(201).json(profile_pic_url);
            User.findOne({'userName': userName},function(err, user){
                if(err)
                    throw err;
                else{

                    var imageurl = user.Profile_pic;
                    var imagefolder = imageurl.split('/');

                    if(imagefolder[0]=='uploads'){
                        fs.unlink('public/'+imageurl, function(){
                        });
                    }
                }
            });
            User.update({'userName': userName}, {$set: {'Profile_pic': profile_pic_url}},function(err) {
                if (err)
                    throw err;
            });
            User.update({chats:{$elemMatch: {$or: [{fromname: userName},{toname: userName}]}}}, {$set: {'image': profile_pic_url}},
                function(err){
                    if(err)
                        throw err;
                });
            User.update({friends:{$elemMatch: {'name': userName}}}, {$set: {'image': profile_pic_url}},
                function(err){
                    if(err)
                        throw err;
                });

        })
    })

};


function getTime(){
    var today = new Date();
    var now = Date.now();
    var  date = today.getDate()+'/'+parseInt(today.getMonth()+1)+'/'+ today.getFullYear();
    var hours = today.getHours();
    var minutes = today.getMinutes();
    if(hours < 10){
        hours = '0'+hours;
    }else{
        hours = hours;
    }
    if(minutes < 10){
        minutes = '0'+minutes;
    }else{
        minutes = minutes;
    }
    var time = hours + ':'+minutes;
    data = [date, time, now];
    return data;
}