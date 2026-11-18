export type MusicCue = 'title' | 'combat' | 'boss'

type Bus = 'world' | 'ui'

export class AudioSystem {
  private context?: AudioContext
  private world?: GainNode
  private uiBus?: GainNode
  private musicNodes: OscillatorNode[] = []
  private musicTimer?: number
  private musicStep = 0
  private worldMuted = false

  async unlock() {
    if (!this.context) {
      this.context = new AudioContext()
      this.world = this.context.createGain()
      this.world.gain.value = 0.62
      this.world.connect(this.context.destination)
      this.uiBus = this.context.createGain()
      this.uiBus.gain.value = 0.55
      this.uiBus.connect(this.context.destination)
    }
    if (this.context.state !== 'running') await this.context.resume()
  }

  private tone(frequency: number, duration: number, wave: OscillatorType, level: number, bus: Bus = 'world', slide?: number) {
    const ctx = this.context
    if (!ctx || !this.world || !this.uiBus || (bus === 'world' && this.worldMuted)) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = wave
    osc.frequency.setValueAtTime(frequency, ctx.currentTime)
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slide), ctx.currentTime + duration)
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), ctx.currentTime + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(bus === 'ui' ? this.uiBus : this.world)
    osc.start()
    osc.stop(ctx.currentTime + duration + 0.02)
  }

  private noise(duration: number, level: number, bus: Bus = 'world') {
    const ctx = this.context
    if (!ctx || !this.world || !this.uiBus || (bus === 'world' && this.worldMuted)) return
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration))
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length)
    const source = ctx.createBufferSource()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    source.buffer = buffer
    filter.type = 'lowpass'
    filter.frequency.value = 4200
    gain.gain.value = level
    source.connect(filter); filter.connect(gain); gain.connect(bus === 'ui' ? this.uiBus : this.world)
    source.start()
  }

  shot(kind: 'rifle' | 'shotgun' | 'rocket' | 'melee') {
    if (kind === 'rifle') { this.noise(0.075, 0.34); this.tone(112, 0.105, 'sawtooth', 0.12, 'world', 48) }
    else if (kind === 'shotgun') { this.noise(0.16, 0.48); this.tone(84, 0.19, 'triangle', 0.16, 'world', 35) }
    else if (kind === 'rocket') { this.noise(0.28, 0.56); this.tone(54, 0.34, 'sawtooth', 0.18, 'world', 28) }
    else { this.noise(0.09, 0.18); this.tone(260, 0.09, 'triangle', 0.08, 'world', 90) }
  }

  jump() { this.tone(170, 0.12, 'triangle', 0.035, 'world', 270) }

  impact(weakpoint = false) {
    this.tone(weakpoint ? 1220 : 720, weakpoint ? 0.19 : 0.11, 'sine', weakpoint ? 0.22 : 0.12, 'world', weakpoint ? 1850 : 330)
  }

  pickup() { this.tone(640, 0.09, 'sine', 0.09); this.tone(960, 0.14, 'sine', 0.075) }
  hitPlayer() { this.noise(0.16, 0.18); this.tone(118, 0.18, 'triangle', 0.12, 'world', 62) }
  explosion() { this.noise(0.55, 0.52); this.tone(58, 0.62, 'sine', 0.22, 'world', 23) }
  ui() { this.tone(540, 0.055, 'sine', 0.075, 'ui'); this.tone(810, 0.075, 'sine', 0.055, 'ui') }
  confirm() { this.tone(420, 0.08, 'triangle', 0.08, 'ui'); this.tone(630, 0.13, 'triangle', 0.08, 'ui') }
  sting(win: boolean) {
    this.tone(win ? 260 : 92, 0.38, 'sawtooth', 0.12, 'ui', win ? 1040 : 38)
    if (win) window.setTimeout(() => this.tone(520, 0.32, 'sine', 0.1, 'ui', 780), 160)
  }

  startMusic(cue: MusicCue) {
    const ctx = this.context
    if (!ctx || this.worldMuted) return
    this.stopMusic()
    const bass = cue === 'boss' ? [55, 65.4, 49, 73.4] : cue === 'combat' ? [82.4, 98, 73.4, 110] : [110, 130.8, 146.8, 98]
    const chord = cue === 'boss' ? [55, 65.4, 82.4] : cue === 'combat' ? [82.4, 123.5, 164.8] : [110, 164.8, 220]
    for (const hz of chord) {
      const osc = ctx.createOscillator()
      const filter = ctx.createBiquadFilter()
      const gain = ctx.createGain()
      osc.type = cue === 'boss' ? 'sawtooth' : 'triangle'
      osc.frequency.value = hz
      filter.type = 'lowpass'
      filter.frequency.value = cue === 'boss' ? 360 : 620
      gain.gain.value = cue === 'boss' ? 0.024 : 0.018
      osc.connect(filter); filter.connect(gain); gain.connect(this.world!)
      osc.start()
      this.musicNodes.push(osc)
    }
    this.musicStep = 0
    const sequence = cue === 'boss' ? [0, 0, 2, 1, 0, 3, 2, 1] : cue === 'combat' ? [0, 2, 1, 3, 0, 1, 2, 3] : [0, 2, 3, 1, 0, 3, 2, 1]
    this.musicTimer = window.setInterval(() => {
      const hz = bass[sequence[this.musicStep % sequence.length]]
      this.tone(hz, cue === 'boss' ? 0.22 : 0.18, cue === 'boss' ? 'sawtooth' : 'triangle', cue === 'boss' ? 0.055 : 0.038)
      if (cue !== 'title' && this.musicStep % 4 === 2) this.tone(hz * 2.01, 0.08, 'sine', 0.024)
      this.musicStep++
    }, cue === 'boss' ? 300 : cue === 'combat' ? 380 : 620)
  }

  private stopMusic() {
    if (this.musicTimer) window.clearInterval(this.musicTimer)
    this.musicTimer = undefined
    for (const node of this.musicNodes) { try { node.stop() } catch { /* already ended */ } }
    this.musicNodes = []
  }

  pauseWorld() {
    this.worldMuted = true
    this.stopMusic()
    if (this.context && this.world) this.world.gain.setTargetAtTime(0, this.context.currentTime, 0.025)
  }

  resumeWorld(cue: MusicCue) {
    this.worldMuted = false
    if (this.context && this.world) this.world.gain.setTargetAtTime(0.62, this.context.currentTime, 0.055)
    this.startMusic(cue)
  }

  gameOver(win: boolean) {
    this.pauseWorld()
    this.sting(win)
  }

  dispose() {
    this.stopMusic()
    this.context?.close()
  }
}
