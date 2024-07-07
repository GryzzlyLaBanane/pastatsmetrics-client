function SendGameOver(){
  var StateGameOver = model.state();
  var VictorsPlayers = model.victors();

  api.Panel.message(api.Panel.parentId, "TheGameOverData", [StateGameOver, VictorsPlayers]);
  return
}

(function (){
  setInterval(SendGameOver, 1000);
})();



lobby_id = localStorage.lobbyId;

function superStatsReported(){};
(function () {
  model.goToSuperStats = function () {
    engine.call('web.launchPage', 'https://pastatsmetrics.com/pastats/charts=' + lobby_id);
  };
  $('input[value="REVIEW"]').parent().before('<div data-bind="visible:superStatsReported"><input type="button" value="PA STATS METRICS" data-bind="click:goToSuperStats" /></div>');
})();