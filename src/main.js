import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// A Scene is the container that holds everything you want to display.
// Think of it as the "stage" where your 3D objects, lights, and camera live.
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// The Camera defines what portion of the scene is visible and from which angle.
// PerspectiveCamera gives a realistic 3D view (things farther away look smaller).
const camera = new THREE.PerspectiveCamera(
  75, // field of view (degrees)
  window.innerWidth / window.innerHeight, // aspect ratio
  0.1, // near clipping plane
  1000 // far clipping plane
);
// Start the camera slightly above the galaxy so we can see the spiral
// arms spread out below. Roughly a 30-degree angle from the horizontal.
camera.position.set(0, 3, 5);
camera.lookAt(0, 0, 0);

// The Renderer draws everything from the scene through the camera onto the screen.
// We set its size to fill the entire browser window.
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
// Limit pixel ratio to 2 to avoid excessive rendering on high-DPI screens,
// which can hurt performance without much visual gain.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// --- Spiral Galaxy ---

const particleCount = 5000;

// BufferGeometry stores vertex data (like positions and colors) in a very
// efficient memory format that the GPU can read directly.
const geometry = new THREE.BufferGeometry();

// We need 3 numbers per particle for position (x, y, z) and 3 for color (r, g, b).
const positions = new Float32Array(particleCount * 3);
const colors = new Float32Array(particleCount * 3);

// Predefined anchor colors for the distance-based gradient:
//   center → magenta/pink → outer
const centerColor = new THREE.Color(0.98, 0.85, 0.55);  // warm yellow-white
const midColor = new THREE.Color(0.9, 0.4, 0.7);        // pink / magenta
const outerColor = new THREE.Color(0.4, 0.4, 0.95);     // deep blue / violet
const particleColor = new THREE.Color();                // reused per particle

const arms = 2;

for (let i = 0; i < particleCount; i++) {
  // --- Concentrate particles near the center ---
  // Using Math.pow with a random value < 1 skews the distribution so more
  // particles land close to the center, making the galactic core denser.
  const radius = Math.pow(Math.random(), 2) * 5;

  // --- Pick which arm this particle belongs to (0 or 1) ---
  const arm = Math.floor(Math.random() * arms);

  // --- Polar coordinates ---
  // In polar coordinates, a point is described by:
  //   radius  = distance from the center
  //   angle   = direction around the center (in radians)
  // Normally angle is random, but if angle increases as radius increases,
  // we get a spiral shape — that's how spiral arms form.
  const baseAngle = arm * ((Math.PI * 2) / arms);
  const spiralAngle = radius * 4; // controls how tightly wound the arms are
  const angle = baseAngle + spiralAngle;

  // --- Add random spread so arms look natural ---
  // If every particle followed the exact mathematical spiral, the arms
  // would be infinitely thin lines. A little random spread makes them
  // look like real, fuzzy galaxy arms.
  const spread = radius * 0.3 + Math.random() * 0.5;
  const angleSpread = (Math.random() - 0.5) * spread * 0.3;
  const radiusSpread = (Math.random() - 0.5) * spread;

  // Final radius and angle after adding natural noise.
  const finalRadius = radius + radiusSpread;
  const finalAngle = angle + angleSpread;

  // --- Convert polar to Cartesian (x, y) coordinates ---
  // x = radius * cos(angle), y = radius * sin(angle)
  const x = Math.cos(finalAngle) * finalRadius;
  const y = Math.sin(finalAngle) * finalRadius;

  // --- Add a small random Z value for slight depth ---
  // This gives the galaxy a thin 3D disk shape instead of a flat 2D plane,
  // making it look more realistic when it rotates.
  const z = (Math.random() - 0.5) * 0.5;

  // Store the three coordinates in the positions array.
  positions[i * 3] = x;
  positions[i * 3 + 1] = y;
  positions[i * 3 + 2] = z;

  // --- Color ---
  // A color attribute assigns one RGB color per particle. Each particle
  // stores its own color in the colors array so the shader knows exactly
  // what color to draw for that specific particle.
  //
  // Distance from center controls the color:
  //   - Very close to center: bright warm white/yellow with slight orange
  //   - Middle region: warm pink/magenta → purple
  //   - Outer region: purple → deep blue/violet
  // We normalize the radius (0–5) to a 0–1 range and interpolate between
  // three anchor colors using THREE.Color.lerpColors().
  const t = THREE.MathUtils.clamp(radius / 5, 0, 1);

  // Add subtle random variation so particles don't all look identical.
  const variedT = THREE.MathUtils.clamp(
    t + (Math.random() - 0.5) * 0.05,
    0,
    1
  );

  // Interpolate between the two relevant halves of the gradient.
  if (variedT < 0.5) {
    particleColor.lerpColors(centerColor, midColor, variedT / 0.5);
  } else {
    particleColor.lerpColors(midColor, outerColor, (variedT - 0.5) / 0.5);
  }

  colors[i * 3] = particleColor.r;
  colors[i * 3 + 1] = particleColor.g;
  colors[i * 3 + 2] = particleColor.b;
}

// Attach the positions array to the geometry.
geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

// Attach the colors array as a "color" attribute. The name "color" is
// special in Three.js — it automatically maps to the material's vertex
// colors when enabled.
geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

// PointsMaterial defines how each particle looks.
// White, tiny particles look like distant stars.
const material = new THREE.PointsMaterial({
  size: 0.02,
  vertexColors: true, // tells Three.js to use the per-particle colors
});

// --- Glow Layer ---
// A second Points object placed behind the main stars creates a soft glow
// around each particle. We reuse the same geometry (same positions and
// colors) but with a smaller, more transparent material with a circular
// texture so the glow looks like a soft halo instead of square blocks.

// Create a soft circular texture using a hidden canvas. The radial
// gradient makes each point fade from bright in the center to
// transparent at the edges, giving a natural star-glow look.
const canvas = document.createElement("canvas");
canvas.width = 32;
canvas.height = 32;
const ctx = canvas.getContext("2d");
const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
gradient.addColorStop(0, "rgba(255, 255, 255, 0.8)");
gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.2)");
gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 32, 32);
const glowTexture = new THREE.CanvasTexture(canvas);

const glowMaterial = new THREE.PointsMaterial({
  size: 0.04, // only slightly larger than main stars (0.02) for a subtle halo
  map: glowTexture, // circular soft texture instead of default square
  transparent: true, // enables opacity-based transparency
  opacity: 0.15, // very low opacity keeps the glow subtle and soft
  vertexColors: true, // reuse the per-particle colors from the geometry
  depthWrite: false, // prevents the glow from blocking the main stars in front
});

// Both layers share the exact same geometry — same positions, same colors.
// Adding the glow first means it renders behind the main stars.
const glowCloud = new THREE.Points(geometry, glowMaterial);
scene.add(glowCloud);

// THREE.Points renders the geometry as a cloud of dots (particles).
const particleCloud = new THREE.Points(geometry, material);
scene.add(particleCloud);

// OrbitControls lets the user drag the mouse to rotate the view around the
// galaxy center and use the mouse wheel to zoom in and out.
const controls = new OrbitControls(camera, renderer.domElement);

// Damping makes camera movement feel smooth — it lags slightly behind
// mouse input instead of stopping abruptly, like a gentle coast.
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// A Clock tracks how much time has elapsed since it started, so animations
// run at the same speed regardless of the computer's frame rate.
const clock = new THREE.Clock();

// The Animation Loop runs over and over (about 60 times per second) using
// requestAnimationFrame. This is what makes the scene update and display.
function animate() {
  requestAnimationFrame(animate);

  // One full rotation every ~60 seconds (2π / 60 radians per second).
  // Using clock.getElapsedTime() keeps the speed consistent across computers.
  const elapsed = clock.getElapsedTime();
  const rotationSpeed = (Math.PI * 2) / 60;
  particleCloud.rotation.z = elapsed * rotationSpeed;
  glowCloud.rotation.z = elapsed * rotationSpeed;

  // Apply damping to the camera controls every frame.
  controls.update();

  renderer.render(scene, camera);
}

animate();

// If the browser window changes size, we need to update the camera's aspect
// ratio and the renderer's size so the scene doesn't get stretched or distorted.
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
