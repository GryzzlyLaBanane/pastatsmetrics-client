/**
 * PaStats Metrics v8 — In-game options bar buttons
 *
 * Injects two clickable badges into PA's in-game options bar:
 *   PS    — toggle the whole mod on/off (master kill switch).
 *   LITE  — toggle "performance mode" (skip camera, drop most watchlist events).
 *
 * Each click flips a Knockout observable, persists the new state to
 * localStorage (raw key + ui-namespaced mirror), and broadcasts it to the
 * parent live_game scene where pastatsmetrics_gamedata.js applies it
 * immediately on the next tick.
 *
 * Pattern lifted from v4.5's options bar (which the user removed by mistake
 * in v6/v7) with two safety improvements:
 *   1. Bail out cleanly if PA's options-bar selector ever changes (don't throw).
 *   2. Honor the `pastats_show_options_buttons` setting (settings page can
 *      hide the buttons entirely).
 *
 * ES5 compatible — no const/let/arrows.
 */

(function () {
  var LOG_PREFIX = "[PAStats:OptionsBar]";

  function log(msg) { try { console.log(LOG_PREFIX + " " + msg); } catch (e) {} }

  // --- Respect the "Show in-game buttons" setting ---
  // Read the same key the settings page writes (PA's setting-template stores
  // booleans as the literal "ON" / "OFF" strings). Default = show.
  try {
    var showButtons = localStorage.getItem("ui.pastats_show_options_buttons");
    if (showButtons === "OFF") {
      log("Buttons disabled by user setting — skipping injection");
      return;
    }
  } catch (e) { /* localStorage unavailable; show buttons as fallback */ }

  // --- Initial state from localStorage (raw keys) ---
  var savedMod  = null;
  var savedPerf = null;
  try {
    savedMod  = localStorage.getItem("pastats_mod_enabled");
    savedPerf = localStorage.getItem("pastats_perf_mode");
  } catch (e) {}

  var initMod  = (savedMod  === null) ? true  : (savedMod  === "true");
  var initPerf = (savedPerf === null) ? false : (savedPerf === "true");

  model.paStatsModEnabled = ko.observable(initMod);
  model.paStatsPerfMode   = ko.observable(initPerf);

  // --- Toggle handlers ---
  model.paStatsToggleMod = function () {
    var next = !model.paStatsModEnabled();
    model.paStatsModEnabled(next);
    try {
      localStorage.setItem("pastats_mod_enabled", String(next));
      localStorage.setItem("ui.pastats_mod_enabled", next ? "ON" : "OFF");
    } catch (e) {}
    try { api.Panel.message(api.Panel.parentId, "pastats_mod_toggle", next); } catch (e) {}
    log("PS toggled: " + next);
  };

  model.paStatsTogglePerf = function () {
    var next = !model.paStatsPerfMode();
    model.paStatsPerfMode(next);
    try {
      localStorage.setItem("pastats_perf_mode", String(next));
      localStorage.setItem("ui.pastats_perf_mode", next ? "ON" : "OFF");
    } catch (e) {}
    try { api.Panel.message(api.Panel.parentId, "pastats_perf_toggle", next); } catch (e) {}
    log("LITE toggled: " + next);
  };

  // --- Inject buttons into the options bar ---
  // PA's options bar is rendered into `.div_ingame_options_bar_cont`. If the
  // selector ever moves we log a warning and stop — better than throwing.
  var $bar = $(".div_ingame_options_bar_cont");
  if ($bar.length === 0) {
    log("WARNING options bar selector not found — buttons skipped");
    return;
  }

  // Two badges. ko if/ifnot picks the cyan-on / grey-off color per state.
  var liteHtml =
    '<div class="btn_ingame_options" title="PA Stats v8: Lite mode (skip camera + drop most watchlist events)">' +
      '<a href="#" data-bind="click: paStatsTogglePerf">' +
        '<!-- ko if: paStatsPerfMode() -->' +
        '<span style="color:#ff9933;font-weight:600;letter-spacing:0.5px;">LITE</span>' +
        '<!-- /ko -->' +
        '<!-- ko ifnot: paStatsPerfMode() -->' +
        '<span style="color:#555555;font-weight:600;letter-spacing:0.5px;">LITE</span>' +
        '<!-- /ko -->' +
      '</a>' +
    '</div>';

  var psHtml =
    '<div class="btn_ingame_options" title="PA Stats v8: Enable / disable stat collection">' +
      '<a href="#" data-bind="click: paStatsToggleMod">' +
        '<!-- ko if: paStatsModEnabled() -->' +
        '<span style="color:#4dcfef;font-weight:600;letter-spacing:0.5px;">PS</span>' +
        '<!-- /ko -->' +
        '<!-- ko ifnot: paStatsModEnabled() -->' +
        '<span style="color:#555555;font-weight:600;letter-spacing:0.5px;">PS</span>' +
        '<!-- /ko -->' +
      '</a>' +
    '</div>';

  // Prepend so PS appears first (left-most), then LITE.
  $bar.prepend(liteHtml);
  $bar.prepend(psHtml);

  log("Buttons injected (mod=" + initMod + " perf=" + initPerf + ")");
})();
