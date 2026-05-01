/**
 * PaStats Metrics - Main Game Data Collector
 * Runs in the live_game scene. Collects and sends game statistics every 5 seconds.
 * Also handles ranked game lobby data (ranked games skip the lobby scene entirely).
 * Receives Panel messages from child panels: economy_bar, time_bar, unit_alert, game_over.
 * ES5 Compatible for Planetary Annihilation
 *
 * @author MarechalGryzzly
 * @version 8
 */

// ==================== CONFIGURATION ====================
// (global scope because handlers{} must be accessible by PA engine)

var paStatsConfig = {
  VERSION: "8.5",
  DEBUG: false, // true = send to local + verbose logs
  PROD_URL: "https://pastatsmetrics.com/pastats/api/",
  LOCAL_URL: "http://127.0.0.1:8000/pastats/api/",
  LOBBY_ENDPOINT: "lobbydata",
  GAMEDATA_ENDPOINT: "gamedata",

  // Master toggles (mirrored to localStorage by options bar + settings page)
  MOD_ENABLED: true,    // Master kill switch. OFF = stop all collection / sends.
  PERF_MODE: false,     // Lite mode: skip camera, drop most watchlist events.

  // Optional self-hoster override. Empty = use PROD_URL / LOCAL_URL above.
  BACKEND_URL_OVERRIDE: "",
  // Anonymize non-self player names before sending (best-effort, local only).
  ANONYMIZE_NAMES: false,

  SEND_INTERVAL_MS: 5000,
  RANKED_LOBBY_DELAY_MS: 1000,
  APM_SAMPLE_INTERVAL_MS: 1000,
  APM_WINDOW_SECONDS: 60,
  MAX_GAME_OVER_SENDS: 5,

  // Whether to inject the PS / LITE buttons into the in-game options bar.
  // Read by live_game_options_bar/pastatsmetrics_optionsbar.js at scene load.
  SHOW_OPTIONS_BUTTONS: true,

  // Watchlist alert system config
  WATCHLIST_ENABLED: true,
  // Which alert types to register. Set to false to disable individually.
  WATCHLIST_ALERTS: {
    creation: true,       // Unit/building finished being built
    death: true,          // Unit/building destroyed
    idle: true,           // Unit became idle — filtered at the source for buildings in
                          // _paStatsSelectAlerts() (redundant with `creation`), kept for
                          // mobile units (feeds the 3D sphere `units` view)
    sight: true,          // New enemy unit spotted
    target_destroyed: true, // Unit's target was destroyed
    arrival: true,        // Unit arrived at destination (movement endpoint tracking)
    damage: false,        // DISABLED by default - very spammy in big battles
    allied_death: true    // Allied unit died — shows ally losses on 3D sphere in team games
  },
  // Unit categories to watch — these are PA engine categories, not our custom ones
  // Mobile = all mobile units, Structure = all buildings, Recon = scouts/radar
  WATCHLIST_CATEGORIES: ["Mobile", "Structure", "Recon"],
  // Max events to buffer per send cycle (prevents memory issues in big battles).
  // v8 default lowered from 3000 → 300 for typical machines; users can raise
  // it to 1000 from the in-game settings page.
  WATCHLIST_MAX_BUFFER: 300,
  // Whether to enrich alerts with getUnitState (HP, orders) for alive units
  WATCHLIST_ENRICH_ALIVE: true,
  // Log every single watchlist event (very verbose, for debugging)
  WATCHLIST_VERBOSE: false,
  // Periodically re-call setXxxAlertTypes in case PA's base game resets the
  // watchlist (currently informational; tying to a real interval is a v9 idea).
  WATCHLIST_REREGISTER_INTERVAL_MS: 30000,

  // Building position snapshot — polls getArmyUnits + getUnitState periodically
  // to catch our own buildings (watchlist never fires `created` for them).
  // Only applies to BUILDINGS — mobile units stay on the event-driven pipeline
  // (polling hundreds of tanks would be too expensive).
  //
  // Adaptive cadence: polls faster during the first SLOW_AFTER_SECONDS of a
  // match (most construction happens early — we want to catch new factories
  // quickly), then slows down when the base stabilizes to reduce engine load.
  BUILDING_SNAPSHOT_ENABLED: true,
  BUILDING_SNAPSHOT_FAST_INTERVAL_MS: 10000,  // every 10s during early game
  BUILDING_SNAPSHOT_SLOW_INTERVAL_MS: 15000,  // every 15s after early game
  BUILDING_SNAPSHOT_SLOW_AFTER_SECONDS: 900,  // "early game" = first 15 minutes
  BUILDING_SNAPSHOT_FIRST_DELAY_MS: 5000,     // wait 5s after mod load (let PA set up)
};

// ==================== SETTINGS HYDRATION ====================
//
// Reads localStorage keys written by either the in-game options bar (raw
// keys: `pastats_mod_enabled`, `pastats_perf_mode`) or the in-game settings
// page (PA's setting-template writes one key per setting under the
// `ui.pastats_*` namespace). Coerces types and writes into paStatsConfig
// in place. Missing keys fall back to the value already in paStatsConfig.
//
// Keep the per-setting defaults in `pastatsmetrics_settings.js` aligned with
// the values above. They are duplicated on purpose because the two files
// run in different PA scenes and can't share state.

function _paStatsReadLS(key) {
  try {
    var v = localStorage.getItem(key);
    return v === null ? undefined : v;
  } catch (e) {
    return undefined;
  }
}

function _paStatsParseBoolONOFF(raw, fallback) {
  if (raw === undefined || raw === null) return fallback;
  if (raw === "ON" || raw === "true" || raw === true) return true;
  if (raw === "OFF" || raw === "false" || raw === false) return false;
  return fallback;
}

function _paStatsParseInt(raw, fallback) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  var n = parseInt(raw, 10);
  return isNaN(n) ? fallback : n;
}

function _paStatsParseStr(raw, fallback) {
  return (raw === undefined || raw === null) ? fallback : String(raw);
}

function _paStatsHydrateConfigFromStorage() {
  var prev = {
    sendInterval: paStatsConfig.SEND_INTERVAL_MS,
    alertsKey: JSON.stringify(paStatsConfig.WATCHLIST_ALERTS),
    categoriesKey: JSON.stringify(paStatsConfig.WATCHLIST_CATEGORIES)
  };

  // Master toggles (raw keys preferred — they are also written by the
  // options bar before PA's settings model is fully bootstrapped).
  paStatsConfig.MOD_ENABLED = _paStatsParseBoolONOFF(
    _paStatsReadLS("pastats_mod_enabled"),
    _paStatsParseBoolONOFF(_paStatsReadLS("ui.pastats_mod_enabled"), paStatsConfig.MOD_ENABLED)
  );
  paStatsConfig.PERF_MODE = _paStatsParseBoolONOFF(
    _paStatsReadLS("pastats_perf_mode"),
    _paStatsParseBoolONOFF(_paStatsReadLS("ui.pastats_perf_mode"), paStatsConfig.PERF_MODE)
  );

  // Watchlist alerts (one key per type)
  var alertKeys = ["creation", "death", "idle", "sight",
                   "target_destroyed", "arrival", "damage", "allied_death"];
  for (var i = 0; i < alertKeys.length; i++) {
    var k = alertKeys[i];
    paStatsConfig.WATCHLIST_ALERTS[k] = _paStatsParseBoolONOFF(
      _paStatsReadLS("ui.pastats_alert_" + k),
      paStatsConfig.WATCHLIST_ALERTS[k]
    );
  }

  // Watchlist categories — select stores the friendly label
  var catLabel = _paStatsParseStr(_paStatsReadLS("ui.pastats_watchlist_categories"), "All");
  if (catLabel === "Mobile only") paStatsConfig.WATCHLIST_CATEGORIES = ["Mobile"];
  else if (catLabel === "Buildings only") paStatsConfig.WATCHLIST_CATEGORIES = ["Structure"];
  else if (catLabel === "Recon only") paStatsConfig.WATCHLIST_CATEGORIES = ["Recon"];
  else paStatsConfig.WATCHLIST_CATEGORIES = ["Mobile", "Structure", "Recon"];

  // Performance / buffer
  paStatsConfig.WATCHLIST_MAX_BUFFER = _paStatsParseInt(
    _paStatsReadLS("ui.pastats_watchlist_max_buffer"), paStatsConfig.WATCHLIST_MAX_BUFFER);
  paStatsConfig.SEND_INTERVAL_MS = _paStatsParseInt(
    _paStatsReadLS("ui.pastats_send_interval_ms"), paStatsConfig.SEND_INTERVAL_MS);
  paStatsConfig.APM_WINDOW_SECONDS = _paStatsParseInt(
    _paStatsReadLS("ui.pastats_apm_window_seconds"), paStatsConfig.APM_WINDOW_SECONDS);
  paStatsConfig.WATCHLIST_ENRICH_ALIVE = _paStatsParseBoolONOFF(
    _paStatsReadLS("ui.pastats_enrich_alive"), paStatsConfig.WATCHLIST_ENRICH_ALIVE);

  // Building snapshot
  paStatsConfig.BUILDING_SNAPSHOT_ENABLED = _paStatsParseBoolONOFF(
    _paStatsReadLS("ui.pastats_bsnap_enabled"), paStatsConfig.BUILDING_SNAPSHOT_ENABLED);
  paStatsConfig.BUILDING_SNAPSHOT_FAST_INTERVAL_MS = _paStatsParseInt(
    _paStatsReadLS("ui.pastats_bsnap_fast_ms"), paStatsConfig.BUILDING_SNAPSHOT_FAST_INTERVAL_MS);
  paStatsConfig.BUILDING_SNAPSHOT_SLOW_INTERVAL_MS = _paStatsParseInt(
    _paStatsReadLS("ui.pastats_bsnap_slow_ms"), paStatsConfig.BUILDING_SNAPSHOT_SLOW_INTERVAL_MS);
  paStatsConfig.BUILDING_SNAPSHOT_SLOW_AFTER_SECONDS = _paStatsParseInt(
    _paStatsReadLS("ui.pastats_bsnap_cutoff_s"), paStatsConfig.BUILDING_SNAPSHOT_SLOW_AFTER_SECONDS);

  // In-game UI
  paStatsConfig.SHOW_OPTIONS_BUTTONS = _paStatsParseBoolONOFF(
    _paStatsReadLS("ui.pastats_show_options_buttons"), paStatsConfig.SHOW_OPTIONS_BUTTONS);

  // Network / privacy
  var backendChoice = _paStatsParseStr(_paStatsReadLS("ui.pastats_backend_url"), "Default");
  if (backendChoice === "Local dev") paStatsConfig.BACKEND_URL_OVERRIDE = paStatsConfig.LOCAL_URL;
  else if (backendChoice === "Custom") {
    paStatsConfig.BACKEND_URL_OVERRIDE = _paStatsParseStr(_paStatsReadLS("ui.pastats_backend_url_custom"), "");
  } else paStatsConfig.BACKEND_URL_OVERRIDE = "";
  paStatsConfig.ANONYMIZE_NAMES = _paStatsParseBoolONOFF(
    _paStatsReadLS("ui.pastats_anonymize_names"), paStatsConfig.ANONYMIZE_NAMES);

  // Debug
  paStatsConfig.DEBUG = _paStatsParseBoolONOFF(
    _paStatsReadLS("ui.pastats_debug"), paStatsConfig.DEBUG);
  paStatsConfig.WATCHLIST_VERBOSE = _paStatsParseBoolONOFF(
    _paStatsReadLS("ui.pastats_watchlist_verbose"), paStatsConfig.WATCHLIST_VERBOSE);
  paStatsConfig.WATCHLIST_REREGISTER_INTERVAL_MS = _paStatsParseInt(
    _paStatsReadLS("ui.pastats_watchlist_rereg_ms"), paStatsConfig.WATCHLIST_REREGISTER_INTERVAL_MS);
  paStatsConfig.MAX_GAME_OVER_SENDS = _paStatsParseInt(
    _paStatsReadLS("ui.pastats_max_game_over_sends"), paStatsConfig.MAX_GAME_OVER_SENDS);
  paStatsConfig.RANKED_LOBBY_DELAY_MS = _paStatsParseInt(
    _paStatsReadLS("ui.pastats_ranked_lobby_delay_ms"), paStatsConfig.RANKED_LOBBY_DELAY_MS);

  // Detect timing-sensitive changes that need a live rebuild.
  return {
    sendIntervalChanged: prev.sendInterval !== paStatsConfig.SEND_INTERVAL_MS,
    watchlistChanged:
      prev.alertsKey !== JSON.stringify(paStatsConfig.WATCHLIST_ALERTS) ||
      prev.categoriesKey !== JSON.stringify(paStatsConfig.WATCHLIST_CATEGORIES)
  };
}

var paStatsPrefix = "[PAStats:Game]";

// ==================== STATE ====================
// These must be accessible by handlers{} so they live in the wrapping scope

var paStatsState = {
  economyData: [],
  timeInSeconds: 0,
  killData: [],
  gameOverData: [],
  unitsDataBuffer: [],
  apmHistory: [],
  currentApm: 0,
  gameOverSentCount: 0,
  cachedLobbyId: null,
  inputCount: 0,
  anonymousCounter: 0,

  // Camera state
  cameraData: null,  // {planet, planetId, x, y, z, zoom}

  // Watchlist state
  watchlistInitialized: false,
  // Buffer of unit events since last send, flushed every SEND_INTERVAL_MS
  unitEventsBuffer: [],
  // Running counters for the current cycle (for logging)
  unitEventsCountThisCycle: 0,
  // Per-unit enrichment throttle: { uid: lastEnrichTimestamp }
  // Prevents spamming getUnitState for the same units on rapid clicks
  enrichThrottle: {},
  // Building snapshot de-dup: { unit_id: true }. PA's watchlist never fires
  // CREATED events for our registration, so we poll getArmyUnits periodically
  // to emit one synthetic "created" event per building. This Set tracks which
  // buildings we've already reported so subsequent polls only emit NEW ones.
  seenBuildingIds: {},
};

// ==================== WATCH TYPES ====================
// Maps numeric watch_type from PA engine to readable strings

var PA_WATCH_TYPES = {
  0: "created",               // Unit/building finished being built
  1: "damaged",               // Health changed (up or down)
  2: "destroyed",             // Unit/building destroyed (death)
  3: "ping",                  // Radar ping
  4: "sight",                 // Enemy unit spotted (important category)
  5: "projectile",            // Projectile event
  6: "first_contact",         // Enemy unit spotted (non-important, reclassified from sight)
  7: "target_destroyed",      // A watched unit's target was destroyed
  8: "allied_death",          // Allied unit died
  9: "idle",                  // Unit became idle (buildings: just finished construction)
  10: "arrival",              // Unit arrived at destination (movement endpoint)
  11: "ready",                // Unit ready
  12: "ammo_fraction_change", // Ammo changed (nukes loaded, etc.)
  13: "departure",            // Unit left
  14: "linked",               // Teleporter linked
  15: "energy_requirement_met_change", // Power on/off
};

// ==================== LOGGING ====================

function paStatsLog(msg) {
  console.log(paStatsPrefix + " " + msg);
}

function paStatsLogData(label, data) {
  console.log(paStatsPrefix + " " + label + ": " + JSON.stringify(data));
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Generate UTC timestamp string
 * @returns {string} "YYYY-MM-DD HH:MM:SS UTC"
 */
function paStatsGetUTCTimestamp() {
  return (
    new Date().toISOString().replace("T", " ").replace(/\..+/, "") + " UTC"
  );
}

/**
 * 64-bit effective hash: two independent 32-bit FNV-1a passes with different seeds
 * concatenated. Gives ~64 bits of collision resistance without BigInt.
 *
 * Output: 16 hex chars (always zero-padded). Kept in sync with the same function
 * in lobby/pastatsmetrics_lobbydata.js so that both files produce identical IDs
 * for the same input string.
 *
 * @param {string} str - Input string
 * @returns {string} 16-char hex hash
 */
function paStatsGenerateFNVHash(str) {
  var h1 = 2166136261;   // FNV offset basis
  var h2 = 0xdeadbeef;   // alternate seed for the 2nd hash
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
 * Safely read a number from a model observable
 * @param {Function} fn - Function that returns the value
 * @param {number} fallback - Fallback value
 * @returns {number}
 */
function paStatsSafeNumber(fn, fallback) {
  try {
    var val = fn();
    var num = Number(val);
    return isNaN(num) ? fallback : num;
  } catch (e) {
    return fallback;
  }
}

/**
 * Safely read a value from a model observable
 * @param {Function} fn - Function that returns the value
 * @param {*} fallback - Fallback value
 * @returns {*}
 */
function paStatsSafeRead(fn, fallback) {
  try {
    var val = fn();
    return val !== null && val !== undefined ? val : fallback;
  } catch (e) {
    return fallback;
  }
}

/**
 * Sanitize a player name: handles null, undefined, empty strings
 * Does NOT strip special characters - JSON handles encoding
 * @param {*} rawName - Raw name from the game API
 * @returns {string} Safe, non-empty player name
 */
function paStatsSanitizePlayerName(rawName) {
  if (rawName === null || rawName === undefined) {
    paStatsState.anonymousCounter++;
    return "Unknown_Player_" + paStatsState.anonymousCounter;
  }
  var name = String(rawName);
  if (name.trim() === "") {
    paStatsState.anonymousCounter++;
    return "Unknown_Player_" + paStatsState.anonymousCounter;
  }
  // Best-effort anonymization. Self name is captured before this function
  // runs (model.playerName() in paStatsCollectAndSend), so applying it
  // wholesale here mainly affects opponent names in player lists.
  if (paStatsConfig.ANONYMIZE_NAMES) {
    var selfName = "";
    try { selfName = String(model.playerName()); } catch (e) {}
    if (name !== selfName) {
      paStatsState.anonymousCounter++;
      return "Player_" + paStatsState.anonymousCounter;
    }
  }
  return name;
}

// ==================== jQuery bindFirst (from SuperStats) ====================
// Ensures our APM event handlers fire first, before other mods

$.fn.bindFirst = function (name, fn) {
  this.on(name, fn);
  this.each(function () {
    try {
      var evts = $._data(this, "events")[name.split(".")[0]];
      var handler = evts.pop();
      evts.splice(0, 0, handler);
    } catch (e) {
      // Fallback: handler is already bound via .on(), just not first
    }
  });
};

// ==================== HTTP SENDER ====================

/**
 * Send data to backend servers with proper Content-Type
 * Logs full payload for debugging without backend
 * @param {string} endpoint - API endpoint name
 * @param {Object} payload - Data object to send
 */
function paStatsSendToServers(endpoint, payload) {
  var jsonString = JSON.stringify(payload);
  // Self-hoster override: when the user picks a custom backend in the
  // settings page, route everything there instead of the canonical PROD_URL.
  var primaryBase = paStatsConfig.BACKEND_URL_OVERRIDE || paStatsConfig.PROD_URL;
  var primaryUrl = primaryBase + endpoint;

  $.ajax({
    type: "POST",
    url: primaryUrl,
    data: jsonString,
    contentType: "application/json; charset=utf-8",
    success: function () {
      paStatsLog("Sent " + endpoint + " to PROD (" + jsonString.length + "b)");
    },
    error: function (xhr, status) {
      paStatsLog("ERROR sending " + endpoint + " to PROD: " + status);
    },
  });

  // DEBUG: also fire to local dev server, but skip if PRIMARY already pointed
  // there (avoid duplicate POST when BACKEND_URL_OVERRIDE === LOCAL_URL).
  if (paStatsConfig.DEBUG && primaryBase !== paStatsConfig.LOCAL_URL) {
    var localUrl = paStatsConfig.LOCAL_URL + endpoint;
    $.ajax({
      type: "POST",
      url: localUrl,
      data: jsonString,
      contentType: "application/json; charset=utf-8",
      error: function (xhr, status) {
        paStatsLog("ERROR sending " + endpoint + " to LOCAL: " + status);
      },
    });
  }
}

// ==================== LOBBY ID RESOLUTION ====================

/**
 * Get the lobby ID for this game session (cached after first resolution)
 * Priority: session store (from lobby scene) > model.lobbyId() > FNV hash fallback
 * @returns {string} Lobby ID
 */
function paStatsGetLobbyId() {
  if (paStatsState.cachedLobbyId) {
    return paStatsState.cachedLobbyId;
  }

  var id = null;

  // 1. Try session store (set by lobby scene for normal games)
  try {
    id = ko.observable(-1).extend({ session: "lobbyId" })();
  } catch (e) {}

  // 2. Try model.lobbyId (for ranked games where lobby scene is skipped)
  if (!id || id === -1 || id === "-1") {
    id = paStatsSafeRead(
      function () { return model.lobbyId(); },
      null
    );
  }

  // 3. Generate fallback (for Galactic War or broken states)
  if (!id || id === -1 || id === "-1") {
    var uberId = paStatsSafeRead(
      function () { return model.uberId(); },
      "unknown"
    );
    id = paStatsGenerateFNVHash(uberId + new Date().toISOString());
  }

  paStatsState.cachedLobbyId = String(id);
  localStorage.lobbyId = paStatsState.cachedLobbyId;
  return paStatsState.cachedLobbyId;
}

// ==================== RANKED GAME LOBBY DATA ====================
// Ranked games skip the new_game (lobby) scene entirely.
// We must collect lobby data here in live_game, with a small delay
// to let the game state initialize.

function paStatsHandleRankedLobby() {
  var isRanked = paStatsSafeRead(
    function () { return model.gameOptions.isLadder1v1(); },
    false
  );

  if (!isRanked) {
    return;
  }

  // Build player list from playerListState (different API than lobby scene)
  // Include army_index so backend can reliably map army → player/color
  var playerList = {};
  try {
    var playerListState = model.playerListState();
    var armyCounter = 0;
    for (var i = 0; i < playerListState.players.length; i++) {
      var team = playerListState.players[i];
      for (var j = 0; j < team.slots.length; j++) {
        var safeName = paStatsSanitizePlayerName(team.slots[j]);
        // In ranked, we don't have uber IDs for opponents, use placeholder + color
        playerList[safeName] = ["0000000000", team.primary_color, armyCounter];
        armyCounter++;
      }
    }
  } catch (e) {
    paStatsLog("ERROR ranked player list: " + e.message);
  }

  // Collect planet biomes
  var planetBiomes = [];
  try {
    var planets = model.planetListState().planets;
    for (var i = 0; i < planets.length; i++) {
      planetBiomes.push(planets[i].biome);
    }
  } catch (e) {}

  var lobbyId = paStatsGetLobbyId();
  var uberId = paStatsSafeRead(function () { return model.uberId(); }, "");

  var rankedReport = {
    is_lobby_data: true,
    lobby_id: lobbyId,
    game_name: "1v1 Ranked",
    is_Local: false,
    is_Public: true,
    is_FriendsOnly: false,
    is_Hidden: false,
    is_Titan: true,
    is_Ranked: true,
    user_name: "None",
    server_mods: "No server mods",
    player_list: JSON.stringify(playerList),
    planets_biomes: JSON.stringify(planetBiomes),
    uber_id: uberId,
    the_date: paStatsGetUTCTimestamp(),
  };

  paStatsSendToServers(paStatsConfig.LOBBY_ENDPOINT, rankedReport);
}

// ==================== UNITS DATA COLLECTION (POLLING) ====================

/**
 * Collect units and buildings data for current player on all planets
 * NOTE: getArmyUnits is asynchronous. The callbacks populate unitsDataBuffer
 * which is read by the next send cycle. First tick may send empty data.
 *
 * This is the POLLING approach: gives aggregate unit counts per planet.
 * The WATCHLIST approach (below) gives per-unit events with positions.
 * Both run in parallel - polling for counts, watchlist for events.
 */
function paStatsCollectUnitsData() {
  var worldView, armyIndex, planetCount;

  try {
    worldView = api.getWorldView(0);
  } catch (e) {
    return;
  }

  armyIndex = paStatsSafeRead(
    function () { return model.armyIndex(); },
    undefined
  );
  if (armyIndex === undefined) {
    armyIndex = paStatsSafeRead(
      function () { return model.armyId(); },
      0
    );
  }

  try {
    planetCount = model.planetListState().planets.length;
  } catch (e) {
    return;
  }

  if (planetCount < 1) {
    return;
  }

  var newBuffer = [];
  var completed = 0;

  for (var planetId = 0; planetId < planetCount; planetId++) {
    try {
      worldView.getArmyUnits(armyIndex, planetId).then(function () {
        try {
          newBuffer.push(JSON.stringify(this.result));
        } catch (e) {
          newBuffer.push("{}");
        }
        completed++;
        if (completed >= planetCount) {
          paStatsState.unitsDataBuffer = newBuffer;
        }
      });
    } catch (e) {
      completed++;
    }
  }
}

// ==================== BUILDING POSITION SNAPSHOT ====================
//
// PA's watchlist never fires `created` events for our registration (base-game
// override), so we never see our OWN live buildings on the 3D `bases` view.
// This function polls getArmyUnits to find our buildings, then batch-queries
// getUnitState for their positions, and pushes ONE synthetic `created` event
// per building into the buffer. Subsequent polls skip buildings already seen.
//
// Mobile units are intentionally NOT handled here — polling hundreds of tanks
// per cycle would thrash the engine. They keep going through the watchlist.
//
// Runs every BUILDING_SNAPSHOT_INTERVAL_MS (default 30s).

function paStatsSnapshotBuildings() {
  if (!paStatsConfig.MOD_ENABLED) return;
  if (!paStatsConfig.BUILDING_SNAPSHOT_ENABLED) return;

  var worldView, armyIndex, eventArmy, planetCount;

  try { worldView = api.getWorldView(0); } catch (e) { return; }

  // Two distinct concepts — they look the same in simple games but diverge
  // in local / sandbox / team games.
  //
  //   armyIndex  — what getArmyUnits(armyIndex, planetId) accepts. On this
  //                PA build, model.armyIndex() returns a value that works.
  //
  //   eventArmy  — what we store on each event. MUST match the value that
  //                watchlist events use in `alertItem.army_id`, otherwise
  //                the 3D view's army-ordering heuristic gets corrupted
  //                (extra distinct army value → wrong player→color mapping).
  //                That's the PA "engine army id" (e.g. 15773), which is
  //                what model.armyId() returns.

  armyIndex = paStatsSafeRead(
    function () { return model.armyIndex(); },
    undefined
  );
  if (armyIndex === undefined) {
    armyIndex = paStatsSafeRead(
      function () { return model.armyId(); },
      0
    );
  }

  eventArmy = paStatsSafeRead(
    function () { return model.armyId(); },
    undefined
  );
  if (eventArmy === undefined) {
    eventArmy = armyIndex;   // last-resort fallback so the event still has a value
  }

  try {
    planetCount = model.planetListState().planets.length;
  } catch (e) { return; }
  if (planetCount < 1) return;

  for (var planetId = 0; planetId < planetCount; planetId++) {
    _paStatsSnapshotBuildingsForPlanet(worldView, armyIndex, eventArmy, planetId);
  }
}

/**
 * Snapshot our buildings on one planet:
 *   1) getArmyUnits -> all own units by spec
 *   2) filter spec paths that look like buildings
 *   3) diff against seenBuildingIds to find NEW buildings this tick
 *   4) batch getUnitState for the new IDs
 *   5) push a synthetic `created` event per building with position
 */
function _paStatsSnapshotBuildingsForPlanet(worldView, armyIndex, eventArmy, planetId) {
  var seen = paStatsState.seenBuildingIds;

  try {
    worldView.getArmyUnits(armyIndex, planetId).then(function () {
      var result;
      try { result = this.result || {}; } catch (e) { return; }

      // DIAGNOSTIC: log the shape of the first non-empty result so we can
      // finally see what getArmyUnits returns in this PA build.
      if (!paStatsState._loggedArmyUnits) {
        try {
          var keys = Object.keys(result);
          if (keys.length > 0) {
            paStatsLog("[Snapshot:getArmyUnits] planet=" + planetId
              + " keys=" + keys.length
              + " sample=" + JSON.stringify(result[keys[0]]).substring(0, 120));
            paStatsState._loggedArmyUnits = true;
          }
        } catch (e) {}
      }

      // Collect NEW building unit_ids + remember their spec path.
      // Accept BOTH string and numeric forms of ids by normalizing to String
      // for the `seen` Set and to Number for getUnitState (which seems to
      // want numeric ids). We keep the original too in case it's needed.
      var newIds = [];              // original ids fed back to getUnitState
      var newIdsNum = [];           // numeric-coerced ids (fallback try)
      var specByUidStr = {};        // keyed by String(uid) for stable lookup

      for (var specPath in result) {
        if (!result.hasOwnProperty(specPath)) continue;
        if (!_paStatsIsBuildingSpec(specPath)) continue;

        var ids = result[specPath] || [];
        for (var i = 0; i < ids.length; i++) {
          var uid = ids[i];
          if (uid === undefined || uid === null) continue;
          var key = String(uid);
          if (seen[key]) continue;
          seen[key] = true;
          newIds.push(uid);
          var asNum = Number(uid);
          newIdsNum.push(isNaN(asNum) ? uid : asNum);
          specByUidStr[key] = specPath;
        }
      }

      if (newIds.length === 0) return;

      paStatsLog("[Snapshot:buildings] planet=" + planetId
        + " newBuildings=" + newIds.length);

      // Strip the "/pa/.../foo.json" up-to-.json (same rule used elsewhere)
      function cleanSpecPath(p) {
        var m = /.*\.json/.exec(p || "");
        return m ? m.pop() : (p || "");
      }

      // Try to pull a position array out of whatever shape unitState takes.
      // PA's `getUnitState` doesn't document a position field; different PA
      // builds / mods have been observed returning positions at various keys.
      // We try each until we find something that looks like a [x,y,z] array.
      function extractPos(u) {
        if (!u) return null;
        var candidates = [
          u.position,
          u.pos,
          u.location,
          u.world_pos,
          u.world_position,
          u.location_on_surface,
        ];
        for (var c = 0; c < candidates.length; c++) {
          var v = candidates[c];
          if (!v) continue;
          // Array-like [x,y,z]
          if (typeof v.length === "number" && v.length >= 3) {
            return [Number(v[0]) || 0, Number(v[1]) || 0, Number(v[2]) || 0];
          }
          // Object {x,y,z}
          if (v.x !== undefined && v.y !== undefined && v.z !== undefined) {
            return [Number(v.x) || 0, Number(v.y) || 0, Number(v.z) || 0];
          }
        }
        return null;
      }

      function pushSnapshotEvents(arr) {
        if (!arr || arr.length === 0) {
          paStatsLog("[Snapshot:buildings] getUnitState returned empty for planet=" + planetId);
          return;
        }

        // DIAGNOSTIC: log the keys of the first unitState so we can fix the
        // extractor if positions live under a yet-unknown field name.
        if (!paStatsState._loggedUnitState) {
          try {
            var u0 = arr[0];
            if (u0) {
              paStatsLog("[Snapshot:getUnitState] keys="
                + Object.keys(u0).join(","));
              paStatsLog("[Snapshot:getUnitState] sample="
                + JSON.stringify(u0).substring(0, 500));
              paStatsState._loggedUnitState = true;
            }
          } catch (e) {}
        }

        var gameTime = Math.floor(paStatsState.timeInSeconds);
        var pushed = 0;
        var noPos = 0;

        for (var j = 0; j < arr.length; j++) {
          var u = arr[j];
          if (!u) continue;

          // Match the unit back to its spec: try u.id first, fall back to
          // positional correspondence with the array we sent.
          var uidStr = (u.id !== undefined) ? String(u.id) : String(newIds[j]);
          var spec = cleanSpecPath(specByUidStr[uidStr] || specByUidStr[String(newIds[j])]);
          var pos = extractPos(u);

          if (!pos) {
            noPos++;
            continue;
          }

          // Respect the buffer cap
          if (paStatsState.unitEventsBuffer.length
              >= paStatsConfig.WATCHLIST_MAX_BUFFER) {
            break;
          }

          paStatsState.unitEventsBuffer.push({
            t: "created",
            time: gameTime,
            spec: spec,
            // Use the PA engine army id (same convention as watchlist events'
            // alertItem.army_id). If we used armyIndex here, the 3D view's
            // order-based player→color mapping would break because our
            // snapshot would create a phantom "extra army" value (0) that
            // isn't one of the engine ids in watchlist events.
            army: eventArmy,
            planet_id: planetId,
            uid: uidStr,
            pos: [
              Math.round(pos[0] * 10) / 10,
              Math.round(pos[1] * 10) / 10,
              Math.round(pos[2] * 10) / 10,
            ],
          });
          paStatsState.unitEventsCountThisCycle++;
          pushed++;
        }

        paStatsLog("[Snapshot:buildings] planet=" + planetId
          + " pushed=" + pushed + " missing_pos=" + noPos);
      }

      // Try the call with ORIGINAL ids first. If PA rejects those (e.g. it
      // wants numeric), retry with numeric-coerced ids. Both attempts are
      // guarded by try/catch so a broken engine signature can't crash us.
      try {
        worldView.getUnitState(newIds).then(function (states) {
          pushSnapshotEvents(states);
        });
      } catch (e1) {
        paStatsLog("[Snapshot:buildings] getUnitState(original) threw: " + e1.message);
        try {
          worldView.getUnitState(newIdsNum).then(function (states) {
            pushSnapshotEvents(states);
          });
        } catch (e2) {
          paStatsLog("[Snapshot:buildings] getUnitState(numeric) threw: " + e2.message);
        }
      }
    });
  } catch (e) {
    paStatsLog("[Snapshot:buildings] getArmyUnits threw: " + e.message);
  }
}

// ==================== WATCHLIST ALERT SYSTEM ====================
//
// The PA engine watchlist lets us register for push notifications when
// units are created, destroyed, damaged, idle, spotted, etc.
// This is much cheaper than polling getArmyUnits and gives us per-unit
// data including positions (x,y,z), HP, unit type, army owner.
//
// Available alert types (from live_game_unit_alert.js line 337 in PA source):
//   damage, ready, allied_death, death, sight, projectile,
//   target_destroyed, idle, arrival, ping, first_contact, ammo_fraction_change
//
// Watch type IDs:
//   CREATED=0, DAMAGED=1, DESTROYED=2, PING=3, SIGHT=4,
//   PROJECTILE=5, FIRST_CONTACT=6, TARGET_DESTROYED=7, ALLIED_DEATH=8
//
// Categories: Mobile, Structure, Recon
//

/**
 * Register watchlist alerts with the PA engine.
 * MUST only be called ONCE (not in a loop!)
 */
function paStatsInitWatchlist() {
  if (!paStatsConfig.WATCHLIST_ENABLED || paStatsState.watchlistInitialized) {
    return;
  }

  var categories = JSON.stringify(paStatsConfig.WATCHLIST_CATEGORIES);
  var exclusions = JSON.stringify([]); // no exclusions

  var alerts = paStatsConfig.WATCHLIST_ALERTS;

  // Register all alert types with the engine.
  // IMPORTANT: The base game's setupWatchList() also registers alerts and can
  // overwrite ours. It also calls watchlist.reset on rewind/restart.
  // We counter this by:
  //   1) Registering with delays (0, 2, 4, 6, 8, 12, 16s) to run AFTER the base game
  //   2) Re-registering periodically (every 30s) in case of watchlist.reset
  function registerAlerts() {
    if (alerts.creation) {
      engine.call("watchlist.setCreationAlertTypes", categories, exclusions);
    }
    if (alerts.death) {
      engine.call("watchlist.setDeathAlertTypes", categories, exclusions);
    }
    if (alerts.idle) {
      engine.call("watchlist.setIdleAlertTypes", categories, exclusions);
    }
    if (alerts.sight) {
      engine.call("watchlist.setSightAlertTypes", categories, exclusions);
    }
    if (alerts.target_destroyed) {
      engine.call("watchlist.setTargetDestroyedAlertTypes", categories, exclusions);
    }
    if (alerts.arrival) {
      engine.call("watchlist.setArrivalAlertTypes", categories, exclusions);
    }
    if (alerts.damage) {
      engine.call("watchlist.setDamageAlertTypes", categories, exclusions);
    }
    if (alerts.allied_death) {
      engine.call("watchlist.setAlliedDeathAlertTypes", categories, exclusions);
    }
  }

  // Register immediately, then retry with delays like the OG PA Stats mod
  // (engine may not be fully ready on first call)
  registerAlerts();
  for (var delay = 2; delay <= 8; delay += 2) {
    window.setTimeout(registerAlerts, delay * 1000);
  }

  paStatsState.watchlistInitialized = true;
  paStatsLog("Watchlist initialized");
}

// ==================== BUILDING DETECTION ====================
// Keywords that identify a unit spec path as a building. Kept in sync with
// the backend's _BUILDING_KEYWORDS in main/views.py so client-side and
// server-side classifications agree. Used to drop idle events for buildings
// (redundant with the CREATED event at the same position).
var _PAS_BUILDING_KEYWORDS = [
  'factory', 'defense', 'turret', 'extractor', 'plant', 'storage', 'radar',
  'launcher', 'teleporter', 'cannon', 'barrier', 'mine', 'catalyst', 'wall',
  'nuke', 'artillery', 'torpedo', 'control_module', 'delta_v_engine',
  'mining_platform', 'deep_space_radar', 'solar_array', 'unit_cannon',
  'land_mine', 'land_barrier', 'anchor', 'halley', 'umbrella', 'jig',
];

// Small memo cache: spec path -> bool. Unit specs are a finite set so this
// stays tiny and avoids re-running indexOf() hundreds of times per tick.
var _paStatsBuildingCache = {};

function _paStatsIsBuildingSpec(specPath) {
  if (!specPath) return false;
  var cached = _paStatsBuildingCache[specPath];
  if (cached !== undefined) return cached;

  var lower = specPath.toLowerCase();
  var isBuilding = false;
  for (var i = 0; i < _PAS_BUILDING_KEYWORDS.length; i++) {
    if (lower.indexOf(_PAS_BUILDING_KEYWORDS[i]) !== -1) {
      isBuilding = true;
      break;
    }
  }
  _paStatsBuildingCache[specPath] = isBuilding;
  return isBuilding;
}

// ==================== IMPORTANT UNIT DETECTION ====================
// Loaded async at mod startup. Maps spec_id -> array of unit type tags
// (e.g. ['Mobile', 'Factory']). Used to decide whether to record HP on an
// event. Stays undefined until the unit_list.json chain finishes loading
// (~1-3s at game start).
var _paStatsUnitTypeMap = undefined;

if (typeof paStatsUnitInfoParser !== "undefined") {
  paStatsUnitInfoParser.loadUnitTypeMapping(function (mapping) {
    _paStatsUnitTypeMap = mapping;
    paStatsLog("Unit type mapping loaded: " + Object.keys(mapping).length + " units");
  });
} else {
  paStatsLog("WARNING: paStatsUnitInfoParser not available, HP enrichment will be skipped");
}

// Tags that mark a unit/building as "important" enough to track HP on.
// Matches the popup filter whitelist used in pastatsmetrics_unit_alert.js.
var _PAS_IMPORTANT_TAGS = ['Factory', 'Commander', 'Recon', 'Important'];

var _paStatsImportantCache = {};

/**
 * Returns true when the unit spec belongs to a Factory / Commander / Recon /
 * Important category. Returns false if the mapping isn't loaded yet or the
 * spec is unknown — we prefer "not important" in those cases so we don't
 * enrich everything by mistake during the startup window.
 */
function _paStatsIsImportantSpec(specPath) {
  if (!specPath) return false;
  var cached = _paStatsImportantCache[specPath];
  if (cached !== undefined) return cached;

  // Mapping not loaded yet — don't memoize (the answer will change later).
  if (_paStatsUnitTypeMap === undefined) return false;

  var unitTypes = _paStatsUnitTypeMap[specPath];
  if (unitTypes === undefined) {
    _paStatsImportantCache[specPath] = false;
    return false;
  }

  var important = false;
  for (var i = 0; i < _PAS_IMPORTANT_TAGS.length; i++) {
    var tag = _PAS_IMPORTANT_TAGS[i];
    for (var j = 0; j < unitTypes.length; j++) {
      if (unitTypes[j] === tag) {
        important = true;
        break;
      }
    }
    if (important) break;
  }
  _paStatsImportantCache[specPath] = important;
  return important;
}

/**
 * Build the base event record from a watchlist alert item.
 * Everything here is synchronous and cheap — no engine calls.
 *
 * @param {Object} alertItem - Single item from payload.list
 *   alertItem.id         - unit ID
 *   alertItem.spec_id    - unit spec path (e.g. "/pa/units/land/tank/tank.json")
 *   alertItem.army_id    - owner army index
 *   alertItem.location   - { x, y, z } planet-surface coordinates
 *   alertItem.planet_id  - which planet
 *   alertItem.watch_type - numeric event type
 * @param {number} watchType - The watch_type from the alert
 * @returns {Object} event record ready to be buffered (and optionally enriched)
 */
function _paStatsBuildBaseEvent(alertItem, watchType) {
  var eventTypeName = PA_WATCH_TYPES[watchType] || "unknown_" + watchType;
  var gameTime = Math.floor(paStatsState.timeInSeconds);

  // Clean up spec_id: strip to just the .json path
  var spec = alertItem.spec_id || "";
  var specMatch = /.*\.json/.exec(spec);
  if (specMatch) {
    spec = specMatch.pop();
  }

  var event = {
    t: eventTypeName,
    time: gameTime,
    spec: spec,
    army: alertItem.army_id !== undefined ? alertItem.army_id : -1,
    planet_id: alertItem.planet_id || 0,
  };

  if (alertItem.id) {
    event.uid = String(alertItem.id);
  }

  var loc = alertItem.location;
  if (loc) {
    event.pos = [
      Math.round((loc.x || 0) * 10) / 10,
      Math.round((loc.y || 0) * 10) / 10,
      Math.round((loc.z || 0) * 10) / 10,
    ];
  }

  return event;
}

/**
 * Apply unit-state enrichment onto an event.
 * Called after getUnitState resolves. Swallows errors silently because
 * units may have died between the alert and the state query.
 *
 * Fields captured (only the ones a downstream feature actually uses):
 *   - order_type    — used by the 3D fights heatmap to light up attackers
 *                     (pattern `e.order_type === 'attack'`)
 *   - target_spec   — used by get_fight_analysis to know "what was killed"
 *   - hp            — ONLY when the unit is a Factory / Commander / Recon /
 *                     Important. For regular mobile units we skip hp: it
 *                     isn't displayed anywhere and its churn would bloat
 *                     the DB with noise on every idle/sight alert.
 *
 * Dropped (previously captured, not consumed by any feature):
 *   - max_hp, build_target, target_pos (target_x/y/z).
 *
 * @param {Object} event - base event built by _paStatsBuildBaseEvent
 * @param {Object|undefined} unitState - entry from getUnitState() result
 */
function _paStatsEnrichEvent(event, unitState) {
  if (!unitState) return;
  try {
    // HP — only record for important units so the DB doesn't fill up with
    // irrelevant health values on every tank/bot idle.
    if (_paStatsIsImportantSpec(event.spec)) {
      if (unitState.health !== undefined) {
        event.hp = Math.round(unitState.health * 1000) / 1000;
      } else if (unitState.built_frac !== undefined) {
        // Unit is still under construction — health is derived from build progress
        event.hp = Math.round(unitState.built_frac * 1000) / 1000;
      }
    }

    // Order type + target spec — both required by the 3D fights heatmap
    // and the fight analysis feature.
    if (unitState.orders && unitState.orders.length > 0) {
      var firstOrder = unitState.orders[0];
      if (firstOrder.type) {
        event.order_type = firstOrder.type; // "move", "attack", "build", etc.
      }
      if (firstOrder.target && firstOrder.target.spec_id) {
        event.target_spec = firstOrder.target.spec_id;
      }
    }
  } catch (e) {
    // Missing fields, etc. — base event is still valuable
  }
}

/**
 * Flush the unit events buffer and return the events for this cycle
 * Resets the buffer for the next cycle
 * @returns {Array} Array of unit events
 */
function paStatsFlushUnitEvents() {
  var events = paStatsState.unitEventsBuffer;
  var count = paStatsState.unitEventsCountThisCycle;

  // Reset for next cycle
  paStatsState.unitEventsBuffer = [];
  paStatsState.unitEventsCountThisCycle = 0;

  // Clean stale entries from enrichment throttle map (older than 2s)
  var now = Date.now();
  var throttle = paStatsState.enrichThrottle;
  for (var uid in throttle) {
    if (throttle.hasOwnProperty(uid) && (now - throttle[uid]) > 2000) {
      delete throttle[uid];
    }
  }

  return events;
}

// ==================== PLAYER LIST BUILDER ====================

/**
 * Build player list with colors from live game state
 * Format: [["playerName", [r, g, b], armyIndex], ...] (array of arrays)
 *
 * NOTE: In live_game, playerListState gives us names + team colors but NOT
 * individual uber_ids. The lobby scene has already sent the full player_list
 * with uber_ids to the server. This function is used for ranked games and
 * as a fallback for player color data.
 * @returns {Array}
 */
function paStatsBuildPlayerList() {
  var playerList = [];

  try {
    var playerListState = model.playerListState();
    var armyCounter = 0;
    for (var i = 0; i < playerListState.players.length; i++) {
      var team = playerListState.players[i];
      // Each slot can have its own color, but PA groups them by team
      // In FFA each "team" has 1 slot with its own primary_color
      // In team games, slots in the same team share primary_color
      var slotColors = team.colors || [];
      for (var j = 0; j < team.slots.length; j++) {
        var safeName = paStatsSanitizePlayerName(team.slots[j]);
        // Try per-slot color, fall back to team color
        var color = (slotColors.length > j) ? slotColors[j] : team.primary_color;
        playerList.push([safeName, color, armyCounter]);
        armyCounter++;
      }
    }
  } catch (e) {}

  return playerList;
}

/**
 * Check if current player is in the player list
 * Uses exact name matching instead of substring search
 * @param {Array} playerList - Array of [name, color] pairs
 * @param {string} playerName - Name to search for
 * @returns {boolean}
 */
function paStatsIsPlayerInGame(playerList, playerName) {
  var safeName = paStatsSanitizePlayerName(playerName);
  for (var i = 0; i < playerList.length; i++) {
    if (playerList[i][0] === safeName) {
      return true;
    }
  }
  return false;
}

/**
 * Check if any player is an AI
 * @returns {boolean}
 */
function paStatsHasAIPlayers() {
  try {
    var players = model.players();
    for (var i = 0; i < players.length; i++) {
      if (players[i].ai === 1) {
        return true;
      }
    }
  } catch (e) {}
  return false;
}

// ==================== APM TRACKING ====================

/**
 * Calculate APM over a 60-second rolling window
 * Called every second, pushes current count to history,
 * sums the last 60 entries to get actions-per-minute
 */
function paStatsCalculateAPM() {
  paStatsState.apmHistory.push(paStatsState.inputCount);

  // Trim history to window size to prevent memory growth
  if (paStatsState.apmHistory.length > paStatsConfig.APM_WINDOW_SECONDS) {
    paStatsState.apmHistory = paStatsState.apmHistory.slice(
      paStatsState.apmHistory.length - paStatsConfig.APM_WINDOW_SECONDS
    );
  }

  // Sum all actions in the window = APM (since window is 60 seconds)
  var sum = 0;
  for (var i = 0; i < paStatsState.apmHistory.length; i++) {
    sum += paStatsState.apmHistory[i];
  }

  paStatsState.currentApm = sum;
  paStatsState.inputCount = 0;
}

/**
 * Capture current camera state (planet, position, zoom)
 * Uses the PA camera API focus for the primary holodeck
 */
var _camDiagCount = 0;
function paStatsCaptureCamera() {
  // Master kill switch and lite-mode short-circuits.
  // Camera capture is the heaviest per-tick op — that's why LITE skips it.
  if (!paStatsConfig.MOD_ENABLED) return;
  if (paStatsConfig.PERF_MODE) return;
  try {
    // Get the focused holodeck's actual ID — PA keys focus objects by holodeck ID string,
    // NOT integer 0. Using getFocus(0) creates a new focus that never receives engine updates.
    var holodeckId = (api.Holodeck.focused && api.Holodeck.focused.id) ? api.Holodeck.focused.id : null;
    if (!holodeckId) return;
    var focus = api.camera.getFocus(holodeckId);
    if (!focus) return;
    var loc = focus.location();
    paStatsState.cameraData = {
      planet: focus.planet(),
      planet_id: focus.planetId(),
      x: loc ? Math.round(loc.x * 10) / 10 : 0,
      y: loc ? Math.round(loc.y * 10) / 10 : 0,
      z: loc ? Math.round(loc.z * 10) / 10 : 0,
      zoom: focus.zoomLevel()
    };
    // Diagnostic: log first 20 camera captures to verify correct data
    if (_camDiagCount < 20) {
      console.log(paStatsPrefix + " CAM holodeck=" + holodeckId + " focus=" + JSON.stringify({
        planet: focus.planet(),
        planetId: focus.planetId(),
        zoom: focus.zoomLevel(),
        loc: loc ? { x: loc.x, y: loc.y, z: loc.z } : null,
        hasLoc: !!loc
      }));
      _camDiagCount++;
    }
  } catch (e) {
    paStatsState.cameraData = null;
  }
}

/**
 * Initialize APM input event listeners
 * Tracks keystrokes and mouse clicks
 *
 * Three separate bindings are needed because PA uses Coherent GT:
 *   - keyup on document:    keyboard shortcuts, hotkeys, build commands
 *   - mousedown on holodeck: clicks in the 3D game world (select, move, attack)
 *   - mousedown on document: clicks on UI elements (build bar, menus, sidebar)
 *
 * holodeck is a native engine element — its events do NOT bubble to document,
 * so both mousedown bindings are required (no double-counting).
 */
function paStatsInitializeInputTracking() {
  $(document).bindFirst("keyup", function () {
    paStatsState.inputCount++;
  });

  // Game world clicks (unit selection, movement orders, attack commands)
  $("holodeck").bindFirst("mousedown", function () {
    paStatsState.inputCount++;
  });

  // UI clicks (build bar, command panel, menus)
  $(document).bindFirst("mousedown", function () {
    paStatsState.inputCount++;
  });

}

// ==================== MAIN DATA COLLECTION LOOP ====================

/**
 * Main data collection and transmission function
 * Called every 5 seconds by setInterval
 */
function paStatsCollectAndSend() {
  // Master kill switch — when the user clicks PS in the options bar (or
  // toggles "Mod enabled" off in the settings page), bail out before doing
  // any work. The interval keeps ticking but nothing collected, nothing sent.
  if (!paStatsConfig.MOD_ENABLED) return;
  try {
    // Trigger async units collection (populates buffer for next cycle)
    paStatsCollectUnitsData();

    // Capture camera state
    paStatsCaptureCamera();

    // Flush watchlist events buffer
    var unitEvents = paStatsFlushUnitEvents();

    // Read current state
    var lobbyId = paStatsGetLobbyId();
    var playerName = paStatsSanitizePlayerName(
      paStatsSafeRead(function () { return model.playerName(); }, null)
    );
    var uberId = paStatsSafeRead(function () { return model.uberId(); }, "");
    var systemName = paStatsSafeRead(function () { return model.systemName(); }, "");
    var playerList = paStatsBuildPlayerList();
    var hasAI = paStatsHasAIPlayers();

    // Game over state (received from game_over panel)
    var gameState = paStatsState.gameOverData[0]
      ? JSON.stringify(paStatsState.gameOverData[0])
      : "";
    var gameVictors = paStatsState.gameOverData[1] || null;

    // Game options
    var isGalacticWar = paStatsSafeRead(function () { return model.gameOptions.isGalaticWar(); }, false);
    var isLadder1v1 = paStatsSafeRead(function () { return model.gameOptions.isLadder1v1(); }, false);
    var isLandAnywhere = paStatsSafeRead(function () { return model.gameOptions.land_anywhere(); }, false);
    var listenToSpectators = paStatsSafeRead(function () { return model.gameOptions.listenToSpectators(); }, false);
    var isSandbox = paStatsSafeRead(function () { return model.gameOptions.sandbox(); }, false);
    var isDynamicAlliances = paStatsSafeRead(function () { return model.gameOptions.dynamic_alliances(); }, false);
    var dynamicAllianceVictory = paStatsSafeRead(function () { return model.gameOptions.dynamic_alliance_victory(); }, false);
    var gameType = paStatsSafeRead(function () { return model.gameOptions.game_type(); }, "");

    // Build report
    var report = {
      is_lobby_data: false,
      game_state: gameState,
      game_victors: gameVictors,
      uber_id: uberId,
      player_name: playerName,
      system_name: systemName,
      the_date: paStatsGetUTCTimestamp(),
      current_apm: paStatsState.currentApm,
      lobby_id: lobbyId,
      eco_data: paStatsState.economyData,
      kill_data: paStatsState.killData,
      time_in_seconds: Math.floor(paStatsState.timeInSeconds),
      unb_data: paStatsState.unitsDataBuffer,
      // NEW: unit events from watchlist (positions, lifecycle, combat)
      unit_events: unitEvents,
      // Camera state (planet, position, zoom level)
      camera_data: paStatsState.cameraData,
      is_galacticwar: isGalacticWar,
      is_ladder1v1: isLadder1v1,
      is_land_anywhere: isLandAnywhere,
      is_listen_to_spectators: listenToSpectators,
      is_sandbox: isSandbox,
      is_dynamic_alliances: isDynamicAlliances,
      dynamic_alliance_victory: dynamicAllianceVictory,
      game_type: gameType,
      has_game_AI: hasAI,
      player_list: JSON.stringify(playerList),
    };

    // Determine if we should send
    var isPaused = paStatsSafeRead(function () { return model.paused(); }, false);
    var isSpectator = paStatsSafeRead(function () { return model.isSpectator(); }, false);
    var isLanding = paStatsSafeRead(function () { return model.showLanding(); }, true);
    // Detect replay/review mode — in replay, model.reviewMode or model.mode is "replay"
    var isReplay = paStatsSafeRead(function () { return model.reviewMode(); }, false)
                || paStatsSafeRead(function () { return model.mode() === "replay"; }, false)
                || paStatsSafeRead(function () { return model.mode() === "review"; }, false);

    var shouldSendData = !isPaused && !isSpectator && !isLanding && !isReplay;
    var playerInGame = paStatsIsPlayerInGame(playerList, playerName);
    var shouldSendGameOver =
      gameVictors &&
      !_.isEmpty(gameVictors) &&
      paStatsState.gameOverSentCount < paStatsConfig.MAX_GAME_OVER_SENDS &&
      playerInGame;

    if (shouldSendData || shouldSendGameOver) {
      paStatsSendToServers(paStatsConfig.GAMEDATA_ENDPOINT, report);

      if (shouldSendGameOver) {
        paStatsState.gameOverSentCount++;
      }
    }
  } catch (e) {
    paStatsLog("ERROR in main collection loop: " + e.message);
  }
}

// ==================== PANEL MESSAGE HANDLERS ====================
// These receive data from child panels (economy_bar, time_bar, unit_alert, game_over)

/**
 * Handle economy data from economy_bar panel
 * Payload: [energyGain, energyLoss, energyNet, energyEffPerc, energyCurrent, energyMax,
 *           metalGain, metalLoss, metalNet, metalEffPerc, metalCurrent, metalMax]
 * We enrich it with combat metal stats only available in the live_game scene
 */
handlers.EcoDataAll = function (payload) {
  var enriched = payload.concat([
    paStatsSafeNumber(function () { return model.enemyMetalDestroyed(); }, 0),
    paStatsSafeNumber(function () { return model.metalLost(); }, 0),
  ]);
  paStatsState.economyData = enriched;
};

/**
 * Handle kill/defeat data from unit_alert panel
 * Payload: army_defeated event data from PA
 */
handlers.comKillData = function (payload) {
  paStatsState.killData = JSON.stringify(payload);
};

/**
 * Handle time updates from time_bar panel
 * Payload: currentTimeInSeconds (number)
 */
handlers.TimeData = function (payload) {
  var time = payload instanceof Array ? payload[0] : payload;
  paStatsState.timeInSeconds = typeof time === "number" ? time : 0;
};

/**
 * Handle game over data from game_over panel
 * Payload: [gameState, victorsData]
 */
handlers.TheGameOverData = function (payload) {
  if (payload && payload.length >= 2) {
    paStatsState.gameOverData = payload;
  }
};

// ==================== WATCHLIST HANDLER ====================

/**
 * Extract the watch_type from an alert entry, preferring the field named
 * `watch_type` and falling back to `alert_type` for compatibility.
 */
function _paStatsAlertWatchType(alert) {
  var wt = alert.watch_type;
  if (wt === undefined) wt = alert.alert_type;
  return wt;
}

/**
 * Select the alert entries we want to process for this tick.
 * Applies source-level filtering (drop idle-for-buildings, buffer cap),
 * and samples large batches so we don't hammer the engine. Returns the
 * indices into `list` that survived.
 */
function _paStatsSelectAlerts(list) {
  var MAX_ENRICHMENTS = 300;
  var SMALL_GROUP_THRESHOLD = 10;

  // Pass 1: drop events we don't want recorded at all.
  //  - Idle events on buildings are redundant with `created` (same spec,
  //    same position) and were the bulk of the DB volume.
  //  - Nothing else is filtered here — the popup filter lives elsewhere.
  var eligible = [];
  for (var i = 0; i < list.length; i++) {
    var alert = list[i];
    var wt = _paStatsAlertWatchType(alert);

    if (wt === 9 /* IDLE */ && _paStatsIsBuildingSpec(alert.spec_id)) {
      continue;
    }

    // Respect the buffer cap — once full, stop queueing new work
    if (paStatsState.unitEventsBuffer.length + eligible.length
        >= paStatsConfig.WATCHLIST_MAX_BUFFER) {
      break;
    }

    eligible.push(i);
  }

  if (eligible.length <= MAX_ENRICHMENTS) {
    return eligible;
  }

  // Huge batch — sample by spec_id so every unit type is represented
  // proportionally while keeping enrichment under the cap.
  var groups = {};   // spec_id -> [eligible indices]
  for (var j = 0; j < eligible.length; j++) {
    var idx = eligible[j];
    var spec = list[idx].spec_id || "unknown";
    if (!groups[spec]) groups[spec] = [];
    groups[spec].push(idx);
  }

  var keptSmall = [];
  var largeGroups = {};
  var largeTotal = 0;
  for (var specKey in groups) {
    if (!groups.hasOwnProperty(specKey)) continue;
    var g = groups[specKey];
    if (g.length < SMALL_GROUP_THRESHOLD) {
      for (var k = 0; k < g.length; k++) keptSmall.push(g[k]);
    } else {
      largeGroups[specKey] = g;
      largeTotal += g.length;
    }
  }

  var budget = MAX_ENRICHMENTS - keptSmall.length;
  if (budget < 0) budget = 0;

  var sampled = keptSmall.slice();
  for (var specKey2 in largeGroups) {
    if (!largeGroups.hasOwnProperty(specKey2)) continue;
    var gItems = largeGroups[specKey2];
    var allowance = largeTotal > 0
      ? Math.max(1, Math.round((gItems.length / largeTotal) * budget))
      : 0;
    var step = gItems.length / allowance;
    for (var m = 0; m < allowance && m < gItems.length; m++) {
      sampled.push(gItems[Math.floor(m * step)]);
    }
  }
  return sampled;
}

/**
 * Handle watchlist alerts from PA engine.
 *
 * The flow for each tick:
 *   1. Select eligible alerts (drop idle-for-buildings, sample huge batches).
 *   2. Build the base event record for each.
 *   3. Decide which events need `getUnitState` enrichment (alive units with
 *      unit IDs, respecting the per-unit 1s throttle).
 *   4. Buffer the non-enriched events immediately.
 *   5. Issue a SINGLE batched getUnitState call for all IDs needing
 *      enrichment, then apply each unit state to its pending event and
 *      buffer. This prevents the UI freeze caused by issuing hundreds of
 *      separate engine calls per tick when a large selection goes idle.
 *
 * IMPORTANT: This handler is registered ONCE globally, not in a loop.
 */
handlers.watch_list = function (payload) {
  if (!paStatsConfig.MOD_ENABLED) return;
  if (!paStatsConfig.WATCHLIST_ENABLED) {
    return;
  }

  if (!payload || !payload.list) {
    return;
  }

  var list = payload.list;
  // LITE mode: keep only CREATED (0) and DESTROYED (2). These are the cheap,
  // non-spammy events that still let bases/fights views work.
  if (paStatsConfig.PERF_MODE) {
    var liteList = [];
    for (var li = 0; li < list.length; li++) {
      var lwt = list[li].watch_type;
      if (lwt === undefined) lwt = list[li].alert_type;
      if (lwt === 0 || lwt === 2) liteList.push(list[li]);
    }
    list = liteList;
  }
  var selected = _paStatsSelectAlerts(list);
  if (selected.length === 0) return;

  var now = Date.now();
  var pending = [];   // { event, unitId } pairs awaiting batched enrichment
  var pendingIds = [];

  for (var i = 0; i < selected.length; i++) {
    var alert = list[selected[i]];
    var wt = _paStatsAlertWatchType(alert);

    var event = _paStatsBuildBaseEvent(alert, wt);

    // Decide whether this event benefits from a getUnitState call.
    // DESTROYED (2) / ALLIED_DEATH (8): unit is gone, state query would fail.
    // CREATED (0): unit just appeared, has no orders yet → nothing useful.
    // IDLE (9): unit is by definition without active orders → nothing useful.
    // ARRIVAL (10): unit finished its movement → order is already cleared.
    // Remaining enrichable types: SIGHT (4), TARGET_DESTROYED (7) — where
    // order_type/target_spec carry real signal for combat analysis.
    var isAliveEvent = (wt !== 2 && wt !== 8);
    var hasUsefulOrderInfo = (wt !== 0 && wt !== 9 && wt !== 10);
    var wantEnrich = paStatsConfig.WATCHLIST_ENRICH_ALIVE
      && isAliveEvent
      && hasUsefulOrderInfo
      && alert.id;

    // Per-unit throttle: skip enrichment if the same unit was enriched
    // less than 1s ago. Prevents piling up engine calls when an order is
    // re-issued rapidly on the same selection.
    if (wantEnrich) {
      var uidKey = String(alert.id);
      var lastEnrich = paStatsState.enrichThrottle[uidKey];
      if (lastEnrich && (now - lastEnrich) < 1000) {
        wantEnrich = false;
      } else {
        paStatsState.enrichThrottle[uidKey] = now;
      }
    }

    if (!wantEnrich) {
      paStatsState.unitEventsBuffer.push(event);
      paStatsState.unitEventsCountThisCycle++;
    } else {
      pending.push({ event: event, unitId: alert.id });
      pendingIds.push(alert.id);
    }
  }

  // Issue ONE batched getUnitState call for everything waiting to enrich.
  if (pendingIds.length > 0) {
    try {
      api.getWorldView(0).getUnitState(pendingIds).then(function (results) {
        var res = results || [];
        for (var p = 0; p < pending.length; p++) {
          _paStatsEnrichEvent(pending[p].event, res[p]);
          paStatsState.unitEventsBuffer.push(pending[p].event);
          paStatsState.unitEventsCountThisCycle++;
        }
      });
    } catch (e) {
      // getWorldView not available — push base events without enrichment
      for (var q = 0; q < pending.length; q++) {
        paStatsState.unitEventsBuffer.push(pending[q].event);
        paStatsState.unitEventsCountThisCycle++;
      }
    }
  }
};

// ==================== INITIALIZATION ====================

// ==================== MESSAGE HANDLERS (options bar + settings) ====================
//
// The in-game options bar (live_game_options_bar/pastatsmetrics_optionsbar.js)
// posts `pastats_mod_toggle` and `pastats_perf_toggle` here whenever the user
// clicks PS / LITE. The settings page (settings/pastatsmetrics_settings.js)
// posts `pastatsmetrics_settings_changed` after Save & Exit. All three paths
// converge on _paStatsHydrateConfigFromStorage() so paStatsConfig stays in
// sync with localStorage without restarting the mod.

handlers.pastats_mod_toggle = function (payload) {
  paStatsConfig.MOD_ENABLED = !!payload;
  try {
    localStorage.setItem("pastats_mod_enabled", String(paStatsConfig.MOD_ENABLED));
    localStorage.setItem("ui.pastats_mod_enabled", paStatsConfig.MOD_ENABLED ? "ON" : "OFF");
  } catch (e) {}
  paStatsLog("Mod " + (paStatsConfig.MOD_ENABLED ? "ENABLED" : "DISABLED"));
};

handlers.pastats_perf_toggle = function (payload) {
  paStatsConfig.PERF_MODE = !!payload;
  try {
    localStorage.setItem("pastats_perf_mode", String(paStatsConfig.PERF_MODE));
    localStorage.setItem("ui.pastats_perf_mode", paStatsConfig.PERF_MODE ? "ON" : "OFF");
  } catch (e) {}
  paStatsLog("Lite mode " + (paStatsConfig.PERF_MODE ? "ON" : "OFF"));
};

// Holds the current send-loop interval id so we can rebuild it when the user
// changes SEND_INTERVAL_MS without restarting PA.
var _paStatsSendIntervalId = null;

function _paStatsRebuildSendInterval() {
  if (_paStatsSendIntervalId !== null) {
    try { clearInterval(_paStatsSendIntervalId); } catch (e) {}
  }
  _paStatsSendIntervalId = setInterval(function () {
    try {
      paStatsCollectAndSend();
    } catch (e) {
      paStatsLog("ERROR in collection loop: " + e.message);
    }
  }, paStatsConfig.SEND_INTERVAL_MS);
}

handlers.pastatsmetrics_settings_changed = function () {
  var changed = _paStatsHydrateConfigFromStorage();
  paStatsLog("Settings reloaded from storage");
  if (changed.sendIntervalChanged) {
    paStatsLog("Send interval changed to " + paStatsConfig.SEND_INTERVAL_MS + "ms — rebuilding loop");
    _paStatsRebuildSendInterval();
  }
  if (changed.watchlistChanged) {
    paStatsLog("Watchlist categories/alerts changed — re-registering");
    paStatsState.watchlistInitialized = false;
    try { paStatsInitWatchlist(); } catch (e) {}
  }
};

// Chain `handlers['settings.exit']` so we re-hydrate when the user closes the
// in-game settings overlay during a match (the settings scene runs in its own
// scope, but localStorage is shared).
(function () {
  var _prev = handlers["settings.exit"];
  handlers["settings.exit"] = function () {
    try { handlers.pastatsmetrics_settings_changed(); } catch (e) {}
    if (typeof _prev === "function") {
      try { _prev.apply(this, arguments); } catch (e) {}
    }
  };
})();

$(document).ready(function () {
  // Hydrate paStatsConfig from localStorage BEFORE anything else reads it.
  // Falls back to whatever is hardcoded above for keys that aren't set yet.
  try { _paStatsHydrateConfigFromStorage(); } catch (e) {
    paStatsLog("Hydrate failed (using defaults): " + e.message);
  }

  paStatsLog("PAStats Metrics v" + paStatsConfig.VERSION + " started (DEBUG=" + paStatsConfig.DEBUG + ")");

  // Ranked lobby report — retry at several delays so a single network/engine
  // hiccup doesn't cost us `date_game_start` for the whole game. The backend
  // `check_n_save` is idempotent (it skips if the lobby_id already exists),
  // so duplicate sends are harmless — only the first to land fills the row.
  var rankedDelays = [1000, 3000, 6000, 10000, 20000, 30000];
  rankedDelays.forEach(function (d) {
    setTimeout(paStatsHandleRankedLobby, d);
  });
  setInterval(paStatsCalculateAPM, paStatsConfig.APM_SAMPLE_INTERVAL_MS);
  paStatsInitializeInputTracking();
  paStatsInitWatchlist();

  _paStatsRebuildSendInterval();

  // Building position snapshot — fills the gap left by PA's watchlist never
  // firing `created` for our registration. Uses a recursive setTimeout so
  // the cadence can adapt to game time (fast during early game, slower once
  // the base stabilizes).
  if (paStatsConfig.BUILDING_SNAPSHOT_ENABLED) {
    function _paStatsScheduleBuildingSnapshot(delayMs) {
      setTimeout(function () {
        try {
          paStatsSnapshotBuildings();
        } catch (e) {
          paStatsLog("ERROR in building snapshot: " + e.message);
        }

        // Pick the next cadence based on current game time.
        var gameTime = paStatsState.timeInSeconds || 0;
        var next = gameTime < paStatsConfig.BUILDING_SNAPSHOT_SLOW_AFTER_SECONDS
          ? paStatsConfig.BUILDING_SNAPSHOT_FAST_INTERVAL_MS
          : paStatsConfig.BUILDING_SNAPSHOT_SLOW_INTERVAL_MS;

        _paStatsScheduleBuildingSnapshot(next);
      }, delayMs);
    }

    _paStatsScheduleBuildingSnapshot(paStatsConfig.BUILDING_SNAPSHOT_FIRST_DELAY_MS);
  }
});
