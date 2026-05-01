/**
 * PaStats Metrics - Time Data Collector
 * Runs in the live_game_time_bar scene (child panel of live_game)
 * Sends current game time to parent panel (gamedata.js) via Panel message
 * ES5 Compatible for Planetary Annihilation
 *
 * @author MarechalGryzzly
 * @version 3.0
 */

(function () {
  "use strict";

  var PREFIX = "[PAStats:Time]";
  // 1 second is sufficient - game data is only sent every 5 seconds anyway
  var COLLECT_INTERVAL_MS = 1000;

  function log(msg) {
    console.log(PREFIX + " " + msg);
  }

  /**
   * Read and send current game time to parent panel
   */
  function collectAndSend() {
    var seconds = 0;
    try {
      seconds = model.currentTimeInSeconds();
      if (typeof seconds !== "number" || isNaN(seconds)) {
        seconds = 0;
      }
    } catch (e) {
      // Game time not available yet (e.g., before commander lands)
    }

    api.Panel.message(api.Panel.parentId, "TimeData", seconds);
  }

  // ==================== INITIALIZATION ====================

  log("Time data collection initialized (interval: " + COLLECT_INTERVAL_MS + "ms)");
  setInterval(collectAndSend, COLLECT_INTERVAL_MS);
})();
