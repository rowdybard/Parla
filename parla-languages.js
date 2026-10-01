/* =========================================================
   Parla — langues et niveaux

   Une même langue est écrite de plusieurs façons sur le site :
   en code (« en ») par le choix des langues de l'apprenant et
   par le test de niveau, en libellé (« Anglais ») par le
   formulaire des missions, et de l'une ou l'autre façon sur
   les profils. ParlaLanguages les compare comme une seule
   langue, quelle que soit leur écriture.
   ========================================================= */

(function () {

  var LABELS = { fr: "Français", en: "Anglais", es: "Espagnol" };

  var ALIASES = {
    fr: ["fr", "fra", "fre", "francais", "french"],
    en: ["en", "eng", "anglais", "english"],
    es: ["es", "spa", "espagnol", "espanol", "spanish"]
  };

  var LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

  var lookup = {};
  Object.keys(ALIASES).forEach(function (code) {
    ALIASES[code].forEach(function (name) { lookup[name] = code; });
  });

  // « Français », « français », « francais », « FR », « fr » → « fr »
  function code(value) {
    var key = String(value == null ? "" : value)
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    return lookup[key] || "";
  }

  // « a2 », « A2 » → « A2 » ; autre chose → ""
  function level(value) {
    var v = String(value == null ? "" : value).trim().toUpperCase();
    return LEVELS.indexOf(v) >= 0 ? v : "";
  }

  window.ParlaLanguages = {
    codes: Object.keys(LABELS),
    levels: LEVELS.slice(),
    code: code,
    level: level,

    label: function (value) {
      return LABELS[code(value)] || (value == null ? "" : String(value));
    },

    same: function (a, b) {
      var x = code(a);
      return x !== "" && x === code(b);
    },

    // pour trier les niveaux du plus simple au plus avancé
    levelRank: function (value) {
      var i = LEVELS.indexOf(level(value));
      return i < 0 ? LEVELS.length : i;
    }
  };

})();
