/**
 * voice.js — Web Speech API module for Indonesian banknote announcements.
 *
 * Maps detected class names to Indonesian speech strings and handles
 * text-to-speech output with a 4-second cooldown so the same denomination
 * can be repeated after two consecutive detection cycles.
 */

// ── Class-name → spoken phrase mapping ──────────────────────────────
const VALUE_SPEECH_MAP = {
    '1000': 'seribu',
    '2000': 'dua ribu',
    '5000': 'lima ribu',
    '10000': 'sepuluh ribu',
    '20000': 'dua puluh ribu',
    '50000': 'lima puluh ribu',
    '100000': 'seratus ribu',
};

// Cooldown tracking — stores the timestamp of the last announcement per class
let lastSpokenTime = {};

// Cooldown duration in milliseconds (4 seconds)
const COOLDOWN_MS = 4000;

/**
 * Speak the detected banknote value in Indonesian.
 * Announces "Ini uang <value> rupiah". Will re-announce the same value
 * only after the cooldown period (4 s) has elapsed.
 *
 * @param {string} className - One of the YOLO class names (e.g. '50000')
 */
export function speak(className) {
    const phrase = VALUE_SPEECH_MAP[className];
    if (!phrase) return;

    const now = Date.now();
    const lastTime = lastSpokenTime[className] || 0;

    if (now - lastTime < COOLDOWN_MS) return;

    lastSpokenTime[className] = now;

    const utterance = new SpeechSynthesisUtterance(`Ini uang ${phrase} rupiah`);
    
    const voices = speechSynthesis.getVoices();
    const indoVoice = voices.find(v => v.lang === "id-ID");

    if (indoVoice) {
        utterance.voice = indoVoice;
    }

    utterance.rate = 1;
    utterance.pitch = 1;

    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
}