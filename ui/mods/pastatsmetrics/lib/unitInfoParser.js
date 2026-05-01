/**
 * PaStats Metrics - Unit Info Parser
 * Builds a map: spec_id (unit JSON path) -> array of unit type tags
 * (e.g. "units/commander/commander.json" -> ["Mobile", "Commander", "Important", ...])
 *
 * Reads the base game's unit_list.json + each unit JSON (recursively following
 * base_spec inheritance) to aggregate the UNITTYPE_* tags from `unit_types`.
 *
 * Used by pastatsmetrics_unit_alert.js to decide which popup alerts to keep.
 *
 * ES5 Compatible for Planetary Annihilation (Coherent GT webview).
 * Adapted from the original PA Stats mod by ColaColin (MIT-compatible).
 */

var paStatsUnitInfoParser =
  (typeof paStatsUnitInfoParser === "undefined") ?
  (function () {
    var _coherentHost = "coui://";
    var _unitListPath = _coherentHost + "pa/units/unit_list.json";

    /**
     * Walk the unit's base_spec chain, calling dataGetter on each unit JSON.
     * dataMerger combines the result from the current unit and its base spec.
     */
    function _loadUnitData(onComplete, dataGetter, dataMerger) {
      var resultTypeMapping = {};
      var spawnedUnitCalls = 0;

      $.getJSON(_unitListPath, function (data) {
        var units = data.units;

        function countDown() {
          spawnedUnitCalls--;
          if (spawnedUnitCalls === 0) {
            onComplete(resultTypeMapping);
          }
        }

        function readUnitDataFromFile(file, callback) {
          $.getJSON(file, function (unit) {
            var freshDataFromUnit = dataGetter(unit);
            var baseSpec = unit.base_spec;

            if (baseSpec !== undefined) {
              readUnitDataFromFile(_coherentHost + baseSpec, function (unitData) {
                callback(dataMerger(freshDataFromUnit, unitData));
              });
            } else {
              if (freshDataFromUnit !== undefined) {
                callback(freshDataFromUnit);
              }
              countDown();
            }
          }).fail(function () {
            // Some unit JSONs may be missing (moddged or incomplete installs).
            // Skip silently and keep going.
            countDown();
          });
        }

        spawnedUnitCalls = units.length;
        function processUnitPath(unitPath) {
          readUnitDataFromFile(_coherentHost + unitPath, function (unitData) {
            resultTypeMapping[unitPath] = unitData;
          });
        }
        for (var i = 0; i < units.length; i++) {
          processUnitPath(units[i]);
        }
      });
    }

    /**
     * Build a map spec_id -> array of unit type tags (UNITTYPE_ prefix stripped).
     * Tags are merged from the entire base_spec inheritance chain.
     */
    function _loadUnitTypeMapping(onComplete) {
      _loadUnitData(onComplete, function (unit) {
        var unitTypes = unit.unit_types;
        if (unitTypes !== undefined) {
          for (var u = 0; u < unitTypes.length; u++) {
            unitTypes[u] = unitTypes[u].replace("UNITTYPE_", "");
          }
        }
        return unitTypes;
      }, function (dataUpTheTree, dataDownTheTree) {
        if (dataUpTheTree === undefined) dataUpTheTree = [];
        if (dataDownTheTree === undefined) dataDownTheTree = [];
        return dataUpTheTree.concat(dataDownTheTree);
      });
    }

    return {
      loadUnitTypeMapping: _loadUnitTypeMapping
    };
  }()) : paStatsUnitInfoParser;
