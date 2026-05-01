/**
 * PaStats Metrics - Game Over Handler
 * Runs in the game_over scene (child panel overlaying live_game)
 * Sends game state and victory data to parent panel (gamedata.js)
 * Adds a "PA STATS METRICS" button to the game over screen
 * ES5 Compatible for Planetary Annihilation
 *
 * @author MarechalGryzzly
 * @version 3.0
 */

(function () {
  "use strict";

  var PREFIX = "[PAStats:GameOver]";
  var CONFIG = {
    COLLECT_INTERVAL_MS: 1000,
    STATS_BASE_URL: "https://pastatsmetrics.com/pastats/charts=",
  };

  function log(msg) {
    console.log(PREFIX + " " + msg);
  }

  // ==================== GAME OVER DATA COLLECTION ====================

  /**
   * Collect game state and victory data, send to parent panel
   * Runs every second so gamedata.js can include it in game data sends
   */
  function collectAndSendGameOverData() {
    var gameState = null;
    var victoryData = null;

    try {
      gameState = model.state();
    } catch (e) {}

    try {
      victoryData = model.victors();
    } catch (e) {}

    api.Panel.message(api.Panel.parentId, "TheGameOverData", [
      gameState,
      victoryData,
    ]);
  }

  // ==================== UI: STATS BUTTON ====================

  /**
   * Add "PA STATS METRICS" button to the game over screen
   * Opens the stats page for the current game in the user's browser
   */
  function addStatsButton() {
    var lobbyId = localStorage.lobbyId;

    // Validate lobby ID
    if (!lobbyId || lobbyId === "-1" || lobbyId === "undefined" || lobbyId === "null") {
      return;
    }

    var statsUrl = CONFIG.STATS_BASE_URL + lobbyId;

    model.goToPaStats = function () {
      engine.call("web.launchPage", statsUrl);
    };

    // Insert button before the REVIEW button
    // FIX: removed "visible:superStatsReported" binding that referenced
    // a non-existent observable, causing the button to be invisible
    var buttonHtml =
      '<div style="margin-bottom: 5px;">' +
      '<input type="button" value="PA STATS METRICS" ' +
      'data-bind="click: goToPaStats" ' +
      'style="font-weight: bold;" />' +
      "</div>";

    var reviewButton = $('input[value="REVIEW"]');
    if (reviewButton.length > 0) {
      reviewButton.parent().before(buttonHtml);
      // Apply Knockout bindings to the new element
      try {
        var newElement = reviewButton.parent().prev()[0];
        ko.applyBindings(model, newElement);
      } catch (e) {}
    }
  }

  // ==================== INITIALIZATION ====================

  setInterval(collectAndSendGameOverData, CONFIG.COLLECT_INTERVAL_MS);
  addStatsButton();
})();
