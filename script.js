
import * as THREE from "three";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = window.matchMedia("(max-width: 650px)").matches;

const state = {
  shape: "torus",
  rotating: true,
  dragging: false,
  pointerX: 0,
  pointerY: 0,
  scroll: 0,
  targetScroll: 0,
  lastPointerX: 0,
  lastPointerY: 0,
  rotationX: 0,
  rotationY: 0
};

const toast = $("#toast");
let toastTimer;

function notify(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

// Navigation
const menuButton = $("#menuButton");
const menuPanel = $("#menuPanel");

menuButton.addEventListener("click", () => {
  const open = menuPanel.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(open));
  menuPanel.setAttribute("aria-hidden", String(!open));
  $("#menuLabel").textContent = open ? "CLOSE" : "INDEX";
  $(".menu-icon").textContent = open ? "×" : "↗";
});

$$(".menu-panel a").forEach(link => {
  link.addEventListener("click", () => {
    menuPanel.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
    menuPanel.setAttribute("aria-hidden", "true");
    $("#menuLabel").textContent = "INDEX";
    $(".menu-icon").textContent = "↗";
  });
});

// Scroll progress and parallax
const scrollProgress = $("#scrollProgress");
const depthBackground = $("#depthBackground");
const heroCopy = $(".hero-copy");
const heroIndex = $(".hero-index");

let scrollTicking = false;

function updateScroll() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  state.targetScroll = maxScroll > 0 ? window.scrollY / maxScroll : 0;
  scrollProgress.style.width = `${state.targetScroll * 100}%`;

  const heroHeight = $(".hero").offsetHeight;
  const heroProgress = Math.min(1, Math.max(0, window.scrollY / heroHeight));

  if (!reducedMotion) {
    heroCopy.style.transform = `translate3d(0, ${window.scrollY * 0.12}px, 0)`;
    heroCopy.style.opacity = String(Math.max(0, 1 - heroProgress * 1.5));
    heroIndex.style.transform = `translate3d(0, ${window.scrollY * -0.15}px, 0)`;
    depthBackground.style.transform = `translate3d(0, ${window.scrollY * -0.035}px, 0)`;
  }

  scrollTicking = false;
}

window.addEventListener("scroll", () => {
  if (!scrollTicking) {
    requestAnimationFrame(updateScroll);
    scrollTicking = true;
  }
}, { passive: true });

updateScroll();

// Reveal elements
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

$$(".reveal:not(.hero .reveal)").forEach(element => revealObserver.observe(element));

// Animated numbers
const countObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;

    const element = entry.target;
    const target = Number(element.dataset.count);

    if (!Number.isFinite(target)) {
      countObserver.unobserve(element);
      return;
    }

    const duration = reducedMotion ? 0 : 1100;
    const start = performance.now();

    function count(now) {
      const progress = Math.min(1, (now - start) / Math.max(duration, 1));
      const eased = 1 - Math.pow(1 - progress, 4);
      element.textContent = Math.round(target * eased);

      if (progress < 1) requestAnimationFrame(count);
    }

    requestAnimationFrame(count);
    countObserver.unobserve(element);
  });
}, { threshold: 0.5 });

$$("[data-count]").forEach(el => {
  if (el.dataset.count !== "∞") countObserver.observe(el);
});

// Cursor ambience
const cursorGlow = $("#cursorGlow");
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let glowX = mouseX;
let glowY = mouseY;

window.addEventListener("pointermove", event => {
  mouseX = event.clientX;
  mouseY = event.clientY;
}, { passive: true });

// Three.js scene
let mainWorld = null;
let labWorld = null;
let animationFrame = 0;
let disposed = false;

function makeRenderer(container, alpha = true) {
  const renderer = new THREE.WebGLRenderer({
    alpha,
    antialias: !isMobile,
    powerPreference: "high-performance"
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.35 : 1.8));
  renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  return renderer;
}

function makeMaterial(color, roughness = 0.3, metalness = 0.6) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    flatShading: false
  });
}

function makeLights(scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 1.3));

  const key = new THREE.PointLight(0xd5ff48, 38, 30);
  key.position.set(4, 4, 5);
  scene.add(key);

  const blue = new THREE.PointLight(0x7876ff, 35, 30);
  blue.position.set(-5, 1, -3);
  scene.add(blue);

  const rim = new THREE.DirectionalLight(0xffffff, 2);
  rim.position.set(2, 6, -4);
  scene.add(rim);
}

function makeStars(scene, count = 850) {
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const radius = 4 + Math.random() * 13;
    const theta = Math.random() * Math.PI * 2;
    const y = (Math.random() - 0.5) * 13;

    positions[i * 3] = Math.cos(theta) * radius;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(theta) * radius - 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xc6cadf,
    size: 0.022,
    transparent: true,
    opacity: 0.75,
    sizeAttenuation: true
  });

  const stars = new THREE.Points(geometry, material);
  scene.add(stars);
  return stars;
}

function createShape(type) {
  switch (type) {
    case "icosahedron":
      return new THREE.IcosahedronGeometry(1.18, 1);

    case "knot":
      return new THREE.TorusKnotGeometry(0.78, 0.23, 180, 16, 2, 5);

    case "torus":
    default:
      return new THREE.TorusGeometry(0.91, 0.32, 28, 120);
  }
}

function createWireShape(type) {
  const geometry = createShape(type);
  const wire = new THREE.EdgesGeometry(geometry, 24);
  geometry.dispose();
  return wire;
}

function buildSculpture(scene, scale = 1) {
  const group = new THREE.Group();

  const coreMaterial = makeMaterial(0x7e83a0, 0.22, 0.85);
  const core = new THREE.Mesh(createShape("torus"), coreMaterial);
  core.scale.setScalar(scale);
  group.add(core);

  const wireMaterial = new THREE.LineBasicMaterial({
    color: 0xd5ff48,
    transparent: true,
    opacity: 0.7
  });

  const wire = new THREE.LineSegments(createWireShape("torus"), wireMaterial);
  wire.scale.setScalar(scale * 1.015);
  group.add(wire);

  const ringMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.8,
    roughness: 0.24,
    transparent: true,
    opacity: 0.68
  });

  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.7 * scale, 0.009, 8, 180), ringMaterial);
  ring1.rotation.set(0.8, 0.1, 0.4);
  group.add(ring1);

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2 * scale, 0.006, 8, 180), ringMaterial.clone());
  ring2.material.color.set(0x8581ff);
  ring2.rotation.set(1.1, 0.8, -0.7);
  group.add(ring2);

  const orbitNodes = new THREE.Group();
  const nodeGeometry = new THREE.SphereGeometry(0.055 * scale, 12, 12);

  for (let i = 0; i < 9; i++) {
    const nodeMaterial = new THREE.MeshStandardMaterial({
      color: i % 3 === 0 ? 0xd5ff48 : 0xd7d9e8,
      emissive: i % 3 === 0 ? 0x526a00 : 0x111122,
      roughness: 0.2,
      metalness: 0.5
    });

    const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
    const angle = i / 9 * Math.PI * 2;

    node.position.set(
      Math.cos(angle) * 1.72 * scale,
      Math.sin(angle * 1.6) * 0.55 * scale,
      Math.sin(angle) * 1.72 * scale
    );

    orbitNodes.add(node);
  }

  group.add(orbitNodes);

  return { group, core, wire, ring1, ring2, orbitNodes };
}

function setShape(world, type, instant = false) {
  if (!world || world.disposed) return;

  world.shape = type;

  const oldCore = world.core;
  const oldWire = world.wire;
  const newGeometry = createShape(type);
  const newWireGeometry = createWireShape(type);

  if (instant) {
    oldCore.geometry.dispose();
    oldWire.geometry.dispose();
    oldCore.geometry = newGeometry;
    oldWire.geometry = newWireGeometry;
    oldCore.scale.setScalar(world.baseScale);
    oldWire.scale.setScalar(world.baseScale * 1.015);
    return;
  }

  world.transition = {
    oldCore,
    oldWire,
    newGeometry,
    newWireGeometry,
    elapsed: 0,
    duration: 0.65
  };

  oldCore.material = oldCore.material.clone();
  oldWire.material = oldWire.material.clone();
}

function buildWorld(container, options = {}) {
  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(
    38,
    Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
    0.1,
    100
  );

  camera.position.set(0, 0, options.cameraZ || 7.5);

  const renderer = makeRenderer(container);
  makeLights(scene);

  const stars = makeStars(scene, options.starCount || 550);
  const sculpture = buildSculpture(scene, options.scale || 1);

  const world = {
    container,
    scene,
    camera,
    renderer,
    stars,
    ...sculpture,
    shape: "torus",
    baseScale: options.scale || 1,
    cameraZ: options.cameraZ || 7.5,
    pointerX: 0,
    pointerY: 0,
    targetX: 0,
    targetY: 0,
    dragX: 0,
    dragY: 0,
    dragging: false,
    rotating: true,
    transition: null,
    time: Math.random() * 10,
    disposed: false,
    resizeObserver: null
  };

  const onPointerMove = event => {
    const rect = container.getBoundingClientRect();

    world.pointerX = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
    world.pointerY = -(((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1);

    if (world.dragging) {
      const dx = event.clientX - world.dragLastX;
      const dy = event.clientY - world.dragLastY;

      world.dragY += dx * 0.008;
      world.dragX += dy * 0.008;

      world.dragLastX = event.clientX;
      world.dragLastY = event.clientY;
    }
  };

  const onPointerDown = event => {
    world.dragging = true;
    world.dragLastX = event.clientX;
    world.dragLastY = event.clientY;
    world.wasDragged = false;
    container.setPointerCapture?.(event.pointerId);
  };

  const onPointerUp = () => {
    world.dragging = false;
  };

  const onPointerCancel = () => {
    world.dragging = false;
  };

  container.style.touchAction = "pan-y";
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("pointerup", onPointerUp);
  container.addEventListener("pointercancel", onPointerCancel);

  world.cleanupPointer = () => {
    container.removeEventListener("pointermove", onPointerMove);
    container.removeEventListener("pointerdown", onPointerDown);
    container.removeEventListener("pointerup", onPointerUp);
    container.removeEventListener("pointercancel", onPointerCancel);
  };

  world.resizeObserver = new ResizeObserver(() => {
    if (world.disposed) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  });

  world.resizeObserver.observe(container);
  return world;
}

function animateWorld(world, dt, time, options = {}) {
  if (!world || world.disposed) return;

  world.time += dt;

  const rotationSpeed = reducedMotion ? 0.06 : 0.22;

  if (world.rotating) {
    world.group.rotation.y += dt * rotationSpeed;
    world.group.rotation.x += dt * rotationSpeed * 0.35;
    world.ring1.rotation.z += dt * 0.13;
    world.ring2.rotation.x -= dt * 0.1;
  }

  world.group.rotation.y += (world.dragY - world.group.rotation.y) * 0.035;
  world.group.rotation.x += (world.dragX - world.group.rotation.x) * 0.035;

  world.targetX = world.pointerY * 0.17;
  world.targetY = world.pointerX * 0.23;

  world.group.rotation.x += (world.targetX * 0.15) * 0.02;
  world.group.rotation.y += (world.targetY * 0.15) * 0.02;

  world.group.position.y = Math.sin(world.time * 0.7) * 0.075;
  world.stars.rotation.y += dt * 0.006;

  if (world.transition) {
    const t = world.transition;
    t.elapsed += dt;
    const progress = Math.min(1, t.elapsed / t.duration);
    const eased = 1 - Math.pow(1 - progress, 3);

    if (progress < 1) {
      world.core.scale.setScalar(world.baseScale * (1 - eased * 0.55));
      world.wire.scale.setScalar(world.baseScale * 1.015 * (1 - eased * 0.55));
      world.core.material.opacity = 1 - eased * 0.5;
      world.core.material.transparent = true;
      world.wire.material.opacity = 0.7 * (1 - eased * 0.5);
    } else {
      world.core.geometry.dispose();
      world.wire.geometry.dispose();

      world.core.geometry = t.newGeometry;
      world.wire.geometry = t.newWireGeometry;

      world.core.scale.setScalar(world.baseScale);
      world.wire.scale.setScalar(world.baseScale * 1.015);
      world.core.material.opacity = 1;
      world.core.material.transparent = false;
      world.wire.material.opacity = 0.7;

      world.transition = null;
    }
  }

  if (world !== mainWorld) {
    const scroll = window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    world.camera.position.z = world.cameraZ + Math.sin(time * 0.4) * 0.05;
  }

  world.renderer.render(world.scene, world.camera);
}

function disposeWorld(world) {
  if (!world || world.disposed) return;

  world.disposed = true;
  world.resizeObserver?.disconnect();
  world.cleanupPointer?.();

  world.scene.traverse(object => {
    if (object.geometry) object.geometry.dispose();

    if (object.material) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => material.dispose());
    }
  });

  world.renderer.dispose();
  world.renderer.domElement.remove();
}

// Status text
const renderStatus = $("#renderStatus");

try {
  mainWorld = buildWorld($("#sceneMount"), {
    cameraZ: 7.5,
    scale: 1,
    starCount: isMobile ? 260 : 750
  });

  labWorld = buildWorld($("#stageCanvas"), {
    cameraZ: 5.8,
    scale: 1.03,
    starCount: isMobile ? 140 : 350
  });

  renderStatus.textContent = "RENDER ACTIVE";
  $(".stage-loading")?.remove();
} catch (error) {
  console.error("3D initialization failed:", error);
  renderStatus.textContent = "3D UNAVAILABLE";
  $(".stage-loading") && ($(".stage-loading").textContent = "3D COULD NOT INITIALIZE");
  notify("3D rendering is unavailable in this browser.");
}

// Specimen controls
const shapeNames = {
  torus: "THE HELIX",
  icosahedron: "THE CRYSTAL",
  knot: "THE ORBIT"
};

$$(".specimen-card").forEach(button => {
  button.addEventListener("click", () => {
    const shape = button.dataset.shape;
    state.shape = shape;

    $$(".specimen-card").forEach(card => {
      const active = card === button;
      card.classList.toggle("active", active);
      card.setAttribute("aria-pressed", String(active));
    });

    $("#objectTitle").textContent = shapeNames[shape];
    setShape(mainWorld, shape);
    setShape(labWorld, shape);

    notify(`${shapeNames[shape]} — GEOMETRY UPDATED`);
  });
});

// Rotation toggle
$("#spinButton").addEventListener("click", () => {
  state.rotating = !state.rotating;

  if (mainWorld) mainWorld.rotating = state.rotating;
  if (labWorld) labWorld.rotating = state.rotating;

  $("#spinIcon").textContent = state.rotating ? "Ⅱ" : "▶";
  $("#spinLabel").textContent = state.rotating ? "PAUSE ROTATION" : "RESUME ROTATION";
  $("#spinButton").setAttribute("aria-pressed", String(!state.rotating));
});

// Animation loop
let lastTime = performance.now();

function animate(now) {
  if (disposed) return;

  animationFrame = requestAnimationFrame(animate);

  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (!reducedMotion) {
    glowX += (mouseX - glowX) * 0.08;
    glowY += (mouseY - glowY) * 0.08;

    cursorGlow.style.left = `${glowX}px`;
    cursorGlow.style.top = `${glowY}px`;
  }

  if (mainWorld) {
    const heroRect = $(".hero").getBoundingClientRect();
    const heroVisible = heroRect.bottom > -200 && heroRect.top < window.innerHeight + 200;

    if (heroVisible) {
      mainWorld.pointerX += (state.pointerX - mainWorld.pointerX) * 0.08;
      mainWorld.pointerY += (state.pointerY - mainWorld.pointerY) * 0.08;
      animateWorld(mainWorld, dt, now * 0.001);
    }
  }

  if (labWorld) {
    const stageRect = $("#stageCanvas").getBoundingClientRect();
    const stageVisible = stageRect.bottom > 0 && stageRect.top < window.innerHeight;

    if (stageVisible) animateWorld(labWorld, dt, now * 0.001);
  }
}

requestAnimationFrame(animate);

// Pause rendering when the tab is hidden
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    cancelAnimationFrame(animationFrame);
  } else {
    lastTime = performance.now();
    requestAnimationFrame(animate);
  }
});

// Keyboard accessibility
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && menuPanel.classList.contains("open")) {
    menuPanel.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
    menuPanel.setAttribute("aria-hidden", "true");
    $("#menuLabel").textContent = "INDEX";
    $(".menu-icon").textContent = "↗";
  }
});

// Tear down WebGL resources if the page is being unloaded
window.addEventListener("pagehide", () => {
  disposed = true;
  cancelAnimationFrame(animationFrame);
  disposeWorld(mainWorld);
  disposeWorld(labWorld);
});
