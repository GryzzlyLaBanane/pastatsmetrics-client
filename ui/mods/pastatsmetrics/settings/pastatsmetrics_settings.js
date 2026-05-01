/**
 * PaStats Metrics v8.5 — In-game settings page
 *
 * Built on the v8.4 architecture (synchronous IIFE, own tab via
 * model.settingGroups().push, ui.pastats_* namespace registered under
 * api.settings.definitions.ui.settings, no ko.applyBindings*) — see
 * pamods/PA_MODDING_PATTERNS.md §6.1 for the canonical pattern.
 *
 * v8.5 changes vs v8.4:
 *   - Reset button removed. v8.4's reset button hung PA on click —
 *     confirm() / window.location.reload() are not webview-safe in
 *     Coherent GT.
 *   - Slider value display fixed by explicitly re-pushing the entire
 *     definitions tree via model.settingDefinitions(api.settings.definitions)
 *     after registration. Forces settingsItemMap to recompute so it
 *     includes our newly-registered ui.pastats_* keys (mirrors
 *     ArmyUtilSettings.js:37).
 *   - Removed `pastats_send_interval_ms` and `pastats_apm_window_seconds`
 *     — hardcoded in paStatsConfig instead.
 *   - Merged "Building snapshot" rows into the "Data collection" section.
 *
 * Settings keys still live under ui.pastats_* so live_game/pastatsmetrics_gamedata.js
 * needs zero changes.
 *
 * ES5 compatible (Coherent GT engine).
 *
 * @author MarechalGryzzly
 * @version 8.5
 */

(function () {
  var LOG_PREFIX = "[PAStats:Settings]";
  var GROUP_NAME = "pastatsmetrics";
  var GROUP_TITLE = "PA Stats Metrics";

  function log(msg) { try { console.log(LOG_PREFIX + " " + msg); } catch (e) {} }

  if (typeof model === "undefined" ||
      typeof api === "undefined" || !api.settings ||
      !api.settings.definitions || !api.settings.definitions.ui ||
      typeof handlers === "undefined" ||
      typeof ko === "undefined" || typeof $ === "undefined") {
    log("required globals missing — bailing out");
    return;
  }

  // ==================== SETTING DEFINITIONS ====================
  // Each entry: { title, type, options, default, advanced, section }.
  // Defaults MUST stay aligned with the matching paStatsConfig fields in
  // live_game/pastatsmetrics_gamedata.js — they are the same numbers
  // duplicated across two scenes that can't share state.

  var SETTINGS = {
    pastats_mod_enabled: {
      title: "Mod enabled",
      type: "select", options: ["ON", "OFF"], "default": "ON",
      section: "Master toggles"
    },
    pastats_perf_mode: {
      title: "Lite (performance) mode",
      type: "select", options: ["ON", "OFF"], "default": "OFF",
      section: "Master toggles"
    },
    pastats_show_advanced: {
      title: "Show advanced settings",
      type: "select", options: ["ON", "OFF"], "default": "OFF",
      section: "Master toggles"
    },

    pastats_alert_creation: {
      title: "Record unit creation events",
      type: "select", options: ["ON", "OFF"], "default": "ON",
      section: "Data collection"
    },
    pastats_alert_death: {
      title: "Record unit death events",
      type: "select", options: ["ON", "OFF"], "default": "ON",
      section: "Data collection"
    },
    pastats_alert_idle: {
      title: "Record idle events (mobile units)",
      type: "select", options: ["ON", "OFF"], "default": "ON",
      section: "Data collection"
    },
    pastats_alert_sight: {
      title: "Record sight (enemy spotted) events",
      type: "select", options: ["ON", "OFF"], "default": "ON",
      section: "Data collection"
    },
    pastats_alert_target_destroyed: {
      title: "Record kill credit events",
      type: "select", options: ["ON", "OFF"], "default": "ON",
      section: "Data collection"
    },
    pastats_alert_arrival: {
      title: "Record movement-arrival events",
      type: "select", options: ["ON", "OFF"], "default": "ON",
      section: "Data collection"
    },
    pastats_alert_damage: {
      title: "Record damage events",
      type: "select", options: ["ON", "OFF"], "default": "OFF",
      advanced: true, section: "Data collection"
    },
    pastats_alert_allied_death: {
      title: "Record allied-death events",
      type: "select", options: ["ON", "OFF"], "default": "ON",
      section: "Data collection"
    },

    pastats_watchlist_max_buffer: {
      title: "Watchlist buffer cap (events / cycle)",
      type: "slider", options: { min: 0, max: 1000, step: 50 }, "default": 300,
      section: "Performance"
    },
    pastats_enrich_alive: {
      title: "Enrich alive units with order/HP",
      type: "select", options: ["ON", "OFF"], "default": "ON",
      advanced: true, section: "Performance"
    },
    pastats_watchlist_categories: {
      title: "Watchlist unit categories",
      type: "select", options: ["All", "Mobile only", "Buildings only", "Recon only"], "default": "All",
      advanced: true, section: "Performance"
    },

    pastats_bsnap_enabled: {
      title: "Building position snapshot",
      type: "select", options: ["ON", "OFF"], "default": "ON",
      section: "Data collection"
    },
    pastats_bsnap_fast_ms: {
      title: "Early-game poll interval (ms)",
      type: "slider", options: { min: 2000, max: 60000, step: 1000 }, "default": 10000,
      advanced: true, section: "Data collection"
    },
    pastats_bsnap_slow_ms: {
      title: "Late-game poll interval (ms)",
      type: "slider", options: { min: 5000, max: 120000, step: 1000 }, "default": 15000,
      advanced: true, section: "Data collection"
    },
    pastats_bsnap_cutoff_s: {
      title: "Early-game cutoff (game seconds)",
      type: "slider", options: { min: 60, max: 3600, step: 60 }, "default": 900,
      advanced: true, section: "Data collection"
    },

    pastats_show_options_buttons: {
      title: "Show PS / LITE buttons in options bar",
      type: "select", options: ["ON", "OFF"], "default": "ON",
      section: "In-game UI"
    },

    pastats_backend_url: {
      title: "Backend URL",
      type: "select", options: ["Default", "Local dev", "Custom"], "default": "Default",
      advanced: true, section: "Network / privacy"
    },
    pastats_anonymize_names: {
      title: "Anonymize opponent names",
      type: "select", options: ["ON", "OFF"], "default": "OFF",
      advanced: true, section: "Network / privacy"
    },

    pastats_debug: {
      title: "Debug mode (also send to localhost)",
      type: "select", options: ["ON", "OFF"], "default": "OFF",
      advanced: true, section: "Debug"
    },
    pastats_watchlist_verbose: {
      title: "Verbose watchlist logging",
      type: "select", options: ["ON", "OFF"], "default": "OFF",
      advanced: true, section: "Debug"
    },
    pastats_watchlist_rereg_ms: {
      title: "Watchlist re-register interval (ms)",
      type: "slider", options: { min: 5000, max: 120000, step: 5000 }, "default": 30000,
      advanced: true, section: "Debug"
    },
    pastats_max_game_over_sends: {
      title: "Max game-over retries",
      type: "slider", options: { min: 1, max: 10, step: 1 }, "default": 5,
      advanced: true, section: "Debug"
    },
    pastats_ranked_lobby_delay_ms: {
      title: "Ranked lobby first-report delay (ms)",
      type: "slider", options: { min: 0, max: 5000, step: 250 }, "default": 1000,
      advanced: true, section: "Debug"
    }
  };

  // ==================== STEP 1 — REGISTER SETTINGS ====================
  // Extend api.settings.definitions.ui.settings with our 24 entries. Doing
  // this synchronously at script load — BEFORE PA's outer applyBindings
  // runs — guarantees model.settingsItemMap() will include our keys when
  // PA computes it for the first time. (See hotbuild_settings.js:424.)

  var uiSettings = api.settings.definitions.ui.settings;
  for (var key in SETTINGS) {
    if (!SETTINGS.hasOwnProperty(key)) continue;
    var s = SETTINGS[key];
    uiSettings[key] = {
      title: s.title,
      type: s.type,
      options: s.options,
      "default": s["default"]
    };
  }

  // ==================== STEP 2 — REGISTER OUR TAB ====================

  if (model.settingGroups().indexOf(GROUP_NAME) === -1) {
    model.settingGroups().push(GROUP_NAME);
  }
  if (model.settingDefinitions().pastatsmetrics === undefined) {
    model.settingDefinitions().pastatsmetrics = {
      title: GROUP_TITLE,
      settings: {}
    };
  }

  // Force settingsItemMap to rebuild so it includes our newly-extended
  // ui.pastats_* keys. Mirrors army-utilities' approach
  // (ArmyUtilSettings.js:37). Without this, sliders may render as empty
  // controls because PA computed settingsItemMap before our extend ran.
  if (typeof model.settingDefinitions === "function") {
    try {
      model.settingDefinitions(api.settings.definitions);
    } catch (e) {
      log("warning: settingDefinitions re-push threw: " + e.message);
    }
  }

  // ==================== STEP 3 — BUILD HTML ====================
  // The advanced/casual split is decided at HTML-build time by reading
  // localStorage. Doing it here (vs. a live Knockout `visible:` binding)
  // avoids depending on the exact observable name PA's setting-template
  // exposes for a select's current value — which we can't easily verify
  // without the engine source. Trade-off: changing the toggle requires the
  // user to Save & Exit then reopen Settings to see new rows. Acceptable.

  var showAdvanced = false;
  try {
    showAdvanced = localStorage.getItem("ui.pastats_show_advanced") === "ON";
  } catch (e) {}

  function buildHtml() {
    // Group keys by section in declaration order.
    var sections = [];
    var byKey = {};
    for (var k in SETTINGS) {
      if (!SETTINGS.hasOwnProperty(k)) continue;
      if (SETTINGS[k].advanced && !showAdvanced) continue;
      var sec = SETTINGS[k].section || "Other";
      if (!byKey[sec]) { byKey[sec] = []; sections.push(sec); }
      byKey[sec].push(k);
    }

    // Wrapper visible only when our tab is the active one.
    var html = '<div class="option-list ' + GROUP_NAME + '" ' +
      'data-bind="visible: ($root.settingGroups()[$root.activeSettingsGroupIndex()] === \'' +
      GROUP_NAME + '\')" ' +
      'style="display: none;">';

    html += '<div class="sub-group-title pastats-block-title">PA STATS METRICS</div>';

    for (var i = 0; i < sections.length; i++) {
      var sec = sections[i];
      var keys = byKey[sec];

      html += '<div class="sub-group">';
      html += '<div class="sub-group-title">' + sec + '</div>';

      for (var j = 0; j < keys.length; j++) {
        var rowKey = keys[j];
        var bind = "template: { name: 'setting-template', " +
          "data: $root.settingsItemMap()['ui." + rowKey + "'] }";
        html += '<div class="option" data-bind="' + bind + '"></div>';
      }

      html += '</div>'; // /sub-group
    }

    html += '</div>'; // /option-list pastatsmetrics
    return html;
  }

  // ==================== STEP 4 — INJECT INTO DOM ====================
  // Append our wrapper as a SIBLING of an existing option-list so PA's
  // tab-switching naturally shows/hides it. Try .option-list.keyboard
  // first (present on every PA build observed); fall back to other tabs.

  var INJECT_TARGETS = [
    ".option-list.keyboard",
    ".option-list.gameplay",
    ".option-list.server",
    ".option-list.graphics",
    ".option-list"
  ];

  var injected = false;
  for (var ti = 0; ti < INJECT_TARGETS.length; ti++) {
    var $sib = $(INJECT_TARGETS[ti]).first();
    if ($sib.length > 0) {
      $sib.parent().append(buildHtml());
      log("Injected as sibling of: " + INJECT_TARGETS[ti]);
      injected = true;
      break;
    }
  }
  if (!injected) {
    log("ERROR: no .option-list.* sibling found — settings tab will be empty");
    var classes = [];
    try {
      $("[class*='option-list']").each(function () {
        if (this && this.className) classes.push(String(this.className));
      });
    } catch (e) {}
    log("Available option-list classes (" + classes.length + "): " +
        (classes.length ? classes.join(" | ") : "NONE"));
    return;
  }

  // ==================== STEP 5 — HOOK settings.exit ====================
  // Wrap-then-call so we don't clobber any other mod's existing handler
  // (e.g. hotbuild2's). On exit, broadcast to live_game so the running
  // collector re-hydrates its config from localStorage immediately.

  (function () {
    var prevExit = handlers["settings.exit"];
    handlers["settings.exit"] = function () {
      try {
        if (api && api.panels && api.panels.live_game) {
          api.panels.live_game.message("pastatsmetrics_settings_changed");
        }
      } catch (e) {}
      log("settings.exit fired — live_game notified");
      if (typeof prevExit === "function") {
        try { prevExit.apply(this, arguments); } catch (e) {}
      }
    };
  })();

  // ==================== STEP 6 — NUDGE THE SIDEBAR ====================

  model.settingGroups.notifySubscribers();

  log("Loaded — group='" + GROUP_NAME + "', " +
      Object.keys(SETTINGS).length + " keys registered");
})();
