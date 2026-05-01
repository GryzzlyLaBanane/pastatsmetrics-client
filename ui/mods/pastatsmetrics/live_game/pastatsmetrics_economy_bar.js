/**
 * PaStats Metrics - Economy Data Collector
 * Runs in the live_game_econ scene (child panel of live_game)
 * Collects energy and metal statistics every second
 * Sends data to parent panel (gamedata.js) via Panel message
 * ES5 Compatible for Planetary Annihilation
 *
 * Data array format (12 fields, order matters for backend):
 *   [0]  energyGain        [6]  metalGain
 *   [1]  energyLoss        [7]  metalLoss
 *   [2]  energyNet         [8]  metalNet
 *   [3]  energyEfficiency%  [9]  metalEfficiency%
 *   [4]  energyCurrent     [10] metalCurrent
 *   [5]  energyMax         [11] metalMax
 *
 * The parent handler (gamedata.js) enriches this with 2 more fields:
 *   [12] enemyMetalDestroyed (win rate)
 *   [13] metalLost (loss rate)
 *
 * @author MarechalGryzzly
 * @version 3.0
 */

(function () {
  "use strict";

  var PREFIX = "[PAStats:Econ]";
  var COLLECT_INTERVAL_MS = 1000;

  function log(msg) {
    console.log(PREFIX + " " + msg);
  }

  /**
   * Safely read a number from a model observable
   * @param {Function} fn - Function returning the value
   * @param {number} fallback - Default if read fails
   * @returns {number}
   */
  function safeNumber(fn, fallback) {
    try {
      var val = Number(fn());
      return isNaN(val) ? fallback : val;
    } catch (e) {
      return fallback;
    }
  }

  /**
   * Collect economy data and send to parent panel
   */
  /**
   * Clamp efficiency ratio to [0, 1] range
   * Game engine can return >1 (over-producing) or <0 (stalled)
   * @param {number} val - Raw efficiency ratio from engine
   * @returns {number} Clamped between 0 and 1
   */
  function clampEfficiency(val) {
    return Math.max(0, Math.min(1, val));
  }

  function collectAndSend() {
    var data = [
      // Energy (indices 0-5)
      safeNumber(function () { return model.energyGain(); }, 0),
      safeNumber(function () { return model.energyLoss(); }, 0),
      safeNumber(function () { return model.energyNet(); }, 0),
      clampEfficiency(safeNumber(function () { return model.energyEfficiencyPerc(); }, 0)),
      safeNumber(function () { return model.currentEnergy(); }, 0),
      safeNumber(function () { return model.maxEnergy(); }, 0),
      // Metal (indices 6-11)
      safeNumber(function () { return model.metalGain(); }, 0),
      safeNumber(function () { return model.metalLoss(); }, 0),
      safeNumber(function () { return model.metalNet(); }, 0),
      clampEfficiency(safeNumber(function () { return model.metalEfficiencyPerc(); }, 0)),
      safeNumber(function () { return model.currentMetal(); }, 0),
      safeNumber(function () { return model.maxMetal(); }, 0),
    ];

    api.Panel.message(api.Panel.parentId, "EcoDataAll", data);
  }

  // ==================== INITIALIZATION ====================

  setInterval(collectAndSend, COLLECT_INTERVAL_MS);
})();
