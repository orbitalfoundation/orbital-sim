<script>
  import * as THREE from 'three'

  // Placeholder city markers — replace with real scenario locations later
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

  // Equirectangular lat/lon → Three.js sphere XYZ
  // Matches the UV mapping of THREE.SphereGeometry's default orientation
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
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
    camera.position.z = 2.4

    // Globe sphere — MeshBasicMaterial shows texture at full brightness,
    // matching the original static image. No lighting setup needed.
    const tex = new THREE.TextureLoader().load('/assets/earth.jpg')
    tex.colorSpace = THREE.SRGBColorSpace
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshBasicMaterial({ map: tex })
    )
    globe.rotation.x =  0.28           // slight northward tilt toward viewer
    globe.rotation.y = -Math.PI / 2    // start with Europe/Africa facing front
    scene.add(globe)

    // City dot markers — children of globe so they rotate with it.
    // MeshBasicMaterial keeps them bright regardless of scene lighting.
    const dotGeo = new THREE.SphereGeometry(0.03, 10, 10)
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xff5533 })
    for (const [, lat, lon] of CITIES) {
      const dot = new THREE.Mesh(dotGeo, dotMat)
      dot.position.copy(latLonToXYZ(lat, lon, 1.04))
      globe.add(dot)
    }

    // Very slow eastward rotation (~6 min per revolution at 60 fps)
    let raf
    const tick = () => {
      raf = requestAnimationFrame(tick)
      globe.rotation.y += 0.0003
      renderer.render(scene, camera)
    }
    tick()

    // Responsive resize
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
      renderer.domElement.remove()
      renderer.dispose()
    }
  })
</script>

<div bind:this={container} style="width:100%;height:100%"></div>
