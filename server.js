var express = require('express');
var app = express();
const axios = require("axios");
require('dotenv').config();
var bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
var cors = require('cors');
const util = require('util');
var server = require('http').createServer(app);
var port = 3306;
var io = require('socket.io')(server);
axios.defaults.headers.common["Authorization"] = process.env.SECRETCODE;

gameSocket = null;
app.use(bodyParser.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

app.use(express.static(__dirname + "/build"));
app.get("/*", function (req, res) {
    res.sendFile(__dirname + "/build/index.html", function (err) {
        if (err) {
            res.status(500).send(err);
        }
    });
});

server.listen(port, function () {
  console.log("server is running on " + port);
});

let users = [];
// Implement socket functionality
gameSocket = io.on('connection', function (socket) {
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });

  socket.on('bet info', async(req) => {
    console.log(req)
    var userToken;
    var randomArray = [];
    var amount;
    var betAmount;
    var positionInfo = [];

    isBetting = req.isBetting;
    betAmount = req.betAmount;
    amount = req.amount;
    userToken = req.token;

    try {
      try {
        await axios.post(process.env.PLATFORM_SERVER + "api/games/bet", {
          token: req.token,
          amount: req.betAmount
        });
      } catch{
        throw new Error("0");
      }

      amount -= betAmount;
      randomArray = CreateRandomArray(req.mineNum);

      users[userToken] = {
        amount: amount,
        betAmount: betAmount,
        randomArray: randomArray,
        nextTileProfitCross: 0.95 / ((25 - req.mineNum) / 25),
        totalProfitCross: 0,
        userToken: userToken,
        gemNum: 25 - req.mineNum,
        mineNum: req.mineNum,
        isBetting: true
      }

      positionInfo = { "mineNum": req.mineNum, "gemNum": 25 - req.mineNum, "nextTileProfitAmount": betAmount * 0.95 / ((25 - req.mineNum) / 25), "totalProfitAmount": 0, "nextTileProfitCross": 0.95 / ((25 - req.mineNum) / 25), "totalProfitCross": 0, "canCashOut": false, "amount": amount };
      console.log(positionInfo);
      socket.emit("mine position", positionInfo)
    } catch (err) {
      socket.emit("error message", { "errMessage": err.message })
    }
  });

  socket.on("card click", (req) => {
    var user = users[req.token];
    var cardResult = [];
    if (user.isBetting) {
      if (user.randomArray[req.posIndex] == 0) {
        user.gemNum--;
        user.totalProfitCross = user.nextTileProfitCross;
        user.nextTileProfitCross /= (user.gemNum / (user.gemNum + user.mineNum));

        cardResult = { "isBetting": true, "canCashOut": true, "nextTileProfitAmount": user.betAmount * user.nextTileProfitCross, "totalProfitAmount":user.totalProfitCross * user.betAmount, "nextTileProfitCross": user.nextTileProfitCross, "totalProfitCross": user.totalProfitCross, "posIndex": req.posIndex }
        socket.emit("card result", cardResult);
      }
      else if (user.randomArray[req.posIndex] == 1) {
        user.isBetting = false;

        cardResult = { "isBetting": user.isBetting, "canCashOut": false, "posIndex": req.posIndex, "randomArray": user.randomArray, "amount": user.amount }
        socket.emit("card result", cardResult);
      }
      console.log(cardResult)
    }

  });

  socket.on("cash out", async(req) => {
    console.log(req);
    var betResult = [];
    try {
      var user = users[req.token];
      if (req.pressedCashOut) {
        user.amount += user.totalProfitCross * user.betAmount;
        try {
          await axios.post(process.env.PLATFORM_SERVER + "api/games/winlose", {
            token: user.userToken,
            amount: user.totalProfitCross * user.betAmount,
            winState: true
          });
        } catch{
          throw new Error("1");
        }
        betResult = { "isBetting": false, "randomArray": user.randomArray, "amount": user.amount, "gameResult": true, "totalProfitAmount": user.totalProfitCross * user.betAmount, "totalProfitCross": user.totalProfitCross }
        socket.emit("game result", betResult);
      }
    } catch (err) {
      socket.emit("error message", { "errMessage": err.message })
    }
  });

  console.log('socket connected: ' + socket.id);
  socket.emit('connected', {});
});




function CreateRandomArray(mineNum) {
  var minePosition = [];
  var randomArray = [];
  for (var i = 0; i < mineNum;) {
    var flag = false;
    var random_Num = getRandomInt(25);
    for (var j = 0; j < minePosition.length; j++) {
      if (minePosition[j] === random_Num) {
        flag = true;
        break;
      }
    }
    if (flag === false) {
      minePosition.push(random_Num);
      i++;
    }
  }

  console.log(minePosition);

  for (var i = 0; i < 25; i++) {
    randomArray.push(0);
  }

  for (var i = 0; i < minePosition.length; i++) {
    randomArray[minePosition[i]] = 1;
  }
  return randomArray;
}

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}
