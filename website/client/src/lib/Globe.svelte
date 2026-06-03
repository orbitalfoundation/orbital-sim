<script>
  import * as THREE from 'three'

  // Placeholder city markers — swap for real scenario { lat, lon } later
  const CITIES = [
    ['London',       51.5,   -0.1 ],
    ['New York',     40.7,  -74.0 ],
    ['Tokyo',        35.7,  139.7 ],
    ['São Paulo',   -23.5,  -46.6 ],
    ['Mumbai',       19.1,   72.9 ],
    ['Sydney',      -33.9,  151.2 ],
    ['Cairo',        30.0,   31.2 ],
    ['Lagos',         6.5,    3.4 ],
    ['Singapore',     1.4,  103.8 ],
    ['Mexico City',  19.4,  -99.1 ],
    ['Berlin',       52.5,   13.4 ],
    ['Shanghai',     31.2,  121.5 ],
    ['Los Angeles',  34.1, -118.2 ],
    ['Nairobi',      -1.3,   36.8 ],
    ['Moscow',       55.8,   37.6 ],
    ['Dubai',        25.2,   55.3 ],
  ]

  // Cycle through these for the dot markers
  const DOT_COLORS = [0xff6b35, 0x4fc3f7, 0x81c784, 0xffca28]

  function latLonToXYZ(lat, lon, r = 1) {
    const phi   = (90 - lat) * (Math.PI / 180)
    const theta = (lon + 180) * (Math.PI / 180)
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
       r * Math.cos(phi),
       r * Math.sin(phi) * Math.sin(theta)
    )
  }

  let container = $state(null)

  $effect(() => {
    if (!container) return

    const w = container.clientWidth
    const h = container.clientHeight

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h)
    Object.assign(renderer.domElement.style, { display: 'block', width: '100%', height: '100%' })
    container.appendChild(renderer.domElement)

    const scene  = new THREE.Scene()

    // Pull camera back so the sphere is ~75% of the frame — leaves visible space
    // between sphere edge and CSS circular clip, which breaks the flat-disk illusion.
    // Slight upward offset gives a natural "looking down a little" angle.
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
    camera.position.set(0, 0.3, 3.2)
    camera.lookAt(0, 0, 0)

    // Low ambient so the shadow side is dark; directional from the upper-left
    // and slightly in front — terminator falls across the visible hemisphere.
    scene.add(new THREE.AmbientLight(0xffffff, 0.12))
    const sun = new THREE.DirectionalLight(0xffffff, 1.8)
    sun.position.set(-5, 2, 2)
    scene.add(sun)

    // Tilt group: tilts the rotation axis 23.4° (Earth's axial tilt).
    // The child globe then spins around its own (tilted) Y-axis.
    const tiltGroup = new THREE.Group()
    tiltGroup.rotation.z = 23.4 * (Math.PI / 180)
    scene.add(tiltGroup)

    const tex = new THREE.TextureLoader().load('/assets/earth.jpg')
    tex.colorSpace = THREE.SRGBColorSpace
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0 })
    )
    globe.rotation.y = -Math.PI / 2   // start with Europe/Africa facing forward
    tiltGroup.add(globe)

    // Dot markers: half-size spheres, different colours, semi-transparent.
    // Children of globe so they rotate with it.
    // r=1.025 keeps them clear of the surface without hitting the CSS clip.
    const dotGeo  = new THREE.SphereGeometry(0.015, 10, 10)
    const dotMats = DOT_COLORS.map(c =>
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.72 })
    )
    for (let i = 0; i < CITIES.length; i++) {
      const [, lat, lon] = CITIES[i]
      const dot = new THREE.Mesh(dotGeo, dotMats[i % dotMats.length])
      dot.position.copy(latLonToXYZ(lat, lon, 1.01))
      globe.add(dot)
    }

    // ~6 min per revolution at 60 fps
    let raf
    const tick = () => {
      raf = requestAnimationFrame(tick)
      globe.rotation.y += 0.0003
      renderer.render(scene, camera)
    }
    tick()

    const ro = new ResizeObserver(() => {
      const w2 = container.clientWidth
      const h2 = container.clientHeight
      camera.aspect = w2 / h2
      camera.updateProjectionMatrix()
      renderer.setSize(w2, h2)
    })
    ro.observe(container)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      dotMats.forEach(m => m.dispose())
      renderer.domElement.remove()
      renderer.dispose()
    }
  })
</script>

<div bind:this={container} style="width:100%;height:100%"></div>
