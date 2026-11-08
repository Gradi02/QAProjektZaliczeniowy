class VADProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const { frameSize, silenceFramesCount, rmsThreshold, preBufferSize } = options.processorOptions;
    this.frameSize = frameSize;
    this.silenceFramesCount = silenceFramesCount;
    this.rmsThreshold = rmsThreshold;
    this.preBufferSize = preBufferSize;

    this.recordingBuffer = [];
    this.preBuffer = new Float32Array(this.preBufferSize);
    this.preBufferIndex = 0;

    this.isSpeaking = false;
    this.silenceFrames = 0;
    this.currentFrame = [];
  }

  calculateRMS(buffer) {
    if (!buffer || buffer.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    const rms = Math.sqrt(sum / buffer.length);
    this.port.postMessage({ type: 'rms', value: rms });
    return rms;
  }

  addToPreBuffer(data) {
    for (let i = 0; i < data.length; i++) {
      this.preBuffer[this.preBufferIndex] = data[i];
      this.preBufferIndex = (this.preBufferIndex + 1) % this.preBufferSize;
    }
  }

  getPreBufferContent() {
    const sortedBuffer = new Float32Array(this.preBufferSize);
    const firstPartLength = this.preBufferSize - this.preBufferIndex;
    sortedBuffer.set(this.preBuffer.subarray(this.preBufferIndex), 0);
    sortedBuffer.set(this.preBuffer.subarray(0, this.preBufferIndex), firstPartLength);
    return Array.from(sortedBuffer);
  }

  process(inputs, outputs, parameters) {
    const inputChannel = inputs[0][0];
    if (!inputChannel) return true;

    this.currentFrame.push(...inputChannel);
    this.addToPreBuffer(inputChannel);

    while (this.currentFrame.length >= this.frameSize) {
      const frameToProcess = this.currentFrame.splice(0, this.frameSize);
      const rms = this.calculateRMS(frameToProcess);

      if (rms > this.rmsThreshold) {
        this.port.postMessage({ type: 'vad', speaking: true });
        this.silenceFrames = 0;
        if (!this.isSpeaking) {
          this.isSpeaking = true;
          this.recordingBuffer = this.getPreBufferContent();
        }
        this.recordingBuffer.push(...frameToProcess);
      } else {
        this.port.postMessage({ type: 'vad', speaking: false });
        if (this.isSpeaking) {
          this.silenceFrames++;
          this.recordingBuffer.push(...frameToProcess);
          if (this.silenceFrames > this.silenceFramesCount) {
            this.isSpeaking = false;
            this.silenceFrames = 0;

            this.port.postMessage({
              type: 'audioData',
              audio: new Float32Array(this.recordingBuffer),
            });
            this.recordingBuffer = [];
          }
        }
      }
    }
    return true;
  }
}

registerProcessor('vad-processor', VADProcessor);
