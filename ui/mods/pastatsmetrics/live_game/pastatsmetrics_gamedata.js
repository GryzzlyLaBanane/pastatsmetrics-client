<<<<<<< HEAD
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


=======
>>>>>>> ee7fb70969c5c6d605ccb1af17f0e7997dac4f45
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
<<<<<<< HEAD

//var metalProduced = [0]
//var energyProduced = [0]

var metallost = []
var metaldestroy = []
=======
var camera_coords = [];
blost = 1;
bdestroy = 1;

var metallost = []
var metaldestroy = []
//self = this;


>>>>>>> ee7fb70969c5c6d605ccb1af17f0e7997dac4f45

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
<<<<<<< HEAD
self.apmFrequency = 1 * 1000; //each sec, very efficient math here
self.keyPressCount = 0; 
self.currentApm = 0;

=======
self.apmFrequency = 1 * 1000; //each sec
self.keyPressCount = 0; 
self.currentApm = 0;


//-------------- CODE DE CAMERA-  ------------
console.log("-------------- CODE DE camera -------------");
var units = [] ;
var ballec = "";
var ic = 0;
(function(){

  var autoto = function(){
    if (!_.isEmpty(GameOverData[1])){
      //console.log("game iover",camera_coords);
      
      //console.log("game sdfsdfiover");
      if(ic < camera_coords.length){
        var target = {};
        target.planet_id = 0;
        target.location = camera_coords[ic];
        target.zoom = "air"; //surface air orbital celestial
        //console.log(camera_coords, "HEEEEEEEEEEY");
        //api.camera.lookAt(target, true);
        //api.camera.getFocus(1).planet()
        ic += 1;
      }
    }
    else {
      //console.log("ouaisouaisouais", api.camera.getFocus(1)["location"]());
    
      xc = api.camera.getFocus(1)["location"]()["x"];
      yc = api.camera.getFocus(1)["location"]()["y"];
      zc = api.camera.getFocus(1)["location"]()["z"];
      const currentPosition = { x: xc, y: yc, z: zc };
      //const targetPosition = { x: 379.42, y: -146.62, z: 506.90 };
      //console.log(api.camera.getFocus(1).planet(),TimeInSeconds[0], currentPosition);
      camera_coords.push([api.camera.getFocus(1).planet(),TimeInSeconds[0], currentPosition]);
      //console.log(camera_coords, "HEEEsdsdsdsdsdsdsdsdsdsdsdEEEEEEEY");

    }

  }

  setInterval(autoto, 200);
})();

//----------------------------------------

>>>>>>> ee7fb70969c5c6d605ccb1af17f0e7997dac4f45
function toUTCStringAlternative() {
    var date = new Date();
    var isoString = date.toISOString();
    var utcString = isoString.replace('T', ' ').replace(/\..+/, '') + ' UTC';
<<<<<<< HEAD

    return utcString;
};

var allIds = [];

(function() {
  function dowhile(){ // so the dowhile do everything ? why is it in a func idk

    var automation = function () {// automation is for getting Units ids/numbers
      var planetnum = model.planetListState().planets.length-1;//getNumberOfPlanets
      for(var i = 0; i<planetnum;i++){

        if(planetnum < 1){_.delay(automation, 5000);}//no idea why this
=======
    return utcString;
};


function processIdsInChunks(allIds) {
  var chunkSize = Math.ceil(allIds.length / 10);

  for (var i = 0; i < 10; i++) {
    (function(index) {
      setTimeout(function() {
        var start = index * chunkSize;
        var end = start + chunkSize;
        var currentChunk = allIds.slice(start, end);
        //console.log("currentchunk", currentChunk);
        var unitState = api.getWorldView(0).getUnitState(currentChunk).then(function(result) {
          //result est un arrau il faut itéré dessus
          unit_res = {"unit_spec" : result.unit_spec, "army_number" : result.army, "pos" : result.pos };
          //console.log("sexe", result.unit_spec);
        });
        // Ensure this processing is lightweight or offloaded if heavy
      }, index * 500);
    })(i);
  }
}


var myunitstateids = [];
var allIds = [];

(function() {
  function dowhile(){

    var automation = function () {
      var planetnum = model.planetListState().planets.length-1;
      //myunitstateids = [];
      for(var i = 0; i<planetnum;i++){

        if(planetnum < 1){_.delay(automation, 5000);}
>>>>>>> ee7fb70969c5c6d605ccb1af17f0e7997dac4f45
            var worldView = api.getWorldView(0);
        var armyindex = model.armyIndex();
        var PlayerArmys = [];
        if (typeof armyindex == "undefined"){
<<<<<<< HEAD
          armyindex = model.armyId() //wtf, why is it here idk
=======

          armyindex = model.armyId()
>>>>>>> ee7fb70969c5c6d605ccb1af17f0e7997dac4f45
        }
        PlayerArmys.push([]);
        }
        var myi = 0;
        
<<<<<<< HEAD
        for(var planetid = 0;planetid<planetnum;planetid++){//for each planet for my current player get his units type and ids
=======
        for(var planetid = 0;planetid<planetnum;planetid++){
>>>>>>> ee7fb70969c5c6d605ccb1af17f0e7997dac4f45
          PlayerArmys[0][planetid] = worldView.getArmyUnits(armyindex,planetid).then(
          function(){
            var myData = this;
            myData2[myi] = JSON.stringify(myData["result"]);
<<<<<<< HEAD
=======

            var dictionary = JSON.parse(myData2[myi]); // Assuming myData2 is a properly formatted JSON string
            //console.log(dictionary);

            for (var key in dictionary) {
              // Ensure the key actually belongs to the dictionary object
              if (dictionary.hasOwnProperty(key)) {
                // Concatenate the array of IDs associated with the current key to the global allIds array
                allIds = allIds.concat(dictionary[key]);
              }
            }
            //console.log(allIds);
            /*var unitState = worldView.getUnitState(allIds).then(function(result) {
                    //console.log(result);
            });*/

>>>>>>> ee7fb70969c5c6d605ccb1af17f0e7997dac4f45
            myi +=1;
          });
        }
        myi = 0;      
    }
    automation();
    console.log("SENDING DATA");
<<<<<<< HEAD

=======
    /*function test(){
      console.log("test");
      blost = model.metalLost();
      bdestroy = model.enemyMetalDestroyed();
    };
    // Your existing code
    //blost = model.metalLost();
    //bdestroy = model.enemyMetalDestroyed();

    var metallost = []
    var metaldestroy = []

    _.delay(test, 3000);
    destroy = model.enemyMetalDestroyed() - bdestroy;
    lost = model.metalLost() - blost;

    // Check if lost is zero and handle it
    if (lost === 0) {
        lost = 1; // Assign a default value to avoid division by zero
    }

    console.log(typeof lost);
    console.log(typeof destroy);

    ratioCombat = destroy / lost;
    console.log(ratioCombat, model.metalLost(), blost);*/
    processIdsInChunks(allIds);
    //console.log(allIds);
    allIds = [];

    //console.log(api.camera.getFocus(1).location());
>>>>>>> ee7fb70969c5c6d605ccb1af17f0e7997dac4f45
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
<<<<<<< HEAD
    var unb_get = false;

    if(myData2){//idk why, if there is data ??
=======


    //console.log(myData2);
    var unb_get = false;
    if(myData2){
>>>>>>> ee7fb70969c5c6d605ccb1af17f0e7997dac4f45
      unb_get = myData2;
    }
    else{
      unb_get = false;
    }
<<<<<<< HEAD
    if(model.gameOptions.isGalaticWar()){// create random lobby id for galactic war
      lobby_id = (Math.floor(Math.random() * 100000000000000000000)).toFixed().toString() + (Math.floor(Math.random() * 1000000000000)).toFixed().toString();
    }
=======
    if(model.gameOptions.isGalaticWar()){
      lobby_id = (Math.floor(Math.random() * 100000000000000000000)).toFixed().toString() + (Math.floor(Math.random() * 1000000000000)).toFixed().toString();
    }
    // api.getWorldView(0).getUnitState(19691) pour avoir chaque POS orientation et vel
    //api.camera.getFocus(1).zoomLevel()
    //api.camera.getFocus(1).location()
>>>>>>> ee7fb70969c5c6d605ccb1af17f0e7997dac4f45

    // NEED THIS pour playerlist name model.playerListState();
    pnamelist = [];
    var test = model.playerListState();
    for(var i = 0; i < test["players"].length;i++){
      for(var j = 0; j < test["players"][i]["slots"].length;j++){
        pnamelist.push([test["players"][i]["slots"][j].replace("'", "`").replace("\"", "`") , test["players"][i]["primary_color"]])
      }
    }
<<<<<<< HEAD
    
=======
    //console.log(pnamelist);
    //console.log(unb_get);
    //console.log(toUTCStringAlternative());
    //var camera_planet = api.camera.getFocus(1).planet();
    //var camera_location = api.camera.getFocus(1)["location"];
    //camera_data = {camera_planet : camera_location};
    console.log("teub", Testme);
>>>>>>> ee7fb70969c5c6d605ccb1af17f0e7997dac4f45
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
<<<<<<< HEAD
      time_in_seconds: Math.floor(TimeInSeconds),
      unb_data: unb_get,
=======
      time_in_seconds: TimeInSeconds,
      unb_data: unb_get,
      unb_state_data : myunitstateids,
>>>>>>> ee7fb70969c5c6d605ccb1af17f0e7997dac4f45
      is_galacticwar: model.gameOptions.isGalaticWar(), // yes game has a typo error it's galatic and not galactic
      is_ladder1v1: model.gameOptions.isLadder1v1(),
      is_land_anywhere: model.gameOptions.land_anywhere(),
      is_listen_to_spectators: model.gameOptions.listenToSpectators(),
      is_sandbox: model.gameOptions.sandbox(),
      is_dynamic_alliances: model.gameOptions.dynamic_alliances(),
      dynamic_alliance_victory: model.gameOptions.dynamic_alliance_victory(),
      game_type: model.gameOptions.game_type(),
<<<<<<< HEAD
      is_AI_game: model.noHumanPlayers(),
      player_list: pnamelist,
    };
    console.log("DEV DEBUG : ", report);
    var report_string = JSON.stringify(report);

=======
      player_list: pnamelist,
      camera_alldata: camera_coords,
    };
    //console.log("report", report);
    var report_string = JSON.stringify(report);
    camera_coords = [];
    myunitstateids = [];
    //console.log(report_string)

    /*
    
    model.paused()
    model.isSpectator()     // playerWasAlwaysSpectating() playerwasinteam()
    model.showLanding()
    

    */
>>>>>>> ee7fb70969c5c6d605ccb1af17f0e7997dac4f45
    if(!(model.paused()) && !(model.isSpectator()) && !(model.showLanding())){
      console.log("WOWBRO");
      //$.post(url, report_string);
      //$.post("http://192.168.0.13:8000/pastats/paview", report_string);
<<<<<<< HEAD
=======
      //$.post("http://192.168.1.119:8000/pastats/paview", report_string);
      //$.post("http://192.168.32.1:8000/pastats/paview", report_string);
      //$.post("http://127.0.0.1:5000/anycontent", report_string);
>>>>>>> ee7fb70969c5c6d605ccb1af17f0e7997dac4f45
    }

    //console.log("YO TEST VICTORS", GameOverData[1], gameover_sent, !_.isEmpty(GameOverData[1]), gameover_sent<7, !(model.isSpectator()));
    if((!_.isEmpty(GameOverData[1])) && gameover_sent<7 && model.isSpectator()){
<<<<<<< HEAD
      gameover_sent +=1;
      //$.post(url, report_string);
      //$.post("http://192.168.0.13:8000/pastats/paview", report_string);
    }
    
=======
      console.log("euh OK");
      gameover_sent +=1;
      //$.post(url, report_string);
      //$.post("http://192.168.0.13:8000/pastats/paview", report_string);
      //$.post("http://192.168.1.119:8000/pastats/paview", report_string); 
      //$.post("http://192.168.32.1:8000/pastats/paview", report_string);
      //$.post("http://127.0.0.1:5000/anycontent", report_string);
    }
    
    //console.log(report_string);

    //var params = 'orem='+myData3;
    //xhr.open('POST', url, true);
    //xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    //xhr.send(params);


    
>>>>>>> ee7fb70969c5c6d605ccb1af17f0e7997dac4f45

        _.delay(dowhile, 5000);
  }
  dowhile();
})();


<<<<<<< HEAD
// from flubb's superstats mod, same code as him for apm
self.apmCounter = setInterval(function () {
=======
// from flubb's superstats mod, same code as him for apm :)

self.apmCounter = setInterval(function () {
  

>>>>>>> ee7fb70969c5c6d605ccb1af17f0e7997dac4f45
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
<<<<<<< HEAD
=======
    //console.log("APM : ", myapm);
    //console.log("kp: ", keypressed);

>>>>>>> ee7fb70969c5c6d605ccb1af17f0e7997dac4f45

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

<<<<<<< HEAD
=======

>>>>>>> ee7fb70969c5c6d605ccb1af17f0e7997dac4f45
$(document).ready(this.init)


handlers.EcoDataAll = function(payload){
  EcoData = payload;
  var metalWinRate = model.enemyMetalDestroyed();
  var metalLossRate = model.metalLost();

<<<<<<< HEAD
  //energyProduced.push(energyProduced[energyProduced.length - 1] + EcoData[0]);
  //metalProduced.push(metalProduced[metalProduced.length - 1] + EcoData[6]);

=======
>>>>>>> ee7fb70969c5c6d605ccb1af17f0e7997dac4f45
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

