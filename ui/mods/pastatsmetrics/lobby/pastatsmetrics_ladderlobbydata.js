// ce fichier est ridicule on ne peut register une ranked que in game, rien de spécial dans le lobby e nfait
//fichier qui doit etre delete et juste on le garde là pour pouvoir resetup un lobby une fois IG
//console.log("hello");
//var my_lobbyid = "";
model.my_lobbyid = ko.observable(-1).extend({ session: 'lobbyId' });
//model.lobbyId(my_lobbyid);
//console.log("hello2");
function SendList(){

  var player_list = {};
  for(var i = 0; i<model.armies().length;i++){
      for(var j = 0; j< model.armies()[i].slots().length;j++){
        if(model.armies()[i].slots()[j].isPlayer()){
          player_list[model.armies()[i].slots()[j].playerName()] = model.armies()[i].slots()[j].playerId();
        }
    }
  }
  var isRanked = true;
  
  if(model.startingGameCountdown() == 5){
    // no lobbyid in lobby for ranked so gotta make one fake for regsitering the game and then replacing with the real one
    var my_id = (Math.floor(Math.random() * 100000000000000000000)).toFixed().toString() + (Math.floor(Math.random() * 1000000000000)).toFixed().toString();
    
    var nowUTC = new Date().toISOString();
    var dateUTC = nowUTC.slice(0, 10) + ' ' + nowUTC.slice(11, 16); //day hourminutes in UTC
    var my_id = JSON.stringify(player_list) + dateUTC
    console.log("avant")
    if(isRanked){
      model.my_lobbyid(my_id);
    }
    //console.log(model.my_lobbyid());
    console.log("Gryz stats SENDATA");
    var ip = "192.168.32.1"
    var url = "http://pastatsmetrics.com/pastats/paview" //"http://"+ ip + ":8000/main_isyw/paview";

    /*if(model.gameName().length > 0){
      game_name = model.gameName();
    }
    else{
      game_name = "None";
    }*/
    var report = {
      is_lobby_data: true,
      lobby_id: model.my_lobbyid(),
      game_name: "1v1 Ranked",
      is_Local: false,
      is_Public: true,
      is_FriendsOnly: false,
      is_Hidden: false,
      is_Titan: model.isTitansGame(),
      user_name: "None",
      server_mods: [],
      player_list: JSON.stringify(player_list),
      planets_biomes: model.planetBiomes(),
      uber_id: model.uberId(), 
      //model.teamCount()
    };
    //console.log("lobbyrepport", report);
    var report_string = JSON.stringify(report);



    //console.log(report_string);
    //$.post(url, report_string);
    $.post("http://192.168.32.1:8000/pastats/paview", report_string);
    //$.post("http://192.168.1.103:8000/pastats/paview", report_string);
    //$.post("http://172.20.10.6:8000/pastats/paview", report_string);
    $.post("http://192.168.1.119:8000/pastats/paview", report_string);
  }
  return
}

(function (){
  setInterval(SendList, 1000);
})();
