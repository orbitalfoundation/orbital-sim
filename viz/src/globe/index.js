/**
 * createGlobe — interactive 3D globe with satellite imagery tiles.
 *
 * Uses Three.js + 3d-tiles-renderer with Cesium Ion satellite imagery when a
 * token is provided (superbly detailed Bing Maps tiles). Falls back to a plain
 * sphere with a texture URL when no token is set.
 *
 * @param {HTMLElement} container  - DOM element to render into
 * @param {object}      options
 * @param {string}      [options.cesiumToken]  - Cesium Ion API token
 * @param {string}      [options.fallbackTexture='/assets/earth.jpg'] - texture URL for no-token mode
 * @param {string}      [options.mode='globe']  - 'globe' | 'orbit'
 * @param {number}      [options.lat=0]  - initial camera latitude
 * @param {number}      [options.lon=0]  - initial camera longitude
 *
 * @returns {{
 *   addPoints(points: Array<{lat,lon,color?,size?,meta?}>): void,
 *   removePoints(id: string): void,
 *   addArcs(arcs: Array<{from:{lat,lon}, to:{lat,lon}, color?,width?,animated?}>): void,
 *   focusOn(lat: number, lon: number, altitudeM?: number): void,
 *   setData(key: string, value: any): void,
 *   dispose(): void,
 * }}
 */
export async function createGlobe(container, options = {}) {
  const {
    cesiumToken     = null,
    fallbackTexture = '/assets/earth.jpg',
    mode            = 'globe',
    lat             = 0,
    lon             = 0,
  } = options;

  // ---- Three.js setup ----
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setClearColor(0x001a33);
  renderer.setPixelRatio(devicePixelRatio);
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
  container.style.position = 'relative';
  container.style.overflow = 'hidden';
  container.appendChild(renderer.domElement);

  const EARTH_RADIUS = 6_378_160;
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    cesiumToken ? 0.1  : 0.01,
    cesiumToken ? 1.6e8 : 100,
  );
  camera.layers.enableAll();

  // ---- lighting ----
  const ambient = new THREE.AmbientLight(0xffffff, 1.2);
  ambient.layers.enableAll();
  scene.add(ambient);
  [[ 1000, 2000,  1000], [-1000, 1500, -1000]].forEach(([x, y, z], i) => {
    const d = new THREE.DirectionalLight(0xffffff, i === 0 ? 1.5 : 0.8);
    d.position.set(x, y, z);
    d.layers.enableAll();
    scene.add(d, d.target);
  });

  // ---- globe / tiles ----
  let tiles    = null;
  let controls = null;
  // `globe` is the rotatable visual root. In fallback mode it holds the earth,
  // atmosphere, and all overlays so they rotate together. In cesium mode the
  // geo-referenced tiles.group is the overlay parent instead.
  const globe = new THREE.Group();
  scene.add(globe);
  const overlayGroup = new THREE.Group(); // points & arcs
  let overlayRoot = globe;                 // where overlays/points attach

  if (cesiumToken) {
    // -- Cesium Ion 3D tiles (real satellite imagery) --
    const [
      { TilesRenderer },
      { CesiumIonAuthPlugin, TileCompressionPlugin, UpdateOnChangePlugin,
        UnloadTilesPlugin, TilesFadePlugin, GLTFExtensionsPlugin, ReorientationPlugin },
      { DRACOLoader },
    ] = await Promise.all([
      import('3d-tiles-renderer'),
      import('3d-tiles-renderer/plugins'),
      import('three/addons/loaders/DRACOLoader.js'),
    ]);

    const { GlobeControls } = await import('3d-tiles-renderer');

    tiles = new TilesRenderer();
    tiles.registerPlugin(new CesiumIonAuthPlugin({ apiToken: cesiumToken, assetId: '2275207', autoRefreshToken: true }));
    tiles.registerPlugin(new TileCompressionPlugin());
    tiles.registerPlugin(new UpdateOnChangePlugin());
    tiles.registerPlugin(new UnloadTilesPlugin());
    tiles.registerPlugin(new TilesFadePlugin());
    tiles.registerPlugin(new GLTFExtensionsPlugin({
      dracoLoader: new DRACOLoader().setDecoderPath(
        'https://unpkg.com/three@0.165.0/examples/jsm/libs/draco/gltf/'
      ),
    }));

    if (mode === 'globe') {
      tiles.group.rotation.x = -Math.PI / 2;
      camera.position.set(EARTH_RADIUS * 2, 0, 0);
      controls = new GlobeControls(scene, camera, renderer.domElement);
      controls.enableDamping = true;
      controls.minDistance   = 10_000;
      controls.maxDistance   = 1.6e8;
      if ('setEllipsoid' in controls) controls.setEllipsoid(tiles.ellipsoid, tiles.group);
    } else {
      tiles.registerPlugin(new ReorientationPlugin({
        lat: lat * Math.PI / 180,
        lon: lon * Math.PI / 180,
      }));
      camera.position.set(1, 1, 1).multiplyScalar(5000);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.minDistance   = 500;
      controls.maxDistance   = 2_000_000;
    }

    scene.add(tiles.group);
    overlayRoot = tiles.group;        // overlays are geo-referenced in cesium mode
    tiles.group.add(overlayGroup);
    tiles.setResolutionFromRenderer(camera, renderer);
    tiles.setCamera(camera);

  } else {
    // -- Fallback: plain textured sphere --
    const geo = new THREE.SphereGeometry(1, 64, 64);
    const tex = new THREE.TextureLoader().load(fallbackTexture);
    const mat = new THREE.MeshPhongMaterial({ map: tex, specular: 0x111122, shininess: 8 });
    const earth = new THREE.Mesh(geo, mat);
    globe.add(earth);                 // earth rotates with the globe group
    globe.add(overlayGroup);          // points/arcs rotate with earth

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping  = true;
    controls.dampingFactor  = 0.08;
    controls.minDistance    = 1.2;
    controls.maxDistance    = 8;
    controls.enablePan      = false;
    camera.position.set(0, 0, 2.8);

    // Atmosphere glow
    const atm = new THREE.Mesh(
      new THREE.SphereGeometry(1.015, 32, 32),
      new THREE.MeshPhongMaterial({ color: 0x3399ff, transparent: true, opacity: 0.08, depthWrite: false }),
    );
    globe.add(atm);

    // Stars
    if (options.stars !== false) {
      const starPos = new Float32Array(3000);
      for (let i = 0; i < 3000; i += 3) {
        const phi = Math.acos(2 * Math.random() - 1), theta = 2 * Math.PI * Math.random();
        const r   = 50 + Math.random() * 50;
        starPos[i]   = r * Math.sin(phi) * Math.cos(theta);
        starPos[i+1] = r * Math.cos(phi);
        starPos[i+2] = r * Math.sin(phi) * Math.sin(theta);
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
      scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 })));
    }
  }

  // ---- resize ----
  const onResize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  onResize();
  const ro = new ResizeObserver(onResize);
  ro.observe(container);

  // ---- auto-rotation (fallback mode only) ----
  const autoRotate      = !cesiumToken && (options.autoRotate ?? false);
  const autoRotateSpeed = options.autoRotateSpeed ?? 0.0002;
  let _userInteracting  = false;
  let _idleTimer        = null;

  if (autoRotate && controls) {
    controls.addEventListener('start', () => {
      _userInteracting = true;
      clearTimeout(_idleTimer);
    });
    controls.addEventListener('end', () => {
      _idleTimer = setTimeout(() => { _userInteracting = false; }, 8000);
    });
  }

  // ---- animation loop ----
  let alive = true;
  const loop = () => {
    if (!alive) return;
    requestAnimationFrame(loop);
    controls?.update();
    if (globe && autoRotate && !_userInteracting) globe.rotation.y += autoRotateSpeed;
    if (tiles) {
      tiles.setResolutionFromRenderer(camera, renderer);
      tiles.setCamera(camera);
      camera.updateMatrixWorld();
      tiles.update();
    }
    renderer.render(scene, camera);
  };
  loop();

  // ---- helpers ----
  const DEG = Math.PI / 180;

  function latlonToVec3(lat, lon, r = 1) {
    const phi   = (90 - lat) * DEG;
    const theta = (lon + 180) * DEG;
    if (cesiumToken) {
      // In 3d-tiles space, Y is up and the globe is rotated -90° on X
      const R = EARTH_RADIUS * r;
      return new THREE.Vector3(
        -R * Math.sin(phi) * Math.cos(theta),
         R * Math.cos(phi),
         R * Math.sin(phi) * Math.sin(theta),
      );
    }
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
       r * Math.cos(phi),
       r * Math.sin(phi) * Math.sin(theta),
    );
  }

  // ---- image overlays (e.g. IPCC temperature raster) ----
  const overlays = new Map();

  function setOverlay(id, buffer, { opacity = 0.85 } = {}) {
    const blob = new Blob([buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)],
                          { type: 'image/png' });
    const url  = URL.createObjectURL(blob);
    new THREE.TextureLoader().load(url, (texture) => {
      URL.revokeObjectURL(url);
      const existing = overlays.get(id);
      if (existing) {
        existing.material.map = texture;
        existing.material.needsUpdate = true;
      } else {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(cesiumToken ? EARTH_RADIUS * 1.001 : 1.003, 64, 64),
          new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity, depthWrite: false }),
        );
        overlayRoot.add(mesh);
        overlays.set(id, mesh);
      }
    });
  }

  function removeOverlay(id) {
    const m = overlays.get(id);
    if (m) { overlayRoot.remove(m); m.geometry.dispose(); m.material.dispose(); overlays.delete(id); }
  }

  // ---- point clouds ----
  const pointGroups = new Map();

  function addPoints(id, points) {
    removePoints(id);
    if (!points?.length) return;

    const positions = [], colors = [], sizes = [];
    for (const p of points) {
      const v = latlonToVec3(p.lat, p.lon, 1.013);
      positions.push(v.x, v.y, v.z);
      const c = new THREE.Color(p.color ?? 0x0fd4bc);
      colors.push(c.r, c.g, c.b);
      sizes.push(p.size ?? (cesiumToken ? 40_000 : 0.012));
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors,    3));
    geo.setAttribute('size',     new THREE.Float32BufferAttribute(sizes,     1));

    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexColors: true,
      vertexShader: `
        attribute float size; varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (${cesiumToken ? '6e8' : '600.0'} / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          gl_FragColor = vec4(vColor, (1.0 - smoothstep(0.3, 0.5, d)) * 0.85);
        }`,
    });

    const mesh = new THREE.Points(geo, mat);
    mesh.layers.enableAll();
    overlayGroup.add(mesh);
    pointGroups.set(id, mesh);
  }

  function removePoints(id) {
    const existing = pointGroups.get(id);
    if (existing) {
      overlayGroup.remove(existing);
      existing.geometry.dispose();
      existing.material.dispose();
      pointGroups.delete(id);
    }
  }

  // ---- focus animation ----
  let focusRaf = null;

  function focusOn(targetLat, targetLon, altitudeM = 10_000) {
    if (focusRaf) cancelAnimationFrame(focusRaf);
    const start = camera.position.clone();
    const startSph = new THREE.Spherical().setFromVector3(start);
    const t0 = Date.now(), dur = 2000;
    const R = cesiumToken ? EARTH_RADIUS + altitudeM : 1.5;

    const phi   = (90 - targetLat) * DEG;
    const theta = -(targetLon + 90) * DEG;

    const ease = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
    const peak  = cesiumToken ? EARTH_RADIUS * 2.5 : 3.5;

    const anim = () => {
      const p = Math.min((Date.now() - t0) / dur, 1);
      const e = ease(p);
      const r = p < 0.5
        ? startSph.radius + (peak - startSph.radius) * ease(p * 2)
        : peak + (R - peak) * ease((p - 0.5) * 2);
      const sph = new THREE.Spherical(
        r,
        startSph.phi   + (phi   - startSph.phi)   * e,
        startSph.theta + (theta - startSph.theta) * e,
      );
      camera.position.setFromSpherical(sph);
      camera.lookAt(0, 0, 0);
      if (controls?.target) controls.target.set(0, 0, 0);
      if (p < 1) focusRaf = requestAnimationFrame(anim);
    };
    anim();
  }

  // ---- dispose ----
  function dispose() {
    alive = false;
    ro.disconnect();
    if (focusRaf) cancelAnimationFrame(focusRaf);
    controls?.dispose();
    tiles?.dispose();
    renderer.dispose();
    container.removeChild(renderer.domElement);
  }

  return { addPoints, removePoints, setOverlay, removeOverlay, focusOn, dispose };
}
