/* Settings: language, view mode, sensor backend address and local data deletion. */
(function () {
  "use strict";
  var FV = window.FV;
  var $ = function (id) { return document.getElementById(id); };
  function validUrl(v) { try { var u = new URL(v); return u.protocol === "http:" || u.protocol === "https:"; } catch (e) { return false; } }
  document.addEventListener("DOMContentLoaded", function () {
    $("st-lang").value = FV.settings.lang;
    $("st-lang").addEventListener("change", function () { FV.settings.lang = this.value; FV.saveSettings(); var top = $("lang-select"); if (top) top.value = this.value; FV.applyI18n(); });
    document.querySelectorAll("[name=st-mode]").forEach(function (r) { r.checked = r.value === FV.settings.mode; r.addEventListener("change", function () { var b = document.querySelector('[data-mode="' + r.value + '"]'); if (b) b.click(); }); });
    $("st-ep").value = FV.settings.iotEndpoint || "";
    $("st-iot").addEventListener("submit", function (e) {
      e.preventDefault(); var v = $("st-ep").value.trim().replace(/\/$/, "");
      if (v && !validUrl(v)) { $("st-ep").setAttribute("aria-invalid", "true"); $("st-ep-e").textContent = "Enter a full address starting with http:// or https://"; return; }
      $("st-ep").removeAttribute("aria-invalid"); $("st-ep-e").textContent = "";
      FV.settings.iotEndpoint = v; FV.settings.iotDemo = !v; FV.saveSettings(); $("st-iot-msg").textContent = v ? "Saved. IoT Monitoring will use this backend." : "Cleared. IoT Monitoring will use demo mode.";
    });
    $("st-test").addEventListener("click", function () {
      var v = $("st-ep").value.trim().replace(/\/$/, ""); if (!validUrl(v)) { $("st-iot-msg").textContent = "Enter a valid address first."; return; }
      $("st-iot-msg").textContent = "Testing...";
      fetch(v + "/api/health").then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (j) { $("st-iot-msg").textContent = "Connected: " + j.readings + " readings stored."; })
        .catch(function (e) { $("st-iot-msg").textContent = "Not reachable (" + e.message + "). Check the address, that the backend is running, its CORS origins, and this site's connect-src policy."; });
    });
    $("st-clear-ep").addEventListener("click", function () { $("st-ep").value = ""; FV.settings.iotEndpoint = ""; FV.settings.iotDemo = true; FV.saveSettings(); $("st-iot-msg").textContent = "Disconnected."; });
    $("st-wipe").addEventListener("click", function () {
      if (!window.confirm("Delete the farm profile and settings stored in this browser? This cannot be undone.")) return;
      try { localStorage.removeItem("fv-farm"); localStorage.removeItem("fv-settings"); sessionStorage.clear(); } catch (e) { /* storage unavailable */ }
      $("st-wipe-msg").textContent = "Deleted. The demonstration farm and default settings will be used.";
    });
  });
})();
