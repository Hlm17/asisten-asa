// Configure ONNX Runtime WASM path
ort.env.wasm.wasmPaths =
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/";

/**
 * detector.js — ONNX Runtime YOLO inference module.
 *
 * Loads the YOLO ONNX model, captures frames from a <video> element,
 * preprocesses them to 640×640, runs inference, and post-processes the
 * output (NMS + confidence filtering) to return detection results.
 */

// ── Constants ───────────────────────────────────────────────────────
const INPUT_SIZE = 640;            // YOLO input resolution
const CONF_THRESH = 0.4;           // Minimum confidence to accept a detection
const IOU_THRESH = 0.5;           // IoU threshold for Non-Maximum Suppression
const NUM_CLASSES = 7;

// Class index → denomination string
const CLASS_NAMES = [
    '1000', '10000', '100000', '2000', '20000', '5000', '50000'
];

// Colour palette for bounding boxes (one per class)
export const CLASS_COLORS = [
    '#FF6B6B', '#FFA94D', '#FFD43B', '#69DB7C',
    '#4DABF7', '#9775FA', '#F783AC'
];

let session = null;   // ONNX InferenceSession

// ── Public API ──────────────────────────────────────────────────────

/**
 * Load the ONNX model from the given path.
 * @param {string} modelPath - relative URL to the .onnx file
 * @returns {Promise<void>}
 */
export async function loadModel(modelPath) {
    try {
        console.log("Loading model:", modelPath);

        session = await ort.InferenceSession.create(modelPath, {
            executionProviders: ['wasm']
        });

        console.log("Model loaded successfully");
    } catch (error) {
        console.error("MODEL LOAD ERROR:", error);
    }
}

/**
 * Run detection on the current video frame.
 *
 * @param {HTMLVideoElement} video
 * @returns {Promise<Array<{box: number[], className: string, confidence: number, colorIndex: number}>>}
 */
export async function detect(video) {
    if (!session) throw new Error('Model not loaded');

    // 1. Capture & preprocess the frame
    const { tensor, xRatio, yRatio } = preprocess(video);

    // 2. Run inference
    const inputName = session.inputNames[0];
    const feeds = { [inputName]: tensor };
    const results = await session.run(feeds);

    // 3. Post-process YOLO output → detections
    const output = results[session.outputNames[0]];
    const detections = postprocess(output, xRatio, yRatio);

    return detections;
}

// ── Preprocessing ───────────────────────────────────────────────────

/**
 * Capture a frame from the video and convert it into a normalised
 * Float32 NCHW tensor [1, 3, 640, 640].
 */
function preprocess(video) {
    const canvas = document.createElement('canvas');
    canvas.width = INPUT_SIZE;
    canvas.height = INPUT_SIZE;
    const ctx = canvas.getContext('2d');

    // Calculate letterbox ratios so we can map boxes back later
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const xRatio = vw / INPUT_SIZE;
    const yRatio = vh / INPUT_SIZE;

    // Draw the video frame resized to 640×640
    ctx.drawImage(video, 0, 0, INPUT_SIZE, INPUT_SIZE);

    const imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
    const pixels = imageData.data; // RGBA flat array

    // Separate channels and normalise to [0, 1]
    const totalPixels = INPUT_SIZE * INPUT_SIZE;
    const float32 = new Float32Array(3 * totalPixels);

    for (let i = 0; i < totalPixels; i++) {
        float32[i] = pixels[i * 4] / 255.0; // R
        float32[i + totalPixels] = pixels[i * 4 + 1] / 255.0; // G
        float32[i + 2 * totalPixels] = pixels[i * 4 + 2] / 255.0; // B
    }

    const tensor = new ort.Tensor('float32', float32, [1, 3, INPUT_SIZE, INPUT_SIZE]);
    return { tensor, xRatio, yRatio };
}

// ── Post-processing ─────────────────────────────────────────────────

/**
 * Parse the raw YOLO output tensor [1, (4+NUM_CLASSES), 8400] into a
 * list of filtered, NMS-ed detections.
 */
function postprocess(output, xRatio, yRatio) {
    const data = output.data;            // Float32Array
    const dims = output.dims;            // [1, 11, 8400]
    const numAnchors = dims[2];            // 8400
    const numFields = dims[1];            // 4 + NUM_CLASSES = 11

    const candidates = [];

    for (let i = 0; i < numAnchors; i++) {
        // Extract class scores (indices 4..10 for each anchor)
        let maxScore = 0;
        let maxIdx = 0;
        for (let c = 0; c < NUM_CLASSES; c++) {
            const score = data[(4 + c) * numAnchors + i];
            if (score > maxScore) {
                maxScore = score;
                maxIdx = c;
            }
        }

        if (maxScore < CONF_THRESH) continue;

        // Extract box (cx, cy, w, h) — raw model output
        const cx = data[0 * numAnchors + i];
        const cy = data[1 * numAnchors + i];
        const w = data[2 * numAnchors + i];
        const h = data[3 * numAnchors + i];

        // Convert to (x1, y1, x2, y2) scaled back to original video size
        const x1 = (cx - w / 2) * xRatio;
        const y1 = (cy - h / 2) * yRatio;
        const x2 = (cx + w / 2) * xRatio;
        const y2 = (cy + h / 2) * yRatio;

        candidates.push({
            box: [x1, y1, x2, y2],
            className: CLASS_NAMES[maxIdx],
            confidence: maxScore,
            colorIndex: maxIdx,
        });
    }

    // Sort by confidence descending
    candidates.sort((a, b) => b.confidence - a.confidence);

    // Non-Maximum Suppression
    return nms(candidates, IOU_THRESH);
}

/**
 * Greedy Non-Maximum Suppression.
 */
function nms(boxes, iouThreshold) {
    const kept = [];

    for (const box of boxes) {
        let dominated = false;
        for (const keptBox of kept) {
            if (iou(box.box, keptBox.box) > iouThreshold) {
                dominated = true;
                break;
            }
        }
        if (!dominated) kept.push(box);
    }

    return kept;
}

/**
 * Intersection-over-Union for two [x1, y1, x2, y2] boxes.
 */
function iou(a, b) {
    const x1 = Math.max(a[0], b[0]);
    const y1 = Math.max(a[1], b[1]);
    const x2 = Math.min(a[2], b[2]);
    const y2 = Math.min(a[3], b[3]);

    const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const areaA = (a[2] - a[0]) * (a[3] - a[1]);
    const areaB = (b[2] - b[0]) * (b[3] - b[1]);

    return inter / (areaA + areaB - inter + 1e-6);
}
