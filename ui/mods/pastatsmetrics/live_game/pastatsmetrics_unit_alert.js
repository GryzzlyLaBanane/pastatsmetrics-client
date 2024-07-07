handlers.army_defeated = function(payload){
  model.processArmyDefeated(payload);
  api.Panel.message(api.Panel.parentId, "comKillData", payload)
}

//handlers.army_data = function(payload){
  //model.processPlayerData(payload);
  //api.Panel.message(api.Panel.parentId, "playerData", payload)
//}

