import * as THREE from "three";

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
camera.position.z = 5;

// The Renderer draws everything from the scene through the camera onto the screen.
// We set its size to fill the entire browser window.
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// --- Spiral Galaxy ---

const particleCount = 5000;

// BufferGeometry stores vertex data (like positions) in a very efficient
// memory format that the GPU can read directly. We store all 5,000
// particle positions in a single array.
const geometry = new THREE.BufferGeometry();

// We need 3 numbers per particle: x, y, and z coordinates.
const positions = new Float32Array(particleCount * 3);

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
}

// Attach the positions array to the geometry.
geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

// PointsMaterial defines how each particle looks.
// White, tiny particles look like distant stars.
const material = new THREE.PointsMaterial({
  size: 0.02,
  color: 0xffffff,
});

// THREE.Points renders the geometry as a cloud of dots (particles).
const particleCloud = new THREE.Points(geometry, material);
scene.add(particleCloud);

// The Animation Loop runs over and over (about 60 times per second) using
// requestAnimationFrame. This is what makes the scene update and display.
function animate() {
  requestAnimationFrame(animate);

  // Rotate the galaxy slowly so the spiral structure is visible.
  particleCloud.rotation.z += 0.001;

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
