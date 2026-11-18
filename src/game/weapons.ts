import * as THREE from 'three'

export type WeaponId = 'rifle' | 'shotgun' | 'launcher' | 'knife' | 'grenade'
export interface WeaponSpec {
  id: WeaponId
  name: string
  damage: number
  rate: number
  magazine: number
  reserve: number
  reload: number
  spread: number
  range: number
  pellets: number
  auto: boolean
}
export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  rifle: { id: 'rifle', name: 'M4 / assault rifle', damage: 26, rate: 0.115, magazine: 30, reserve: 180, reload: 1.55, spread: 0.007, range: 90, pellets: 1, auto: true },
  shotgun: { id: 'shotgun', name: 'M12 / combat shotgun', damage: 14, rate: 0.18, magazine: 8, reserve: 64, reload: 1.2, spread: 0.064, range: 27, pellets: 9, auto: true },
  launcher: { id: 'launcher', name: 'AT-4 / rocket launcher', damage: 150, rate: 0.95, magazine: 1, reserve: 8, reload: 1.9, spread: 0, range: 100, pellets: 1, auto: false },
  knife: { id: 'knife', name: 'M9 / field knife', damage: 60, rate: 0.45, magazine: 0, reserve: 0, reload: 0, spread: 0, range: 3.1, pellets: 1, auto: false },
  grenade: { id: 'grenade', name: 'M67 / frag grenade', damage: 115, rate: 0.75, magazine: 3, reserve: 0, reload: 0, spread: 0, range: 42, pellets: 1, auto: false },
}

const material = (color: THREE.ColorRepresentation, metalness = 0.58, roughness = 0.48) => new THREE.MeshStandardMaterial({ color, metalness, roughness })

function part(parent: THREE.Group, geometry: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(geometry, mat)
  mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz)
  mesh.castShadow = true
  parent.add(mesh)
  return mesh
}

export function createWeaponView(camera: THREE.Camera) {
  const root = new THREE.Group()
  root.name = 'view-weapon'
  camera.add(root)
  root.scale.setScalar(0.8)
  const dark = material('#252d2c', 0.7, 0.46)
  const polymer = material('#1b2020', 0.22, 0.78)
  const steel = material('#69706b', 0.82, 0.36)
  const tan = material('#756149', 0.28, 0.79)
  const amber = new THREE.MeshStandardMaterial({ color: '#f6b466', emissive: '#d77d2d', emissiveIntensity: 1.2 })
  const red = new THREE.MeshStandardMaterial({ color: '#ff4029', emissive: '#ff1d0b', emissiveIntensity: 3.2 })

  // The forearm sleeves and gloves keep the first-person view grounded in a human operator.
  const sleeve = material('#323c39', 0.16, 0.9)
  const glove = material('#242b29', 0.2, 0.86)
  const arm1 = part(root, new THREE.CapsuleGeometry(0.105, 0.48, 4, 7), sleeve, -0.08, -0.25, -0.29, -0.92, 0.05, 0.28)
  arm1.scale.set(1.0, 1.15, 1.0)
  part(root, new THREE.CapsuleGeometry(0.085, 0.21, 4, 7), glove, 0.12, -0.16, -0.51, -0.95, 0.1, -0.18)
  part(root, new THREE.CapsuleGeometry(0.11, 0.48, 4, 7), sleeve, 0.38, -0.3, -0.17, -0.8, 0.05, -0.46)
  part(root, new THREE.CapsuleGeometry(0.08, 0.19, 4, 7), glove, 0.23, -0.17, -0.53, -0.8, -0.05, 0.35)
  const rifle = new THREE.Group(); root.add(rifle)
  const shotgun = new THREE.Group(); root.add(shotgun)
  const launcher = new THREE.Group(); root.add(launcher)
  const knife = new THREE.Group(); root.add(knife)
  const grenade = new THREE.Group(); root.add(grenade)

  // M4-style carbine: receiver, buffer stock, magazine, rail, front post, suppressor and functional red-dot optic.
  part(rifle, new THREE.BoxGeometry(0.24, 0.17, 0.56), dark, 0.05, -0.06, -0.12)
  part(rifle, new THREE.BoxGeometry(0.22, 0.12, 0.38), tan, 0.05, -0.08, 0.27)
  part(rifle, new THREE.BoxGeometry(0.16, 0.29, 0.2), polymer, 0.05, -0.26, 0.01, -0.18)
  part(rifle, new THREE.BoxGeometry(0.22, 0.13, 0.38), polymer, 0.05, -0.05, 0.42)
  part(rifle, new THREE.BoxGeometry(0.09, 0.23, 0.11), tan, 0.05, -0.19, -0.24)
  part(rifle, new THREE.CylinderGeometry(0.035, 0.04, 0.55, 10), steel, 0.05, -0.02, -0.59, Math.PI / 2)
  part(rifle, new THREE.CylinderGeometry(0.048, 0.048, 0.23, 10), dark, 0.05, -0.02, -0.96, Math.PI / 2)
  part(rifle, new THREE.BoxGeometry(0.28, 0.13, 0.36), tan, 0.05, 0.0, -0.51)
  for (let i = 0; i < 3; i++) part(rifle, new THREE.BoxGeometry(0.29, 0.022, 0.08), dark, 0.05, 0.075, -0.39 - i * 0.1)
  part(rifle, new THREE.BoxGeometry(0.1, 0.1, 0.32), polymer, 0.05, -0.17, -0.46, 0.15)
  part(rifle, new THREE.BoxGeometry(0.23, 0.035, 0.23), dark, 0.05, 0.04, -0.17)
  // Optic ring, lens and pin-sized red emitter sit on the weapon itself; aim mode narrows the camera through it.
  part(rifle, new THREE.TorusGeometry(0.084, 0.015, 7, 18), steel, 0.05, 0.145, -0.18, Math.PI / 2)
  part(rifle, new THREE.BoxGeometry(0.055, 0.14, 0.1), dark, 0.05, 0.09, -0.18)
  part(rifle, new THREE.SphereGeometry(0.012, 8, 6), red, 0.05, 0.145, -0.105)
  part(rifle, new THREE.BoxGeometry(0.035, 0.17, 0.04), steel, 0.05, 0.115, -0.82)
  part(rifle, new THREE.SphereGeometry(0.033, 8, 6), amber, -0.08, -0.05, -0.4)

  // Combat shotgun: elevated receiver, shell carrier, front bead and aligned iron sights, rapid-action pump.
  part(shotgun, new THREE.BoxGeometry(0.24, 0.17, 0.49), dark, 0.04, -0.055, -0.06)
  part(shotgun, new THREE.BoxGeometry(0.19, 0.13, 0.38), tan, 0.04, -0.02, -0.46)
  part(shotgun, new THREE.CylinderGeometry(0.046, 0.047, 0.67, 10), steel, 0.04, -0.01, -0.72, Math.PI / 2)
  part(shotgun, new THREE.CylinderGeometry(0.055, 0.055, 0.48, 10), dark, 0.04, -0.13, -0.56, Math.PI / 2)
  part(shotgun, new THREE.BoxGeometry(0.21, 0.14, 0.39), polymer, 0.04, -0.04, 0.39)
  part(shotgun, new THREE.BoxGeometry(0.16, 0.25, 0.16), polymer, 0.04, -0.23, 0.08, -0.18)
  part(shotgun, new THREE.BoxGeometry(0.22, 0.07, 0.22), steel, 0.04, 0.14, -0.33)
  part(shotgun, new THREE.BoxGeometry(0.16, 0.08, 0.1), steel, 0.04, 0.16, -0.84)
  part(shotgun, new THREE.SphereGeometry(0.025, 8, 6), amber, 0.04, 0.2, -0.91)
  for (let i = 0; i < 5; i++) part(shotgun, new THREE.CylinderGeometry(0.025, 0.025, 0.12, 8), material('#bd6d37', 0.62, 0.32), -0.11, -0.08, 0.16 - i * 0.1, Math.PI / 2)

  // Rocket tube launcher with optical block, shoulder stock and finned inert training rocket model.
  part(launcher, new THREE.CylinderGeometry(0.16, 0.17, 1.12, 12), dark, 0.04, 0.02, -0.43, Math.PI / 2)
  part(launcher, new THREE.CylinderGeometry(0.18, 0.16, 0.16, 12), steel, 0.04, 0.02, -1.03, Math.PI / 2)
  part(launcher, new THREE.BoxGeometry(0.39, 0.2, 0.34), tan, 0.04, -0.04, 0.26)
  part(launcher, new THREE.BoxGeometry(0.12, 0.27, 0.15), polymer, 0.04, -0.24, -0.03)
  part(launcher, new THREE.BoxGeometry(0.26, 0.15, 0.17), dark, 0.04, 0.21, -0.35)
  part(launcher, new THREE.BoxGeometry(0.28, 0.08, 0.19), steel, 0.04, -0.16, -0.71)
  for (const side of [-1, 1]) part(launcher, new THREE.BoxGeometry(0.08, 0.18, 0.12), amber, 0.04 + side * 0.15, 0.01, -0.8)

  // M9 field knife; grenade is visibly held when its slot is selected.
  part(knife, new THREE.BoxGeometry(0.07, 0.1, 0.34), polymer, 0.04, -0.14, -0.16, 0, 0, -0.5)
  const blade = part(knife, new THREE.BoxGeometry(0.055, 0.04, 0.38), steel, 0.11, -0.09, -0.49, 0, 0, -0.38)
  blade.scale.x = 1.15
  part(grenade, new THREE.CylinderGeometry(0.12, 0.12, 0.25, 10), standardOlive(), 0.12, -0.15, -0.39)
  part(grenade, new THREE.TorusGeometry(0.08, 0.018, 6, 12), steel, 0.12, -0.01, -0.39, Math.PI / 2)
  part(grenade, new THREE.BoxGeometry(0.08, 0.13, 0.05), steel, 0.17, 0.015, -0.38)

  const models: Record<WeaponId, THREE.Group> = { rifle, shotgun, launcher, knife, grenade }
  return {
    root,
    set(id: WeaponId, aimed: boolean, time: number) {
      for (const [key, model] of Object.entries(models)) model.visible = key === id
      root.position.set(aimed && id === 'rifle' ? 0.06 : 0.13, aimed && id === 'rifle' ? -0.18 : -0.27, aimed ? -0.38 : -0.48)
      root.rotation.z = Math.sin(time * 8) * 0.004
    },
    recoil(amount: number, id: WeaponId) {
      root.position.z += amount
      root.rotation.x = -amount * 0.6
      const model = models[id]
      if (model) model.rotation.x = -amount * 0.4
    },
    settle(id: WeaponId, aimed: boolean, time: number, recoil: number) {
      this.set(id, aimed, time)
      root.position.z += recoil
      root.rotation.x = -recoil * 0.6
    },
  }
}

function standardOlive() { return material('#596049', 0.24, 0.83) }
