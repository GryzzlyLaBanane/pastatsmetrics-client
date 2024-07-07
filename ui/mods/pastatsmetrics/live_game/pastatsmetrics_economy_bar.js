/*


Toute les fonction ont des équivalents String
model.energyGain (y a aussi avec GainString) ==> le gain net
model.energyLoss ==> la conso net
model.energyNet ==> prod net
model.energyEfficiencyPerc ça c'est le pourcentage prod/conso si 1 alors 100% si 5.55 alors le rapport vaut 555% en pourcent :)
model.currentEnergy ==> valeur du déprotomax
model.maxEnergy ==> max du depot

tout pareil avec model.metal


*/
// var Energy_Gain = (function(){
//   var r = model.energyGain();
//   return r;
// })();

function SendEco(){
  var EnergyGain = model.energyGain()
  var EnergyLoss = model.energyLoss()
  var EnergyNet = model.energyNet()
  var EnergyEfficiencyPerc = model.energyEfficiencyPerc()
  var EnergyCurrentEnergy = model.currentEnergy()
  var EnergyMaxEnergy = model.maxEnergy()

  var MetalGain = model.metalGain()
  var MetalLoss = model.metalLoss()
  var MetalNet = model.metalNet()
  var MetalEfficiencyPerc = model.metalEfficiencyPerc()
  var MetalCurrentMetal = model.currentMetal()
  var MetalMaxMetal = model.maxMetal()

  api.Panel.message(api.Panel.parentId, "EcoDataAll", [EnergyGain, EnergyLoss, EnergyNet, EnergyEfficiencyPerc, EnergyCurrentEnergy, EnergyMaxEnergy, MetalGain, MetalLoss, MetalNet, MetalEfficiencyPerc, MetalCurrentMetal, MetalMaxMetal])
  return
}

(function (){
  setInterval(SendEco, 1000);
})();
