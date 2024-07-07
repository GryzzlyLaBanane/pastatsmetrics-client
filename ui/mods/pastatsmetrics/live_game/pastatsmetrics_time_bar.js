//recup time en sec et en string
function SendTimeData(){
  var TimeData = model.currentTimeInSeconds();


  api.Panel.message(api.Panel.parentId, "TimeData", [TimeData])
  return
}

(function (){
  setInterval(SendTimeData, 200);
})();
