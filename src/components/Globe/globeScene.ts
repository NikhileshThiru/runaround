import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  DoubleSide,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Matrix4,
  Scene,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Spherical,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { GLOBE_RADIUS, latLngToVector, sampleGreatCircleArc } from '@/lib/globeProjection'
import {
  interpolateGreatCircle,
  ROUTE,
  type GlobePosition,
  type JourneyProgress,
  type RouteMilestoneWithDistance,
} from '@/lib/globeRoute'

export interface GlobeBoundaryGeometry {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: number[][][] | number[][][][]
}

export interface GlobeBoundary {
  geometry: GlobeBoundaryGeometry
  layer: 'country' | 'state'
}

export interface MilestoneHover {
  milestone: RouteMilestoneWithDistance
  reached: boolean
  x: number
  y: number
}

export interface GlobeSceneOptions {
  container: HTMLElement
  reducedMotion: boolean
  onMilestoneHover?: (hover: MilestoneHover | null) => void
}

export interface GlobeScene {
  setBoundaries(boundaries: readonly GlobeBoundary[]): void
  setJourney(journey: JourneyProgress): void
  setSize(width: number, height: number): void
  dispose(): void
}

const ROUTE_COLOR = '#67d8f5'
const ROUTE_GLOW_COLOR = '#27c0e8'
const CURRENT_COLOR = '#ecfbff'

// Layer radii: each vector layer sits a fraction above the opaque sphere so
// depth testing hides the far side without z-fighting the surface.
const GRATICULE_SCALE = 1.0006
const BOUNDARY_SCALE = 1.001
const ROUTE_SCALE = 1.003
const MARKER_SCALE = 1.0045

const INTRO_DURATION_MS = 1900
const FLY_DURATION_MS = 950
const PULSE_PERIOD_MS = 2400
const AUTOROTATE_RESUME_MS = 4000

// Screen-space route width in pixels, interpolated by zoom: slightly bolder
// up close where the route is the subject, thinner zoomed out so the line
// never dominates the hemisphere.
const ROUTE_WIDTH_NEAR_PX = 2.4
const ROUTE_WIDTH_FAR_PX = 1.2

interface CameraFlight {
  fromTheta: number
  fromPhi: number
  fromRadius: number
  toTheta: number
  toPhi: number
  toRadius: number
  startedAt: number
  durationMs: number
}

function toVector3(position: GlobePosition, radiusScale = 1): Vector3 {
  const { x, y, z } = latLngToVector(position, GLOBE_RADIUS * radiusScale)
  return new Vector3(x, y, z)
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function shortestAngleDelta(from: number, to: number): number {
  return MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI
}

function disposeObject(object: Object3D): void {
  object.traverse((child) => {
    if (child instanceof Mesh || child instanceof Line || child instanceof Sprite) {
      const material = child.material as { dispose?: () => void } | Array<{ dispose?: () => void }>
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose?.())
      else material.dispose?.()
      if ('geometry' in child) (child.geometry as { dispose?: () => void }).dispose?.()
    }
  })
}

function geometryRings(geometry: GlobeBoundaryGeometry): number[][][] {
  return geometry.type === 'Polygon'
    ? geometry.coordinates as number[][][]
    : (geometry.coordinates as number[][][][]).flat()
}

/** Soft radial glow used by the current-position halo and the route comet. */
function createGlowTexture(): CanvasTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(255,255,255,1)')
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.45)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)
  }
  return new CanvasTexture(canvas)
}

const SPHERE_VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDirection;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDirection = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`

// Opaque near-black sphere with a restrained purple fresnel rim, so the limb
// reads as lit instrument glass instead of a flat disc.
const SPHERE_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDirection;
  void main() {
    float facing = max(dot(normalize(vNormal), normalize(vViewDirection)), 0.0);
    float fresnel = pow(1.0 - facing, 3.2);
    vec3 base = vec3(0.010, 0.022, 0.034);
    vec3 rim = vec3(0.153, 0.753, 0.910);
    gl_FragColor = vec4(base + rim * fresnel * 0.22, 1.0);
  }
`

const ATMOSPHERE_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDirection;
  void main() {
    float intensity = pow(0.55 - dot(normalize(vNormal), normalize(vViewDirection)), 5.0);
    vec3 glow = vec3(0.153, 0.753, 0.910);
    gl_FragColor = vec4(glow, 1.0) * clamp(intensity, 0.0, 1.0) * 0.42;
  }
`

export function createGlobeScene(options: GlobeSceneOptions): GlobeScene {
  const { container, reducedMotion, onMilestoneHover } = options

  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1))
  renderer.domElement.style.display = 'block'
  container.appendChild(renderer.domElement)

  const scene = new Scene()
  const camera = new PerspectiveCamera(
    40,
    Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1),
    1,
    2000,
  )
  camera.position.setFromSpherical(new Spherical(GLOBE_RADIUS * 4.2, Math.PI / 2 - 0.5, -1.2))
  camera.lookAt(0, 0, 0)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enablePan = false
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.rotateSpeed = 0.45
  controls.zoomSpeed = 0.6
  controls.minDistance = GLOBE_RADIUS * 1.45
  controls.maxDistance = GLOBE_RADIUS * 4.6
  controls.autoRotate = !reducedMotion
  controls.autoRotateSpeed = 0.28

  // --- Static scenery -------------------------------------------------------

  const sphereGeometry = new SphereGeometry(GLOBE_RADIUS, 96, 96)
  const sphereMaterial = new ShaderMaterial({
    vertexShader: SPHERE_VERTEX_SHADER,
    fragmentShader: SPHERE_FRAGMENT_SHADER,
  })
  const globeMesh = new Mesh(sphereGeometry, sphereMaterial)
  scene.add(globeMesh)

  const atmosphereGeometry = new SphereGeometry(GLOBE_RADIUS, 64, 64)
  const atmosphereMaterial = new ShaderMaterial({
    vertexShader: SPHERE_VERTEX_SHADER,
    fragmentShader: ATMOSPHERE_FRAGMENT_SHADER,
    side: BackSide,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const atmosphereMesh = new Mesh(atmosphereGeometry, atmosphereMaterial)
  atmosphereMesh.scale.setScalar(1.08)
  scene.add(atmosphereMesh)

  const graticuleGeometry = buildGraticuleGeometry()
  const graticuleMaterial = new LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.055 })
  scene.add(new LineSegments(graticuleGeometry, graticuleMaterial))

  // The full planned route stays faintly visible so visitors can read the
  // journey's shape; the traveled portion is drawn brightly on top of it.
  const plannedRoutePoints = ROUTE.slice(1).flatMap((to, index) =>
    sampleGreatCircleArc(ROUTE[index]!, to).map((point) => toVector3(point, ROUTE_SCALE)))
  const plannedRouteGeometry = new BufferGeometry().setFromPoints(plannedRoutePoints)
  const plannedRouteMaterial = new LineBasicMaterial({ color: '#94a6b2', transparent: true, opacity: 0.16 })
  scene.add(new Line(plannedRouteGeometry, plannedRouteMaterial))

  // The traveled route uses a screen-space line material: pixel-based width
  // keeps the line crisp at every zoom level, unlike a world-space tube whose
  // cross-section reads as a translucent ribbon up close. A single opaque
  // line is deliberate — an additive glow pass saturates to white wherever
  // the zig-zag route overlaps itself at low zoom.
  const traveledCoreMaterial = new LineMaterial({
    color: ROUTE_COLOR,
    linewidth: ROUTE_WIDTH_NEAR_PX,
    resolution: new Vector2(
      Math.max(container.clientWidth, 1),
      Math.max(container.clientHeight, 1),
    ),
  })

  const boundariesGroup = new Group()
  scene.add(boundariesGroup)

  // --- Milestone markers ----------------------------------------------------

  const reachedMarkerGeometry = new CircleGeometry(0.5, 24)
  const upcomingMarkerGeometry = new CircleGeometry(0.34, 20)
  const reachedMarkerMaterial = new MeshBasicMaterial({ color: ROUTE_COLOR, side: DoubleSide })
  const upcomingMarkerMaterial = new MeshBasicMaterial({
    color: '#76838e',
    side: DoubleSide,
    transparent: true,
    opacity: 0.85,
  })

  const markerEntries = ROUTE.map((milestone) => {
    const position = toVector3(milestone, MARKER_SCALE)
    const mesh = new Mesh(upcomingMarkerGeometry, upcomingMarkerMaterial)
    mesh.position.copy(position)
    mesh.lookAt(position.clone().multiplyScalar(2))
    scene.add(mesh)
    return { milestone, position, mesh, reached: false }
  })

  // --- Journey-dependent objects (rebuilt by setJourney) ----------------------

  const journeyGroup = new Group()
  scene.add(journeyGroup)

  // The current position is a flat directional arrow lying tangent on the
  // surface, aimed along the great circle toward the next milestone — it
  // answers "where are they and which way are they headed" in one glyph.
  // A larger additive copy underneath provides the glow, and the whole arrow
  // nudges forward along its heading.
  const glowTexture = createGlowTexture()
  const currentGroup = new Group()
  const arrowShape = new Shape()
  arrowShape.moveTo(0, 0.8)
  arrowShape.lineTo(0.52, -0.5)
  arrowShape.lineTo(0, -0.22)
  arrowShape.lineTo(-0.52, -0.5)
  arrowShape.closePath()
  const arrowGeometry = new ShapeGeometry(arrowShape)
  const arrow = new Mesh(
    arrowGeometry,
    new MeshBasicMaterial({ color: CURRENT_COLOR, side: DoubleSide }),
  )
  const arrowGlowMaterial = new MeshBasicMaterial({
    color: ROUTE_GLOW_COLOR,
    side: DoubleSide,
    transparent: true,
    opacity: 0.3,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const arrowGlow = new Mesh(arrowGeometry, arrowGlowMaterial)
  arrowGlow.scale.setScalar(1.5)
  arrowGlow.position.z = -0.05
  arrow.add(arrowGlow)
  const currentHalo = new Sprite(new SpriteMaterial({
    map: glowTexture,
    color: ROUTE_GLOW_COLOR,
    transparent: true,
    opacity: 0.45,
    blending: AdditiveBlending,
    depthWrite: false,
  }))
  currentHalo.scale.setScalar(3)
  currentGroup.add(arrow, currentHalo)
  currentGroup.visible = false
  scene.add(currentGroup)
  const arrowHeading = new Vector3(0, 1, 0)

  let hasJourney = false

  // --- Camera flights ---------------------------------------------------------

  let flight: CameraFlight | null = null

  function startFlight(target: GlobePosition, durationMs: number, radius?: number): void {
    const current = new Spherical().setFromVector3(camera.position)
    const destination = new Spherical().setFromVector3(toVector3(target))
    destination.phi = MathUtils.clamp(destination.phi, 0.35, Math.PI - 0.35)
    if (reducedMotion) {
      camera.position.setFromSpherical(
        new Spherical(radius ?? current.radius, destination.phi, destination.theta),
      )
      camera.lookAt(0, 0, 0)
      return
    }
    flight = {
      fromTheta: current.theta,
      fromPhi: current.phi,
      fromRadius: current.radius,
      toTheta: current.theta + shortestAngleDelta(current.theta, destination.theta),
      toPhi: destination.phi,
      toRadius: radius ?? current.radius,
      startedAt: performance.now(),
      durationMs,
    }
  }

  function updateFlight(now: number): boolean {
    if (!flight) return false
    const t = MathUtils.clamp((now - flight.startedAt) / flight.durationMs, 0, 1)
    const eased = easeInOutCubic(t)
    camera.position.setFromSpherical(new Spherical(
      MathUtils.lerp(flight.fromRadius, flight.toRadius, eased),
      MathUtils.lerp(flight.fromPhi, flight.toPhi, eased),
      MathUtils.lerp(flight.fromTheta, flight.toTheta, eased),
    ))
    camera.lookAt(0, 0, 0)
    if (t >= 1) flight = null
    return true
  }

  // --- Pointer interaction ----------------------------------------------------

  const raycaster = new Raycaster()
  const pointer = new Vector2()
  let hovered: typeof markerEntries[number] | null = null
  let autoRotateTimer: ReturnType<typeof setTimeout> | null = null

  function pauseAutoRotate(): void {
    controls.autoRotate = false
    if (autoRotateTimer) clearTimeout(autoRotateTimer)
    autoRotateTimer = setTimeout(() => {
      controls.autoRotate = !reducedMotion
    }, AUTOROTATE_RESUME_MS)
  }

  function milestoneAt(event: PointerEvent | MouseEvent): typeof markerEntries[number] | null {
    const bounds = renderer.domElement.getBoundingClientRect()
    if (bounds.width === 0 || bounds.height === 0) return null
    pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    )
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObject(globeMesh, false)[0]
    if (!hit) return null

    // Hit-test against the sphere, then snap to the nearest marker. This keeps
    // small tangent discs hoverable without phantom raycast helper meshes.
    const threshold = MathUtils.clamp(camera.position.length() * 0.014, 1.8, 5)
    let nearest: typeof markerEntries[number] | null = null
    let nearestDistance = threshold
    for (const entry of markerEntries) {
      const distance = entry.position.distanceTo(hit.point)
      if (distance < nearestDistance) {
        nearest = entry
        nearestDistance = distance
      }
    }
    return nearest
  }

  function handlePointerMove(event: PointerEvent): void {
    const entry = milestoneAt(event)
    if (entry !== hovered) {
      hovered = entry
      renderer.domElement.style.cursor = entry ? 'pointer' : 'grab'
      if (entry) pauseAutoRotate()
      const bounds = renderer.domElement.getBoundingClientRect()
      onMilestoneHover?.(entry
        ? {
            milestone: entry.milestone,
            reached: entry.reached,
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
          }
        : null)
    }
  }

  function handlePointerLeave(): void {
    if (!hovered) return
    hovered = null
    renderer.domElement.style.cursor = 'grab'
    onMilestoneHover?.(null)
  }

  function handleClick(event: MouseEvent): void {
    const entry = milestoneAt(event)
    if (entry) startFlight(entry.milestone, FLY_DURATION_MS)
  }

  function handleControlsStart(): void {
    flight = null
    pauseAutoRotate()
  }

  renderer.domElement.style.cursor = 'grab'
  renderer.domElement.style.touchAction = 'none'
  renderer.domElement.addEventListener('pointermove', handlePointerMove)
  renderer.domElement.addEventListener('pointerleave', handlePointerLeave)
  renderer.domElement.addEventListener('click', handleClick)
  controls.addEventListener('start', handleControlsStart)

  // --- Render loop -------------------------------------------------------------

  let frameHandle: number | null = null
  let disposed = false
  let visible = true
  // Anchored to the first animation-frame timestamp: a frame timestamp can
  // precede a performance.now() captured during setup, and a negative elapsed
  // time would index animation paths out of bounds.
  let startedAt: number | null = null

  function renderFrame(now: number): void {
    frameHandle = null
    if (disposed) return

    const flying = updateFlight(now)
    if (!flying) controls.update()

    const zoomT = MathUtils.clamp(
      (camera.position.length() - controls.minDistance) / (controls.maxDistance - controls.minDistance),
      0,
      1,
    )
    traveledCoreMaterial.linewidth = MathUtils.lerp(ROUTE_WIDTH_NEAR_PX, ROUTE_WIDTH_FAR_PX, zoomT)
    // Keep the current-position arrow roughly constant in apparent size:
    // shrink its world scale as the camera approaches so it never dominates
    // the map up close, and grows back to a readable size from afar.
    currentGroup.scale.setScalar(MathUtils.lerp(0.45, 1.15, zoomT))

    startedAt ??= now
    const elapsed = Math.max(0, now - startedAt)
    if (!reducedMotion && currentGroup.visible) {
      // Breathe the glow and nudge the arrow forward along its heading.
      const pulseT = (Math.sin((elapsed / PULSE_PERIOD_MS) * Math.PI * 2) + 1) / 2
      arrowGlowMaterial.opacity = 0.18 + pulseT * 0.28
      arrow.position.copy(arrowHeading).multiplyScalar(pulseT * 0.3)
    }

    renderer.render(scene, camera)
    scheduleFrame()
  }

  function scheduleFrame(): void {
    if (!disposed && visible && frameHandle === null) {
      frameHandle = requestAnimationFrame(renderFrame)
    }
  }

  const visibilityObserver = typeof IntersectionObserver === 'undefined'
    ? null
    : new IntersectionObserver((entries) => {
        visible = entries.some((entry) => entry.isIntersecting)
        if (visible) scheduleFrame()
      })
  visibilityObserver?.observe(container)
  scheduleFrame()

  // --- Public API ----------------------------------------------------------------

  function setBoundaries(boundaries: readonly GlobeBoundary[]): void {
    boundariesGroup.children.forEach(disposeObject)
    boundariesGroup.clear()

    const countryVertices: Vector3[] = []
    const stateVertices: Vector3[] = []
    for (const boundary of boundaries) {
      const target = boundary.layer === 'state' ? stateVertices : countryVertices
      for (const ring of geometryRings(boundary.geometry)) {
        for (let index = 1; index < ring.length; index += 1) {
          const previous = ring[index - 1]
          const current = ring[index]
          // Skip segments that wrap the antimeridian; drawing them would slice
          // a chord straight through the sphere.
          if (!previous || !current || Math.abs(current[0]! - previous[0]!) > 180) continue
          target.push(
            toVector3({ lat: previous[1]!, lng: previous[0]! }, BOUNDARY_SCALE),
            toVector3({ lat: current[1]!, lng: current[0]! }, BOUNDARY_SCALE),
          )
        }
      }
    }

    boundariesGroup.add(new LineSegments(
      new BufferGeometry().setFromPoints(countryVertices),
      new LineBasicMaterial({ color: '#b4c3cd', transparent: true, opacity: 0.5 }),
    ))
    boundariesGroup.add(new LineSegments(
      new BufferGeometry().setFromPoints(stateVertices),
      new LineBasicMaterial({ color: '#7e8b96', transparent: true, opacity: 0.32 }),
    ))
  }

  function setJourney(journey: JourneyProgress): void {
    // Dispose geometries only: the screen-space line materials are shared
    // across rebuilds (and disposed once with the scene).
    journeyGroup.children.forEach((child) => {
      if ('geometry' in child) (child.geometry as { dispose?: () => void }).dispose?.()
    })
    journeyGroup.clear()

    const traveledPoints: Vector3[] = []
    ROUTE.slice(1).forEach((to, index) => {
      const from = ROUTE[index]!
      const segmentProgress = MathUtils.clamp(
        to.segmentMiles === 0 ? 1 : (journey.appliedRouteMiles - from.cumulativeMiles) / to.segmentMiles,
        0,
        1,
      )
      if (segmentProgress <= 0) return
      // Dense sampling keeps every interpolated vertex on the sphere, so the
      // polyline hugs the surface instead of cutting visible chords.
      const samples = sampleGreatCircleArc(from, to, 0, segmentProgress, 64)
        .map((point) => toVector3(point, ROUTE_SCALE))
      traveledPoints.push(...(traveledPoints.length ? samples.slice(1) : samples))
    })

    if (traveledPoints.length > 1) {
      const geometry = new LineGeometry()
      geometry.setPositions(traveledPoints.flatMap((point) => [point.x, point.y, point.z]))
      journeyGroup.add(new Line2(geometry, traveledCoreMaterial))
    }

    for (const entry of markerEntries) {
      entry.reached = entry.milestone.cumulativeMiles <= journey.appliedRouteMiles
      entry.mesh.geometry = entry.reached ? reachedMarkerGeometry : upcomingMarkerGeometry
      entry.mesh.material = entry.reached ? reachedMarkerMaterial : upcomingMarkerMaterial
    }

    const currentPosition = journey.currentPosition
    currentGroup.position.copy(toVector3(currentPosition, MARKER_SCALE))
    const normal = currentGroup.position.clone().normalize()

    // Heading: sample a point slightly ahead on the great circle toward the
    // next milestone (or back along the final segment once complete) and
    // project the difference onto the tangent plane.
    const aheadDelta = journey.nextMilestone
      ? toVector3(interpolateGreatCircle(currentPosition, journey.nextMilestone, 0.02), MARKER_SCALE)
          .sub(currentGroup.position)
      : currentGroup.position.clone()
          .sub(toVector3(interpolateGreatCircle(ROUTE.at(-2)!, currentPosition, 0.98), MARKER_SCALE))
    aheadDelta.addScaledVector(normal, -aheadDelta.dot(normal))
    if (aheadDelta.lengthSq() > 1e-10) arrowHeading.copy(aheadDelta.normalize())
    else arrowHeading.set(0, 1, 0)

    // Basis: geometry +Y → heading, +Z → surface normal.
    arrow.quaternion.setFromRotationMatrix(
      new Matrix4().makeBasis(arrowHeading.clone().cross(normal), arrowHeading, normal),
    )
    currentGroup.visible = true

    // While the camera is still parked at the distant intro framing, fly all
    // the way in; later journey updates keep whatever zoom the user chose.
    const settleRadius = camera.position.length() > GLOBE_RADIUS * 3
      ? GLOBE_RADIUS * 2.6
      : undefined
    startFlight(currentPosition, hasJourney ? FLY_DURATION_MS : INTRO_DURATION_MS, settleRadius)
    hasJourney = true
  }

  function setSize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    traveledCoreMaterial.resolution.set(width, height)
  }

  function dispose(): void {
    disposed = true
    if (frameHandle !== null) cancelAnimationFrame(frameHandle)
    if (autoRotateTimer) clearTimeout(autoRotateTimer)
    visibilityObserver?.disconnect()
    renderer.domElement.removeEventListener('pointermove', handlePointerMove)
    renderer.domElement.removeEventListener('pointerleave', handlePointerLeave)
    renderer.domElement.removeEventListener('click', handleClick)
    controls.removeEventListener('start', handleControlsStart)
    controls.dispose()
    scene.traverse((object) => {
      if (object instanceof Mesh || object instanceof Line || object instanceof Sprite) {
        disposeObject(object)
      }
    })
    traveledCoreMaterial.dispose()
    glowTexture.dispose()
    renderer.dispose()
    renderer.domElement.remove()
  }

  return { setBoundaries, setJourney, setSize, dispose }
}

/** Latitude/longitude grid every 15°, omitting clutter near the poles. */
function buildGraticuleGeometry(): BufferGeometry {
  const vertices: Vector3[] = []
  const step = 3

  for (let lat = -75; lat <= 75; lat += 15) {
    for (let lng = -180; lng < 180; lng += step) {
      vertices.push(
        toVector3({ lat, lng }, GRATICULE_SCALE),
        toVector3({ lat, lng: lng + step }, GRATICULE_SCALE),
      )
    }
  }
  for (let lng = -180; lng < 180; lng += 15) {
    for (let lat = -80; lat < 80; lat += step) {
      vertices.push(
        toVector3({ lat, lng }, GRATICULE_SCALE),
        toVector3({ lat: lat + step, lng }, GRATICULE_SCALE),
      )
    }
  }
  return new BufferGeometry().setFromPoints(vertices)
}
