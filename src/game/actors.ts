import * as THREE from 'three'

export type EnemyKind = 'wolf' | 'boar' | 'robot' | 'dog' | 'exosuit' | 'boss'
export interface Enemy {
  id: number
  kind: EnemyKind
  root: THREE.Group
  health: number
  maxHealth: number
  speed: number
  damage: number
  fireDelay: number
  attackTimer: number
  radius: number
  dead: boolean
  phase: number
  bob: number
  value: number
  targetId?: number
  special: boolean
}

const standard = (color: THREE.ColorRepresentation, roughness = 0.72, metalness = 0.25) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
const glow = (color: THREE.ColorRepresentation, intensity = 1.5) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.35, metalness: 0.35 })

function addMesh(root: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, tag?: string) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  if (tag) mesh.userData.hitZone = tag
  root.add(mesh)
  return mesh
}

function human(root: THREE.Group, kind: EnemyKind, boss = false) {
  const suit = standard(kind === 'boar' ? '#443c34' : kind === 'exosuit' ? '#3f4944' : '#3f4948', 0.78, 0.35)
  const armor = standard(kind === 'boar' ? '#51463b' : '#35413f', 0.5, 0.48)
  const dark = standard('#182020', 0.5, 0.54)
  const mask = standard(kind === 'boar' ? '#99866e' : kind === 'wolf' ? '#a79d87' : '#b5b4aa', 0.7, 0.18)
  const helmet = standard('#293433', 0.58, 0.36)
  const lens = glow(kind === 'boar' ? '#dc7546' : '#e4aa53', 1.35)
  const core = glow('#ff9b48', 2.5)
  addMesh(root, new THREE.CapsuleGeometry(boss ? 0.52 : 0.33, boss ? 1.1 : 0.78, 5, 9), suit, 0, 1.05, 0)
  addMesh(root, new THREE.BoxGeometry(boss ? 1.32 : 0.92, boss ? 0.74 : 0.55, 0.48), armor, 0, 1.34, 0.02)
  addMesh(root, new THREE.BoxGeometry(boss ? 0.23 : 0.14, 0.61, 0.19), dark, 0, 1.34, 0.28)
  const head = addMesh(root, new THREE.SphereGeometry(boss ? 0.38 : 0.25, 12, 10), helmet, 0, 2.0, 0.05, 'head')
  addMesh(root, new THREE.BoxGeometry(boss ? 0.5 : 0.35, 0.16, 0.29), mask, 0, 1.91, 0.25)
  for (const x of [-0.095, 0.095]) addMesh(root, new THREE.SphereGeometry(0.036, 8, 6), lens, x, 2.03, 0.3)
  if (kind === 'wolf') {
    const muzzle = addMesh(root, new THREE.ConeGeometry(0.15, 0.34, 5), mask, 0, 1.86, 0.41)
    muzzle.rotation.x = Math.PI / 2
    for (const x of [-0.18, 0.18]) {
      const ear = addMesh(root, new THREE.ConeGeometry(0.12, 0.25, 4), mask, x, 2.2, 0.0)
      ear.rotation.z = x < 0 ? 0.4 : -0.4
    }
  } else if (kind === 'boar') {
    addMesh(root, new THREE.SphereGeometry(0.17, 10, 8), mask, 0, 1.83, 0.38)
    for (const x of [-0.16, 0.16]) {
      const tusk = addMesh(root, new THREE.ConeGeometry(0.055, 0.21, 6), standard('#d2c3a8', 0.46, 0.15), x, 1.79, 0.39)
      tusk.rotation.x = Math.PI / 2
    }
  }
  if (kind === 'exosuit' || boss) {
    for (const side of [-1, 1]) {
      addMesh(root, new THREE.BoxGeometry(boss ? 0.37 : 0.28, 0.62, 0.52), dark, side * (boss ? 0.67 : 0.49), 1.52, -0.02)
      addMesh(root, new THREE.BoxGeometry(boss ? 0.46 : 0.34, 0.18, 0.55), armor, side * (boss ? 0.63 : 0.48), 1.74, 0.02)
    }
    const weak = addMesh(root, new THREE.SphereGeometry(boss ? 0.22 : 0.14, 12, 10), core, 0, 1.37, 0.36, 'weakpoint')
    weak.scale.z = 0.45
    const frame = standard('#71756b', 0.42, 0.72)
    for (const side of [-1, 1]) {
      addMesh(root, new THREE.CylinderGeometry(0.045, 0.07, 0.67, 8), frame, side * 0.45, 1.0, 0.01).rotation.z = side * -0.09
      addMesh(root, new THREE.BoxGeometry(0.3, 0.22, 0.48), dark, side * 0.24, 0.44, 0.02)
      addMesh(root, new THREE.BoxGeometry(0.16, 0.22, 0.12), glow('#e67f4d', 1.1), side * 0.2, 0.46, 0.24)
    }
    for (const side of [-1, 1]) addMesh(root, new THREE.BoxGeometry(0.24, 0.46, 0.34), armor, side * 0.19, 0.57, 0)
  } else {
    for (const side of [-1, 1]) {
      addMesh(root, new THREE.CapsuleGeometry(0.105, 0.42, 4, 7), suit, side * 0.43, 1.02, 0.01).rotation.z = side * -0.14
      addMesh(root, new THREE.CapsuleGeometry(0.12, 0.45, 4, 7), suit, side * 0.18, 0.43, 0).rotation.z = side * 0.03
      addMesh(root, new THREE.BoxGeometry(0.28, 0.12, 0.4), dark, side * 0.18, 0.14, -0.02)
      addMesh(root, new THREE.BoxGeometry(0.2, 0.17, 0.23), armor, side * 0.42, 0.69, 0.02)
    }
    addMesh(root, new THREE.BoxGeometry(0.45, 0.28, 0.28), standard('#171c1c', 0.48, 0.56), 0.46, 1.12, 0.18)
  }
  head.userData.hitZone = 'head'
  // Tiny readable silhouette details: headset cup and chest straps.
  for (const side of [-1, 1]) addMesh(root, new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8), dark, side * 0.26, 2.0, 0.04).rotation.z = Math.PI / 2
  for (const side of [-1, 1]) addMesh(root, new THREE.BoxGeometry(0.07, 0.6, 0.06), standard('#8b7956', 0.8, 0.1), side * 0.21, 1.32, 0.27).rotation.z = side * 0.28
}

function robot(root: THREE.Group) {
  const shell = standard('#d3d5ce', 0.38, 0.62)
  const joint = standard('#4b5351', 0.51, 0.7)
  const light = glow('#6bd3d2', 2.2)
  addMesh(root, new THREE.BoxGeometry(0.72, 0.86, 0.42), shell, 0, 1.17, 0)
  addMesh(root, new THREE.BoxGeometry(0.84, 0.23, 0.52), joint, 0, 1.55, -0.01)
  const head = addMesh(root, new THREE.BoxGeometry(0.5, 0.34, 0.34), shell, 0, 1.92, 0.04, 'head')
  addMesh(root, new THREE.BoxGeometry(0.34, 0.08, 0.12), light, 0, 1.96, 0.23)
  addMesh(root, new THREE.BoxGeometry(0.32, 0.12, 0.12), joint, 0, 0.92, 0.24, 'weakpoint')
  for (const side of [-1, 1]) {
    addMesh(root, new THREE.CylinderGeometry(0.095, 0.11, 0.66, 8), joint, side * 0.48, 1.12, 0).rotation.z = side * -0.1
    addMesh(root, new THREE.CylinderGeometry(0.13, 0.12, 0.7, 8), shell, side * 0.2, 0.48, 0)
    addMesh(root, new THREE.BoxGeometry(0.3, 0.22, 0.52), joint, side * 0.2, 0.12, 0.03)
  }
  for (const side of [-1, 1]) addMesh(root, new THREE.BoxGeometry(0.12, 0.42, 0.5), shell, side * 0.42, 1.36, 0)
  head.userData.hitZone = 'head'
}

function dog(root: THREE.Group) {
  const shell = standard('#525a58', 0.48, 0.69)
  const armor = standard('#283332', 0.43, 0.68)
  const sensor = glow('#dc7748', 1.9)
  addMesh(root, new THREE.BoxGeometry(0.74, 0.39, 1.03), shell, 0, 0.75, 0)
  addMesh(root, new THREE.BoxGeometry(0.5, 0.33, 0.42), armor, 0, 0.94, 0.62, 'head')
  addMesh(root, new THREE.BoxGeometry(0.28, 0.09, 0.05), sensor, 0, 0.97, 0.85)
  addMesh(root, new THREE.CylinderGeometry(0.12, 0.1, 0.42, 8), armor, 0, 1.05, -0.12)
  addMesh(root, new THREE.BoxGeometry(0.54, 0.22, 0.3), shell, 0, 1.3, -0.12)
  addMesh(root, new THREE.BoxGeometry(0.16, 0.12, 0.24), sensor, 0, 1.46, -0.12, 'weakpoint')
  for (const x of [-0.26, 0.26]) for (const z of [-0.32, 0.35]) {
    const leg = addMesh(root, new THREE.CylinderGeometry(0.07, 0.11, 0.54, 6), armor, x, 0.39, z)
    leg.rotation.z = x * 0.25
    addMesh(root, new THREE.BoxGeometry(0.17, 0.13, 0.25), shell, x, 0.1, z + 0.02)
  }
  addMesh(root, new THREE.CylinderGeometry(0.04, 0.05, 0.37, 7), armor, 0, 0.72, -0.6).rotation.x = -0.4
}

export function createEnemy(id: number, kind: EnemyKind, position: THREE.Vector3, wave: number, special = false): Enemy {
  const root = new THREE.Group()
  root.position.copy(position)
  const boss = kind === 'boss'
  if (kind === 'robot') robot(root)
  else if (kind === 'dog') dog(root)
  else human(root, kind, boss)
  if (boss) root.scale.setScalar(2.15)
  const scale = boss ? 1 : kind === 'dog' ? 0.8 : kind === 'robot' ? 1 : 1
  const healthBase = boss ? 1050 : kind === 'dog' ? 92 : kind === 'robot' ? 118 : kind === 'exosuit' ? 210 : kind === 'boar' ? 132 : 105
  const maxHealth = Math.round(healthBase * (boss ? 1 : 0.78 + Math.min(1.25, wave * 0.095)))
  const speedBase = boss ? 1.85 : kind === 'dog' ? 5.3 : kind === 'robot' ? 2.5 : kind === 'exosuit' ? 2.0 : 2.8
  const damageBase = boss ? 27 : kind === 'dog' ? 11 : kind === 'robot' ? 13 : kind === 'exosuit' ? 20 : 16
  const enemy: Enemy = {
    id, kind, root, health: maxHealth, maxHealth,
    speed: speedBase * (1 + Math.min(0.42, wave * 0.035)),
    damage: damageBase * (1 + Math.min(0.55, wave * 0.055)),
    fireDelay: boss ? 1.2 : kind === 'dog' ? 1.55 : kind === 'robot' ? 1.15 : 1.35,
    attackTimer: 1 + Math.random() * 0.9,
    radius: boss ? 1.2 : kind === 'dog' ? 0.6 : 0.48,
    dead: false,
    phase: 1,
    bob: Math.random() * 7,
    value: Math.round((kind === 'boss' ? 2500 : kind === 'exosuit' ? 180 : kind === 'dog' ? 120 : 100) * scale),
    special,
  }
  root.traverse(object => { object.userData.target = enemy })
  return enemy
}

export function animateEnemy(enemy: Enemy, dt: number, time: number) {
  const gait = Math.sin(time * (enemy.kind === 'dog' ? 13 : 7) + enemy.bob) * (enemy.kind === 'boss' ? 0.06 : 0.11)
  enemy.root.children.forEach((child, index) => {
    if (index % 5 === 0 && child instanceof THREE.Mesh) child.rotation.x = gait
  })
  enemy.root.position.y = enemy.kind === 'dog' ? Math.abs(Math.sin(time * 10 + enemy.bob)) * 0.045 : Math.sin(time * 3 + enemy.bob) * 0.012
  if (enemy.kind === 'boss') {
    enemy.root.scale.setScalar(2.15 + Math.sin(time * 2.8) * 0.018)
    const core = enemy.root.children.find(c => c.userData.hitZone === 'weakpoint')
    if (core instanceof THREE.Mesh && core.material instanceof THREE.MeshStandardMaterial) core.material.emissiveIntensity = enemy.phase === 3 ? 4.5 + Math.sin(time * 11) * 1.2 : 2.5 + Math.sin(time * 6) * 0.55
  }
  void dt
}
