//引入库
var static = require('node-static');
var http = require('http');
var file = new(static.Server)();
var app = http.createServer(function (req, res) {//req是请求对象，res是响应对象
  file.serve(req, res);
}).listen(3000);
//建立
console.log('Listening on ' + app.address().port);
var io = require('socket.io').listen(app);// 创建一个http服务，引入socket.io库


//设置用户类，其中包括用户名、是否已准备、用户分数
class User{
  constructor(name){
    this.name = name;
    this.isready = false;
    this.score = 0;
    this.time = 0;
    //this.index = 0;
  }
}
//设置房间类，包括房间号、房间内成员
class Room{
  constructor(number){
    this.number = number;
    this.users = [];
    this.ranking = [];
    this.howmanyUsers = 0;
    this.isallReady = false;
    this.isPlaying = false;
    this.Biground = 0;
    this.Smallround = 0;
    this.timer;
    this.maxtime = 120;
    this.remainQuestions = [];
    this.questionNow = '********';
  }
  add(user){this.users.push(user);}//加入一个新用户
  remove(user){this.users.splice(this.users.indexOf(user), 1)}//移除一个用户
}

const questions = ['落井下石','画饼充饥','虎头蛇尾','泪流满面','捧腹大笑','画蛇添足','一手遮天','羊入虎口','掩耳盗铃'];//用来存储问题
const rooms = {};
const users = {};
const sockets = {};

//---------------------------以下是事件--------------------------

io.sockets.on('connection', function (socket){
    //处理创建用户
    socket.on('Create User', function(name){
      let user = new User(name);
      users[name] = user;
      sockets[name] = socket;//创建socket列表，方便建立连接时查找id
    });

  

    // 处理创建或加入房间
    socket.on('Create or Join Room', function (data) {//data: {roomNumber: room, userName: user}
      var usersInRoom = io.nsps['/'].adapter.rooms[data.roomNumber];
      var usersNumber = usersInRoom === undefined ? 0 : Object.keys(usersInRoom.sockets).length;//如果之前一个人都没有，那人数就是0，如果有人，有几个就是几个人
      console.log('Room ' + data.roomNumber + ' has ' + usersNumber + ' client(s)');
      console.log('Request to create or join room', data.roomNumber);

      // First client joining...
      if (usersNumber == 0){                 
        socket.join(data.roomNumber, () => {
        let room = new Room(data.roomNumber);
        rooms[data.roomNumber] = room;
        rooms[data.roomNumber].add(data.userName);
        rooms[data.roomNumber].howmanyUsers = rooms[data.roomNumber].users.length;//记房间内用户总数
        console.log('room : '+ data.roomNumber + ' has been created');
        //users[userName].index = 1;
        }); //根据输入的房间号创建房间，同时调用回调函数，将房间加入房间列表数组
        socket.emit('created', data.roomNumber);
      } 
      else if (usersNumber != 0 && usersNumber <= 5 && rooms[data.roomNumber].isPlaying == false) {               	
        socket.join(data.roomNumber);
        rooms[data.roomNumber].add(data.userName);
        rooms[data.roomNumber].howmanyUsers = rooms[data.roomNumber].users.length;//记房间内用户总数
        console.log('room now has: '+ rooms[data.roomNumber].users.length + ' members, the members are: ' + rooms[data.roomNumber].users); 
        //for(let i = 0; i<rooms[data.roomNumber].howmanyUsers; i++){
        //  console.log('按序输出：' + rooms[data.roomNumber].users[i]);
        //}
        rooms[data.roomNumber].isallReady = false;
        //users[userName].index = rooms[data.roomNumber].users.length;//记用户加入次序
        socket.emit('joined',{roomUsers: rooms[data.roomNumber].users, newUser: data.userName});//发给要进来的用户告诉他其实房内已经有人了，你是后进来的，执行offer
        socket.broadcast.to(data.roomNumber).emit('join',{roomUsers: rooms[data.roomNumber].users, newUser: data.userName});//发给房内的用户告诉他有人进来了,执行answer
      } 
      else { //如果满员了，触发满员事件
        socket.emit('full');
      }
    });
    
    //处理离开房间
    socket.on('Leave Room', function(data){
      console.log(data.userName + 'is requesting to leave room');
      io.sockets.in(data.roomNumber).emit('Leaved', {user: data.userName, initiator: data.initiator});//发送已离开
      socket.leave(data.roomNumber);
      rooms[data.roomNumber].remove(data.userName);
      console.log('Now the room remains ' + rooms[data.roomNumber].users);
      if(rooms[data.roomNumber].users.length == 0){
        delete rooms[data.roomNumber];
      }//如果用户离开后，房间内一个人也没有了，则把房间删除
      
    });

    socket.on('Assemble', function(data){
      io.sockets.in(data.room).emit('Assemble Video', data);
    });

    //获取用户视频权限，被废了，没用
    socket.on('Asking For Videos', function(data){
      console.log(data.user + 'is asking for videos');
      io.sockets.in(data.room).emit('Add Video', data);
    });


    //socket.io实现的公屏聊天，已经被废了，没用
    socket.on('Broadcast Chat Message', function(data){
      console.log('Received message ' + data.chatMessage + ' from ' + data.userName);
      if(data.chatMessage == rooms[data.roomNumber].questionNow){
        Catchtime(data.roomNumber, data.userName);
        io.sockets.in(data.roomNumber).emit('Correct', {userName: data.userName, chatMessage: 'correct'});
      }
      else{
        io.sockets.in(data.roomNumber).emit('Receive Message', {userName: data.userName, chatMessage: data.chatMessage});
      }
    });

    //转发icecandidate
    socket.on('ice', function(data){
      socket.to(sockets[data.anotherUser].id).emit('ice', data)
    });

    socket.on('offer', function(data){
      socket.to(sockets[data.answeruser].id).emit('offer', data)
    });

    socket.on('answer', function(data){
      socket.to(sockets[data.offeruser].id).emit('answer', data)
    });

//---------------------------以下是你画我猜功能--------------------------

    //处理用户准备指令
    socket.on('Ready to play', function(data){
      console.log('User ' + data.user + 'has been ready to play');
      users[data.user].isready = true;
      let count = 0;
      for(let username in rooms[data.room].users){
        if(users[rooms[data.room].users[username]].isready === true){
          count++;
          console.log('confirm ' + rooms[data.room].users[username] + ' is ready, now there are ' + count + ' users is ready');
        }
        else{
          break;
        }
        if(rooms[data.room].howmanyUsers === count){
          rooms[data.room].isallReady = true;
          io.sockets.in(data.room).emit('All ready');
        }
      }
    })

    //初始化每一局游戏的游戏时间和局数还有题目
    socket.on('Play Game', function(data){
      rooms[data.room].isPlaying = true;
      rooms[data.room].remainQuestions = JSON.parse(JSON.stringify(questions));
      for(let i = 0; i < rooms[data.room].howmanyUsers; i++){
        rooms[data.room].ranking.push(users[rooms[data.room].users[i]]);
      }
      for(let i = 0; i < rooms[data.room].howmanyUsers; i++){
        console.log('初始化排序：' + rooms[data.room].ranking[i].name);
      }
      PreparenewRound(data.room);
    })

    socket.on('Correct Answer', function(data){
      console.log('Received correct answer from ' + data.user);
      Catchtime(data.room, data.user);
    })


    
  }); 

//新回合函数，初始化计时器以及绘画者
function StartnewRound(room){
  clearInterval(rooms[room].timer);
  rooms[room].maxtime = 120;//120,测试时改短
  console.log('Room ' + room + 'has began to play');
  rooms[room].timer = setInterval(function(){
    if (rooms[room].maxtime >= 0) {
      //console.log("距离本轮游戏结束还有" + rooms[room].maxtime + "秒")
      io.sockets.in(room).emit('Timer', rooms[room].maxtime);
      --rooms[room].maxtime;
    } 
    else{
      OneroundEnd(room);
    }
  }, 1000); 
  if(rooms[room].Biground < 3){
    console.log('Big round: '+ rooms[room].Biground + 1 + '. Small round: ' + rooms[room].Smallround + 1 + ', the Drawer is player '+ rooms[room].users[rooms[room].Smallround]);
    users[rooms[room].users[rooms[room].Smallround]].time = 120;
    io.sockets.in(room).emit('One Round', rooms[room].users[rooms[room].Smallround]);
    rooms[room].Smallround++;
    if(rooms[room].Smallround == rooms[room].howmanyUsers){
      rooms[room].Smallround = 0;
      rooms[room].Biground++;
    }
  }
  else{
    rooms[room].Biground = 0;
    rooms[room].Smallround = 0;
    rooms[room].isPlaying = false;
    rooms[room].questionNow = '********';
    rooms[room].ranking = [];
    for(let username in rooms[room].users){
      users[rooms[room].users[username]].isready = false;
      users[rooms[room].users[username]].score = 0;
      users[rooms[room].users[username]].time = 0;
    }
    io.sockets.in(room).emit('Game End');
    console.log('Game end!');
  }
}


//记录猜对正确答案时候的时间剩余，根据时间在结算时判定分数
function Catchtime(room, user){
  let count = 0;
  users[user].time = rooms[room].maxtime;
  for(let i = 0; i < rooms[room].howmanyUsers; i++){
    if(users[rooms[room].users[i]].time != 0){
      count++;
      console.log(rooms[room].users[i] + 'remains ' + users[rooms[room].users[i]].time + 'senconds');
    }
  }
  if(count == rooms[room].howmanyUsers){
    OneroundEnd(room);
  }
}

//结算一局结束的统计数据，计算玩家得分
function OneroundEnd(room){
  console.log('一局游戏结束了，开始结算');
  rooms[room].ranking.sort(function(a,b){
    return b.time - a.time;
  })
  for(let i = 0; i < rooms[room].howmanyUsers; i++){//根据时间先给玩家排序
    console.log('这一轮用时排序（第一位为绘画者）：' + rooms[room].ranking[i].name);
  }
  let count = rooms[room].howmanyUsers;
  for(let i = 0; i < rooms[room].howmanyUsers; i++){//计算有多少人猜出了答案，给绘画者记分
    if(rooms[room].ranking[i].time == 0){
      count--;
    }
  }
  if(count >= 3){
    rooms[room].ranking[0].score += 3;
  }
  else if(count < 3 && count > 1){
    rooms[room].ranking[0].score += 2;
  }
  if(rooms[room].ranking[1] && rooms[room].ranking[1].time != 0){
    rooms[room].ranking[1].score += 3;
  }
  if(rooms[room].ranking[2] && rooms[room].ranking[2].time != 0){
    rooms[room].ranking[2].score += 2;
  }
  if(rooms[room].ranking[3] && rooms[room].ranking[3].time != 0){
    rooms[room].ranking[3].score += 1;
  }
  if(rooms[room].ranking[4] && rooms[room].ranking[4].time != 0){
    rooms[room].ranking[4].score += 1;
  }
  if(rooms[room].ranking[5] && rooms[room].ranking[5].time != 0){
    rooms[room].ranking[5].score += 1;
  }
  rooms[room].ranking.sort(function(a,b){
    return b.score - a.score;
  })
  for(let i = 0; i < rooms[room].howmanyUsers; i++){//根据分数给玩家排序
    console.log('这一轮分数排序：' + rooms[room].ranking[i].name + ': ' + rooms[room].ranking[i].score + ' 分');
  }
  var scores = [];
  var names = [];
  for(let i = 0; i < rooms[room].howmanyUsers; i++){//初始化时间，并填充传送分数数组
    rooms[room].ranking[i].time = 0;
    names[i] = rooms[room].ranking[i].name;
    scores[i] = rooms[room].ranking[i].score;
  }
  io.sockets.in(room).emit('Reset Score', {names: names, scores: scores});
  PreparenewRound(room);
}

function PreparenewRound(room){//准备新一轮游戏，包括提示绘画者，选定题目等
  clearInterval(rooms[room].timer);
  var waitingtime = 5;//5,测试时改短
  var number = rooms[room].remainQuestions.length;
  console.log('there are ' + number + ' questions remains now');
  var index = Math.floor(Math.random()*number);
  
  if(rooms[room].Biground == 3){
    //初始化所有游戏数据
    rooms[room].Biground = 0;
    rooms[room].Smallround = 0;
    rooms[room].isPlaying = false;
    rooms[room].questionNow = '********';
    rooms[room].ranking = [];
    for(let username in rooms[room].users){
      users[rooms[room].users[username]].isready = false;
      users[rooms[room].users[username]].score = 0;
      users[rooms[room].users[username]].time = 0;
    }
    io.sockets.in(room).emit('Game End');
    console.log('Game end!');
  }
  else{
    console.log('the question this round is ' + questions[index]);
    console.log('the question\'s length this round is ' + questions[index].length);
    rooms[room].questionNow = rooms[room].remainQuestions[index];
    rooms[room].remainQuestions.splice(index, 1);

    io.sockets.in(room).emit('Reminder', {drawer: rooms[room].users[rooms[room].Smallround], question: rooms[room].questionNow});
    //等待五秒，开始新游戏
    rooms[room].timer = setInterval(function(){
      if (waitingtime >= 0) {
        //console.log("距离准备结束还有" + waitingtime + "秒")
        io.sockets.in(room).emit('Timer', waitingtime);
        --waitingtime;
      } 
      else{
        StartnewRound(room);
      }
    }, 1000); 
  }
  
}
