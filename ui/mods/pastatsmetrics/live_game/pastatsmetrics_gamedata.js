// for a ranked game we have zero data in the lobby so gotta do it here, especially the lobbyid available only here
if(!model.ranked()){
  var player_list = model.playerData();
  var planets_biomes = {};
  for(var i = 0; i<model.planetListState()["planets"].length;i++){
    planets_biomes.push(model.planetListState()["planets"][i]["biome"]);
  }
  var ranked_report = {
    is_lobby_data: true,
    lobby_id: model.lobbyId(),
    game_name: "1v1 Ranked",
    is_Local: false,
    is_Public: true,
    is_FriendsOnly: false,
    is_Hidden: false,
    is_Titan: true,
    is_Ranked: true,
    user_name: "None",
    server_mods: [],
    player_list: JSON.stringify(player_list),
    planets_biomes: JSON.stringify(planets_biomes),
    uber_id: model.uberId(),
    the_date: toUTCStringAlternative(),
  };

  var report_string = JSON.stringify(ranked_report);
  //$.post(url, report_string);
}


var EcoData = []; 
var TimeInSeconds = 0;
var KillData = [];
var Testme = [];
var GameOverData = [];
var myData2 = [];
var myapm = [0];
var keypressed = [];
var myUnitsIds = [];
var gameover_sent = 4;

//var metalProduced = [0]
//var energyProduced = [0]

var metallost = []
var metaldestroy = []

//copied from super stats, i have no idea how it works
$.fn.bindFirst = function (name, fn) {
    this.on(name, fn);
    this.each(function () {
      var handlers = $._data(this, 'events')[name.split('.')[0]];
      var handler = handlers.pop();
      handlers.splice(0, 0, handler);
    });
  };
var self = this;

self.apm = 0;
self.apmCounter = false;
self.apmFrequency = 1 * 1000; //each sec, very efficient math here
self.keyPressCount = 0; 
self.currentApm = 0;

function toUTCStringAlternative() {
    var date = new Date();
    var isoString = date.toISOString();
    var utcString = isoString.replace('T', ' ').replace(/\..+/, '') + ' UTC';

    return utcString;
};

var allIds = [];

(function() {
  function dowhile(){ // so the dowhile do everything ? why is it in a func idk

    var automation = function () {// automation is for getting Units ids/numbers
      var planetnum = model.planetListState().planets.length-1;//getNumberOfPlanets
      for(var i = 0; i<planetnum;i++){

        if(planetnum < 1){_.delay(automation, 5000);}//no idea why this
            var worldView = api.getWorldView(0);
        var armyindex = model.armyIndex();
        var PlayerArmys = [];
        if (typeof armyindex == "undefined"){
          armyindex = model.armyId() //wtf, why is it here idk
        }
        PlayerArmys.push([]);
        }
        var myi = 0;
        
        for(var planetid = 0;planetid<planetnum;planetid++){//for each planet for my current player get his units type and ids
          PlayerArmys[0][planetid] = worldView.getArmyUnits(armyindex,planetid).then(
          function(){
            var myData = this;
            myData2[myi] = JSON.stringify(myData["result"]);
            myi +=1;
          });
        }
        myi = 0;      
    }
    automation();
    console.log("SENDING DATA");

    var gameState = JSON.stringify(GameOverData[0]);
    var gameVictors = GameOverData[1];
    var playerUberId = model.uberId();
    var playerName = model.playerName();
    var systemName = model.systemName();
    var the_date = Date().toString();
    var isRanked = model.ranked();
    
    var currentAPM = myapm[myapm.length - 1];
    var lobby_id = ko.observable(-1).extend({ session: 'lobbyId' });
    lobby_id = lobby_id();
    //localStorage.lobbyId() = lobby_id;
    var ip = "192.168.0.13";
    var ip2 = "192.168.32.1";
    var url = "http://pastatsmetrics.com/pastats/paview";//"http://"+ ip + ":8000/main_isyw/paview";
    var unb_get = false;

    if(myData2){//idk why, if there is data ??
      unb_get = myData2;
    }
    else{
      unb_get = false;
    }
    if(model.gameOptions.isGalaticWar()){// create random lobby id for galactic war
      lobby_id = (Math.floor(Math.random() * 100000000000000000000)).toFixed().toString() + (Math.floor(Math.random() * 1000000000000)).toFixed().toString();
    }

    // NEED THIS pour playerlist name model.playerListState();
    pnamelist = [];
    var test = model.playerListState();
    for(var i = 0; i < test["players"].length;i++){
      for(var j = 0; j < test["players"][i]["slots"].length;j++){
        pnamelist.push([test["players"][i]["slots"][j].replace("'", "`").replace("\"", "`") , test["players"][i]["primary_color"]])
      }
    }
    
    var report = {
      is_lobby_data: false,
      game_state: JSON.stringify(GameOverData[0]),
      game_victors: GameOverData[1],
      uber_id: model.uberId(),
      player_name: model.playerName(),
      system_name: model.systemName(),
      the_date: toUTCStringAlternative(),
      current_apm: myapm[myapm.length - 1],
      lobby_id: lobby_id,
      eco_data: EcoData,
      kill_data: KillData,
      time_in_seconds: Math.floor(TimeInSeconds),
      unb_data: unb_get,
      is_galacticwar: model.gameOptions.isGalaticWar(), // yes game has a typo error it's galatic and not galactic
      is_ladder1v1: model.gameOptions.isLadder1v1(),
      is_land_anywhere: model.gameOptions.land_anywhere(),
      is_listen_to_spectators: model.gameOptions.listenToSpectators(),
      is_sandbox: model.gameOptions.sandbox(),
      is_dynamic_alliances: model.gameOptions.dynamic_alliances(),
      dynamic_alliance_victory: model.gameOptions.dynamic_alliance_victory(),
      game_type: model.gameOptions.game_type(),
      is_AI_game: model.noHumanPlayers(),
      player_list: pnamelist,
    };
    console.log("DEV DEBUG : ", report);
    var report_string = JSON.stringify(report);

    if(!(model.paused()) && !(model.isSpectator()) && !(model.showLanding())){
      console.log("WOWBRO");
      //$.post(url, report_string);
      //$.post("http://192.168.0.13:8000/pastats/paview", report_string);
    }

    //console.log("YO TEST VICTORS", GameOverData[1], gameover_sent, !_.isEmpty(GameOverData[1]), gameover_sent<7, !(model.isSpectator()));
    if((!_.isEmpty(GameOverData[1])) && gameover_sent<7 && model.isSpectator()){
      gameover_sent +=1;
      //$.post(url, report_string);
      //$.post("http://192.168.0.13:8000/pastats/paview", report_string);
    }
    

        _.delay(dowhile, 5000);
  }
  dowhile();
})();


// from flubb's superstats mod, same code as him for apm
self.apmCounter = setInterval(function () {
    var sum = 0;
    keypressed.push(self.keyPressCount)
    if(keypressed.length <= 60){
      for(var i = 0; i < keypressed.length;i++){
        sum += keypressed[i];
      }
    }
    else if(keypressed.length > 60){
      for(var i = keypressed.length-60; i < keypressed.length;i++){
        sum += keypressed[i];
      }
    }
    myapm.push(sum);

  self.apm = 60 * 1000 * (self.keyPressCount / self.apmFrequency);
  self.keyPressCount = 0;}, self.apmFrequency);

self.init = function () {
$(document).bindFirst("keyup", function (e) {
  //console.log("CLICK1");
  self.keyPressCount += 1
});
$('holodeck').bindFirst("mousedown", function (e) {
  //console.log("CLICK2");
  self.keyPressCount += 1
});
$(document).bindFirst("mousedown", function (e) {
  //console.log("CLICK3");
  self.keyPressCount += 1
});

};

$(document).ready(this.init)


handlers.EcoDataAll = function(payload){
  EcoData = payload;
  var metalWinRate = model.enemyMetalDestroyed();
  var metalLossRate = model.metalLost();

  //energyProduced.push(energyProduced[energyProduced.length - 1] + EcoData[0]);
  //metalProduced.push(metalProduced[metalProduced.length - 1] + EcoData[6]);

  EcoData.push(metalWinRate);
  EcoData.push(metalLossRate);
}

handlers.comKillData = function(payload){
  KillData = payload;
  KillData = JSON.stringify(KillData);
}

handlers.TimeData = function(payload){
  TimeInSeconds = payload;
}

handlers.TheGameOverData = function(payload){
  GameOverData = payload;
}

