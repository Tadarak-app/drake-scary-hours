import * as THREE from 'three'
import { AudioSystem, type MusicCue } from './audio'
import { animateEnemy, createEnemy, type Enemy, type EnemyKind } from './actors'
import { HarborWorld } from './world'
import { createWeaponView, WEAPONS, type WeaponId } from './weapons'
import type { GameMode, HudState } from '../ui'

export type GameState = 'menu' | 'briefing' | 'playing' | 'paused' | 'augment' | 'results'
interface AmmoState { mag: number; reserve: number }
interface Projectile { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; explosive: boolean; owner: 'player' | 'enemy'; damage: number; target?: Enemy; grenade?: boolean }
interface Effect { object: THREE.Object3D; age: number; duration: number; velocity?: THREE.Vector3; gravity?: number; fade?: boolean }
interface Pickup { object: THREE.Group; kind: 'health' | 'armor' | 'ammo'; age: number }
interface GameCallbacks {
  state: (state: GameState, mode?: GameMode) => void
  hud: (data: HudState) => void
  toast: (text: string) => void
  hit: (weakpoint: boolean, headshot: boolean) => void
  damage: () => void
  feed: (text: string) => void
  results: (win: boolean, stats: { mode: string; kills: number; wave: number; score: number; bestWave: number }) => void
}

const ORDER: WeaponId[] = ['rifle', 'shotgun', 'launcher', 'knife', 'grenade']
const STORIES = [
  ['TARIQ / ROOK 6', 'Drake, the relay is at the center of the yard. Wolves on the stacks. Keep their line of sight broken.'],
  ['SARAH / VESPER 2', 'I have the signal. The contractor channel is running a second heartbeat—something is moving under that crane.'],
  ['HIRA / WRAITH 3', 'Convoy ETA is four minutes. The white units are pushing through the south lane. Don’t let them reach the pier.'],
  ['FARIS / VIPER 5', 'Thermal just lit up. Heavy frame inbound. Its chest core is cycling—wait for the plates to open.'],
  ['TARIQ / ROOK 6', 'Bravo 7-1, Vesper has the west gantry. Rook is holding your east. We’ve got your back.'],
  ['SARAH / VESPER 2', 'Core exposed! Put the whole magazine into it. It is adapting—keep changing angles.'],
]

export class FpsGame {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly audio = new AudioSystem()
  readonly world: HarborWorld
  state: GameState = 'menu'
  mode: GameMode = 'survival'
  private callbacks: GameCallbacks
  private weaponView: ReturnType<typeof createWeaponView>
  private enemies: Enemy[] = []
  private projectiles: Projectile[] = []
  private effects: Effect[] = []
  private pickups: Pickup[] = []
  private input = new Set<string>()
  private held = new Set<string>()
  private gamepadPressed = new Set<number>()
  private player = new THREE.Vector3(0, 0, 6)
  private velocity = new THREE.Vector3()
  private raycaster = new THREE.Raycaster()
  private yaw = 0
  private pitch = 0
  private verticalSpeed = 0
  private grounded = true
  private moveAxis = new THREE.Vector2()
  private time = 0
  private gameTime = 0
  private fireCooldown = 0
  private reloadTimer = 0
  private grenadeTimer = 0
  private armorWait = 0
  private hitStop = 0
  private wave = 0
  private nextId = 1
  private kills = 0
  private score = 0
  private style = 0
  private rank = 'Initiate'
  private lastSwap = -10
  private comboTimer = 0
  private combo = 0
  private overdrive = 0
  private overdriveTime = 0
  private overdriveActive = false
  private health = 100
  private armor = 150
  private maxArmor = 150
  private damageBonus = 1
  private weakBonus = 1
  private pickupBonus = 1
  private overdriveBonus = 0
  private augments = new Set<string>()
  private weapon: WeaponId = 'rifle'
  private ammo: Record<WeaponId, AmmoState> = {
    rifle: { mag: 30, reserve: 180 }, shotgun: { mag: 8, reserve: 64 }, launcher: { mag: 1, reserve: 8 }, knife: { mag: 0, reserve: 0 }, grenade: { mag: 3, reserve: 0 },
  }
  private aimed = false
  private crouch = false
  private sliding = false
  private slideTime = 0
  private slideDirection = new THREE.Vector3()
  private sprint = false
  private recoil = 0
  private cameraShake = 0
  private muzzle?: THREE.PointLight
  private muzzleFlash?: THREE.Mesh
  private arenaRespawn = 0
  private pendingWave = 0
  private lastHud = 0
  private bestWave = 0
  private bestScore = 0
  private pendingResult = false

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, callbacks: GameCallbacks) {
    this.scene = scene
    this.camera = camera
    this.scene.add(camera)
    this.callbacks = callbacks
    this.world = new HarborWorld(scene)
    this.weaponView = createWeaponView(camera)
    this.makeMuzzle()
    this.loadRecords()
    this.camera.position.set(0, 1.68, 6)
    this.camera.rotation.order = 'YXZ'
    this.callbacks.state('menu')
  }

  async start(mode: GameMode) {
    await this.audio.unlock()
    this.input.clear(); this.held.clear(); this.moveAxis.set(0, 0)
    this.mode = mode
    this.augments.clear()
    this.clearCombat()
    this.state = 'playing'
    this.wave = 0
    this.kills = 0; this.score = 0; this.style = 0; this.combo = 0; this.rank = 'Initiate'
    this.overdrive = 0; this.overdriveActive = false; this.overdriveTime = 0
    this.health = 100; this.maxArmor = 150; this.armor = this.maxArmor
    this.damageBonus = 1; this.weakBonus = 1; this.pickupBonus = 1; this.overdriveBonus = 0
    this.augments.add('base')
    this.ammo = { rifle: { mag: 30, reserve: 180 }, shotgun: { mag: 8, reserve: 64 }, launcher: { mag: 1, reserve: 8 }, knife: { mag: 0, reserve: 0 }, grenade: { mag: 3, reserve: 0 } }
    this.weapon = 'rifle'; this.aimed = false; this.crouch = false; this.sliding = false
    this.player.set(0, 0, 6); this.velocity.set(0, 0, 0); this.yaw = 0; this.pitch = 0; this.verticalSpeed = 0; this.grounded = true
    this.arenaRespawn = 0; this.pendingResult = false
    this.callbacks.state('playing', mode)
    const cue: MusicCue = 'combat'
    this.audio.resumeWorld(cue)
    if (mode === 'arena') this.spawnArena()
    else {
      this.beginWave(1)
      if (mode === 'campaign') this.radio(0)
    }
    this.syncHud(true)
  }

  pause() {
    if (this.state !== 'playing') return
    this.state = 'paused'; this.aimed = false
    this.input.clear(); this.held.clear(); this.moveAxis.set(0, 0)
    this.audio.pauseWorld()
    this.callbacks.state('paused', this.mode)
  }

  async resume() {
    if (this.state !== 'paused') return
    await this.audio.unlock()
    this.state = 'playing'
    this.audio.resumeWorld(this.currentMusic())
    this.callbacks.state('playing', this.mode)
  }

  async restart() { await this.start(this.mode) }

  toMenu() {
    this.state = 'menu'; this.clearCombat(); this.audio.pauseWorld(); this.audio.ui()
    this.callbacks.state('menu')
  }

  chooseAugment(id: string) {
    if (this.state !== 'augment') return
    this.augments.add(id)
    if (id === 'ceramic') { this.maxArmor += 35; this.armor = this.maxArmor }
    if (id === 'hot-load') this.damageBonus += 0.18
    if (id === 'field-medic') this.health = Math.min(100, this.health + 45)
    if (id === 'surge') this.overdriveBonus += 3
    if (id === 'scavenger') this.pickupBonus += 0.35
    if (id === 'dead-eye') this.weakBonus += 0.25
    this.audio.confirm()
    this.pendingWave++
    this.beginWave(this.pendingWave)
  }

  setHeld(action: string, down: boolean) {
    if (down) this.held.add(action)
    else this.held.delete(action)
    if (action === 'fire') this.setKey('fire', down)
    if (action === 'aim') this.aimed = down
    if (action === 'jump' && down) this.jump()
    if (action === 'slide' && down) this.startSlide()
    if (action === 'reload' && down) this.reload()
    if (action === 'grenade' && down) this.throwGrenade()
    if (action === 'melee' && down) this.melee()
    if (action === 'sprint') this.setKey('ShiftLeft', down)
    if (action === 'switch' && down) this.quickSwap()
    if (action === 'overdrive' && down) this.activateOverdrive()
  }

  setKey(code: string, down: boolean) {
    if (down) this.input.add(code)
    else this.input.delete(code)
  }

  keyPressed(code: string) {
    if (this.state !== 'playing') return
    if (code === 'Space') this.jump()
    else if (code === 'KeyR') this.reload()
    else if (code === 'KeyF') this.melee()
    else if (code === 'KeyG') this.throwGrenade()
    else if (code === 'KeyV') this.activateOverdrive()
    else if (code === 'KeyQ') this.quickSwap()
    else if (code === 'KeyC') this.startSlide()
    else if (code.startsWith('Digit')) {
      const n = Number(code.slice(-1)) - 1
      if (n >= 0 && n < ORDER.length) this.selectWeapon(ORDER[n])
    }
  }

  look(dx: number, dy: number) {
    if (this.state !== 'playing') return
    this.yaw -= dx * 0.00225
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.00205, -1.48, 1.48)
  }

  setMove(x: number, y: number) { this.moveAxis.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1)) }

  update(rawDt: number) {
    const dt0 = Math.min(rawDt, 0.05)
    this.time += dt0
    this.world.update(dt0)
    if (this.state !== 'playing') return
    this.gameTime += dt0
    if (this.hitStop > 0) { this.hitStop -= dt0; if (this.hitStop > 0) return }
    const dt = dt0
    this.readGamepad(dt)
    this.updatePlayer(dt)
    this.updateEnemies(dt)
    this.updateProjectiles(dt)
    this.updatePickups(dt)
    this.updateEffects(dt)
    this.fireCooldown = Math.max(0, this.fireCooldown - dt)
    this.reloadTimer = Math.max(0, this.reloadTimer - dt)
    this.grenadeTimer = Math.max(0, this.grenadeTimer - dt)
    if (this.reloadTimer === 0 && this.ammo[this.weapon].mag === 0 && this.weapon !== 'knife' && this.weapon !== 'grenade') this.reload()
    this.updateArmor(dt)
    if (this.overdriveActive) {
      this.overdriveTime -= dt
      if (this.overdriveTime <= 0) { this.overdriveActive = false; this.callbacks.toast('OVERDRIVE EXPIRED') }
    }
    this.comboTimer -= dt
    if (this.comboTimer <= 0) this.combo = 0
    this.recoil = Math.max(0, this.recoil - dt * 1.7)
    this.cameraShake = Math.max(0, this.cameraShake - dt * 3.3)
    this.aimed = this.held.has('aim') && this.weapon === 'rifle'
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, this.aimed ? 46 : 74, 10, dt)
    this.camera.updateProjectionMatrix()
    this.weaponView.set(this.weapon, this.aimed, this.time)
    if (this.recoil > 0) this.weaponView.settle(this.weapon, this.aimed, this.time, this.recoil * 0.11)
    this.muzzle!.visible = this.time % 0.07 < 0.035 && this.fireCooldown > 0.03
    this.muzzleFlash!.visible = this.muzzle!.visible
    if (this.input.has('fire') && this.fireCooldown <= 0) this.fireWeapon()
    if (this.mode === 'arena') this.updateArena(dt)
    else this.checkWaveClear()
    if (this.gameTime - this.lastHud > 0.08) this.syncHud()
  }

  private updatePlayer(dt: number) {
    const forwardInput = (this.input.has('KeyW') ? 1 : 0) - (this.input.has('KeyS') ? 1 : 0) - this.moveAxis.y
    const rightInput = (this.input.has('KeyD') ? 1 : 0) - (this.input.has('KeyA') ? 1 : 0) + this.moveAxis.x
    const len = Math.hypot(forwardInput, rightInput)
    const f = len > 1 ? forwardInput / len : forwardInput
    const r = len > 1 ? rightInput / len : rightInput
    this.sprint = this.input.has('ShiftLeft') || this.input.has('ShiftRight')
    this.crouch = this.input.has('KeyC') || this.held.has('slide')
    if (!this.sliding) {
      const speed = this.crouch ? 2.5 : this.sprint ? 9.25 : 6.2
      const targetX = (Math.sin(this.yaw) * f + Math.cos(this.yaw) * r) * speed
      const targetZ = (-Math.cos(this.yaw) * f + Math.sin(this.yaw) * r) * speed
      const accel = this.grounded ? 15 : 5
      this.velocity.x = THREE.MathUtils.damp(this.velocity.x, targetX, accel, dt)
      this.velocity.z = THREE.MathUtils.damp(this.velocity.z, targetZ, accel, dt)
    } else {
      this.slideTime -= dt
      const damp = Math.max(0, this.slideTime) * 1.1
      this.velocity.x = this.slideDirection.x * (7 + damp * 6)
      this.velocity.z = this.slideDirection.z * (7 + damp * 6)
      if (this.slideTime <= 0) this.sliding = false
    }
    let nx = this.player.x + this.velocity.x * dt
    let nz = this.player.z + this.velocity.z * dt
    if (!this.world.isBlocked(nx, this.player.z)) this.player.x = nx
    else this.velocity.x *= -0.15
    if (!this.world.isBlocked(this.player.x, nz)) this.player.z = nz
    else this.velocity.z *= -0.15
    if (this.input.has('Space') && this.grounded) this.jump()
    if (!this.grounded) {
      this.verticalSpeed -= 20 * dt
      this.player.y += this.verticalSpeed * dt
      if (this.player.y <= 0) { this.player.y = 0; this.verticalSpeed = 0; this.grounded = true }
    }
    const moving = Math.hypot(this.velocity.x, this.velocity.z) > 0.6
    const bob = moving && this.grounded ? Math.sin(this.time * (this.sprint ? 13 : 9)) * (this.sprint ? 0.032 : 0.018) : 0
    const h = this.crouch && !this.sliding ? 1.2 : this.sliding ? 0.86 : 1.68
    const shakeX = (Math.random() - 0.5) * this.cameraShake * 0.027
    const shakeY = (Math.random() - 0.5) * this.cameraShake * 0.027
    this.camera.position.set(this.player.x + shakeX, h + this.player.y + bob + shakeY, this.player.z)
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ')
  }

  private jump() {
    if (!this.grounded || this.state !== 'playing') return
    this.grounded = false; this.verticalSpeed = 7.6; this.sliding = false
    this.audio.jump()
  }

  private startSlide() {
    if (this.state !== 'playing' || !this.grounded) return
    if (this.sprint || Math.hypot(this.velocity.x, this.velocity.z) > 5.2) {
      this.sliding = true; this.slideTime = 0.72
      this.slideDirection.set(this.velocity.x, 0, this.velocity.z).normalize()
      if (this.slideDirection.lengthSq() < 0.1) this.slideDirection.set(Math.sin(this.yaw), 0, -Math.cos(this.yaw))
      this.style += 0.2
    }
  }

  private readGamepad(_dt: number) {
    const pad = navigator.getGamepads?.()[0]
    if (!pad || this.state !== 'playing') return
    const dz = (v: number) => Math.abs(v) < 0.18 ? 0 : (Math.abs(v) - 0.18) / 0.82 * Math.sign(v)
    const leftX = dz(pad.axes[0] || 0), leftY = dz(pad.axes[1] || 0)
    this.moveAxis.set(leftX, -leftY)
    if (Math.abs(pad.axes[2] || 0) > 0.02 || Math.abs(pad.axes[3] || 0) > 0.02) this.look((pad.axes[2] || 0) * 10, (pad.axes[3] || 0) * 10)
    this.setKey('fire', !!pad.buttons[7]?.pressed)
    this.aimed = !!pad.buttons[6]?.pressed && this.weapon === 'rifle'
    this.setKey('ShiftLeft', !!pad.buttons[10]?.pressed)
    this.setKey('Space', !!pad.buttons[0]?.pressed)
    const edge = (index: number) => {
      const down = !!pad.buttons[index]?.pressed
      if (down && !this.gamepadPressed.has(index)) {
        if (index === 2) this.reload()
        if (index === 1) this.startSlide()
        if (index === 3) this.throwGrenade()
        if (index === 4) this.quickSwap()
        this.gamepadPressed.add(index)
      } else if (!down) this.gamepadPressed.delete(index)
    }
    for (const i of [1, 2, 3, 4]) edge(i)
  }

  private updateArmor(dt: number) {
    this.armorWait += dt
    if (this.armorWait > 1 && this.armor < this.maxArmor) this.armor = Math.min(this.maxArmor, this.armor + 55 * dt)
  }

  private selectWeapon(id: WeaponId) {
    if (this.weapon === id) return
    this.weapon = id; this.aimed = false; this.fireCooldown = Math.min(this.fireCooldown, 0.12)
    this.weaponView.set(id, false, this.time)
    if (this.time - this.lastSwap < 1.8) {
      this.style += 0.45; this.callbacks.toast('RAPID SWAP / STYLE +')
    }
    this.lastSwap = this.time
    this.audio.ui()
    this.syncHud(true)
  }

  private quickSwap() {
    const index = ORDER.indexOf(this.weapon)
    this.selectWeapon(ORDER[(index + 1) % ORDER.length])
  }

  private reload() {
    if (this.state !== 'playing' || this.weapon === 'knife' || this.weapon === 'grenade' || this.reloadTimer > 0) return
    const state = this.ammo[this.weapon]
    const capacity = WEAPONS[this.weapon].magazine
    if (state.mag >= capacity || state.reserve <= 0) { this.callbacks.toast(state.reserve <= 0 ? 'NO AMMUNITION' : 'MAGAZINE FULL'); return }
    this.reloadTimer = WEAPONS[this.weapon].reload
    const id = this.weapon
    this.callbacks.toast(id === 'shotgun' ? 'TUBE RELOAD / SHELLS FEEDING' : 'RELOADING')
    window.setTimeout(() => {
      if (this.state !== 'playing') return
      const ammo = this.ammo[id]; const take = Math.min(WEAPONS[id].magazine - ammo.mag, ammo.reserve)
      ammo.mag += take; ammo.reserve -= take; this.syncHud(true)
    }, WEAPONS[id].reload * 1000)
  }

  private fireWeapon() {
    if (this.weapon === 'knife') { this.melee(); this.fireCooldown = WEAPONS.knife.rate; return }
    if (this.weapon === 'grenade') { this.throwGrenade(); this.fireCooldown = 0.48; return }
    if (this.reloadTimer > 0) return
    const spec = WEAPONS[this.weapon]
    const state = this.ammo[this.weapon]
    if (state.mag <= 0) { this.audio.ui(); this.reload(); return }
    const rate = spec.rate / (this.overdriveActive ? 1.65 : 1)
    this.fireCooldown = Math.max(0.045, rate)
    if (!this.overdriveActive) state.mag--
    this.recoil = Math.min(1, this.recoil + (this.weapon === 'launcher' ? 0.8 : this.weapon === 'shotgun' ? 0.5 : 0.25))
    this.cameraShake = Math.min(1, this.cameraShake + (this.weapon === 'launcher' ? 0.8 : 0.3))
    this.audio.shot(this.weapon === 'rifle' ? 'rifle' : this.weapon === 'shotgun' ? 'shotgun' : 'rocket')
    if (this.weapon === 'launcher') this.launchRocket()
    else this.hitscan(spec.damage * this.damageBonus, spec.pellets, spec.spread, spec.range)
    this.ejectCasing(this.weapon)
    this.flashMuzzle()
    this.syncHud(true)
  }

  private hitscan(baseDamage: number, pellets: number, spread: number, range: number) {
    const origin = this.camera.position.clone()
    const baseDir = new THREE.Vector3(); this.camera.getWorldDirection(baseDir)
    let firstHit = false
    for (let p = 0; p < pellets; p++) {
      const direction = baseDir.clone().add(new THREE.Vector3((Math.random() - 0.5) * spread * 2, (Math.random() - 0.5) * spread * 2, (Math.random() - 0.5) * spread * 2)).normalize()
      this.raycaster.set(origin, direction); this.raycaster.far = range
      const roots = this.enemies.filter(e => !e.dead).map(e => e.root)
      const hit = this.raycaster.intersectObjects(roots, true).find(item => !this.lineBlocked(origin, item.point))
      if (hit) {
        const enemy = hit.object.userData.target as Enemy | undefined
        if (enemy && !enemy.dead) {
          const zone = hit.object.userData.hitZone as string | undefined
          const weak = zone === 'weakpoint'
          const head = zone === 'head'
          const multiplier = weak ? 1.75 * this.weakBonus : head ? 1.45 * this.weakBonus : 1
          this.damageEnemy(enemy, baseDamage * multiplier, weak, head, true)
          if (!firstHit) this.callbacks.hit(weak, head)
          firstHit = true
        }
        this.tracer(origin, hit.point, this.weapon === 'shotgun' ? '#ffc78a' : '#f0d59c')
        this.impactDecal(hit.point)
      } else {
        const endpoint = origin.clone().add(direction.multiplyScalar(Math.min(range, 48)))
        this.tracer(origin, endpoint, '#e7d6ae')
      }
    }
    if (!firstHit) this.audio.impact(false)
  }

  private lineBlocked(from: THREE.Vector3, to: THREE.Vector3) {
    const d = to.clone().sub(from)
    const steps = Math.floor(d.length() / 1.25)
    for (let i = 2; i < steps - 1; i++) {
      const p = from.clone().addScaledVector(d, i / steps)
      if (this.world.isBlocked(p.x, p.z, 0.08) && p.y < 3.45) return true
    }
    return false
  }

  private launchRocket() {
    const direction = new THREE.Vector3(); this.camera.getWorldDirection(direction)
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshStandardMaterial({ color: '#f0b45f', emissive: '#e77732', emissiveIntensity: 2 }))
    const origin = this.camera.position.clone().addScaledVector(direction, 0.85).add(new THREE.Vector3(0.14, -0.18, 0))
    mesh.position.copy(origin); this.scene.add(mesh)
    this.projectiles.push({ mesh, velocity: direction.multiplyScalar(31), life: 3.2, explosive: true, owner: 'player', damage: WEAPONS.launcher.damage })
    this.callbacks.toast('AT-4 / ROCKET AWAY')
  }

  private throwGrenade() {
    if (this.state !== 'playing' || this.grenadeTimer > 0 || this.ammo.grenade.mag <= 0) return
    this.ammo.grenade.mag--; this.grenadeTimer = 0.75
    const direction = new THREE.Vector3(); this.camera.getWorldDirection(direction)
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.15, 9, 7), new THREE.MeshStandardMaterial({ color: '#5b624e', metalness: 0.24, roughness: 0.66, emissive: '#d47d3a', emissiveIntensity: 0.6 }))
    mesh.position.copy(this.camera.position).addScaledVector(direction, 0.7); this.scene.add(mesh)
    this.projectiles.push({ mesh, velocity: direction.multiplyScalar(12).add(new THREE.Vector3(0, 5.2, 0)), life: 1.45, explosive: true, grenade: true, owner: 'player', damage: 115 })
    this.audio.shot('rocket'); this.syncHud(true)
  }

  private melee() {
    if (this.state !== 'playing' || this.fireCooldown > 0.2) return
    this.weapon = 'knife'; this.weaponView.set('knife', false, this.time)
    this.fireCooldown = 0.5; this.audio.shot('melee')
    const direction = new THREE.Vector3(); this.camera.getWorldDirection(direction)
    const start = this.camera.position.clone(); this.raycaster.set(start, direction); this.raycaster.far = 3.1
    const hit = this.raycaster.intersectObjects(this.enemies.filter(e => !e.dead).map(e => e.root), true)[0]
    if (hit) {
      const enemy = hit.object.userData.target as Enemy | undefined
      if (enemy) { this.damageEnemy(enemy, WEAPONS.knife.damage * this.damageBonus, false, hit.object.userData.hitZone === 'head', true); this.callbacks.hit(false, false) }
    }
    this.recoil = 0.35; this.syncHud(true)
  }

  private makeMuzzle() {
    this.muzzle = new THREE.PointLight('#ffb45e', 0, 5, 2)
    this.camera.add(this.muzzle); this.muzzle.position.set(0.08, -0.13, -1.28)
    this.muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.08, 7, 6), new THREE.MeshBasicMaterial({ color: '#ffd28a' }))
    this.muzzleFlash.position.copy(this.muzzle.position); this.camera.add(this.muzzleFlash)
    this.muzzle.visible = false; this.muzzleFlash.visible = false
  }

  private flashMuzzle() {
    this.muzzle!.intensity = this.weapon === 'launcher' ? 70 : this.weapon === 'shotgun' ? 48 : 30
    this.muzzle!.visible = true; this.muzzleFlash!.visible = true
  }

  private ejectCasing(id: WeaponId) {
    if (id !== 'rifle' && id !== 'shotgun') return
    const brass = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.09, 6), new THREE.MeshStandardMaterial({ color: '#b87939', metalness: 0.72, roughness: 0.32 }))
    brass.position.copy(this.camera.position).add(new THREE.Vector3(0.23, -0.23, -0.46))
    brass.rotation.z = Math.PI / 2; this.scene.add(brass)
    this.effects.push({ object: brass, age: 0, duration: 2.1, velocity: new THREE.Vector3(1.3 + Math.random(), 1.8, 0.2), gravity: 7 })
  }

  private spawnArena() {
    this.callbacks.toast('KILL HOUSE / SIX AI COMBATANTS')
    const kinds: EnemyKind[] = ['wolf', 'boar', 'robot', 'dog', 'exosuit', 'robot']
    kinds.forEach((kind, i) => {
      const a = Math.PI * 2 * i / kinds.length
      const enemy = createEnemy(this.nextId++, kind, new THREE.Vector3(Math.cos(a) * 22, 0, Math.sin(a) * 22), 2)
      enemy.targetId = 0
      this.enemies.push(enemy); this.scene.add(enemy.root)
    })
    this.audio.startMusic('combat')
  }

  private beginWave(wave: number) {
    if (wave > 8) { this.win(); return }
    this.wave = wave; this.pendingWave = wave
    this.callbacks.state('playing', this.mode)
    this.callbacks.toast(`WAVE ${String(wave).padStart(2, '0')} / HOSTILES INBOUND`)
    if (this.mode === 'campaign') {
      if (wave === 3) this.radio(1)
      if (wave === 5) this.radio(2)
      if (wave === 7) this.radio(3)
    }
    this.audio.startMusic(wave === 8 ? 'boss' : 'combat')
    if (wave === 8) {
      this.spawnEnemy('boss', 0, -31, true)
      for (let i = 0; i < 4; i++) {
        const angle = i * Math.PI / 2 + 0.6
        this.spawnEnemy(i % 2 ? 'robot' : 'wolf', Math.cos(angle) * 23, Math.sin(angle) * 24, false)
      }
      return
    }
    const count = 3 + Math.min(8, wave)
    const pool: EnemyKind[] = wave < 2 ? ['wolf', 'boar'] : wave < 4 ? ['wolf', 'boar', 'robot'] : wave < 6 ? ['wolf', 'robot', 'dog'] : ['boar', 'robot', 'dog', 'exosuit']
    for (let i = 0; i < count; i++) {
      const kind = pool[Math.floor(Math.random() * pool.length)]
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4
      const radius = 20 + Math.random() * 9
      this.spawnEnemy(kind, Math.cos(angle) * radius, Math.sin(angle) * radius, i === count - 1 && wave >= 5)
    }
  }

  private spawnEnemy(kind: EnemyKind, x: number, z: number, special = false) {
    const position = new THREE.Vector3(x, 0, z)
    const enemy = createEnemy(this.nextId++, kind, position, this.wave, special)
    this.enemies.push(enemy); this.scene.add(enemy.root)
  }

  private updateEnemies(dt: number) {
    const alive = this.enemies.filter(e => !e.dead)
    for (const enemy of alive) {
      animateEnemy(enemy, dt, this.time)
      let targetPos = this.player.clone().add(new THREE.Vector3(0, 1, 0))
      let targetEnemy: Enemy | undefined
      let targetPlayer = true
      if (this.mode === 'arena') {
        let nearest = Infinity
        for (const candidate of alive) {
          if (candidate === enemy) continue
          const d = enemy.root.position.distanceTo(candidate.root.position)
          if (d < nearest) { nearest = d; targetEnemy = candidate }
        }
        const playerDist = enemy.root.position.distanceTo(this.player)
        if (playerDist < nearest && this.arenaRespawn <= 0) { targetEnemy = undefined; targetPlayer = true }
        else targetPlayer = false
        if (targetEnemy) targetPos = targetEnemy.root.position.clone().add(new THREE.Vector3(0, 0.9, 0))
      }
      const planar = new THREE.Vector3(targetPos.x - enemy.root.position.x, 0, targetPos.z - enemy.root.position.z)
      const dist = Math.max(0.01, planar.length())
      planar.normalize()
      enemy.root.rotation.y = Math.atan2(planar.x, planar.z)
      const dogRange = enemy.kind === 'dog' ? 15 : enemy.kind === 'boss' ? 27 : 18
      const attackRange = this.mode === 'arena' ? 17 : dogRange
      if (dist > attackRange * 0.72) {
        const amount = enemy.speed * dt
        let nx = enemy.root.position.x + planar.x * amount
        let nz = enemy.root.position.z + planar.z * amount
        if (!this.world.isBlocked(nx, enemy.root.position.z, enemy.radius)) enemy.root.position.x = nx
        else { nx = enemy.root.position.x + planar.z * amount; if (!this.world.isBlocked(nx, enemy.root.position.z, enemy.radius)) enemy.root.position.x = nx }
        if (!this.world.isBlocked(enemy.root.position.x, nz, enemy.radius)) enemy.root.position.z = nz
        else { nz = enemy.root.position.z - planar.x * amount; if (!this.world.isBlocked(enemy.root.position.x, nz, enemy.radius)) enemy.root.position.z = nz }
      } else {
        const orbit = new THREE.Vector3(-planar.z, 0, planar.x).multiplyScalar(Math.sin(this.time * 0.8 + enemy.bob) * enemy.speed * 0.18 * dt)
        const nx = enemy.root.position.x + orbit.x, nz = enemy.root.position.z + orbit.z
        if (!this.world.isBlocked(nx, nz, enemy.radius)) enemy.root.position.set(nx, 0, nz)
      }
      enemy.attackTimer -= dt
      if (enemy.attackTimer <= 0 && dist < attackRange && !this.lineBlocked(enemy.root.position.clone().add(new THREE.Vector3(0, 1.25, 0)), targetPos)) {
        enemy.attackTimer = enemy.fireDelay * (0.85 + Math.random() * 0.4)
        this.enemyFire(enemy, targetPos, targetEnemy, targetPlayer)
      }
    }
  }

  private enemyFire(enemy: Enemy, target: THREE.Vector3, targetEnemy?: Enemy, targetsPlayer = true) {
    if (enemy.kind === 'dog' || enemy.kind === 'boss') {
      this.tracer(enemy.root.position.clone().add(new THREE.Vector3(0, 1.1, 0)), target, enemy.kind === 'boss' ? '#ff7c4e' : '#dc9b67')
      if (targetsPlayer && Math.random() < (enemy.kind === 'boss' ? 0.62 : 0.46)) this.playerDamage(enemy.damage, enemy.root.position)
      else if (targetEnemy && Math.random() < 0.43) this.damageEnemy(targetEnemy, enemy.damage * 0.45, false, false, false)
      if (enemy.kind === 'boss' && enemy.phase >= 2) this.makeImpactBurst(target.clone().setY(0.18), '#d96c48', 1.1)
      return
    }
    const muzzle = enemy.root.position.clone().add(new THREE.Vector3(0, 1.25, 0))
    const direction = target.clone().sub(muzzle).normalize()
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.052, 6, 5), new THREE.MeshBasicMaterial({ color: enemy.kind === 'robot' ? '#64ded6' : '#f3a86c' }))
    mesh.position.copy(muzzle); this.scene.add(mesh)
    this.projectiles.push({ mesh, velocity: direction.multiplyScalar(enemy.kind === 'robot' ? 25 : 22), life: 2.4, explosive: false, owner: 'enemy', damage: enemy.damage, target: targetEnemy })
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i]
      projectile.life -= dt
      if (projectile.grenade) projectile.velocity.y -= 10.5 * dt
      projectile.mesh.position.addScaledVector(projectile.velocity, dt)
      if (projectile.grenade && projectile.mesh.position.y < 0.15) {
        projectile.mesh.position.y = 0.15; projectile.velocity.y *= -0.43; projectile.velocity.x *= 0.72; projectile.velocity.z *= 0.72
      }
      let targetHit = false
      if (projectile.owner === 'enemy') {
        if (projectile.target && !projectile.target.dead && projectile.mesh.position.distanceTo(projectile.target.root.position.clone().add(new THREE.Vector3(0, 1, 0))) < 0.65) {
          this.damageEnemy(projectile.target, projectile.damage, false, false, false); targetHit = true
        } else if (!projectile.target && this.arenaRespawn <= 0 && projectile.mesh.position.distanceTo(this.player.clone().add(new THREE.Vector3(0, 1, 0))) < 0.72) {
          this.playerDamage(projectile.damage, projectile.mesh.position); targetHit = true
        }
      } else {
        const target = this.enemies.find(e => !e.dead && projectile.mesh.position.distanceTo(e.root.position.clone().add(new THREE.Vector3(0, 1, 0))) < e.radius + 0.22)
        if (target) {
          if (!projectile.explosive) this.damageEnemy(target, projectile.damage, false, false, true)
          targetHit = true
        }
      }
      if (Math.abs(projectile.mesh.position.x) > 45 || Math.abs(projectile.mesh.position.z) > 45 || this.world.isBlocked(projectile.mesh.position.x, projectile.mesh.position.z, 0.12)) targetHit = true
      if (targetHit && projectile.explosive && !projectile.grenade) this.explode(projectile.mesh.position, projectile.damage, projectile.owner)
      if (projectile.life <= 0 && projectile.explosive) this.explode(projectile.mesh.position, projectile.damage, projectile.owner)
      if (targetHit || projectile.life <= 0) {
        this.scene.remove(projectile.mesh); projectile.mesh.geometry.dispose(); (projectile.mesh.material as THREE.Material).dispose()
        this.projectiles.splice(i, 1)
      }
    }
  }

  private explode(center: THREE.Vector3, damage: number, owner: 'player' | 'enemy') {
    this.audio.explosion()
    this.makeImpactBurst(center, '#ff8b51', 2.8)
    const enemies = this.enemies.filter(e => !e.dead)
    for (const enemy of enemies) {
      const dist = enemy.root.position.distanceTo(center)
      if (dist < 7 && !this.lineBlocked(center, enemy.root.position.clone().add(new THREE.Vector3(0, 0.8, 0)))) {
        const scale = Math.max(0.18, 1 - dist / 7)
        this.damageEnemy(enemy, damage * scale * (owner === 'player' ? this.damageBonus : 1), false, false, owner === 'player')
      }
    }
    if (this.player.distanceTo(center) < 6) {
      const raw = damage * Math.max(0.12, 1 - this.player.distanceTo(center) / 6) * 0.45
      // Self-damage is deliberately unboosted even while Overdrive is active.
      this.playerDamage(raw, center)
    }
  }

  private damageEnemy(enemy: Enemy, damage: number, weak: boolean, head: boolean, byPlayer: boolean) {
    if (enemy.dead) return
    enemy.health -= damage
    this.audio.impact(weak)
    if (weak || head) this.callbacks.hit(weak, head)
    this.makeImpactBurst(enemy.root.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 1.0 + Math.random() * 0.8, 0.2)), weak ? '#ff9c47' : '#c96d51', 0.28)
    if (enemy.kind === 'boss') {
      const fraction = enemy.health / enemy.maxHealth
      const phase = fraction <= 0.34 ? 3 : fraction <= 0.68 ? 2 : 1
      if (phase !== enemy.phase) {
        enemy.phase = phase
        this.callbacks.toast(phase === 2 ? 'WARDEN / ARMOR SHATTERED / PHASE 02' : 'WARDEN / CORE UNSEALED / PHASE 03')
        enemy.speed += 0.55
        this.audio.startMusic('boss')
      }
    }
    if (byPlayer) {
      this.hitStop = Math.max(this.hitStop, weak || head ? 0.035 : 0.018)
      if (enemy.health <= 0) this.killEnemy(enemy)
    } else if (enemy.health <= 0) this.killEnemy(enemy, false)
    this.syncHud(true)
  }

  private killEnemy(enemy: Enemy, byPlayer = true) {
    if (enemy.dead) return
    enemy.dead = true; this.scene.remove(enemy.root)
    this.hitStop = 0.045
    if (byPlayer) {
      this.kills++; this.score += enemy.value
      this.combo = this.comboTimer > 0 ? this.combo + 1 : 1; this.comboTimer = 2.4
      this.overdrive = Math.min(100, this.overdrive + (enemy.kind === 'boss' ? 42 : 16))
      let label = enemy.kind === 'boss' ? 'WARDEN' : enemy.kind === 'dog' ? 'TURRET HOUND' : enemy.kind === 'robot' ? 'SECURITY UNIT' : enemy.kind === 'exosuit' ? 'HEAVY' : enemy.kind === 'boar' ? 'BOAR-MASK' : 'WOLF-MASK'
      if (this.sliding) { this.style += 1.5; label += ' / SLIDE KILL' }
      else if (!this.grounded) { this.style += 1.2; label += ' / AIRBORNE' }
      else this.style += 1
      if (this.combo >= 3) { this.style += this.combo * 0.35; label += ` / ${this.combo}X CHAIN` }
      this.updateRank()
      this.callbacks.feed(`${label}  +${enemy.value}`)
      if (enemy.kind !== 'boss' && Math.random() < 0.68) this.spawnPickup(Math.random() < 0.32 ? 'health' : Math.random() < 0.55 ? 'armor' : 'ammo', enemy.root.position.clone())
      this.makeImpactBurst(enemy.root.position.clone().add(new THREE.Vector3(0, 1.1, 0)), enemy.kind === 'robot' ? '#7de0d8' : '#db7954', 0.65)
      if (enemy.kind === 'boss') { this.win(); return }
    } else if (this.mode === 'arena') {
      this.score += 80
      this.callbacks.feed(`${enemy.kind.toUpperCase()} ELIMINATED`)
    }
    if (this.mode === 'arena') {
      window.setTimeout(() => { if (this.state === 'playing' && this.mode === 'arena') this.respawnBot(enemy.kind) }, 1600)
    }
    this.syncHud(true)
  }

  private playerDamage(amount: number, from: THREE.Vector3) {
    if (this.state !== 'playing' || this.mode === 'arena' && this.arenaRespawn > 0) return
    const previousArmor = this.armor
    const absorbed = Math.min(this.armor, amount)
    this.armor -= absorbed
    this.health -= amount - absorbed
    this.armorWait = 0
    this.callbacks.damage(); this.audio.hitPlayer()
    this.cameraShake = Math.min(1.0, this.cameraShake + amount * 0.012)
    if (previousArmor > 0 && this.armor <= 0) this.callbacks.toast('ARMOR BROKEN / REPOSITION')
    if (from) {
      const toward = new THREE.Vector3(from.x - this.player.x, 0, from.z - this.player.z).normalize()
      const facing = new THREE.Vector3(Math.sin(this.yaw), 0, -Math.cos(this.yaw))
      const side = facing.x * toward.z - facing.z * toward.x
      if (Math.abs(side) > 0.25) this.callbacks.toast(side > 0 ? 'CONTACT / RIGHT' : 'CONTACT / LEFT')
    }
    if (this.health <= 0) {
      this.health = 0
      if (this.mode === 'arena') {
        this.arenaRespawn = 2.5
        this.callbacks.toast('DOWN / RESPAWNING')
        window.setTimeout(() => {
          if (this.state === 'playing' && this.mode === 'arena') {
            this.health = 100; this.armor = this.maxArmor; this.player.set((Math.random() - .5) * 24, 0, (Math.random() - .5) * 24); this.callbacks.toast('BACK IN THE FIGHT')
          }
        }, 2350)
      } else this.lose()
    }
    this.syncHud(true)
  }

  private respawnBot(kind: EnemyKind) {
    const angle = Math.random() * Math.PI * 2
    let x = Math.cos(angle) * (20 + Math.random() * 8)
    let z = Math.sin(angle) * (20 + Math.random() * 8)
    for (let i = 0; i < 6 && this.world.isBlocked(x, z, 0.6); i++) { x *= 0.72; z *= 0.72 }
    const bot = createEnemy(this.nextId++, kind === 'boss' ? 'exosuit' : kind, new THREE.Vector3(x, 0, z), 2)
    this.enemies.push(bot); this.scene.add(bot.root)
  }

  private updateArena(dt: number) {
    if (this.arenaRespawn > 0) this.arenaRespawn -= dt
    if (this.kills >= 20) this.win()
  }

  private checkWaveClear() {
    if (this.wave <= 0 || this.pendingResult || this.state !== 'playing') return
    const living = this.enemies.some(e => !e.dead)
    if (living) return
    if (this.wave === 8) { this.win(); return }
    this.state = 'augment'
    this.callbacks.state('augment', this.mode)
    this.callbacks.toast(`WAVE ${String(this.wave).padStart(2, '0')} COMPLETE`)
  }

  private spawnPickup(kind: Pickup['kind'], position: THREE.Vector3) {
    const object = new THREE.Group(); object.position.copy(position); object.position.y = 0.48
    const colors = { health: '#e17961', armor: '#78c7bd', ammo: '#d8a05f' }
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.23, 0), new THREE.MeshStandardMaterial({ color: colors[kind], emissive: colors[kind], emissiveIntensity: 1.3, metalness: 0.32, roughness: 0.3 }))
    object.add(core)
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.024, 6, 18), new THREE.MeshBasicMaterial({ color: colors[kind], transparent: true, opacity: 0.62 }))
    halo.rotation.x = Math.PI / 2; object.add(halo)
    this.scene.add(object); this.pickups.push({ object, kind, age: 0 })
  }

  private updatePickups(dt: number) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i]; pickup.age += dt
      pickup.object.rotation.y += dt * 1.2; pickup.object.position.y = 0.48 + Math.sin(pickup.age * 3) * 0.11
      if (pickup.age > 25) { this.scene.remove(pickup.object); this.pickups.splice(i, 1); continue }
      if (pickup.object.position.distanceTo(this.player.clone().add(new THREE.Vector3(0, 0.7, 0))) > 1.4) continue
      if (pickup.kind === 'health') this.health = Math.min(100, this.health + 30 * this.pickupBonus)
      if (pickup.kind === 'armor') this.armor = Math.min(this.maxArmor, this.armor + 45 * this.pickupBonus)
      if (pickup.kind === 'ammo') {
        for (const id of ['rifle', 'shotgun', 'launcher'] as WeaponId[]) this.ammo[id].reserve += Math.ceil((id === 'rifle' ? 18 : id === 'shotgun' ? 6 : 1) * this.pickupBonus)
        this.ammo.grenade.mag = Math.min(5, this.ammo.grenade.mag + 1)
      }
      this.audio.pickup(); this.callbacks.toast(pickup.kind === 'health' ? 'MEDICAL SUPPLY' : pickup.kind === 'armor' ? 'ARMOR PLATES' : 'AMMUNITION');
      this.scene.remove(pickup.object); this.pickups.splice(i, 1); this.syncHud(true)
    }
  }

  private tracer(from: THREE.Vector3, to: THREE.Vector3, color: string) {
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to])
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }))
    line.frustumCulled = false; this.scene.add(line)
    this.effects.push({ object: line, age: 0, duration: 0.085, fade: true })
  }

  private impactDecal(point: THREE.Vector3) {
    const decal = new THREE.Mesh(new THREE.CircleGeometry(0.12 + Math.random() * 0.08, 8), new THREE.MeshBasicMaterial({ color: '#242728', transparent: true, opacity: 0.58, depthWrite: false }))
    decal.rotation.x = -Math.PI / 2; decal.position.set(point.x, 0.015, point.z)
    this.scene.add(decal); this.effects.push({ object: decal, age: 0, duration: 18, fade: true })
    for (let i = 0; i < 3; i++) {
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), new THREE.MeshBasicMaterial({ color: '#e7b775' }))
      spark.position.copy(point); this.scene.add(spark)
      this.effects.push({ object: spark, age: 0, duration: 0.25, velocity: new THREE.Vector3((Math.random() - .5) * 3, Math.random() * 2, (Math.random() - .5) * 3), gravity: 6 })
    }
  }

  private makeImpactBurst(position: THREE.Vector3, color: string, scale: number) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35 * scale, 0.035 * scale, 6, 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }))
    ring.position.copy(position); ring.rotation.x = Math.PI / 2; this.scene.add(ring)
    this.effects.push({ object: ring, age: 0, duration: 0.42, fade: true })
    for (let i = 0; i < Math.floor(5 + scale * 4); i++) {
      const particle = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.055), new THREE.MeshBasicMaterial({ color: i % 2 ? color : '#e6c08a' }))
      particle.position.copy(position); this.scene.add(particle)
      this.effects.push({ object: particle, age: 0, duration: 0.45 + Math.random() * 0.35, velocity: new THREE.Vector3((Math.random() - 0.5) * 5 * scale, Math.random() * 5 * scale, (Math.random() - 0.5) * 5 * scale), gravity: 10 })
    }
  }

  private updateEffects(dt: number) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i]; effect.age += dt
      if (effect.velocity) {
        effect.velocity.y -= (effect.gravity ?? 0) * dt
        effect.object.position.addScaledVector(effect.velocity, dt)
        if (effect.object.position.y < 0.03 && !(effect.object instanceof THREE.Line)) effect.object.position.y = 0.03
      }
      const t = effect.age / effect.duration
      if (effect.object instanceof THREE.Mesh && effect.object.geometry instanceof THREE.TorusGeometry) effect.object.scale.setScalar(1 + t * 4)
      if (effect.fade && effect.object instanceof THREE.Mesh && effect.object.material instanceof THREE.Material && 'opacity' in effect.object.material) (effect.object.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 * (1 - t))
      if (effect.age >= effect.duration) {
        this.scene.remove(effect.object)
        if (effect.object instanceof THREE.Mesh || effect.object instanceof THREE.Line) {
          effect.object.geometry.dispose()
          const material = effect.object.material
          if (Array.isArray(material)) material.forEach(m => m.dispose()); else material.dispose()
        }
        this.effects.splice(i, 1)
      }
    }
  }

  private radio(index: number) {
    const [who, line] = STORIES[index]
    this.callbacks.feed(`${who}  /  “${line}”`)
  }

  private activateOverdrive() {
    if (this.state !== 'playing' || this.overdrive < 100 || this.overdriveActive) { this.callbacks.toast('OVERDRIVE / BUILD CHARGE WITH KILLS'); return }
    this.overdrive = 0; this.overdriveActive = true; this.overdriveTime = 8 + this.overdriveBonus
    this.callbacks.toast(`OVERDRIVE / ${Math.ceil(this.overdriveTime)} SECONDS / UNLIMITED AMMO`)
    this.audio.confirm(); this.cameraShake = 0.25
  }

  private updateRank() {
    const ranks = ['Initiate', 'Operator', 'Vanguard', 'Reaper', 'Phantom']
    const index = Math.min(4, Math.floor(this.style / 5))
    if (ranks[index] !== this.rank) { this.rank = ranks[index]; this.callbacks.toast(`STYLE RANK / ${this.rank.toUpperCase()}`) }
  }

  private currentMusic(): MusicCue { return this.wave === 8 ? 'boss' : 'combat' }

  private win() {
    if (this.pendingResult) return
    this.pendingResult = true; this.state = 'results'; this.audio.gameOver(true)
    this.bestWave = Math.max(this.bestWave, this.wave); this.bestScore = Math.max(this.bestScore, this.score); this.saveRecords()
    this.callbacks.state('results', this.mode)
    this.callbacks.results(true, { mode: this.mode, kills: this.kills, wave: this.wave, score: this.score, bestWave: this.bestWave })
  }

  private lose() {
    if (this.pendingResult) return
    this.pendingResult = true; this.state = 'results'; this.audio.gameOver(false)
    this.bestWave = Math.max(this.bestWave, this.wave); this.bestScore = Math.max(this.bestScore, this.score); this.saveRecords()
    this.callbacks.state('results', this.mode)
    this.callbacks.results(false, { mode: this.mode, kills: this.kills, wave: this.wave, score: this.score, bestWave: this.bestWave })
  }

  private syncHud(force = false) {
    if (!force && this.gameTime - this.lastHud < 0.08) return
    this.lastHud = this.gameTime
    const living = this.enemies.filter(e => !e.dead)
    const boss = living.find(e => e.kind === 'boss')
    const waveText = this.mode === 'arena' ? 'Kill House / Offline free-for-all' : this.mode === 'campaign' ? 'Operation Black Tide / Campaign' : 'Terminal Hold / Survival'
    const objective = this.mode === 'arena' ? `Reach 20 eliminations · ${this.kills} / 20 confirmed` : this.wave === 8 ? 'Break the Warden armor; fire into its exposed chest core.' : this.wave >= 5 ? 'Protect the relay; eliminate hostiles and preserve plates.' : 'Secure the terminal. Hold until the next wave is cleared.'
    this.callbacks.hud({ health: this.health, armor: this.armor, maxArmor: this.maxArmor, overdrive: this.overdrive, ammo: this.ammo[this.weapon].mag, reserve: this.ammo[this.weapon].reserve, weapon: WEAPONS[this.weapon].name, wave: this.wave, waveText, objective, kills: this.kills, score: this.score, rank: this.rank, enemies: living.length, bossHealth: boss?.health ?? 0, bossMaxHealth: boss?.maxHealth ?? 0, bossPhase: boss?.phase ?? 0, aimed: this.aimed, crouching: this.crouch, sliding: this.sliding, overdriveActive: this.overdriveActive })
  }

  private clearCombat() {
    for (const enemy of this.enemies) this.scene.remove(enemy.root)
    for (const p of this.projectiles) this.scene.remove(p.mesh)
    for (const f of this.effects) this.scene.remove(f.object)
    for (const p of this.pickups) this.scene.remove(p.object)
    this.enemies = []; this.projectiles = []; this.effects = []; this.pickups = []
  }

  private loadRecords() {
    try {
      const data = JSON.parse(localStorage.getItem('drake-scary-hours-records') || '{}') as { bestWave?: number; bestScore?: number }
      this.bestWave = data.bestWave || 0; this.bestScore = data.bestScore || 0
    } catch { this.bestWave = 0; this.bestScore = 0 }
  }

  private saveRecords() {
    try { localStorage.setItem('drake-scary-hours-records', JSON.stringify({ bestWave: this.bestWave, bestScore: this.bestScore, lastMode: this.mode, bestAt: new Date().toISOString() })) } catch { /* private browsing may disable storage */ }
  }

  dispose() {
    this.clearCombat(); this.world.dispose(); this.audio.dispose()
    this.camera.remove(this.weaponView.root)
  }
}
