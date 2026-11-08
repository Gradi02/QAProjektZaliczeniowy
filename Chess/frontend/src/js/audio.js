import { elements } from './ui.js';
import { appState } from './state.js';

const TARGET_SAMPLE_RATE = 16000;
const VAD_FRAME_MS = 30;
const VAD_RMS_THRESHOLD = 0.02;
const PRE_BUFFER_MS = 240;
const SILENCE_THRESHOLD_MS = 800;

const HIGH_PASS_FREQ = 80;
const LOW_PASS_FREQ = 4000;

const VAD_FRAME_SIZE = Math.round((TARGET_SAMPLE_RATE * VAD_FRAME_MS) / 1000);
const SILENCE_FRAMES_COUNT = Math.round(SILENCE_THRESHOLD_MS / VAD_FRAME_MS);
const PRE_BUFFER_FRAMES_COUNT = Math.round(PRE_BUFFER_MS / VAD_FRAME_MS);
const PRE_BUFFER_SIZE = PRE_BUFFER_FRAMES_COUNT * VAD_FRAME_SIZE;

let audioContext;
let stream;
let vadNode;

export async function startListening(onAudioReadyCallback) {
    try {
        if (!audioContext) {
            audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
            await audioContext.audioWorklet.addModule('js/vadProcessor.js');
        }
        if (audioContext.state === 'suspended') await audioContext.resume();

        stream = await navigator.mediaDevices.getUserMedia({
            audio: { channelCount: 1, sampleRate: TARGET_SAMPLE_RATE, echoCancellation: true, noiseSuppression: true }
        });

        const source = audioContext.createMediaStreamSource(stream);

        vadNode = new AudioWorkletNode(audioContext, 'vad-processor', {
            processorOptions: {
                frameSize: VAD_FRAME_SIZE,
                silenceFramesCount: SILENCE_FRAMES_COUNT,
                rmsThreshold: VAD_RMS_THRESHOLD,
                preBufferSize: PRE_BUFFER_SIZE
            }
        });

        vadNode.port.onmessage = (event) => {
            if (event.data.type === 'vad') {
                handleVadUpdate(event.data.speaking);
            } else if (event.data.type === 'audioData') {
                processAndRelayAudio(event.data.audio, onAudioReadyCallback);
            } else if (event.data.type === 'rms') {
                updateVoiceLevel(event.data.value);
            }
        };

        source.connect(vadNode);
    } catch (err) {
        console.error('Microphone error:', err);
        throw err;
    }
}

export function stopListening() {
    if (vadNode) vadNode.disconnect();
    if (stream) stream.getTracks().forEach((t) => t.stop());
    handleVadUpdate(false);
    updateVoiceLevel(0);
}

async function processAndRelayAudio(audioFloat32Array, callback) {
const filteredAudio = applyBandPassFilter(audioFloat32Array, LOW_PASS_FREQ, HIGH_PASS_FREQ, TARGET_SAMPLE_RATE);
    const normalizedAudio = normalizeAudio(filteredAudio);

    if (!audioContext) return;

    const audioBuffer = audioContext.createBuffer(1, normalizedAudio.length, TARGET_SAMPLE_RATE);
    audioBuffer.copyToChannel(normalizedAudio, 0);
    const wavBlob = bufferToWavBlob(audioBuffer);
    callback(wavBlob);
}

function handleVadUpdate(isSpeaking) {
    if (isSpeaking && appState.isListening) {
        elements.voiceLevel.classList.add('recording-active');
    } else {
        elements.voiceLevel.classList.remove('recording-active');
    }
}

function updateVoiceLevel(rms) {
    const db = 20 * Math.log10(rms);
    const percentage = Math.max(0, Math.min(100, 100 * (1 + db / 50))); // od -50dB do 0dB
    elements.voiceLevel.style.width = `${percentage}%`;
}

function applyBandPassFilter(data, lowPassFreq, highPassFreq, sampleRate) {
    const lowPassAlpha = Math.exp(-2 * Math.PI * lowPassFreq / sampleRate);
    let lowPassLast = 0;
    const filteredLow = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
        lowPassLast = data[i] * (1 - lowPassAlpha) + lowPassLast * lowPassAlpha;
        filteredLow[i] = lowPassLast;
    }

    const highPassAlpha = Math.exp(-2 * Math.PI * highPassFreq / sampleRate);
    let highPassLastIn = 0;
    let highPassLastOut = 0;
    const finalFiltered = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
        highPassLastOut = (highPassLastOut + filteredLow[i] - highPassLastIn) * highPassAlpha;
        highPassLastIn = filteredLow[i];
        finalFiltered[i] = highPassLastOut;
    }

    return finalFiltered;
}

function normalizeAudio(data) {
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i]);
        if (abs > peak) {
            peak = abs;
        }
    }

    if (peak === 0) return data;

    const gain = 0.9 / peak;
    const normalized = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
        normalized[i] = data[i] * gain;
    }
    return normalized;
}

function floatTo16BitPCM(input) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
}

function bufferToWavBlob(buffer) {
    const pcmData = floatTo16BitPCM(buffer.getChannelData(0));
    const wavHeader = encodeWAV(pcmData, buffer.sampleRate);
    return new Blob([wavHeader, pcmData], { type: 'audio/wav' });
}

function encodeWAV(samples, sampleRate) {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);
    const writeString = (v, offset, str) => {
        for (let i = 0; i < str.length; i++) v.setUint8(offset + i, str.charCodeAt(i));
    };
    const pcmLength = samples.length * 2;
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcmLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, pcmLength, true);
    return view.buffer;
}