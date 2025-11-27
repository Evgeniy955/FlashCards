// Simple Web Audio API wrapper for UI sounds
class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private gainNode: GainNode | null = null;

  constructor() {
    // Load mute preference from local storage
    try {
      this.isMuted = localStorage.getItem('app_sfx_muted') === 'true';
    } catch (e) {
      this.isMuted = false;
    }
  }

  private init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
        this.gainNode = this.ctx.createGain();
        this.gainNode.connect(this.ctx.destination);
      }
    }
    // Resume context if suspended (browser autoplay policy)
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    localStorage.setItem('app_sfx_muted', String(this.isMuted));
    return this.isMuted;
  }

  public play(type: 'click' | 'flip' | 'correct' | 'incorrect' | 'success') {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx || !this.gainNode) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.gainNode);

    switch (type) {
      case 'click':
        // Soft high tick
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
        break;

      case 'flip':
        // Soft swoosh/pop
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.linearRampToValueAtTime(300, t + 0.1);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.linearRampToValueAtTime(0.001, t + 0.15);
        osc.start(t);
        osc.stop(t + 0.15);
        break;

      case 'correct':
        // Pleasant "Ding" (High C major)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, t); // C5
        osc.frequency.exponentialRampToValueAtTime(523.25, t + 0.1);
        
        // Add a overtone for "sparkle"
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(this.gainNode);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1046.50, t); // C6
        
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        
        gain2.gain.setValueAtTime(0.05, t);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

        osc.start(t);
        osc.stop(t + 0.5);
        osc2.start(t);
        osc2.stop(t + 0.5);
        break;

      case 'incorrect':
        // Soft low buzz/thud
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.linearRampToValueAtTime(100, t + 0.2);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.linearRampToValueAtTime(0.001, t + 0.2);
        osc.start(t);
        osc.stop(t + 0.2);
        break;

      case 'success':
        // Ascending Arpeggio
        const now = t;
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => { // C E G C
            const o = this.ctx!.createOscillator();
            const g = this.ctx!.createGain();
            o.connect(g);
            g.connect(this.gainNode!);
            
            o.type = 'sine';
            o.frequency.value = freq;
            
            const startTime = now + i * 0.08;
            g.gain.setValueAtTime(0, startTime);
            g.gain.linearRampToValueAtTime(0.1, startTime + 0.05);
            g.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
            
            o.start(startTime);
            o.stop(startTime + 0.4);
        });
        break;
    }
  }
}

export const sounds = new SoundManager();