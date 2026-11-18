export type GameMode = 'campaign' | 'survival' | 'arena'
export type UiEvent =
  | { type: 'briefing' }
  | { type: 'start'; mode: GameMode }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'menu' }
  | { type: 'controls' }
  | { type: 'augment'; id: string }
  | { type: 'hold'; action: string; down: boolean }
  | { type: 'tap'; action: string }
  | { type: 'install' }

export interface HudState {
  health: number
  armor: number
  maxArmor: number
  overdrive: number
  ammo: number
  reserve: number
  weapon: string
  wave: number
  waveText: string
  objective: string
  kills: number
  score: number
  rank: string
  enemies: number
  bossHealth: number
  bossMaxHealth: number
  bossPhase: number
  aimed: boolean
  crouching: boolean
  sliding: boolean
  overdriveActive: boolean
}

const AUGMENTS = [
  { id: 'ceramic', name: 'Ceramic weave', desc: '+35 maximum armor; refill your plates immediately.', kicker: '01 / DEFENSE' },
  { id: 'hot-load', name: 'Hot-load kit', desc: 'Increase rifle and shotgun damage by 18%.', kicker: '02 / BALLISTICS' },
  { id: 'field-medic', name: 'Combat stim', desc: 'Restore 45 health and improve dropped med packs.', kicker: '03 / RECOVERY' },
  { id: 'surge', name: 'Surge capacitor', desc: 'Overdrive lasts 3 seconds longer and charges faster.', kicker: '04 / SYSTEMS' },
  { id: 'scavenger', name: 'Scavenger rig', desc: 'Pickups replenish extra ammunition and grenades.', kicker: '05 / SUPPLY' },
  { id: 'dead-eye', name: 'Dead-eye optics', desc: 'Headshot and exposed-core damage increased by 25%.', kicker: '06 / TARGETING' },
]

export class GameUI {
  private root: HTMLElement
  private panels = new Map<string, HTMLElement>()
  private eventHandler: (event: UiEvent) => void
  private installPrompt?: BeforeInstallPromptEvent
  private joystickKnob?: HTMLElement

  constructor(root: HTMLElement, eventHandler: (event: UiEvent) => void) {
    this.root = root
    this.eventHandler = eventHandler
    this.root.innerHTML = `
      <div class="scan-lines" aria-hidden="true"></div>
      <section class="screen menu-screen" data-screen="menu">
        <div class="menu-backdrop"></div>
        <div class="topline"><div class="brand-mark"><img src="/brand-logo.svg" alt="Drake: Scary Hours logo"><span><b>DRAKE</b> / SCARY HOURS</span></div><div class="online-status">LOCAL OPERATION / OFFLINE</div></div>
        <div class="menu-content">
          <div class="title-block">
            <p class="eyebrow">Operation Black Tide · Port Meridian</p>
            <h1 class="game-title">Drake<span>Scary Hours</span></h1>
            <p class="title-sub">Tactical FPS · Solo deployment · No network required</p>
            <div class="title-rule"></div>
            <div class="menu-stack">
              <button class="action-button primary" data-action="campaign"><span>Operation Black Tide<small>Campaign · Briefing first</small></span><span class="arrow">↗</span></button>
              <button class="action-button" data-action="survival"><span>Hold the Terminal<small>Survival · 8 waves · 3-phase boss</small></span><span class="arrow">→</span></button>
              <button class="action-button" data-action="arena"><span>Kill House Free-for-All<small>6 AI combatants · Offline</small></span><span class="arrow">→</span></button>
              <button class="action-button" data-action="controls"><span>Field manual<small>Controls, weapons & mission rules</small></span><span class="arrow">⌕</span></button>
            </div>
            <div class="menu-foot"><span>8 wave holdout</span><span>3 phase exosuit</span><span>6 bot arena</span></div>
            <div class="menu-credit">A game by Zohaib Qaiser</div>
          </div>
          <div class="menu-info"><strong>Mission intel / 17:42 local</strong>The harbor is dark, the perimeter is broken and the relief convoy is four minutes out. Choose your insertion. Survive the night.</div>
        </div>
        <button class="install-chip" data-action="install">Install offline game</button>
        <div class="attribution">A game by Zohaib Qaiser</div>
      </section>
      <section class="screen" data-screen="briefing" hidden>
        <article class="card-panel">
          <div class="panel-tag">Bravo 7-1 / Command net</div>
          <h2 class="panel-title">Operation<br>Black Tide</h2>
          <p class="panel-copy">Port Meridian has gone dark. A rogue contractor cell breached the container terminal and seized the relay. <strong>Lt. Zohaib “Drake” Qaiser</strong> leads Bravo 7-1 through the outer yard, holds until extraction, then shuts down the exosuit command core.</p>
          <div class="brief-lines"><b>Team</b><span>Lt. Drake “Bravo 7-1” · Sgt. Tariq “Rook 6” · Staff Sgt. Sarah “Vesper 2” · Hira “Wraith 3” · Faris “Viper 5”</span><b>Objective</b><span>Secure the relay, survive the terminal assault and destroy the three-stage powered exosuit.</span><b>Rules of engagement</b><span>Offline operation. Watch your armor; plates recharge after one second out of fire.</span></div>
          <div class="button-row"><button class="action-button" data-action="menu">Back<span class="arrow">←</span></button><button class="action-button primary" data-action="begin-campaign">Deploy Bravo 7-1<span class="arrow">↗</span></button></div>
        </article>
      </section>
      <section class="screen" data-screen="controls" hidden>
        <article class="card-panel wide">
          <div class="panel-tag">Field manual / Quick reference</div><h2 class="panel-title">Move fast. Stay sharp.</h2>
          <p class="panel-copy">Precision and movement are force multipliers. Keep moving, break line of sight and aim for heads or exposed suit cores. Hold cover to lower your profile; chain kills for style and Overdrive.</p>
          <div class="controls-grid">
            <div class="control-item"><span>Move / look</span><kbd>W A S D</kbd></div><div class="control-item"><span>Fire / aim optic</span><kbd>LMB / RMB</kbd></div>
            <div class="control-item"><span>Sprint / jump / slide</span><kbd>SHIFT / SPACE / C</kbd></div><div class="control-item"><span>Quick swap / reload</span><kbd>Q / R</kbd></div>
            <div class="control-item"><span>Weapons 1–5 / melee</span><kbd>1–5 / F</kbd></div><div class="control-item"><span>Grenade / Overdrive</span><kbd>G / V</kbd></div>
            <div class="control-item"><span>Pause / escape</span><kbd>ESC</kbd></div><div class="control-item"><span>Gamepad</span><kbd>LS / RS / RT</kbd></div>
          </div>
          <div class="button-row"><button class="action-button" data-action="menu">Return to title<span class="arrow">←</span></button></div>
        </article>
      </section>
      <section class="screen" data-screen="pause" hidden>
        <article class="card-panel">
          <div class="panel-tag">Combat paused / Audio silenced</div><h2 class="panel-title">Catch your breath.</h2>
          <p class="panel-copy">The operation is paused. Your armor, ammunition and wave state are preserved. Resume when ready, or restart the current deployment.</p>
          <div class="button-row"><button class="action-button primary" data-action="resume">Resume mission<span class="arrow">↗</span></button><button class="action-button" data-action="restart">Restart deployment<span class="arrow">⟳</span></button><button class="action-button" data-action="menu">Return to title<span class="arrow">←</span></button></div>
        </article>
      </section>
      <section class="screen" data-screen="augment" hidden>
        <article class="card-panel wide">
          <div class="panel-tag">Wave secured / Field resupply</div><h2 class="panel-title">Choose one augment.</h2>
          <p class="panel-copy">Select a permanent upgrade for this operation. Augments stack between waves.</p><div class="augment-grid" id="augment-grid"></div>
        </article>
      </section>
      <section class="screen" data-screen="results" hidden>
        <article class="card-panel">
          <div class="panel-tag" id="result-tag">After action report</div><h2 class="panel-title" id="result-title">Operation complete.</h2>
          <p class="panel-copy" id="result-copy">Bravo 7-1 is clear to exfil.</p><div id="result-stats"></div>
          <div class="button-row"><button class="action-button primary" data-action="restart">Deploy again<span class="arrow">↗</span></button><button class="action-button" data-action="menu">Return to title<span class="arrow">←</span></button></div>
        </article>
      </section>
      <section class="hud" data-screen="hud" hidden>
        <div class="hud-top"><div class="hud-block"><div class="hud-kicker">Bravo 7-1 / Field operator</div><div class="hud-value">LT. DRAKE</div></div><div class="hud-block hud-center"><div class="hud-kicker" id="hud-mode">Operation Black Tide</div><div class="hud-value" id="hud-wave">WAVE 01 / 08</div></div><div class="hud-block hud-right"><div class="hud-kicker">Hostiles / Score</div><div class="hud-value"><span id="hud-enemies">00</span> <span style="color:#888">/</span> <span id="hud-score">0000</span></div></div></div>
        <div class="objective" id="objective"><b>Primary objective</b><span id="objective-text">Secure the outer terminal.</span></div>
        <div class="crosshair" id="crosshair"></div><div class="hit-confirm" id="hit-confirm">TARGET HIT</div>
        <div class="damage-edge" id="damage-edge"></div><div class="hit-direction" id="hit-direction" hidden>▼</div>
        <div class="boss-panel" id="boss-panel" hidden><div class="boss-name">THE WARDEN / PHASE <span id="boss-phase">01</span></div><div class="boss-bar"><div class="boss-fill" id="boss-fill"></div></div></div>
        <div class="status-bars"><div class="bar-row"><span>HEALTH</span><div class="bar-shell"><div class="bar-fill" id="health-fill"></div></div><span class="bar-num" id="health-num">100</span></div><div class="bar-row"><span>ARMOR</span><div class="bar-shell"><div class="bar-fill armor" id="armor-fill"></div></div><span class="bar-num" id="armor-num">150</span></div><div class="bar-row"><span>OVERDRIVE</span><div class="bar-shell"><div class="bar-fill overdrive" id="overdrive-fill"></div></div><span class="bar-num" id="overdrive-num">0%</span></div></div>
        <div class="weapon-readout"><div class="weapon-name" id="weapon-name">M4 / ASSAULT RIFLE</div><div class="ammo-count"><span id="ammo-num">30</span><small>/ <span id="reserve-num">180</span></small></div></div>
        <div class="killfeed" id="killfeed"></div><div class="rank-pop" id="rank-pop">STYLE / INITIATE</div><div class="toast" id="toast" hidden></div>
        <div class="pause-hint">ESC / PAUSE · V / OVERDRIVE</div>
      </section>
      <div class="touch" data-screen="touch" hidden>
        <div class="joystick-zone touch-control" id="joystick-zone"><div class="joystick-ring"><div class="joystick-knob" id="joystick-knob"></div></div><span class="touch-move-label">MOVE</span></div>
        <div class="look-zone touch-control" id="look-zone"></div>
        <div class="touch-buttons">
          <button class="touch-button touch-control" data-hold="sprint">RUN</button><button class="touch-button touch-control" data-hold="slide">SLIDE</button><button class="touch-button touch-control" data-hold="jump">JUMP</button><button class="touch-button touch-control" data-hold="melee">KNIFE</button><button class="touch-button touch-control" data-hold="switch">SWAP</button><button class="touch-button touch-control aim" data-hold="aim">ADS</button><button class="touch-button touch-control" data-hold="reload">R</button><button class="touch-button touch-control" data-hold="grenade">G</button><button class="touch-button touch-control" data-hold="overdrive">OD</button><button class="touch-button touch-control fire" data-hold="fire">FIRE</button>
        </div>
      </div>
      <div class="rotate-prompt">Rotate your device to landscape<span>↻</span></div>
    `
    for (const element of this.root.querySelectorAll<HTMLElement>('[data-screen]')) this.panels.set(element.dataset.screen!, element)
    this.root.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')
      if (!button) return
      const action = button.dataset.action
      if (action === 'campaign') this.emit({ type: 'briefing' })
      else if (action === 'survival') this.emit({ type: 'start', mode: 'survival' })
      else if (action === 'arena') this.emit({ type: 'start', mode: 'arena' })
      else if (action === 'begin-campaign') this.emit({ type: 'start', mode: 'campaign' })
      else if (action === 'resume') this.emit({ type: 'resume' })
      else if (action === 'restart') this.emit({ type: 'restart' })
      else if (action === 'menu') this.emit({ type: 'menu' })
      else if (action === 'controls') this.emit({ type: 'controls' })
      else if (action === 'install') this.emit({ type: 'install' })
      else if (action === 'augment' && button.dataset.id) this.emit({ type: 'augment', id: button.dataset.id })
    })
    this.root.addEventListener('pointerdown', event => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-hold]')
      if (target) {
        event.preventDefault()
        target.setPointerCapture?.(event.pointerId)
        target.classList.add('active')
        this.emit({ type: 'hold', action: target.dataset.hold!, down: true })
      }
    })
    const release = (event: PointerEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-hold]')
      if (target) {
        target.classList.remove('active')
        this.emit({ type: 'hold', action: target.dataset.hold!, down: false })
      }
    }
    this.root.addEventListener('pointerup', release)
    this.root.addEventListener('pointercancel', release)
    this.root.addEventListener('lostpointercapture', event => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-hold]')
      if (target) this.emit({ type: 'hold', action: target.dataset.hold!, down: false })
    })
    this.joystickKnob = this.root.querySelector('#joystick-knob') ?? undefined
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault()
      this.installPrompt = event as BeforeInstallPromptEvent
      const chip = this.root.querySelector<HTMLElement>('.install-chip')
      if (chip) chip.style.display = 'block'
    })
  }

  private emit(event: UiEvent) { this.eventHandler(event) }

  show(screen: string) {
    for (const [name, element] of this.panels) element.hidden = name !== screen
    if (screen === 'hud') {
      const coarse = matchMedia('(pointer: coarse) and (orientation: landscape)').matches
      this.panels.get('touch')!.hidden = !coarse
    }
  }

  showBriefing() { this.show('briefing') }
  showControls() { this.show('controls') }
  showMenu() { this.show('menu') }
  showPause() { this.show('pause') }
  showHud() { this.show('hud') }

  showAugments() {
    const grid = this.root.querySelector<HTMLElement>('#augment-grid')!
    grid.replaceChildren()
    const selection = [...AUGMENTS].sort(() => Math.random() - 0.5).slice(0, 3)
    selection.forEach((item, i) => {
      const button = document.createElement('button')
      button.className = 'augment-card'
      button.dataset.action = 'augment'
      button.dataset.id = item.id
      const kicker = document.createElement('span'); kicker.className = 'num'; kicker.textContent = item.kicker
      const title = document.createElement('b'); title.textContent = item.name
      const desc = document.createElement('small'); desc.textContent = item.desc
      const index = document.createElement('span'); index.className = 'num'; index.textContent = `SELECT / ${i + 1}`
      button.append(kicker, title, desc, index)
      grid.append(button)
    })
    this.show('augment')
  }

  showResults(win: boolean, result: { mode: string; kills: number; wave: number; score: number; bestWave: number }) {
    this.show('results')
    this.root.querySelector<HTMLElement>('#result-tag')!.textContent = win ? 'After action report / Exfil complete' : 'After action report / Operator down'
    this.root.querySelector<HTMLElement>('#result-title')!.textContent = win ? 'Bravo 7-1, clear to exfil.' : 'The harbor keeps its dead.'
    this.root.querySelector<HTMLElement>('#result-copy')!.textContent = win
      ? 'The relay is secure. The Warden is down. Tariq has the convoy on the pier; Sarah is already moving the wounded.'
      : 'Bravo 7-1 is out of the fight. The mission has been logged locally; regroup and try another insertion.'
    const stats = this.root.querySelector<HTMLElement>('#result-stats')!
    stats.replaceChildren()
    const rows = [['MODE', statsArg(result, 'mode')], ['HOSTILES DOWN', String(statsArg(result, 'kills')).padStart(2, '0')], ['BEST WAVE', `${String(statsArg(result, 'bestWave')).padStart(2, '0')} / 08`], ['FINAL SCORE', String(statsArg(result, 'score')).padStart(6, '0')]] as const
    for (const [key, value] of rows) {
      const row = document.createElement('div'); row.className = 'scoreline'
      const left = document.createElement('span'); left.textContent = key
      const right = document.createElement('strong'); right.textContent = String(value)
      row.append(left, right); stats.append(row)
    }
  }

  updateHud(hud: HudState) {
    this.setText('#hud-mode', hud.waveText)
    this.setText('#hud-wave', hud.wave > 0 ? `WAVE ${String(hud.wave).padStart(2, '0')} / 08` : 'FREE-FOR-ALL')
    this.setText('#hud-enemies', String(hud.enemies).padStart(2, '0'))
    this.setText('#hud-score', String(hud.score).padStart(5, '0'))
    this.setText('#health-num', String(Math.ceil(hud.health)))
    this.setText('#armor-num', String(Math.ceil(hud.armor)))
    this.setText('#ammo-num', String(hud.ammo))
    this.setText('#reserve-num', String(hud.reserve))
    this.setText('#weapon-name', hud.weapon)
    this.setText('#rank-pop', `STYLE / ${hud.rank.toUpperCase()}${hud.overdriveActive ? ' · OVERDRIVE' : ''}`)
    this.setText('#objective-text', hud.objective)
    this.setText('#overdrive-num', hud.overdriveActive ? 'ACTIVE' : `${Math.floor(hud.overdrive)}%`)
    this.setWidth('#health-fill', hud.health)
    this.setWidth('#armor-fill', (hud.armor / hud.maxArmor) * 100)
    this.setWidth('#overdrive-fill', hud.overdriveActive ? 100 : hud.overdrive)
    const cross = this.root.querySelector<HTMLElement>('#crosshair')!
    cross.classList.toggle('aimed', hud.aimed)
    cross.classList.toggle('low-profile', hud.crouching || hud.sliding)
    const bossPanel = this.root.querySelector<HTMLElement>('#boss-panel')!
    bossPanel.hidden = hud.bossMaxHealth <= 0
    if (hud.bossMaxHealth > 0) {
      this.setText('#boss-phase', String(hud.bossPhase).padStart(2, '0'))
      this.setWidth('#boss-fill', (hud.bossHealth / hud.bossMaxHealth) * 100)
    }
  }

  damage() { this.root.querySelector('#damage-edge')?.classList.add('active'); window.setTimeout(() => this.root.querySelector('#damage-edge')?.classList.remove('active'), 220) }

  hit(weakpoint: boolean, headshot: boolean) {
    const el = this.root.querySelector<HTMLElement>('#hit-confirm')!
    el.textContent = weakpoint ? 'EXPOSED CORE' : headshot ? 'HEADSHOT' : 'TARGET HIT'
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show')
    const cross = this.root.querySelector<HTMLElement>('#crosshair')!
    cross.classList.add('hit'); window.setTimeout(() => cross.classList.remove('hit'), 110)
  }

  toast(message: string) {
    const el = this.root.querySelector<HTMLElement>('#toast')!
    el.textContent = message; el.hidden = false
    window.clearTimeout(Number(el.dataset.timer))
    el.dataset.timer = String(window.setTimeout(() => { el.hidden = true }, 2100))
  }

  feed(message: string) {
    const box = this.root.querySelector<HTMLElement>('#killfeed')!
    const row = document.createElement('span'); row.textContent = message; box.prepend(row)
    while (box.children.length > 4) box.lastElementChild?.remove()
    window.setTimeout(() => row.remove(), 3100)
  }

  async install() {
    if (!this.installPrompt) return
    await this.installPrompt.prompt()
    this.installPrompt = undefined
  }

  setJoystick(x: number, y: number) {
    if (!this.joystickKnob) return
    this.joystickKnob.style.transform = `translate(${x * 35}px, ${y * 35}px)`
  }

  private setText(selector: string, value: string) {
    const node = this.root.querySelector<HTMLElement>(selector)
    if (node) node.textContent = value
  }
  private setWidth(selector: string, value: number) {
    const node = this.root.querySelector<HTMLElement>(selector)
    if (node) node.style.width = `${Math.max(0, Math.min(100, value))}%`
  }
}

function statsArg(stats: { mode: string; kills: number; wave: number; score: number; bestWave: number }, key: keyof typeof stats) {
  return stats[key]
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}
