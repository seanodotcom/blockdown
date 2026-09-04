/**
 * Blockdown - Vintage PC Speaker Audio Synthesizer
 * Authentically synthesizes IBM PC/Compatibles 1-bit square-wave PC speaker sound effects
 * using the Web Audio API.
 */

export class RetroAudio {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.muted = false;
        this.volume = 0.3;
    }

    /**
     * Initializes AudioContext upon user gesture.
     */
    init() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            return;
        }

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
    }

    setMuted(muted) {
        this.muted = muted;
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
        }
    }

    toggleMute() {
        this.setMuted(!this.muted);
        return this.muted;
    }

    /**
     * Helper to play a single vintage square-wave tone burst.
     */
    playTone(freq, durationSec, delaySec = 0, type = 'square', endFreq = null) {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const startTime = this.ctx.currentTime + delaySec;
        const endTime = startTime + durationSec;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        if (endFreq !== null) {
            osc.frequency.linearRampToValueAtTime(endFreq, endTime);
        }

        // PC speaker has near-instant attack and crisp cutoff
        gain.gain.setValueAtTime(0.6, startTime);
        gain.gain.setValueAtTime(0.6, endTime - 0.003);
        gain.gain.linearRampToValueAtTime(0.0001, endTime);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(startTime);
        osc.stop(endTime);
    }

    /**
     * SFX: Move piece horizontally or forward/backward
     */
    playMove() {
        // High-pitched 12ms tick
        this.playTone(1350, 0.015, 0, 'square', 900);
    }

    /**
     * SFX: Rotate piece in 3D (pitch, yaw, or roll)
     */
    playRotate() {
        // Crisp two-tone chirp
        this.playTone(880, 0.018, 0, 'square');
        this.playTone(1320, 0.020, 0.018, 'square');
    }

    /**
     * SFX: Bump into pit wall or illegal move
     */
    playBump() {
        this.playTone(140, 0.035, 0, 'square');
    }

    /**
     * SFX: Piece drop / lands on floor or stack
     */
    playDrop() {
        // Solid low square wave thud
        this.playTone(180, 0.045, 0, 'square', 60);
    }

    /**
     * SFX: Layer cleared (8-bit arpeggio)
     */
    playLayerClear(layerCount = 1) {
        if (layerCount === 1) {
            // Rapid rising triad
            const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            notes.forEach((freq, idx) => {
                this.playTone(freq, 0.045, idx * 0.045, 'square');
            });
        } else {
            // Multi-layer high arpeggio
            const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
            notes.forEach((freq, idx) => {
                this.playTone(freq, 0.040, idx * 0.038, 'square');
            });
        }
    }

    /**
     * SFX: Level Up fanfare announcing new unlocked pieces!
     */
    playLevelUp() {
        // Triumphant PC speaker flourish
        const melody = [
            { f: 440.00, d: 0.07 }, // A4
            { f: 554.37, d: 0.07 }, // C#5
            { f: 659.25, d: 0.07 }, // E5
            { f: 880.00, d: 0.16 }, // A5
            { f: 659.25, d: 0.06 }, // E5
            { f: 880.00, d: 0.28 }  // A5
        ];

        let offset = 0;
        melody.forEach(n => {
            this.playTone(n.f, n.d, offset, 'square');
            offset += n.d + 0.012;
        });
    }

    /**
     * SFX: Complete pit cleared ("BLOCK OUT" jackpot bonus!)
     */
    playBlockout() {
        // Victorious fanfare arpeggio
        const victory = [
            { f: 523.25, d: 0.06 },
            { f: 659.25, d: 0.06 },
            { f: 783.99, d: 0.06 },
            { f: 1046.50, d: 0.12 },
            { f: 783.99, d: 0.06 },
            { f: 1046.50, d: 0.06 },
            { f: 1318.51, d: 0.24 }
        ];

        let offset = 0;
        victory.forEach(n => {
            this.playTone(n.f, n.d, offset, 'square');
            offset += n.d + 0.01;
        });
    }

    /**
     * SFX: Game Over descending buzz
     */
    playGameOver() {
        const tones = [440, 415.3, 392, 369.9, 329.6, 220, 110];
        tones.forEach((f, i) => {
            this.playTone(f, 0.08, i * 0.085, 'square');
        });
    }
}
