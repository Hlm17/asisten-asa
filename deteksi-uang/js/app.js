/**
 * app.js — Main orchestration for the banknote detection app.
 *
 * Responsibilities:
 * 1. Request camera access and display the stream.
 * 2. Load the YOLO ONNX model.
 * 3. Run detection every 2 seconds.
 * 4. Draw bounding boxes on the canvas overlay.
 * 5. Display detected value and trigger voice announcements.
 */

import { loadModel, detect, CLASS_COLORS } from './detector.js';
import { speak } from './voice.js';

// ── DOM Elements ────────────────────────────────────────────────────
const video = document.getElementById('camera-feed');
const canvas = document.getElementById('detection-canvas');
const ctx = canvas.getContext('2d');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const resultCard = document.getElementById('result-card');
const resultValue = document.getElementById('result-value');
const resultConfidence = document.getElementById('result-confidence');
const viewport = document.getElementById('camera-viewport');

const MODEL_PATH = 'model/best.onnx';

// ── Formatters ──────────────────────────────────────────────────────

/** Format a class name like '50000' → 'Rp 50.000' */
function formatCurrency(className) {
    return 'Rp ' + Number(className).toLocaleString('id-ID');
}

// ── Camera Setup ────────────────────────────────────────────────────

async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 },
            },
            audio: false,
        });
        video.srcObject = stream;
        await video.play();
        console.log('[app] Camera started');
    } catch (err) {
        console.error('[app] Camera error:', err);
        setStatus('error', 'Kamera tidak tersedia');
    }
}

// ── Status Helpers ──────────────────────────────────────────────────

function setStatus(state, text) {
    statusDot.className = 'status-dot';
    if (state === 'ready') statusDot.classList.add('ready');
    if (state === 'error') statusDot.classList.add('error');
    statusText.textContent = text;
}

// ── Drawing ─────────────────────────────────────────────────────────

/** Resize the canvas to match the video element's display size. */
function syncCanvasSize() {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
}

/**
 * Draw bounding boxes for the given detections.
 * @param {Array} detections
 */
function drawDetections(detections) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const det of detections) {
        const [x1, y1, x2, y2] = det.box;
        const color = CLASS_COLORS[det.colorIndex] || '#6366f1';
        const w = x2 - x1;
        const h = y2 - y1;

        // Box
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(x1, y1, w, h);

        // Label background
        const label = `${formatCurrency(det.className)}  ${Math.round(det.confidence * 100)}%`;
        ctx.font = 'bold 16px Inter, sans-serif';
        const metrics = ctx.measureText(label);
        const labelH = 24;
        const labelW = metrics.width + 12;
        const labelY = Math.max(y1 - labelH, 0);

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x1, labelY, labelW, labelH, 4);
        ctx.fill();

        // Label text
        ctx.fillStyle = '#fff';
        ctx.fillText(label, x1 + 6, labelY + 17);
    }
}

// ── Detection Loop ──────────────────────────────────────────────────

async function detectMoney() {
    if (video.readyState < 2) return; // video not ready yet

    syncCanvasSize();

    try {
        const detections = await detect(video);

        drawDetections(detections);

        if (detections.length > 0) {
            // Use the highest-confidence detection
            const best = detections[0];

            // Update UI
            resultCard.classList.add('detected');
            viewport.classList.add('detecting');
            resultValue.textContent = formatCurrency(best.className);
            resultValue.classList.add('highlight');
            resultConfidence.textContent = `Akurasi: ${Math.round(best.confidence * 100)}%`;

            // Speak the value
            speak(best.className);
        } else {
            // No detection — clear UI
            resultCard.classList.remove('detected');
            viewport.classList.remove('detecting');
            resultValue.textContent = 'Belum ada deteksi';
            resultValue.classList.remove('highlight');
            resultConfidence.textContent = '';
        }
    } catch (err) {
        console.error('[app] Detection error:', err);
    }
}

// ── Initialisation ──────────────────────────────────────────────────

async function init() {
    setStatus('loading', 'Memuat model AI…');

    // Start camera and model loading in parallel
    await Promise.all([
        initCamera(),
        loadModel(MODEL_PATH),
    ]);

    setStatus('ready', 'Siap mendeteksi');
    console.log('[app] Ready — starting detection loop');

    // Run detection every 2 seconds
    setInterval(detectMoney, 2000);
}

document.addEventListener('DOMContentLoaded', init);
