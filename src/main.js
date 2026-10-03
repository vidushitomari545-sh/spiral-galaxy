import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GUI } from "lil-gui";

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

// --- Background Stars (created once, never rebuilt) ---

// A separate Points layer for distant background stars. We use a *separate*
// BufferGeometry so these stars don't share or interfere with the galaxy's
// geometry — they have their own positions and colors.

// A separate BufferGeometry is efficient because all 2,000 star positions
// are stored in a single typed array uploaded to the GPU once, just like
// the galaxy. No individual objects or draw calls per star.
const bgGeometry = new THREE.BufferGeometry();
const bgPositions = new Float32Array(2000 * 3);
const bgColors = new Float32Array(2000 * 3);
const bgColor = new THREE.Color();

for (let i = 0; i < 2000; i++) {
  // Spread stars across a large sphere (20–100 units away) so they
  // feel far behind the galaxy and don't compete visually.
  const dir = new THREE.Vector3(
    (Math.random() - 0.5) * 2,
    (Math.random() - 0.5) * 2,
    (Math.random() - 0.5) * 2
  ).normalize();
  const distance = 20 + Math.random() * 80;
  const position = dir.multiplyScalar(distance);
  bgPositions[i * 3] = position.x;
  bgPositions[i * 3 + 1] = position.y;
  bgPositions[i * 3 + 2] = position.z;

  // Mostly white with very subtle variation so no two stars are identical.
  const brightness = 0.6 + Math.random() * 0.4;
  bgColor.setRGB(brightness, brightness, brightness);
  bgColors[i * 3] = bgColor.r;
  bgColors[i * 3 + 1] = bgColor.g;
  bgColors[i * 3 + 2] = bgColor.b;
}

bgGeometry.setAttribute("position", new THREE.BufferAttribute(bgPositions, 3));
bgGeometry.setAttribute("color", new THREE.BufferAttribute(bgColors, 3));

const bgMaterial = new THREE.PointsMaterial({
  size: 0.005,
  vertexColors: true,
  transparent: true,
  opacity: 0.4,
  depthWrite: false,
});

const backgroundStars = new THREE.Points(bgGeometry, bgMaterial);
scene.add(backgroundStars);

// --- Config Object ---
// A config object holds all the tweakable parameters in one place.
// lil-gui reads this object and creates a control for each property,
// so changing a value in the GUI instantly updates the config value.
const config = {
  particleCount: 5000,
  spiralArms: 2,
  spin: 4,
  randomness: 0.3,
  centerColor: "#f9d98c", // warm yellow-white
  outerColor: "#6666f2",  // deep blue / violet
};

// Mid-color (pink/magenta) used for the color gradient transition.
// This is fixed — only center and outer colors are user-controlled.
const midColor = new THREE.Color("#e666b3");

// Module-level variables for the galaxy so the animation loop and
// GUI callbacks can reference the latest objects after a rebuild.
let geometry;
let material;
let glowMaterial;
let glowTexture;
let glowCloud;
let particleCloud;
const particleColor = new THREE.Color(); // reused color object

function createGalaxy() {
  // When rebuilding, dispose of the old geometry, materials, and texture
  // so we don't leak GPU memory. Three.js keeps the old data allocated
  // until you explicitly call dispose() on it.
  if (geometry) {
    scene.remove(glowCloud);
    scene.remove(particleCloud);
    geometry.dispose();
    material.dispose();
    glowMaterial.dispose();
    if (glowTexture) glowTexture.dispose();
  }

  // BufferGeometry stores all particle data in typed arrays that go straight
  // to the GPU — very efficient for rendering thousands of particles.
  geometry = new THREE.BufferGeometry();

  const positions = new Float32Array(config.particleCount * 3);
  const colors = new Float32Array(config.particleCount * 3);

  for (let i = 0; i < config.particleCount; i++) {
    // --- Concentrate particles near the center ---
    const radius = Math.pow(Math.random(), 2) * 5;

    // --- Pick which spiral arm this particle belongs to ---
    const arm = Math.floor(Math.random() * config.spiralArms);

    // --- Spiral shape in polar coordinates ---
    // angle increases with radius → spiral pattern.
    const baseAngle = arm * ((Math.PI * 2) / config.spiralArms);
    const spiralAngle = radius * config.spin;
    const angle = baseAngle + spiralAngle;

    // --- Random spread for natural-looking arms ---
    const spread = radius * config.randomness + Math.random() * 0.5;
    const angleSpread = (Math.random() - 0.5) * spread * 0.3;
    const radiusSpread = (Math.random() - 0.5) * spread;

    const finalRadius = radius + radiusSpread;
    const finalAngle = angle + angleSpread;

    const x = Math.cos(finalAngle) * finalRadius;
    const y = Math.sin(finalAngle) * finalRadius;
    const z = (Math.random() - 0.5) * 0.5;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // --- Color based on distance from center ---
    const centerCol = new THREE.Color(config.centerColor);
    const outerCol = new THREE.Color(config.outerColor);
    const t = THREE.MathUtils.clamp(radius / 5, 0, 1);
    const variedT = THREE.MathUtils.clamp(
      t + (Math.random() - 0.5) * 0.05,
      0,
      1
    );

    if (variedT < 0.5) {
      particleColor.lerpColors(centerCol, midColor, variedT / 0.5);
    } else {
      particleColor.lerpColors(midColor, outerCol, (variedT - 0.5) / 0.5);
    }

    colors[i * 3] = particleColor.r;
    colors[i * 3 + 1] = particleColor.g;
    colors[i * 3 + 2] = particleColor.b;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  // Main star particles — sharp and visible.
  material = new THREE.PointsMaterial({
    size: 0.02,
    vertexColors: true,
  });

  // --- Glow Layer ---
  // A second Points object behind the stars creates a soft glow halo.
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
  glowTexture = new THREE.CanvasTexture(canvas);

  glowMaterial = new THREE.PointsMaterial({
    size: 0.04,
    map: glowTexture,
    transparent: true,
    opacity: 0.15,
    vertexColors: true,
    depthWrite: false,
  });

  // Both layers share the same geometry.
  glowCloud = new THREE.Points(geometry, glowMaterial);
  scene.add(glowCloud);

  particleCloud = new THREE.Points(geometry, material);
  scene.add(particleCloud);
}

// Create the galaxy for the first time.
createGalaxy();

// --- OrbitControls ---
// OrbitControls lets the user drag the mouse to rotate the view around
// the galaxy center and use the mouse wheel to zoom in and out.
const controls = new OrbitControls(camera, renderer.domElement);

// Damping makes camera movement feel smooth — it lags slightly behind
// mouse input instead of stopping abruptly, like a gentle coast.
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// A Clock tracks how much time has elapsed since it started, so animations
// run at the same speed regardless of the computer's frame rate.
const clock = new THREE.Clock();

// --- Live Color Update (no geometry rebuild) ---
// When only a color changes, we just recompute the color attribute on
// the existing geometry — no need to regenerate positions or rebuild.
function updateColors() {
  if (!geometry) return;

  const colorAttr = geometry.attributes.color;
  const positionAttr = geometry.attributes.position;
  const posArray = positionAttr.array;
  const centerCol = new THREE.Color(config.centerColor);
  const outerCol = new THREE.Color(config.outerColor);

  for (let i = 0; i < config.particleCount; i++) {
    // Use each particle's actual distance from center for the color blend.
    const x = posArray[i * 3];
    const y = posArray[i * 3 + 1];
    const distance = Math.sqrt(x * x + y * y);
    const t = THREE.MathUtils.clamp(distance / 5, 0, 1);
    const variedT = THREE.MathUtils.clamp(
      t + (Math.random() - 0.5) * 0.05,
      0,
      1
    );

    if (variedT < 0.5) {
      particleColor.lerpColors(centerCol, midColor, variedT / 0.5);
    } else {
      particleColor.lerpColors(midColor, outerCol, (variedT - 0.5) / 0.5);
    }

    colorAttr.array[i * 3] = particleColor.r;
    colorAttr.array[i * 3 + 1] = particleColor.g;
    colorAttr.array[i * 3 + 2] = particleColor.b;
  }

  colorAttr.needsUpdate = true;
}

// --- lil-gui Control Panel ---
// lil-gui is a lightweight GUI library that creates sliders, color pickers,
// and buttons in the browser. It reads from a config object and calls
// callbacks when values change, so you can tweak parameters live.
const gui = new GUI({ width: 300 });

const galaxyFolder = gui.addFolder("Galaxy");
galaxyFolder
  .add(config, "particleCount", 500, 20000, 100)
  .name("Particle Count")
  .onFinishChange(createGalaxy); // rebuild geometry — changing count needs new buffers
galaxyFolder
  .add(config, "spiralArms", 1, 5, 1)
  .name("Spiral Arms")
  .onFinishChange(createGalaxy); // rebuild — arm count changes position layout
galaxyFolder.add(config, "spin", 0, 10, 0.1).name("Spin").onFinishChange(createGalaxy);
galaxyFolder
  .add(config, "randomness", 0, 1, 0.01)
  .name("Randomness")
  .onFinishChange(createGalaxy);
galaxyFolder.open();

const colorFolder = gui.addFolder("Colors");
colorFolder.addColor(config, "centerColor").name("Center").onChange(updateColors);
colorFolder.addColor(config, "outerColor").name("Outer").onChange(updateColors);
colorFolder.open();

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
