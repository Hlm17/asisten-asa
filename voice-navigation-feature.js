/**
 * For feature pages (deteksi-uang, lokasi, pesan-cepat, sirene, suara-visual, suara-teks).
 * When user has full voice navigation enabled, speak a hint and listen for "Kembali" to go back to main.
 */
(function () {
  if (localStorage.getItem("voiceNavigation") !== "true") return;

  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  var recognition = new SpeechRecognition();
  recognition.lang = "id-ID";
  recognition.continuous = true;
  recognition.interimResults = true;

  var hintText = "Jika anda ingin kembali ke beranda, katakan 'Kembali'.";
  var backUrl = "../index.html";

  function speak(text, onEnd) {
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.lang = "id-ID";
    u.rate = 1;
    if (onEnd && typeof onEnd === "function") {
      u.onend = onEnd;
    }
    window.speechSynthesis.speak(u);
  }

  function goBack() {
    try {
      recognition.stop();
    } catch (e) {}
    sessionStorage.setItem("from_feature_back", "1");
    speak("Kembali ke beranda", function () {
      window.location.href = backUrl;
    });
  }

  function isBackCommand(transcript) {
    var t = (transcript || "").trim().toLowerCase();
    return t.includes("kembali") || t.includes("beranda") || t === "back";
  }

  recognition.onresult = function (event) {
    for (var i = 0; i < event.results.length; i++) {
      var result = event.results[i];
      if (!result.isFinal) continue;
      var segment = result[0];
      if (!segment) continue;
      var transcript = segment.transcript.trim().toLowerCase();
      if (isBackCommand(transcript)) {
        goBack();
        return;
      }
    }
  };

  recognition.onerror = function (e) {
    if (e.error === "aborted") return;
    setTimeout(function () {
      try {
        recognition.start();
      } catch (err) {}
    }, 600);
  };

  recognition.onend = function () {
    if (localStorage.getItem("voiceNavigation") !== "true") return;
    setTimeout(function () {
      try {
        recognition.start();
      } catch (err) {}
    }, 400);
  };

  function init() {
    setTimeout(function () {
      speak(hintText, function () {
        setTimeout(function () {
          try {
            recognition.start();
          } catch (e) {}
        }, 500);
      });
    }, 600);
  }

  function markBackToMainLinks() {
    document.querySelectorAll('a[href="/"], a[href="../"], a[href="../index.html"]').forEach(function (a) {
      a.addEventListener("click", function () {
        sessionStorage.setItem("from_feature_back", "1");
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      markBackToMainLinks();
      init();
    });
  } else {
    markBackToMainLinks();
    init();
  }
})();
