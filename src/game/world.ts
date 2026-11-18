import * as THREE from 'three'

export interface CoverBox { x: number; z: number; hx: number; hz: number; height: number }

const mat = (color: THREE.ColorRepresentation, roughness = 0.72, metalness = 0.18) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness })

export class HarborWorld {
  readonly cover: CoverBox[] = []
  readonly rain: THREE.Points
  private rainPositions: Float32Array
  private water: THREE.Mesh
  private clock = 0
  private flareLights: THREE.PointLight[] = []

  constructor(readonly scene: THREE.Scene) {
    scene.background = new THREE.Color('#9a6850')
    scene.fog = new THREE.FogExp2('#8f7468', 0.008)
    this.buildGround()
    this.buildContainerYard()
    this.buildHarbor()
    this.buildLights()
    this.rainPositions = new Float32Array(1200 * 3)
    for (let i = 0; i < 1200; i++) {
      this.rainPositions[i * 3] = (Math.random() - 0.5) * 84
      this.rainPositions[i * 3 + 1] = Math.random() * 26 + 2
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 84
    }
    const rainGeometry = new THREE.BufferGeometry()
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3))
    this.rain = new THREE.Points(rainGeometry, new THREE.PointsMaterial({ color: '#d5dbe0', size: 0.045, transparent: true, opacity: 0.34, depthWrite: false }))
    this.scene.add(this.rain)
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(160, 80), mat('#26383b', 0.46, 0.34))
    this.water.rotation.x = -Math.PI / 2
    this.water.position.set(0, -0.09, -78)
    this.scene.add(this.water)
  }

  private box(parent: THREE.Object3D, w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number, cast = true): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    mesh.position.set(x, y, z)
    mesh.castShadow = cast
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  private buildGround() {
    const concrete = new THREE.Mesh(new THREE.PlaneGeometry(94, 94), mat('#393d3d', 0.88, 0.08))
    concrete.rotation.x = -Math.PI / 2
    concrete.position.y = -0.12
    concrete.receiveShadow = true
    this.scene.add(concrete)
    const lane = mat('#b49770', 0.85, 0.05)
    for (const x of [-12, 12]) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 66), lane)
      stripe.rotation.x = -Math.PI / 2
      stripe.position.set(x, -0.1, 2)
      this.scene.add(stripe)
    }
    for (let i = 0; i < 12; i++) {
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(1 + Math.random() * 3, 24), mat('#242f31', 0.5, 0.28))
      puddle.rotation.x = -Math.PI / 2
      puddle.scale.y = 0.36
      puddle.position.set((Math.random() - 0.5) * 55, -0.085, (Math.random() - 0.5) * 48)
      this.scene.add(puddle)
    }
    // Dock approach and painted safety marks.
    const yellow = mat('#b79b5e', 0.85, 0.05)
    for (let i = -5; i <= 5; i++) {
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.12), yellow)
      mark.rotation.x = -Math.PI / 2
      mark.position.set(i * 2.1, -0.095, 10)
      this.scene.add(mark)
    }
  }

  private container(x: number, z: number, w: number, d: number, h: number, color: string) {
    const root = new THREE.Group()
    root.position.set(x, 0, z)
    const body = mat(color, 0.82, 0.36)
    const edge = mat('#20282a', 0.66, 0.46)
    this.box(root, w, h, d, body, 0, h / 2, 0)
    for (const side of [-1, 1]) {
      const ribs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.075, h - 0.16, 0.055), edge, 14)
      const dummy = new THREE.Object3D()
      for (let i = 0; i < 14; i++) {
        dummy.position.set(-w / 2 + 0.3 + i * (w - 0.6) / 13, h / 2, side * (d / 2 + 0.035))
        dummy.updateMatrix()
        ribs.setMatrixAt(i, dummy.matrix)
      }
      ribs.castShadow = true
      ribs.receiveShadow = true
      root.add(ribs)
    }
    for (const px of [-w / 2 + 0.09, w / 2 - 0.09]) {
      this.box(root, 0.18, h, d + 0.12, edge, px, h / 2, 0)
    }
    this.box(root, w + 0.06, 0.12, d + 0.08, edge, 0, h - 0.05, 0)
    this.box(root, w + 0.06, 0.12, d + 0.08, edge, 0, 0.05, 0)
    this.scene.add(root)
    this.cover.push({ x, z, hx: w / 2, hz: d / 2, height: h })
  }

  private buildContainerYard() {
    const palette = ['#5d3530', '#475b5e', '#62614f', '#394b56', '#77523e', '#465147', '#6b493b']
    const rows: Array<[number, number, number, number, number]> = [
      [-27, -21, 9, 3.2, 3.3], [-15, -21, 8, 3.2, 3.3], [0, -22, 10, 3.2, 3.3], [17, -22, 9, 3.2, 3.3], [29, -21, 8, 3.2, 3.3],
      [-29, -6, 8, 3.2, 3.3], [-18, -6, 9, 3.2, 3.3], [19, -6, 8, 3.2, 3.3], [30, -6, 8, 3.2, 3.3],
      [-29, 10, 8, 3.2, 3.3], [-18, 11, 9, 3.2, 3.3], [19, 12, 9, 3.2, 3.3], [30, 11, 8, 3.2, 3.3],
      [-27, 26, 10, 3.2, 3.3], [-13, 28, 8, 3.2, 3.3], [18, 27, 9, 3.2, 3.3], [30, 27, 8, 3.2, 3.3],
    ]
    rows.forEach(([x, z, w, d, h], i) => {
      const color = palette[i % palette.length]
      this.container(x, z, w, d, h, color)
      if (i % 4 === 1 || i === 5 || i === 11) this.container(x, z, w, d, h, palette[(i + 3) % palette.length])
    })
    // Low concrete jersey barriers, cable reels and crates create crouch-height cover.
    const concrete = mat('#656663', 0.93, 0.02)
    const crate = mat('#3d423e', 0.92, 0.03)
    for (const [x, z] of [[-9, -13], [9, -12], [-10, 21], [11, 21], [0, 29], [0, -31]] as number[][]) {
      this.box(this.scene, 3.2, 1.1, 0.9, concrete, x, 0.55, z)
      this.cover.push({ x, z, hx: 1.6, hz: 0.45, height: 1.1 })
    }
    for (const [x, z] of [[-5, 3], [5, 4], [-8, 26], [8, -27], [24, 18], [-24, 16]] as number[][]) {
      this.box(this.scene, 1.5, 1.25, 1.5, crate, x, 0.625, z)
      this.cover.push({ x, z, hx: 0.75, hz: 0.75, height: 1.25 })
      const strap = mat('#82724c', 0.75, 0.18)
      this.box(this.scene, 1.55, 0.08, 0.08, strap, x, 0.72, z - 0.78)
    }
    // Safety lamps and a few practical overhead strings.
    for (const [x, z] of [[-33, 0], [33, 2], [-2, -35], [2, 35]] as number[][]) {
      const mast = mat('#22292a', 0.45, 0.75)
      this.box(this.scene, 0.13, 8.5, 0.13, mast, x, 4.25, z)
      const lamp = new THREE.PointLight('#e5a25f', 32, 20, 1.7)
      lamp.position.set(x, 8.3, z)
      this.scene.add(lamp)
      this.flareLights.push(lamp)
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshBasicMaterial({ color: '#ffd39a' }))
      bulb.position.copy(lamp.position)
      this.scene.add(bulb)
    }
  }

  private buildHarbor() {
    const steel = mat('#273235', 0.64, 0.64)
    const rust = mat('#765443', 0.82, 0.42)
    // Gantry crane: portal frame, crossbeam, trolley, suspended spreader and cable.
    for (const x of [-23, 23]) {
      this.box(this.scene, 0.8, 20, 0.8, steel, x, 10, -34)
      this.box(this.scene, 1.8, 1.2, 2.2, rust, x, 1.0, -34)
      this.box(this.scene, 2.2, 0.25, 2.8, steel, x, 19.8, -34)
    }
    this.box(this.scene, 52, 0.9, 1.0, rust, 0, 20.5, -34)
    this.box(this.scene, 51, 0.2, 0.25, steel, 0, 20.0, -34)
    this.box(this.scene, 4.5, 0.8, 2.4, steel, 7, 19.6, -34)
    this.box(this.scene, 0.1, 5.5, 0.1, steel, 7, 16.45, -34)
    this.box(this.scene, 6.2, 0.4, 2.1, rust, 7, 13.6, -34)
    // Container ship silhouettes beyond the terminal fence.
    this.box(this.scene, 30, 7.5, 11, mat('#263337', 0.5, 0.62), -2, 3.7, -62)
    this.box(this.scene, 5.5, 4.6, 6.2, mat('#485050', 0.76, 0.27), -12, 9.2, -61)
    for (let row = 0; row < 2; row++) for (let i = 0; i < 4; i++) {
      const shipBox = new THREE.Mesh(new THREE.BoxGeometry(5.7, 2.4, 4.8), mat(['#704b3d', '#43535a', '#66614e', '#60463a'][(i + row) % 4], 0.82, 0.3))
      shipBox.position.set(-10 + i * 6, 9.8 + row * 2.6, -62)
      shipBox.castShadow = true
      this.scene.add(shipBox)
    }
    // Distant dock cranes and mast silhouettes.
    for (const x of [-43, -29, 31, 43]) {
      this.box(this.scene, 0.55, 15, 0.55, steel, x, 7.5, -47)
      this.box(this.scene, 11, 0.45, 0.55, rust, x + 3.7, 14.5, -47)
      this.box(this.scene, 0.09, 6.0, 0.09, steel, x + 5.7, 11.2, -47)
    }
    const rail = mat('#20282a', 0.68, 0.62)
    for (const x of [-39, 39]) {
      this.box(this.scene, 0.18, 1.7, 58, rail, x, 0.85, -5)
      for (let z = -31; z < 25; z += 2.5) this.box(this.scene, 0.12, 2.1, 0.12, rail, x, 1.05, z)
    }
  }

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight('#b5b4b0', '#35302b', 1.6))
    const sun = new THREE.DirectionalLight('#ffd0a0', 3.15)
    sun.position.set(-30, 43, 18)
    sun.castShadow = true
    sun.shadow.mapSize.set(1536, 1536)
    sun.shadow.camera.left = -48; sun.shadow.camera.right = 48
    sun.shadow.camera.top = 42; sun.shadow.camera.bottom = -42
    sun.shadow.bias = -0.00025
    this.scene.add(sun)
    const sunset = new THREE.PointLight('#e57d52', 46, 105, 1.4)
    sunset.position.set(-48, 16, -44)
    this.scene.add(sunset)
    const ambientDock = new THREE.PointLight('#68848b', 18, 52, 1.8)
    ambientDock.position.set(8, 8, -36)
    this.scene.add(ambientDock)
  }

  update(dt: number) {
    this.clock += dt
    for (let i = 0; i < this.rainPositions.length / 3; i++) {
      const n = i * 3
      this.rainPositions[n] += dt * 1.6
      this.rainPositions[n + 1] -= dt * (15 + (i % 7))
      if (this.rainPositions[n + 1] < 0) {
        this.rainPositions[n + 1] = 19 + Math.random() * 10
        this.rainPositions[n] = (Math.random() - 0.5) * 84
        this.rainPositions[n + 2] = (Math.random() - 0.5) * 84
      }
    }
    ;(this.rain.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    this.water.position.y = -0.09 + Math.sin(this.clock * 0.55) * 0.008
    this.flareLights.forEach((light, i) => { light.intensity = 30 + Math.sin(this.clock * 2.2 + i) * 2.4 })
  }

  isBlocked(x: number, z: number, radius = 0.38): boolean {
    if (Math.abs(x) > 43 || Math.abs(z) > 43) return true
    return this.cover.some(b => x > b.x - b.hx - radius && x < b.x + b.hx + radius && z > b.z - b.hz - radius && z < b.z + b.hz + radius)
  }

  dispose() {
    this.rain.geometry.dispose()
    ;(this.rain.material as THREE.Material).dispose()
  }
}
