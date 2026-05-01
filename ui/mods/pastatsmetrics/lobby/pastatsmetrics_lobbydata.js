/**
 * PaStats Metrics - Lobby Data Collector
 * Collects lobby information when game countdown starts (new_game scene)
 * Sends lobby metadata to backend servers
 * ES5 Compatible for Planetary Annihilation
 *
 * @author MarechalGryzzly
 * @version 3.0
 */

(function () {
  "use strict";

  // ==================== CONFIGURATION ====================

  var CONFIG = {
    VERSION: "3.0",
    DEBUG: false, // true = send to local + verbose logs, false = prod only
    PROD_URL: "https://pastatsmetrics.com/pastats/api/",
    LOCAL_URL: "http://127.0.0.1:8000/pastats/api/",
    LOBBY_ENDPOINT: "lobbydata",
    CHECK_INTERVAL_MS: 1000,
    COUNTDOWN_TRIGGER: 5,
  };

  var PREFIX = "[PAStats:Lobby]";
  var lobbySent = false;
  var checkIntervalId = null;
  var anonymousCounter = 0;

  // ==================== PLAYER IDENTITY COLLECTION ====================
  // Cache setup info early (async) so it's ready by countdown

  var _cachedSetupInfo = null;
  try {
    api.game.getSetupInfo().then(function (info) {
      _cachedSetupInfo = info;
      log("Setup info cached: discord=" + (info.discord_id || "n/a") + " gpu=" + (info.opengl_renderer || "n/a"));
    });
  } catch (e) {
    log("getSetupInfo not available: " + e);
  }

  // ==================== LOBBY ID PERSISTENCE ====================
  // Preserve lobby ID across scenes via Knockout session extender
  // The live_game scene reads this value to associate game data with the lobby

  var originalLobbyId = model.lobbyId();
  model.lobbyId = ko.observable(-1).extend({ session: "lobbyId" });
  model.lobbyId(originalLobbyId);
  localStorage.lobbyId = model.lobbyId();

  // ==================== LOGGING ====================

  function log(msg) {
    console.log(PREFIX + " " + msg);
  }

  function logData(label, data) {
    console.log(PREFIX + " " + label + ": " + JSON.stringify(data));
  }

  // ==================== UTILITY FUNCTIONS ====================

  /**
   * Generate UTC timestamp string
   * @returns {string} "YYYY-MM-DD HH:MM:SS UTC"
   */
  function getUTCTimestamp() {
    return (
      new Date().toISOString().replace("T", " ").replace(/\..+/, "") + " UTC"
    );
  }

  /**
   * Generate a 64-bit effective hash by running two independent 32-bit FNV-1a
   * passes with different seeds and concatenating them. Gives ~64 bits of
   * collision resistance without requiring BigInt (which may not be supported
   * in older Coherent GT webviews).
   *
   * Output: 16 hex chars (always zero-padded).
   *
   * @param {string} str - Input string
   * @returns {string} 16-char hex hash
   */
  function generateFNVHash(str) {
    var h1 = 2166136261;      // FNV offset basis
    var h2 = 0xdeadbeef;      // alternate seed for the 2nd hash
    var prime = 16777619;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      h1 = ((h1 ^ c) * prime) >>> 0;
      h2 = ((h2 ^ c) * prime) >>> 0;
    }
    var hex1 = ("00000000" + h1.toString(16)).slice(-8);
    var hex2 = ("00000000" + h2.toString(16)).slice(-8);
    return hex1 + hex2;
  }

  /**
   * Round a UTC timestamp string ("YYYY-MM-DD HH:MM:SS UTC") down to the
   * nearest 5-minute bucket. Tolerates clock skew up to a few minutes between
   * players in the same local/custom game.
   *
   * @param {string} utcStr
   * @returns {string} "YYYY-MM-DD HH:MM" (always on 00/05/10/.../55)
   */
  function roundTo5MinBucket(utcStr) {
    var iso = String(utcStr).replace(" UTC", "Z").replace(" ", "T");
    var d = new Date(iso);
    if (isNaN(d.getTime())) {
      // Parsing failed — fall back to minute-level bucketing
      return String(utcStr).substring(0, 16);
    }
    var bucketMs = Math.floor(d.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000);
    var rd = new Date(bucketMs);
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    return rd.getUTCFullYear() + "-" + pad(rd.getUTCMonth() + 1) + "-" + pad(rd.getUTCDate())
      + " " + pad(rd.getUTCHours()) + ":" + pad(rd.getUTCMinutes());
  }

  /**
   * Sanitize a player name: handles null, undefined, empty strings
   * Does NOT strip special characters - JSON.stringify handles encoding
   * @param {*} rawName - Raw name from the game API
   * @returns {string} Safe, non-empty player name
   */
  function sanitizePlayerName(rawName) {
    if (rawName === null || rawName === undefined) {
      anonymousCounter++;
      return "Unknown_Player_" + anonymousCounter;
    }
    var name = String(rawName);
    if (name.trim() === "") {
      anonymousCounter++;
      return "Unknown_Player_" + anonymousCounter;
    }
    return name;
  }

  // ==================== DATA BUILDERS ====================

  /**
   * Build player list from lobby armies
   * Includes both human players AND AI players
   * Format: { "playerName": [playerId, armyIndex, color], ... }
   * - playerId: uber_id for humans, "AI_0", "AI_1" etc for AI
   * - armyIndex: army index from armies array (reliable mapping)
   * - color: primary_color [r,g,b] from army
   * @returns {Object} Player list keyed by name
   */
  function buildPlayerList() {
    var playerList = {};
    var armies;
    var aiCounter = 0;

    try {
      armies = model.armies();
    } catch (e) {
      return playerList;
    }

    for (var i = 0; i < armies.length; i++) {
      var slots;
      try {
        slots = armies[i].slots();
      } catch (e) {
        continue;
      }

      // Try to get army color
      var armyColor = [128, 128, 128];
      try {
        var c = armies[i].color();
        if (c) armyColor = c;
      } catch (e) {
        try {
          var c2 = armies[i].primary_color;
          if (c2) armyColor = c2;
        } catch (e2) {}
      }

      for (var j = 0; j < slots.length; j++) {
        try {
          var rawName, playerId, safeName;

          if (slots[j].isPlayer()) {
            rawName = slots[j].playerName();
            playerId = slots[j].playerId();
            safeName = sanitizePlayerName(rawName);
            playerList[safeName] = [playerId, i, armyColor];
          } else {
            // AI player
            rawName = slots[j].playerName ? slots[j].playerName() : null;
            safeName = rawName ? sanitizePlayerName(rawName) : ("AI_Player_" + aiCounter);
            playerId = "AI_" + aiCounter;
            aiCounter++;
            playerList[safeName] = [playerId, i, armyColor];
          }
        } catch (e) {}
      }
    }

    var count = Object.keys(playerList).length;
    return playerList;
  }

  /**
   * Build formatted server mods list
   * Uses ::: separator to avoid comma conflicts in mod names
   * @returns {string} Formatted server mods string
   */
  function buildServerModsList() {
    var serverMods;
    try {
      serverMods = model.serverMods();
    } catch (e) {
      return "No server mods";
    }

    if (!serverMods || !serverMods.length) {
      return "No server mods";
    }

    var modsList = "";
    for (var i = 0; i < serverMods.length; i++) {
      var displayName =
        serverMods[i] && serverMods[i].display_name
          ? serverMods[i].display_name
          : "unknown_mod";
      modsList += ":::" + displayName;
    }

    return modsList || "No server mods";
  }

  /**
   * Check if current player is spectating
   * @returns {boolean}
   */
  function isCurrentPlayerSpectating() {
    try {
      var spectators = model.spectators();
      var currentUberId = model.uberId();

      for (var i = 0; i < spectators.length; i++) {
        if (spectators[i].id === currentUberId) {
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  // ==================== HTTP SENDER ====================

  /**
   * Send data to backend servers with proper Content-Type
   * Logs the full payload for debugging without backend
   * @param {string} endpoint - API endpoint name
   * @param {Object} payload - Data object to send
   */
  function sendToServers(endpoint, payload) {
    var jsonString = JSON.stringify(payload);
    var url = CONFIG.PROD_URL + endpoint;

    $.ajax({
      type: "POST",
      url: url,
      data: jsonString,
      contentType: "application/json; charset=utf-8",
      success: function () {
        log("Sent " + endpoint + " to PROD (" + jsonString.length + "b)");
      },
      error: function (xhr, status) {
        log("ERROR sending " + endpoint + " to PROD: " + status);
      },
    });

    if (CONFIG.DEBUG) {
      var localUrl = CONFIG.LOCAL_URL + endpoint;
      $.ajax({
        type: "POST",
        url: localUrl,
        data: jsonString,
        contentType: "application/json; charset=utf-8",
        error: function (xhr, status) {
          log("ERROR sending " + endpoint + " to LOCAL: " + status);
        },
      });
    }
  }

  // ==================== MAIN LOBBY DATA COLLECTION ====================

  /**
   * Main function: collect and send lobby data
   * Triggers once when countdown reaches COUNTDOWN_TRIGGER, then stops polling
   */
  function collectAndSendLobbyData() {
    // Only trigger when game countdown starts
    try {
      if (model.startingGameCountdown() !== CONFIG.COUNTDOWN_TRIGGER) {
        return;
      }
    } catch (e) {
      return;
    }

    if (lobbySent) {
      return;
    }

    if (isCurrentPlayerSpectating()) {
      lobbySent = true;
      clearInterval(checkIntervalId);
      return;
    }

    // Build all data
    var playerList = buildPlayerList();
    var gameStartTime = getUTCTimestamp();
    var serverModsList = buildServerModsList();

    // Safely read game properties (moved earlier — gameName is part of the lobby_id hash)
    var gameName = "None";
    try {
      gameName = model.gameName() || "None";
    } catch (e) {}

    // Resolve lobby ID
    var lobbyId = model.lobbyId();
    var isLocal = false;
    var isCustomServer = false;

    try {
      isLocal = model.isLocalGame();
    } catch (e) {}
    try {
      isCustomServer = model.serverType() === "custom";
    } catch (e) {}

    // Local/custom games don't have server-assigned lobby IDs.
    // Generate a deterministic ID that will be the SAME for all players:
    //   - Sort player names alphabetically (order-independent)
    //   - Include system name (same for all players in the lobby)
    //   - Include gameName (extra discriminator for named custom lobbies — rematches)
    //   - Round timestamp to the nearest 5-minute bucket (tolerates clock skew
    //     between players; no more false-negatives when one PC is 30s off)
    // The final id is prefixed ("local_" / "custom_") so it can NEVER collide
    // with server-assigned numeric Uber lobby IDs. 16-char hex hash gives ~64-bit
    // collision resistance (≈ 2^32 games before birthday collision → effectively never).
    if (isLocal || isCustomServer) {
      var sortedNames = Object.keys(playerList).sort().join("|");
      var systemName = "";
      try { systemName = model.system().name() || ""; } catch (e) {}
      var timeBucket = roundTo5MinBucket(gameStartTime);
      var hashInput =
        sortedNames + ":" +
        systemName + ":" +
        gameName + ":" +
        timeBucket;
      var prefix = isLocal ? "local_" : "custom_";
      lobbyId = prefix + generateFNVHash(hashInput);
    }

    model.lobbyId(lobbyId);
    localStorage.lobbyId = lobbyId;

    var isPublic = false,
      isFriendsOnly = false,
      isHidden = false,
      isTitan = false;
    try {
      isPublic = model.isPublicGame();
    } catch (e) {}
    try {
      isFriendsOnly = model.isFriendsOnlyGame();
    } catch (e) {}
    try {
      isHidden = model.isHiddenGame();
    } catch (e) {}
    try {
      isTitan = model.isTitansGame();
    } catch (e) {}

    // Bounty mode: captured from the lobby options (new_game scene).
    // bountyMode is a boolean, bountyValue is a float (e.g. 0.2 = 20%).
    var bountyMode = false;
    var bountyValue = 0;
    try {
      bountyMode = model.bountyMode() || false;
    } catch (e) {}
    try {
      bountyValue = model.bountyValue() || 0;
    } catch (e) {}

    var planetBiomes = [];
    try {
      planetBiomes = model.planetBiomes();
    } catch (e) {}

    var gameMode = "";
    try {
      gameMode = model.gameOptions.game_type() || "";
    } catch (e) {}

    var uberId = "";
    try {
      uberId = model.uberId() || "";
    } catch (e) {}

    var userName = "None";
    try {
      userName = model.username() || "None";
    } catch (e) {}

    // Collect Steam identity (synchronous global)
    var steamId = "";
    var steamPersonaName = "";
    var ownedContent = [];
    try {
      if (typeof gEngineParams !== "undefined" && gEngineParams.steam) {
        steamId = gEngineParams.steam.steamid || "";
        steamPersonaName = gEngineParams.steam.persona_name || "";
        ownedContent = gEngineParams.steam.owned_content || [];
      }
    } catch (e) {
      log("Could not read gEngineParams.steam: " + e);
    }

    // Collect setup info (from cached async call)
    var discordId = "";
    var discordUsername = "";
    var gpuName = "";
    var cpuCores = 0;
    var osName = "";
    var memoryMb = 0;
    var paBuild = "";
    if (_cachedSetupInfo) {
      discordId = _cachedSetupInfo.discord_id || "";
      discordUsername = _cachedSetupInfo.discord_username || "";
      gpuName = _cachedSetupInfo.opengl_renderer || "";
      cpuCores = _cachedSetupInfo.cores || 0;
      osName = _cachedSetupInfo.os || "";
      memoryMb = _cachedSetupInfo.memory || 0;
      paBuild = _cachedSetupInfo.build || "";
    }

    // Build lobby report
    var lobbyReport = {
      is_lobby_data: true,
      lobby_id: lobbyId,
      uber_id: uberId,
      user_name: userName,
      the_date: gameStartTime,
      game_name: gameName,
      is_Local: isLocal,
      is_Public: isPublic,
      is_FriendsOnly: isFriendsOnly,
      is_Hidden: isHidden,
      is_Titan: isTitan,
      is_Ranked: false, // Ranked games skip this scene, handled in gamedata.js
      bounty_mode: bountyMode,
      bounty_value: bountyValue,
      game_mode: gameMode,
      server_mods: serverModsList,
      player_list: JSON.stringify(playerList),
      planets_biomes: planetBiomes,
      steam_id: steamId,
      steam_persona_name: steamPersonaName,
      owned_content: ownedContent,
      discord_id: discordId,
      discord_username: discordUsername,
      gpu: gpuName,
      cpu_cores: cpuCores,
      os_name: osName,
      memory_mb: memoryMb,
      pa_build: paBuild,
    };

    sendToServers(CONFIG.LOBBY_ENDPOINT, lobbyReport);

    lobbySent = true;
    clearInterval(checkIntervalId);
  }

  // ==================== INITIALIZATION ====================

  checkIntervalId = setInterval(collectAndSendLobbyData, CONFIG.CHECK_INTERVAL_MS);
})();
