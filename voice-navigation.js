let voiceNavigationEnabled = null;
let recognitionActive = false;
var micPausedUntilIntroDone = false;

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

const recognition = new SpeechRecognition();

recognition.lang = "id-ID";
recognition.continuous = true;
recognition.interimResults = true;
recognition.maxAlternatives = 2;

function speak(text, onEnd) {
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "id-ID";
  utterance.rate = 1;
  if (onEnd && typeof onEnd === "function") {
    utterance.onend = onEnd;
  }
  speechSynthesis.speak(utterance);
}

function setVoiceNavigation(status) {
  voiceNavigationEnabled = status;
  localStorage.setItem("voiceNavigation", status);
  updateVoiceNavBadge();
}

function updateVoiceNavBadge() {
  var badge = document.getElementById("voice-nav-badge");
  if (!badge) return;
  if (voiceNavigationEnabled === true) {
    badge.classList.remove("hidden");
    badge.classList.add("flex");
  } else {
    badge.classList.add("hidden");
    badge.classList.remove("flex");
  }
}


function enableVoiceNavigation() {
  setVoiceNavigation(true);
  startVoiceNavigation();
  showPage("page-main-menu");
}

function disableVoiceNavigation() {
  setVoiceNavigation(false);
  showPage("page-main-menu");
}

function askVoiceNavigation() {
  var question =
    "Apakah anda ingin menggunakan navigasi suara penuh? Katakan ya atau tidak.";
  speak(question, function () {
    setTimeout(function () {
      startRecognitionForSetup();
    }, 500);
  });
}

// Called when user taps the overlay (user gesture required for Chrome to allow speech).
function dismissVoiceSetupOverlayAndSpeak(event) {
  const overlay = document.getElementById("voice-setup-overlay");
  if (!overlay) return;
  overlay.style.display = "none";
  overlay.removeAttribute("tabindex");
  overlay.setAttribute("aria-hidden", "true");
  askVoiceNavigation();
  const firstButton = document.querySelector("#page-voice-setup button");
  if (firstButton) firstButton.focus();
}

function startVoiceNavigation() {
  if (!voiceNavigationEnabled) return;
  var msg = "Kami memiliki fitur deteksi uang dan lokasi anda, tolong ucapkan fitur apa yang anda inginkan.";
  speak(msg, function () {
    micPausedUntilIntroDone = false;
    setTimeout(function () {
      if (!recognitionActive) {
        try {
          recognition.start();
        } catch (e) {}
      }
    }, 1200);
  });
}

function handleCommand(command) {
  if (!voiceNavigationEnabled) return;
  try {
    recognition.stop();
  } catch (e) {}
  recognitionActive = false;

  if (command.includes("deteksi uang")) {
    speak("Membuka deteksi uang");
    window.location.href = "deteksi-uang/index.html";
  }
  else if (command.includes("lokasi")) {
    speak("Membuka fitur lokasi anda");
    window.location.href = "lokasi/index.html";
  }
  else if (command.includes("pesan cepat")) {
    speak("Membuka pesan cepat");
    window.location.href = "pesan-cepat/index.html";
  }
  else if (command.includes("sirene")) {
    speak("Mengaktifkan sirene");
    window.location.href = "sirene/index.html";
  }
  else if (command.includes("menu utama") || command.includes("kembali") || command.includes("beranda")) {
    speak("Kembali ke beranda", function () {
      showPage("page-main-menu");
      setTimeout(function () {
        try {
          recognition.start();
        } catch (e) {}
      }, 500);
    });
  }
}

function isYes(text) {
  var t = (text || "").trim().toLowerCase();
  return /^(ya|iya|iyah|yah|yakin|yes)$/.test(t) || t.includes("ya") || t.includes("iya");
}

function isNo(text) {
  var t = (text || "").trim().toLowerCase();
  return /^(tidak|enggak|nggak|tak|no)$/.test(t) || t.includes("tidak") || t.includes("enggak") || t.includes("nggak");
}

recognition.onresult = function (event) {
  if (voiceNavigationEnabled !== null) {
    var lastResult = event.results[event.results.length - 1];
    var lastSegment = lastResult && lastResult[0];
    if (!lastSegment || !lastResult.isFinal) return;
    handleCommand(lastSegment.transcript.trim().toLowerCase());
    return;
  }

  for (var i = 0; i < event.results.length; i++) {
    var result = event.results[i];
    if (!result.isFinal) continue;
    var segment = result[0];
    if (!segment) continue;
    var transcript = segment.transcript.trim().toLowerCase();
    if (isYes(transcript)) {
      micPausedUntilIntroDone = true;
      try {
        recognition.stop();
      } catch (e) {}
      recognitionActive = false;
      setVoiceNavigation(true);
      showPage("page-main-menu");
      speak("Navigasi suara diaktifkan", function () {
        startVoiceNavigation();
      });
      return;
    }
    if (isNo(transcript)) {
      setVoiceNavigation(false);
      speak("Navigasi suara tidak diaktifkan", function () {
        showPage("page-main-menu");
      });
      return;
    }
  }
};

recognition.onstart = function () {
  recognitionActive = true;
};

recognition.onerror = function (event) {
  recognitionActive = false;
  if (event.error === "aborted") return;
  if (micPausedUntilIntroDone) return;
  var isSetup = voiceNavigationEnabled === null;
  var isEnabled = voiceNavigationEnabled === true;
  if (isSetup || isEnabled) {
    setTimeout(function () {
      if (micPausedUntilIntroDone) return;
      if (isSetup) startRecognitionForSetup();
      else try { recognition.start(); } catch (e) {}
    }, 600);
  }
};

recognition.onend = function () {
  recognitionActive = false;
  if (micPausedUntilIntroDone) return;
  var isSetup = voiceNavigationEnabled === null;
  var isEnabled = voiceNavigationEnabled === true;
  if (isSetup || isEnabled) {
    setTimeout(function () {
      if (micPausedUntilIntroDone) return;
      if (isSetup) startRecognitionForSetup();
      else try { recognition.start(); } catch (e) {}
    }, 400);
  }
};

function startRecognitionForSetup() {
  if (localStorage.getItem("voiceNavigation") !== null) return;
  if (recognitionActive) return;
  try {
    recognition.start();
  } catch (e) {
    recognitionActive = false;
  }
}

window.onload = function () {
  var savedPreference = localStorage.getItem("voiceNavigation");

  if (savedPreference !== null) {
    voiceNavigationEnabled = savedPreference === "true";
    updateVoiceNavBadge();
    if (voiceNavigationEnabled) {
      startVoiceNavigation();
    }
  }
};

// Call this when the voice-setup page is actually shown (after loading screen).
// We only try auto-speak; Chrome often blocks speech until user taps (no gesture on first load).
// The "Dengarkan pertanyaan" button guarantees speech works after a user gesture.
function onVoiceSetupPageShown() {
  if (localStorage.getItem("voiceNavigation") !== null) return;
  askVoiceNavigation();
}