import * as THREE from 'three'
import './ui.css'
import { FpsGame } from './game/game'
import { GameUI, type UiEvent } from './ui'

const canvas = document.querySelector<HTMLCanvasElement>('#game')!
const app = document.querySelector<HTMLElement>('#app')!
const coarse = matchMedia('(pointer: coarse)').matches

const renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, alpha: false, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.7))
renderer.setSize(window.innerWidth, window.innerHeight, false)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.08, 150)
const resize = () => {
  const width = Math.max(1, window.innerWidth), height = Math.max(1, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.7))
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize, { passive: true })

let game: FpsGame
let titleCueStarted = false
const ui = new GameUI(app, event => { void handleUi(event) })

game = new FpsGame(scene, camera, {
  state(state) {
    if (state === 'menu') ui.showMenu()
    else if (state === 'briefing') ui.showBriefing()
    else if (state === 'playing') ui.showHud()
    else if (state === 'paused') ui.showPause()
    else if (state === 'augment') ui.showAugments()
    else if (state === 'results') ui.show('results')
  },
  hud(data) { ui.updateHud(data) },
  toast(text) { ui.toast(text) },
  hit(weak, head) { ui.hit(weak, head) },
  damage() { ui.damage() },
  feed(text) { ui.feed(text) },
  results(win, stats) { ui.showResults(win, stats) },
})

async function handleUi(event: UiEvent) {
  if (event.type === 'briefing') {
    await unlockAudio()
    game.audio.ui()
    ui.showBriefing()
    return
  }
  if (event.type === 'start') {
    void unlockAudio()
    requestAimLock()
    await game.start(event.mode)
    return
  }
  if (event.type === 'resume') {
    requestAimLock()
    await game.resume()
    return
  }
  if (event.type === 'restart') {
    requestAimLock()
    await game.restart()
    return
  }
  if (event.type === 'menu') {
    game.toMenu()
    exitAimLock()
    await game.audio.unlock()
    game.audio.resumeWorld('title')
    return
  }
  if (event.type === 'controls') {
    await unlockAudio()
    ui.showControls()
    return
  }
  if (event.type === 'augment') { game.chooseAugment(event.id); return }
  if (event.type === 'hold') { game.setHeld(event.action, event.down); return }
  if (event.type === 'tap') { game.keyPressed(event.action); return }
  if (event.type === 'install') { await ui.install(); return }
}

function requestAimLock() {
  if (coarse || !canvas.requestPointerLock) return
  try { void canvas.requestPointerLock() } catch { /* pointer lock may be disabled in an embedded browser */ }
}
function exitAimLock() {
  if (document.pointerLockElement === canvas) document.exitPointerLock()
}
async function unlockAudio() {
  await game.audio.unlock()
  if (!titleCueStarted && game.state === 'menu') {
    titleCueStarted = true
    game.audio.startMusic('title')
  }
}

// A first gesture enables browser audio and starts the atmospheric title cue.
app.addEventListener('pointerdown', () => { void unlockAudio() }, { once: true, passive: true })

window.addEventListener('keydown', event => {
  if (event.code === 'Escape') {
    event.preventDefault()
    if (game.state === 'playing') { game.pause(); exitAimLock() }
    else if (game.state === 'paused') { requestAimLock(); void game.resume() }
    return
  }
  if (game.state !== 'playing') return
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault()
  game.setKey(event.code, true)
  if (!event.repeat) game.keyPressed(event.code)
}, { passive: false })
window.addEventListener('keyup', event => game.setKey(event.code, false), { passive: true })
window.addEventListener('blur', () => {
  if (game.state === 'playing' && !coarse) { game.pause(); exitAimLock() }
})
window.addEventListener('contextmenu', event => event.preventDefault())

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && game.state === 'playing' && !coarse) game.pause()
})
document.addEventListener('mousemove', event => {
  if (document.pointerLockElement === canvas) game.look(event.movementX, event.movementY)
}, { passive: true })
document.addEventListener('mousedown', event => {
  if (game.state !== 'playing') return
  if (event.button === 0) game.setHeld('fire', true)
  if (event.button === 2) game.setHeld('aim', true)
})
document.addEventListener('mouseup', event => {
  if (event.button === 0) game.setHeld('fire', false)
  if (event.button === 2) game.setHeld('aim', false)
})
canvas.addEventListener('wheel', event => {
  if (game.state === 'playing') game.keyPressed(event.deltaY > 0 ? 'KeyQ' : 'KeyQ')
}, { passive: true })

const joystickZone = app.querySelector<HTMLElement>('#joystick-zone')!
const lookZone = app.querySelector<HTMLElement>('#look-zone')!
let movePointer: number | undefined
let lookPointer: number | undefined
let moveOrigin = { x: 0, y: 0 }
let lastLook = { x: 0, y: 0 }
joystickZone.addEventListener('pointerdown', event => {
  if (game.state !== 'playing') return
  movePointer = event.pointerId; moveOrigin = { x: event.clientX, y: event.clientY }
  joystickZone.setPointerCapture(event.pointerId)
  updateMove(event.clientX, event.clientY)
})
joystickZone.addEventListener('pointermove', event => { if (event.pointerId === movePointer) updateMove(event.clientX, event.clientY) })
const releaseMove = (event: PointerEvent) => { if (event.pointerId === movePointer) { movePointer = undefined; game.setMove(0, 0); ui.setJoystick(0, 0) } }
joystickZone.addEventListener('pointerup', releaseMove)
joystickZone.addEventListener('pointercancel', releaseMove)
function updateMove(x: number, y: number) {
  const dx = (x - moveOrigin.x) / 52, dy = (y - moveOrigin.y) / 52
  const length = Math.hypot(dx, dy), scale = length > 1 ? 1 / length : 1
  const nx = dx * scale, ny = dy * scale
  game.setMove(nx, ny); ui.setJoystick(nx, ny)
}
lookZone.addEventListener('pointerdown', event => {
  if (game.state !== 'playing') return
  lookPointer = event.pointerId; lastLook = { x: event.clientX, y: event.clientY }
  lookZone.setPointerCapture(event.pointerId)
})
lookZone.addEventListener('pointermove', event => {
  if (event.pointerId !== lookPointer) return
  game.look(event.clientX - lastLook.x, event.clientY - lastLook.y)
  lastLook = { x: event.clientX, y: event.clientY }
})
const releaseLook = (event: PointerEvent) => { if (event.pointerId === lookPointer) lookPointer = undefined }
lookZone.addEventListener('pointerup', releaseLook)
lookZone.addEventListener('pointercancel', releaseLook)

let previous = performance.now()
function frame(now: number) {
  const dt = Math.min(0.05, (now - previous) / 1000)
  previous = now
  game.update(dt)
  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => undefined) }, { once: true })
}

window.addEventListener('error', event => {
  console.error('FPS runtime error:', event.error || event.message)
  if (game.state === 'playing') ui.toast('SYSTEM ERROR / RELOAD AFTER SAVING YOUR PROGRESS')
})
