"use strict";
//navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mediaDevices.getUserMedia;

var socket = io.connect('http://localhost:3000');
var chat;
var Video = {};
var chatContent = document.getElementById('chatContent');//这是一测试用的，估计后期要删掉
var sendButton = document.getElementById('sendButton');//聊天发送按钮
var chatInput = document.getElementById('chatInput');//聊天输入内容
var Createorjoinroom = document.getElementById('Createorjoinroom');//创建新房间
var Leaveroom = document.getElementById('Leaveroom');//离开房间
var Call = document.getElementById('call');//呼叫按钮
var opencamera = document.getElementById('camera');//开启摄像头按钮
var endcall = document.getElementById('endcall');//挂断按钮
var Createuser = document.getElementById('Createuser');//创建新用户
var canvas = document.getElementById('Canvas');
var ready = document.getElementById('Ready');
var play = document.getElementById('Play');
var colorChange = document.getElementById('Color');
var weightChange = document.getElementById('Weight');
var pen = document.getElementById('Pen');
var eraser = document.getElementById('Eraser');
var undo = document.getElementById('Undo');
var clear = document.getElementById('Clear');
//var timer = document.getElementById('timer');
//var reminder = document.getElementById('reminder');

Video[0] = document.getElementById('Video1');//视频1
Video[1] = document.getElementById('Video2');//视频2
Video[2] = document.getElementById('Video3');//视频3
Video[3] = document.getElementById('Video4');//视频4
Video[4] = document.getElementById('Video5');//视频5
Video[5] = document.getElementById('Video6');//视频6

var localstream;

var color;
var weight;
var isInitiator = false;
//通过弹出窗口获得用户名和房间号
var user// = prompt('Enter user name:');
var room// = prompt('Enter room name:');
var socket = io.connect();
var peerInfo = {};
var rightAnswer = '你一定猜不出来游戏没开始的时候答案的初始设置是这么一句很长的很啰嗦的话';
var alreadyDown = false;
var usersInroom = [];
var iscalling = false;

class Peerinfo{
  constructor(name){
    this.name = name;
    this.peer = '*';
    this.datachannel = '*';
  }
}

//用来提示房间已建立
socket.on('created', function(roomNumber){
  isInitiator = true;
  sendButton.disabled = false;
  Createuser.disabled = true;
  Createorjoinroom.disabled = true;
  Leaveroom.disabled = false;
  ready.disabled = false;
  play.disabled = true;
  chatContent.insertAdjacentHTML( 'beforeEnd', '<p style="color:blue">' + '房间 '	+ roomNumber + ' 已被创建，您是房主，请等待其他玩家加入 </p>');//提示用户是房主
});

//处理离开房间事件
socket.on('Leaved', function(data){
  if(user == data.user){//退出房间者处理以下操作
    sendButton.disabled = true;
    Createuser.disabled = false;
    Createorjoinroom.disabled = false;
    Leaveroom.disabled = true;
    Call.disabled = true;
    endcall.disabled = true;
    opencamera.disabled = true;
    ready.disabled = true;
    play.disabled = true;
    room = null;
    isInitiator = false;
    localstream = null;
    iscalling = false;
    for(let userName in peerInfo){
      peerInfo[userName].peer.close();
      peerInfo[userName].datachannel.close();
      peerInfo[userName] = null;
      delete peerInfo[userName];
    }
    peerInfo = {};
    usersInroom = [];
    for(let i = 0; i <= 5; i++){
      Video[i].srcObject = null;
      document.getElementById('Name' + i).innerHTML = '';
    }
    console.log('you leaved the room')
  }
  else{//房间内剩余用户处理以下操作
    if(data.initiator == user){
      isInitiator = true;
      chatContent.insertAdjacentHTML( 'beforeEnd', '<p style="color:blue"> 房主离开房间，您现在是房主 </p>');
    }
    if(peerInfo[data.user]){
      peerInfo[data.user].peer.close();
      peerInfo[data.user].datachannel.close();
      peerInfo[data.user] = null;
      delete peerInfo[data.user];
    }
    if((usersInroom.indexOf(data.user) + 1) < 5){
      for(let i = (usersInroom.indexOf(data.user) + 1); i < 5; i++){
        if(Video[i + 1].srcObject){
          var video = Video[i + 1].srcObject;
          Video[i].srcObject = video;
          Video[i + 1].srcObject = null;
          document.getElementById('Name' + i).innerHTML = usersInroom[i];
          document.getElementById('Name' + (i + 1)).innerHTML = '';
        }
        else{
          Video[i].srcObject = null;
          document.getElementById('Name' + i).innerHTML = '';
        }
      }
    }
    else{
      Video[5].srcObject = null;
      document.getElementById('Name5').innerHTML = '';
    }
    usersInroom.splice(usersInroom.indexOf(data.user),1);
    if(usersInroom){
      console.log(data.user + ' leaved the room, the rest users in room is: ' + usersInroom)
    }
    else{
      console.log('there is only you in this room');
    }
    chatContent.insertAdjacentHTML( 'beforeEnd', '<p style="color:blue">' + '用户： '	+ data.user + ' 已离开房间。房间内剩余成员：' + usersInroom + '</p>');
  }
  
});

//处理满员事件
socket.on('full', function(){
  alert("请该房间已满或已开局，请输入其他房间号");
});

socket.on('join', function(data){
  console.log('User: ' + data.newUser + ' made a request to join room. ');
  sendButton.disabled = false;
  Createuser.disabled = true;
  Createorjoinroom.disabled = true;
  Leaveroom.disabled = false;
  ready.disabled = false;
  play.disabled = true;
  chatContent.insertAdjacentHTML( 'beforeEnd', '<p style="color:blue">' + '用户： '	+ data.newUser + ' 已加入房间，房内用户已有： ' + data.roomUsers + '</p>');
  
  if (data.roomUsers.length > 1) {
    console.log('you are going to answer from ' + data.newUser);
    prepareforAnswer(data);
  }
});

socket.on('joined', function(data){
  console.log('This peer has joined room');
  sendButton.disabled = false;
  Createuser.disabled = true;
  Createorjoinroom.disabled = true;
  Leaveroom.disabled = false;
  ready.disabled = false;
  play.disabled = true;
  iscalling = false;
  chatContent.insertAdjacentHTML( 'beforeEnd', '<p style="color:blue">' + '用户 '	+ data.newUser + ' 已加入房间，房内用户已有： ' + data.roomUsers + '</p>');
  if (data.roomUsers.length > 1) {
    console.log('You are going to create connection among ' + data.roomUsers);
    prepareforOffer(data);
  }
});

socket.on('Receive Message', function(data){
  chatContent.insertAdjacentHTML( 'beforeEnd', '<p>' + data.userName + ': ' +  data.chatMessage  + '</p>');
});

//所有玩家都准备了后，房主可以开始游戏
socket.on('All ready', function(){
  console.log('All the players are ready to play');
  if(isInitiator){
    play.disabled = false;
  }
})

socket.on('Add Video', function(data){
  if(user != data.user){
    peerInfo[data.user].peer.addStream(localstream);
  }
});


//分配谁画
socket.on('One Round', function(data){
  console.log('New turn , player ' + data + ' is the drawer');
  alreadyDown = false;
  if(user == data){
    pen.disabled = false;
    eraser.disabled = false;
    undo.disabled = false;
    clear.disabled = false;
    draw.init;
    draw.canvas.addEventListener('mousedown', draw.bindMousedown);//启用鼠标点击事件，可以画画了
    window.addEventListener('mouseup', draw.bindMouseup);
  }
  else{
    pen.disabled = true;
    eraser.disabled = true;
    undo.disabled = true;
    clear.disabled = true;
    draw.init;
    draw.canvas.removeEventListener('mousedown', draw.bindMousedown);
    window.removeEventListener('mouseup', draw.bindMouseup);
  }
})

socket.on('Correct', function(data){
  chatContent.insertAdjacentHTML( 'beforeEnd', '<p style="color:blue">' + data.userName + ' 已经猜出了正确答案！'  + '</p>');
})

socket.on('Timer', function(data){
  document.getElementById('timer').innerHTML = "倒计时：" + data + " 秒";
})

socket.on('Reminder', function(data){
  rightAnswer = data.question;
  if(user == data.drawer){
    document.getElementById('reminder').innerHTML = "本局你来画！题目为：" + data.question;
    sendButton.disabled = true;
  }
  else{
    document.getElementById('reminder').innerHTML = "本局你来猜！提示：" + data.question.length + " 个字";
    sendButton.disabled = false;
  }
  pen.disabled = true;
  eraser.disabled = true;
  undo.disabled = true;
  clear.disabled = true;
  draw.init;
  draw.canvas.removeEventListener('mousedown', draw.bindMousedown);
  window.removeEventListener('mouseup', draw.bindMouseup);
})

socket.on('Game End', function(){
  ready.disabled = false;
  play.disabled = true;
  pen.disabled = true;
  eraser.disabled = true;
  undo.disabled = true;
  clear.disabled = true;
  Leaveroom.disabled = false;
  sendButton.disabled = false;
  rightAnswer = '你一定猜不出来游戏没开始的时候答案的初始设置是这么一句很长的很啰嗦的话';
  alreadyDown = false;
  draw.init;
  draw.canvas.removeEventListener('mousedown', draw.bindMousedown);
  window.removeEventListener('mouseup', draw.bindMouseup);
  console.log('Game end!');
})

socket.on('Reset Score', function(data){
  draw.imgData = [];
  draw.index = 0;
  draw.ctx.clearRect(0, 0, draw.width, draw.height);
  draw.init;
  if(data.names[0]){
    document.getElementById('player1').innerHTML = "第一名" + data.names[0] + " :" + data.scores[0] + " 分";
  }
  if(data.names[1]){
    document.getElementById('player2').innerHTML = "第二名" + data.names[1] + " :" + data.scores[1] + " 分";
  }
  if(data.names[2]){
    document.getElementById('player3').innerHTML = "第三名" + data.names[2] + " :" + data.scores[2] + " 分";
  }
  if(data.names[3]){
    document.getElementById('player4').innerHTML = "第四名" + data.names[3] + " :" + data.scores[3] + " 分";
  }
  if(data.names[4]){
    document.getElementById('player5').innerHTML = "第五名" + data.names[4] + " :" + data.scores[4] + " 分";
  }
  if(data.names[5]){
    document.getElementById('player6').innerHTML = "第六名" + data.names[5] + " :" + data.scores[5] + " 分";
  }
})

socket.on('Assemble Video', function(data){
  if(user != data.user){
    if((usersInroom.indexOf(data.user) + 1) < 5){
      for(let i = (usersInroom.indexOf(data.user) + 1); i < 5; i++){
        if(Video[i + 1].srcObject){
          var video = Video[i + 1].srcObject;
          Video[i].srcObject = video;
          Video[i + 1].srcObject = null;
          document.getElementById('Name' + i).innerHTML = usersInroom[i];
          document.getElementById('Name' + (i + 1)).innerHTML = '';
        }
        else{
          Video[i].srcObject = null;
          document.getElementById('Name' + i).innerHTML = '';
        }
      }
    }
    else{
      Video[5].srcObject = null;
      document.getElementById('Name5').innerHTML = '';
    }
    usersInroom.splice(usersInroom.indexOf(data.user),1);
  }
})

//---------------------------以下是按钮------------------------------

sendButton.onclick = sendMessage;
Createuser.onclick = createUser;
Createorjoinroom.onclick = createOrjoinRoom;
Leaveroom.onclick = leaveRoom;
Call.onclick = callforconnection;
opencamera.onclick = acquirevideo;
endcall.onclick = reassemblevideo;
ready.onclick = readytoplay;
play.onclick = playGame;
//更改颜色
colorChange.onchange = () =>{
  color = colorChange.value;
  console.log('color changed!', color);
  draw.color = color;
}
//更改粗细
weightChange.onchange = () =>{
  weight = weightChange.value;
  console.log('weight changed!', weight);
  draw.weight = weight;
}
pen.onclick = () =>{
  draw.color = draw.lastcolor;
}
eraser.onclick = () =>{
  if(draw.color != '#FFFFFF'){
    draw.lastcolor = draw.color;
  }
  color = '#FFFFFF';
  console.log('eraser!', color);
  draw.color = color;
}
undo.onclick = () =>{
  if(draw.index == 1){
    alert('You can\'t undo now!');
  }
  else{
    sendData('undo', {});
    draw.ctx.clearRect(0, 0, draw.width, draw.height);
    draw.ctx.putImageData(draw.imgData[draw.index - 2], 0, 0);
    draw.imgData.pop();
    draw.index--;
    console.log('undo, now has ' + draw.index + ' picture(s) saved', draw.imgData);
  } 
}
clear.onclick = () =>{
  draw.imgData = [];
  draw.index = 0;
  draw.ctx.clearRect(0, 0, draw.width, draw.height);
  draw.init;
  sendData('clear', {});
}


//---------------------------以下是canvas----------------------------

class Draw{
  constructor(canvas){
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.weight = 12;
    this.color = '#000000';
    this.lastcolor = '#000000';
    // 用于撤回
    this.imgData = [];
    // 记录当前帧
    this.index = 0;
    // 现在的坐标
    this.nowPosition = [0, 0];
    // 移动前的坐标
    this.beginPosition = [0, 0];
    this.bindMousemove = this.onmousemove.bind(this);
    this.bindMousedown = this.onmousedown.bind(this);
    this.bindMouseup = this.onmouseup.bind(this);
    this.isDrawing = false;
  }
  init(){
    this.imgData = [];
    this.index = 0;
    this.ctx.clearRect(0, 0, draw.width, draw.height);
    this.imgData.push(this.ctx.getImageData(0, 0, this.width, this.height));
    
  }
  onmousedown(event){
    this.beginPosition = [event.offsetX, event.offsetY];
    console.log('Drawing...');
    this.canvas.addEventListener('mousemove', this.bindMousemove);//在画布上准备监听鼠标移动
  }
  onmousemove(event){
    this.isDrawing = true;
    this.nowPosition = [event.offsetX, event.offsetY];
    let data = {Bp: this.beginPosition, Np: this.nowPosition, Wt: this.weight, Cr: this.color};
    this.drawing(data);
    sendData('pen', data);
  }
  onmouseup() {
    this.canvas.removeEventListener('mousemove', this.bindMousemove);
    if(this.isDrawing){
      this.isDrawing = false;
      sendData('save', {});
      this.index++;
      this.imgData.push(this.ctx.getImageData(0, 0, this.width, this.height));//存储这一次鼠标抬起前的绘画图
      //为了存储空间，最多存储三次最近操作
      if(this.index > 4){
        this.imgData = this.imgData.slice(1,5);
        this.index = 4;
      }
      
      console.log('now have saved : ' + this.index + ' picture(s)' , this.imgData);
    }
  }
  drawing(data) {
    this.ctx.beginPath();
    this.ctx.lineWidth = data.Wt;
    this.ctx.strokeStyle = data.Cr;
    this.ctx.moveTo(data.Bp[0], data.Bp[1]);//从哪画
    this.ctx.lineTo(data.Np[0], data.Np[1]);//画到哪
    this.ctx.closePath();
    this.ctx.stroke()
    this.beginPosition = this.nowPosition;
  }
}

var draw = new Draw(canvas);


//---------------------------以下是peerconnction---------------------

function prepareforOffer(data){
  if (data.roomUsers.length > 1){
    for(let roomuser in data.roomUsers){
      if (data.roomUsers[roomuser] !== user && typeof data.roomUsers[roomuser] !== 'undefined') {
        //usersInroom.push(data.roomUsers[roomuser]);
        if (!peerInfo[data.roomUsers[roomuser]]){
          console.log('Creating peerconnection with: ' + data.roomUsers[roomuser]);
          P2Pcreate(data.roomUsers[roomuser]);
        }
      }
    }   
  }
  console.log('房间内还有这些人：' + usersInroom);
  opencamera.disabled = false;
  for(let anotheruser in peerInfo){
    console.log('Creating offer with: ' + anotheruser);
    ongoingcreateoffer(anotheruser, peerInfo[anotheruser].peer);
  }
  //由新加入房间的用户向之前已经在房间中的用户发送offer
  //for(let anotheruser in P2Ppeer){
  //  console.log('Creating offer with: ' + anotheruser);
  //  ongoingcreateoffer(anotheruser, P2Ppeer[anotheruser]);
  //}
}

function prepareforAnswer(data){
  if (!peerInfo[data.newUser]){
    P2Pcreate(data.newUser);
  }
  if(iscalling){
    peerInfo[data.newUser].peer.addStream(localstream);
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!');
  }
  //usersInroom.push(data.newUser);
  console.log('房间内还有这些人：' + usersInroom);
  console.log('Adding local stream to: ' + data.newUser);
  opencamera.disabled = false;
}

socket.on('ice', function(data){
  console.log('Received ice from: '+ data.thisUser + ', the icecandidate is: ' , data.icecandidate);
  peerInfo[data.thisUser].peer.addIceCandidate(data.icecandidate);
});

socket.on('offer', function(data){
  console.log('Received offer from: '+ data.offeruser);
  peerInfo[data.offeruser].peer.setRemoteDescription(data.sdp);
  peerInfo[data.offeruser].peer.createAnswer().then(
    description => {
      peerInfo[data.offeruser].peer.setLocalDescription(description);
	    //console.log('Answer descripton : ' , description.sdp);
      socket.emit('answer', {offeruser: data.offeruser, answeruser: data.answeruser, sdp: description});
    }
  )
});

socket.on('answer', function(data){
  console.log('Received answer from: '+ data.answeruser);
  peerInfo[data.answeruser].peer.setRemoteDescription(data.sdp)
});

//---------------------------以下是function--------------------------

//创建或加入房间
function createOrjoinRoom(){
  if(user == null){
    alert("请先创建用户！");
  }
  else{
    room = prompt('Enter room name:');
    if(room != null){
      socket.emit('Create or Join Room', {roomNumber: room, userName: user});
    }
  }
}

//创建用户
function createUser(){
  user = prompt('Enter user name:');
  socket.emit('Create User', user);
}

function leaveRoom(){
  if(isInitiator){
    socket.emit('Leave Room', {userName: user, roomNumber: room, initiator: usersInroom[0]});
  }
  else{
    socket.emit('Leave Room', {userName: user, roomNumber: room, initiator: 'nobody is initiator'});
  }
}

//下边这个是用datachannel实现发送消息
function sendMessage(){
  if(chatInput.value != rightAnswer){
    chat = user + ' : ' + chatInput.value;
    var p = document.createElement('p');
    p.innerHTML = chat;
    chatContent.appendChild(p);//自己更新
    sendData('message', chat);//发给别人
    chatInput.value = '';//清空输入框中的内容
  }
  else if(chatInput.value == rightAnswer && alreadyDown == false){
    socket.emit('Correct Answer', {room: room, user: user});
    alreadyDown = true;
    chat = user + ' 已经猜出了正确答案！';
    var p = document.createElement('p');
    p.innerHTML = chat;
    chatContent.appendChild(p);//自己更新
    sendData('message', chat);//发给别人
    chatInput.value = '';//清空输入框中的内容
  }
  else{
    alert('请不要再重复发正确答案了！！！给别人点机会吧求求了！！！');
    chatInput.value = '';
  }
}

//创建peer实例，并且设置事件应对措施
async function P2Pcreate(anotheruser){
  var PeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
  let peeruser = new Peerinfo(anotheruser);
  peerInfo[anotheruser] = peeruser;
  peerInfo[anotheruser].peer = new PeerConnection({
    configuration: {
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    },
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });
  
  //处理icecandidate事件
  peerInfo[anotheruser].peer.onicecandidate = (event) => {
    //console.log('trigger event icecandidate');
    if(event.candidate){
     socket.emit('ice', {roomNumber: room, thisUser: user, anotherUser: anotheruser, icecandidate: event.candidate});
    }
  }

  //处理addstream事件
  peerInfo[anotheruser].peer.onaddstream = (event) => {
    usersInroom.push(peerInfo[anotheruser].name);
    var number = usersInroom.indexOf(peerInfo[anotheruser].name) + 1;
    Video[number].srcObject = event.stream;
    document.getElementById('Name' + number).innerHTML = peerInfo[anotheruser].name;
    console.log("Received remote stream from: " + peerInfo[anotheruser].name + ' the vedio index is :' + number);
  }

  /*peerInfo[anotheruser].peer.ontrack = (event) => {
    if(videocount < 6){
      videocount++;
    } 
    peerInfo[anotheruser].videoIndex = videocount;
    Video[peerInfo[anotheruser].videoIndex].srcObject = event.stream;
    document.getElementById('Name' + peerInfo[anotheruser].videoIndex).innerHTML = peerInfo[anotheruser].name;
	  console.log("Received remote stream from: " + peerInfo[anotheruser].name + ' the vedio index is :' + peerInfo[anotheruser].videoIndex);
  }*/

  //处理ondatachannel事件
  peerInfo[anotheruser].peer.ondatachannel = (event) =>{
    console.log('trigger ondatachannel');
    event.channel.binaryType = 'arraybuffer'
    event.channel.onmessage = (event) => { // 收到消息
      let sendingData = JSON.parse(event.data);
      switch (sendingData.option) {
        case 'pen':{
          draw.drawing(sendingData.data);
          break;
        }
        case 'undo':{
          //if(draw.index != sendingData.data){
          //  console.log('error!!!!!!!!!!!!!!', draw.index, sendingData.data)
          //}
          if(draw.index != 1 && draw.index != 0){
            draw.ctx.clearRect(0, 0, draw.width, draw.height);
            draw.ctx.putImageData(draw.imgData[draw.index - 2], 0, 0);
            draw.imgData.pop();
            draw.index--;
          }
          //console.log(draw.index); 
          break;
        }
        case 'clear':{
          draw.imgData = [];
          draw.index = 0;
          draw.ctx.clearRect(0, 0, draw.width, draw.height);
          draw.init;
          break;
        }
        case 'save':{
          draw.index++;
          draw.imgData.push(draw.ctx.getImageData(0, 0, draw.width, draw.height));
          if(draw.index > 4){
            draw.imgData = draw.imgData.slice(1,5);
            draw.index = 4;
          }
          break;
        }
        case 'message':{
          var p = document.createElement('p');
          p.innerHTML = sendingData.data;
          chatContent.appendChild(p);
          break;
        }
      }
      console.log('received the option: ' + sendingData.option);  
    }
  }


  console.log('与' + peerInfo[anotheruser].name + '的peer实例已建立');
  peerInfo[anotheruser].datachannel = await peerInfo[anotheruser].peer.createDataChannel('messagechannel');//创建数据传输通道
  }

function ongoingcreateoffer(anotheruser, peer){
  peer.createOffer({offerToReceiveAudio: 1, offerToReceiveVideo: 1}).then(
    description =>{
      peer.setLocalDescription(description);
      console.log('the offer description is : ' , description);
      socket.emit('offer', {offeruser: user, answeruser: anotheruser, sdp: description});
    }
  );
}

function acquirevideo(){
  //navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
  navigator.mediaDevices.getUserMedia({audio:false, video:{
    mandatory: {
      maxWidth: 320,
      maxHeight: 240
    }
  }}).then(
    stream => {
      console.log("Received local stream");
	    Video[0].srcObject = stream;//这里改了一下，新版本chrome好像是要这么写
      if(localstream == null){
        Call.disabled = false;
      }
	    localstream = stream;
      
      //socket.emit('Asking For Videos', {user: user, room: room});
    }
  )//为了异步执行addstream
}

function reassemblevideo(){
  Call.disabled = true;
  endcall.disabled = true;
  opencamera.disabled = false;
  localstream = null;
  Video[0].srcObject = null;
  iscalling = false;
  document.getElementById('Name0').innerHTML = '';
  socket.emit('Assemble', {room: room, user: user});
}

function callforconnection(){
  if(Call.disabled == false && endcall.disabled == true){
    Call.disabled = true;
    endcall.disabled = false;
  }
  iscalling = true;
  for(let anotheruser in peerInfo){
    console.log('Adding local stream to: ' + anotheruser);
    peerInfo[anotheruser].peer.addStream(localstream);
    //localstream.getTracks().forEach(track => {
    //  peerInfo[anotheruser].peer.addTrack(track, localstream);
    //})
    document.getElementById('Name0').innerHTML = user;
  }
  for(let anotheruser in peerInfo){
    console.log('Creating offer with: ' + anotheruser);
    ongoingcreateoffer(anotheruser, peerInfo[anotheruser].peer);
  }
}

function readytoplay(){
  ready.disabled = true;
  play.disabled = true;
  Leaveroom.disabled = true;
  console.log('you are ready to play!');
  socket.emit('Ready to play',{room: room, user: user});
}

function sendData(option, data){
  for (let anotheruser in peerInfo) {
    console.log('sending drawing data to other players: ' + option);
    peerInfo[anotheruser].datachannel.send(JSON.stringify({option: option, data: data}));
  }
}

function playGame(){
  ready.disabled = true;
  play.disabled = true;
  Leaveroom.disabled = true;
  console.log('Game begin!');
  socket.emit('Play Game',{room: room, user: user});
}





 