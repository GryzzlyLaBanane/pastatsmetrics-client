// BS so the lobbyid stay the same over scenes, no idea why i coded this way, probably because it works
var my_lobbyid = model.lobbyId();
model.lobbyId = ko.observable(-1).extend({ session: 'lobbyId' });
model.lobbyId(my_lobbyid);
localStorage.lobbyId = model.lobbyId();

function SendList(){
  // some code i might have copied somewhere or someone told me how to do this, it's the getPlayerList
  var player_list = {};
  for(var i = 0; i<model.armies().length;i++){
      for(var j = 0; j< model.armies()[i].slots().length;j++){
        if(model.armies()[i].slots()[j].isPlayer()){
          player_list[model.armies()[i].slots()[j].playerName()] = model.armies()[i].slots()[j].playerId();
        }
    }
  }

  //for once, a normal a cute piece of code anyone can understand
  server_mods = model.serverMods();
  isFFA = model.isFFAGame();
  isTeamGame = model.isTeamGame();
  isLocal = model.isLocalGame();
  isPublic = model.isPublicGame();
  isFriendsOnly = model.isFriendsOnlyGame();
  isHidden = model.isHiddenGame();
  isTitan = model.isTitansGame();
  username = model.username();
  is_sandbox= model.sandbox();

  // im not sure but i think separator is comma and since mods can have comma then comma is a bad separator so i add one manually myself that is unlikely to get used
  var custom_server_mods_list = ""
  for(var i = 0;i<Object.keys(server_mods).length; i++){
     custom_server_mods_list += ":::" + server_mods[i]["display_name"];
  }

  //setup var for later
  var current_player_is_spectating = false;

  //counter for debugger
  console.log("pastatsmetrics counter", model.startingGameCountdown());
  if(model.startingGameCountdown() != 5){ //==5

    var nowUTC = new Date().toISOString().replace('T', ' ').replace(/\..+/, '') + ' UTC';
    //var dateUTC = nowUTC.slice(0, 10) + ' ' + nowUTC.slice(11, 16); //day hourminutes in UTC
    var my_id = JSON.stringify(player_list) + nowUTC // the lobbyid in the Database is gonna be the sha 256 of this string, the playerlist can be reversed for 2 different player, need to check
    console.log(nowUTC);
    if(isLocal){
      model.lobbyId(my_id);
      localStorage.lobbyId = model.lobbyId();
    }
    console.log("pastatsmetrics is SENDING DATA");
    var ip = "192.168.0.13";
    var url = "http://pastatsmetrics.com/pastats/paview"; //"http://"+ ip + ":8000/main_isyw/paview";

    // setup a default gameName if empty
    if(model.gameName()){
      game_name_v = model.gameName();
    }
    else{
      game_name_v = "None";
    }
    var report = {
      is_lobby_data: true, // used by the server to know if it's lobbydata or livegame data, i could just do 2 different receiving endpath for clarity 
      lobby_id: model.lobbyId(),
      game_name: game_name_v,
      is_Local: model.isLocalGame(),
      is_Public: model.isPublicGame(),
      is_FriendsOnly: model.isFriendsOnlyGame(),
      is_Hidden: model.isHiddenGame(),
      is_Titan: model.isTitansGame(),
      is_Ranked: false,
      user_name: model.username(), // not sure if this one is always accurate, PA has bugs, supposed to be steam name
      server_mods: custom_server_mods_list,
      player_list: JSON.stringify(player_list),
      planets_biomes: model.planetBiomes(),
      uber_id: model.uberId(),
      the_date: nowUTC,
    };
    var report_string = JSON.stringify(report); // data send as a string containing a JSON
  

    
    console.log("WHAT IS SEND", report);
    var ls_specs = model.spectators();
    var uberid = model.uberId();

    for(var i = 0; i< ls_specs.length;i++){
      if(ls_specs[i]["id"] == uberid){ // IF CURRENT PLAYER IS IN SPEC when the game starts
        current_player_is_spectating = true;
      }
    }

    if(!current_player_is_spectating){ // IF NOT then we can send the lobbydata
      console.log("before sending data");
      //$.post(url, report_string);
      //$.post("http://192.168.1.103:8000/pastats/paview", report_string);
      //$.post("http://192.168.1.119:8000/pastats/paview", report_string);
      //$.post("http://192.168.32.1:8000/pastats/paview", report_string);
      console.log("after sending data");
    }
  }
  return
}

(function (){
  setInterval(SendList, 1000);
})();



