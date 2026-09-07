/**
 * Shared NeMo 128-mel log-spectrogram frontend (canary-180m-flash and
 * parakeet-tdt-v3 use the identical "nemo128" preprocessing):
 * 16 kHz mono, preemph 0.97, symmetric Hann(400) centred in the 512-point window,
 * hop 160, n_fft 512 with centred reflect padding, power spectrum,
 * slaney/slaney mel filterbank (257×128), natural log with 2^-24 guard,
 * per-feature normalisation over all frames (ddof=1).
 */
const N_FFT = 512;
const WIN_LENGTH = 400;
const HOP_LENGTH = 160;
const PREEMPH = 0.97;
const LOG_GUARD = 2 ** -24;
const N_MELS = 128;
const NUM_FREQ_BINS = N_FFT / 2 + 1;
const PAD = N_FFT / 2;
const VAR_EPS = 1e-5;
const MEL_HZ_TO_MEL_EPS = 1.1920928955078125e-7;

export interface NemoMelResult {
    /** Channel-first [1, N_MELS, totalFrames]: index = channel * totalFrames + frame. */
    features: Float32Array;
    totalFrames: number;
    /** Frames the normalisation statistics are computed over (all frames; 0 for inputs too short to reflect-pad). */
    validFrames: number;
}

function hzToMel(freq: number): number {
    return freq < 1000 ? (3 * freq) / 200 : 15 + (27 * Math.log(freq / 1000 + MEL_HZ_TO_MEL_EPS)) / Math.log(6.4);
}

function melToHz(mel: number): number {
    return mel < 15 ? (200 * mel) / 3 : 1000 * Math.pow(6.4, (mel - 15) / 27);
}

function buildSlaneyFbank(): Float64Array {
    const allFreqs = new Float64Array(NUM_FREQ_BINS);
    for (let i = 0; i < NUM_FREQ_BINS; i++) allFreqs[i] = (8000 * i) / (NUM_FREQ_BINS - 1);
    const mMin = hzToMel(0);
    const mMax = hzToMel(8000);
    const mPts = new Float64Array(N_MELS + 2);
    for (let i = 0; i <= N_MELS + 1; i++) mPts[i] = melToHz(mMin + ((mMax - mMin) * i) / (N_MELS + 1));
    const fb = new Float64Array(NUM_FREQ_BINS * N_MELS);
    for (let j = 0; j < NUM_FREQ_BINS; j++) {
        const f = allFreqs[j];
        for (let i = 0; i < N_MELS; i++) {
            const lower = (f - mPts[i]) / (mPts[i + 1] - mPts[i]);
            const upper = (mPts[i + 2] - f) / (mPts[i + 2] - mPts[i + 1]);
            const ramp = Math.max(0, Math.min(lower, upper));
            fb[j * N_MELS + i] = (ramp * 2) / (mPts[i + 2] - mPts[i]);
        }
    }
    return fb;
}

// Precomputed once at module load (~0.5 MB).
const FBANK = buildSlaneyFbank();

const HANN = new Float64Array(N_FFT);
const WINDOW_OFFSET = (N_FFT - WIN_LENGTH) / 2;
for (let i = 0; i < WIN_LENGTH; i++) HANN[WINDOW_OFFSET + i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (WIN_LENGTH - 1));

const FFT_SIZE = N_FFT;
const FFT_LEVELS = 9;
const COS_TABLE = new Float64Array(FFT_SIZE / 2);
const SIN_TABLE = new Float64Array(FFT_SIZE / 2);
for (let i = 0; i < FFT_SIZE / 2; i++) {
    COS_TABLE[i] = Math.cos((-2 * Math.PI * i) / FFT_SIZE);
    SIN_TABLE[i] = Math.sin((-2 * Math.PI * i) / FFT_SIZE);
}

const fftRe = new Float64Array(FFT_SIZE);
const fftIm = new Float64Array(FFT_SIZE);

/** In-place iterative radix-2 FFT; leaves magnitudes² for the first half in `power`. */
function fftPower(real: Float64Array, power: Float64Array): void {
    const re = fftRe;
    const im = fftIm;
    re.set(real);
    im.fill(0);
    for (let i = 1, j = 0; i < FFT_SIZE; i++) {
        let bit = FFT_SIZE >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            const tr = re[i];
            re[i] = re[j];
            re[j] = tr;
            const ti = im[i];
            im[i] = im[j];
            im[j] = ti;
        }
    }
    for (let level = 0; level < FFT_LEVELS; level++) {
        const span = 1 << level;
        const step = 2 * span;
        for (let start = 0; start < FFT_SIZE; start += step) {
            for (let k = 0; k < span; k++) {
                const twiddle = (k * FFT_SIZE) / step;
                const wr = COS_TABLE[twiddle];
                const wi = SIN_TABLE[twiddle];
                const i0 = start + k;
                const i1 = i0 + span;
                const tr = wr * re[i1] - wi * im[i1];
                const ti = wr * im[i1] + wi * re[i1];
                re[i1] = re[i0] - tr;
                im[i1] = im[i0] - ti;
                re[i0] += tr;
                im[i0] += ti;
            }
        }
    }
    for (let k = 0; k < NUM_FREQ_BINS; k++) power[k] = re[k] * re[k] + im[k] * im[k];
}

const frameReal = new Float64Array(FFT_SIZE);
const framePower = new Float64Array(NUM_FREQ_BINS);

/**
 * Computes the NeMo 128-mel log-spectrogram for one utterance of 16 kHz mono
 * PCM. Throws nothing — callers feed the returned `validFrames` to the encoder
 * and must guard themselves against audio below two valid frames.
 *
 * @param pcm exactly the utterance samples at 16 kHz, mono, typically −1..1
 */
export function computeNemoMel(pcm: Float32Array): NemoMelResult {
    const samples = pcm.length;
    const totalFrames = Math.floor(samples / HOP_LENGTH) + 1;
    const features = new Float32Array(N_MELS * totalFrames);

    // Reflect padding (NeMo pad_mode="reflect") needs PAD samples on both sides.
    if (samples < PAD + 1) return { features, totalFrames, validFrames: 0 };
    const validFrames = totalFrames;

    const logMel = new Float64Array(N_MELS * totalFrames);
    for (let frame = 0; frame < totalFrames; frame++) {
        const start = frame * HOP_LENGTH - PAD;
        for (let i = 0; i < FFT_SIZE; i++) {
            const idx = start + i;
            // Centred reflect padding. Pre-emphasis y[0]=x[0], y[t]=x[t]−0.97·x[t−1] is applied
            // to the raw waveform first; the padding reflects the pre-emphasised signal.
            const source = idx < 0 ? -idx : idx >= samples ? 2 * (samples - 1) - idx : idx;
            const preemphasised = source === 0 ? pcm[0] : pcm[source] - PREEMPH * pcm[source - 1];
            frameReal[i] = preemphasised * HANN[i];
        }
        fftPower(frameReal, framePower);
        for (let c = 0; c < N_MELS; c++) {
            let sum = 0;
            for (let j = 0; j < NUM_FREQ_BINS; j++) sum += framePower[j] * FBANK[j * N_MELS + c];
            logMel[c * totalFrames + frame] = Math.log(sum + LOG_GUARD);
        }
    }

    // Per-feature (per mel channel) normalisation over all frames, unbiased variance.
    for (let c = 0; c < N_MELS; c++) {
        let mean = 0;
        for (let t = 0; t < validFrames; t++) mean += logMel[c * totalFrames + t];
        mean /= validFrames;
        let variance = 0;
        for (let t = 0; t < validFrames; t++) {
            const diff = logMel[c * totalFrames + t] - mean;
            variance += diff * diff;
        }
        variance /= validFrames - 1;
        const scale = Math.sqrt(variance) + VAR_EPS;
        for (let t = 0; t < totalFrames; t++) {
            const index = c * totalFrames + t;
            features[index] = (logMel[index] - mean) / scale;
        }
    }

    return { features, totalFrames, validFrames };
}
