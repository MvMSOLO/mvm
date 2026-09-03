<script>
  import { onMount, onDestroy } from 'svelte';
  import { PhoneSceneEngine } from '$lib/3d/phoneEngine.js';
  import { gsap } from 'gsap';

  // Configurator state
  let selectedModel = $state('NOVA ONE');
  let selectedFinish = $state('Titanium');
  let selectedStorage = $state('512GB');

  // Interactive cursor
  let cursorX = $state(-100);
  let cursorY = $state(-100);
  let isCursorHovered = $state(false);

  // Gallery state
  let currentGalleryIndex = $state(0);
  const galleryImages = [
    { title: 'Chassis Engineering', desc: 'Grade 5 Titanium Frame with micro-milled precision' },
    { title: 'OLED Pure Motion', desc: '120Hz adaptive display with ultra-narrow bezel' },
    { title: 'Penta Camera System', desc: '50MP Sony Custom Sensor with periscope lens' },
    { title: 'Neural Compute Core', desc: '4nm NPU engine built for on-device AI tasks' },
  ];

  // Mobile menu
  let isMobileMenuOpen = $state(false);

  // Loading state
  let isLoading = $state(true);
  let loadProgress = $state(0);

  let canvasContainer;
  let engine = null;

  onMount(() => {
    // Initialize 3D WebGL Engine
    if (canvasContainer) {
      engine = new PhoneSceneEngine(canvasContainer, {
        onProgress: (prog) => {
          loadProgress = Math.round(prog * 100);
          if (loadProgress >= 100) {
            setTimeout(() => {
              isLoading = false;
            }, 300);
          }
        },
      });

      setTimeout(() => {
        isLoading = false;
      }, 600);
    }

    // GSAP ScrollTrigger timeline mapping for 120FPS smooth scroll synchronization
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const progress = Math.min(Math.max(scrollTop / (maxScroll || 1), 0), 1);

      let currentSec = 'HERO';
      if (progress > 0.12) currentSec = 'DISPLAY';
      if (progress > 0.27) currentSec = 'EXPLODED';
      if (progress > 0.42) currentSec = 'CAMERA';
      if (progress > 0.56) currentSec = 'PERFORMANCE';
      if (progress > 0.68) currentSec = 'BATTERY';
      if (progress > 0.78) currentSec = 'AI';
      if (progress > 0.88) currentSec = 'FINAL';

      if (engine) {
        gsap.to(engine, {
          duration: 0.1,
          ease: 'power1.out',
          onUpdate: () => {
            engine.updateScrollProgress(progress, currentSec);
          }
        });
      }
    };

    const handleMouseMove = (e) => {
      cursorX = e.clientX;
      cursorY = e.clientY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
      if (engine) engine.destroy();
    };
  });

  function setFinish(finish) {
    selectedFinish = finish;
    if (engine) engine.setMaterialFinish(finish);
  }
</script>

<svelte:head>
  <title>NOVA ONE — The Next Form</title>
  <meta name="description" content="Flagship smartphone experience built on high performance WebGL and 120FPS architecture." />
</svelte:head>

<!-- Custom Cursor (Desktop) -->
<div
  class="custom-cursor {isCursorHovered ? 'hovered' : ''}"
  style="transform: translate3d({cursorX}px, {cursorY}px, 0);"
></div>

<!-- Loading Experience Screen -->
{#if isLoading}
  <div class="loader-overlay">
    <div class="loader-content">
      <h1 class="loader-logo">NOVA</h1>
      <p class="loader-subtitle">INITIALIZING EXPERIENCE</p>
      <div class="loader-bar-bg">
        <div class="loader-bar-fill" style="width: {loadProgress}%;"></div>
      </div>
      <div class="loader-num">{loadProgress}%</div>
    </div>
  </div>
{/if}

<!-- Fixed 3D Canvas Background -->
<div class="canvas-viewport" bind:this={canvasContainer}></div>

<!-- Sticky Header & Mobile Drawer -->
<header class="global-header">
  <div class="header-inner">
    <div class="brand-logo">NOVA</div>

    <nav class="desktop-nav">
      <a href="#hero" class="nav-item">FORM</a>
      <a href="#display" class="nav-item">DISPLAY</a>
      <a href="#exploded" class="nav-item">EXPLODED</a>
      <a href="#camera" class="nav-item">CAMERA</a>
      <a href="#performance" class="nav-item">PERFORMANCE</a>
      <a href="#configurator" class="nav-item">PRE-ORDER</a>
    </nav>

    <button
      class="mobile-menu-btn"
      onpointerdown={() => { isMobileMenuOpen = !isMobileMenuOpen; }}
    >
      {isMobileMenuOpen ? '✕' : '☰'}
    </button>
  </div>
</header>

{#if isMobileMenuOpen}
  <div class="mobile-menu-drawer">
    <nav class="mobile-nav">
      <a href="#hero" onclick={() => (isMobileMenuOpen = false)}>PRODUCT</a>
      <a href="#display" onclick={() => (isMobileMenuOpen = false)}>TECHNOLOGY</a>
      <a href="#camera" onclick={() => (isMobileMenuOpen = false)}>CAMERA</a>
      <a href="#performance" onclick={() => (isMobileMenuOpen = false)}>AI & COMPUTE</a>
      <a href="#configurator" onclick={() => (isMobileMenuOpen = false)}>PRE-ORDER</a>
    </nav>
  </div>
{/if}

<!-- Main Scroll Container -->
<main class="content-container">
  <!-- 01. HERO SECTION -->
  <section id="hero" class="hero-section">
    <div class="hero-content">
      <span class="eyebrow">NOVA ONE</span>
      <h1 class="hero-title">THE NEXT FORM</h1>
      <p class="hero-desc">
        Monolithic grade 5 titanium chassis, 120Hz Pure Motion OLED, and penta-lens computational camera array.
      </p>
      <div class="scroll-indicator">
        <span class="scroll-text">SCROLL TO EXPLORE</span>
        <div class="scroll-line"></div>
      </div>
    </div>
  </section>

  <!-- 02. DISPLAY SECTION -->
  <section id="display" class="section-wrapper display-section">
    <div class="section-card left">
      <span class="badge">DISPLAY</span>
      <h2>120Hz PURE MOTION</h2>
      <p>
        Adaptive OLED panel with 0.0ms pixel response latency. Dynamic sweep GLSL shader calibration for absolute color precision and zero eye strain.
      </p>
    </div>
  </section>

  <!-- 03. EXPLODED VIEW SECTION -->
  <section id="exploded" class="section-wrapper exploded-section">
    <div class="section-card right">
      <span class="badge">INTERNAL ARCHITECTURE</span>
      <h2>PRECISION ENGINEERED</h2>
      <p>
        Each structural layer is independently aligned on a rigid titanium frame. Unrestricted thermal dispersal and high structural resilience.
      </p>

      <div class="layers-hud">
        <div class="hud-item"><span>01</span> SAPPHIRE GLASS</div>
        <div class="hud-item"><span>02</span> OLED MATRIX</div>
        <div class="hud-item"><span>03</span> TITANIUM CHASSIS</div>
        <div class="hud-item"><span>04</span> PENTA CAMERA</div>
        <div class="hud-item"><span>05</span> NPU LOGIC BOARD</div>
        <div class="hud-item"><span>06</span> 5000mAh BATTERY</div>
      </div>
    </div>
  </section>

  <!-- 04. CAMERA SECTION -->
  <section id="camera" class="section-wrapper camera-section">
    <div class="section-card left">
      <span class="badge">OPTICS</span>
      <h2>SEE MORE.</h2>
      <p>
        Five lens modules engineered with optical sapphire glass and periscope zoom architecture. Capture high-fidelity raw detail in low light.
      </p>
    </div>
  </section>

  <!-- 05. PERFORMANCE SECTION -->
  <section id="performance" class="section-wrapper performance-section">
    <div class="section-card right">
      <span class="badge">COMPUTE ENGINE</span>
      <h2>4nm NPU ARCHITECTURE</h2>
      <p>
        On-device real-time neural inference with dedicated array accelerators. Instantaneous computational photography and multi-thread efficiency.
      </p>
    </div>
  </section>

  <!-- 06. BATTERY & ENERGY SECTION -->
  <section id="battery" class="section-wrapper battery-section">
    <div class="section-card left">
      <span class="badge">ENERGY</span>
      <h2>5000mAh ARCHITECTURE</h2>
      <p>
        Ultra-high energy density cell designed for continuous high-load GPU/NPU throughput. Smart charging logic ensures long-term longevity.
      </p>
    </div>
  </section>

  <!-- 07. PRODUCT CONFIGURATOR -->
  <section id="configurator" class="configurator-section">
    <div class="config-container">
      <span class="badge">CONFIGURATOR</span>
      <h2>SELECT YOUR SPECIFICATION</h2>

      <div class="config-grid">
        <!-- Model -->
        <div class="config-group">
          <span class="group-label">MODEL</span>
          <div class="controls-row">
            {#each ['NOVA ONE', 'NOVA ONE PRO'] as model}
              <button
                class="text-control {selectedModel === model ? 'active' : ''}"
                onpointerdown={() => (selectedModel = model)}
              >
                {model}
              </button>
            {/each}
          </div>
        </div>

        <!-- Finish -->
        <div class="config-group">
          <span class="group-label">FINISH</span>
          <div class="controls-row">
            {#each ['Titanium', 'Obsidian', 'Silver'] as finish}
              <button
                class="text-control {selectedFinish === finish ? 'active' : ''}"
                onpointerdown={() => setFinish(finish)}
              >
                {finish}
              </button>
            {/each}
          </div>
        </div>

        <!-- Storage -->
        <div class="config-group">
          <span class="group-label">STORAGE</span>
          <div class="controls-row">
            {#each ['256GB', '512GB', '1TB'] as storage}
              <button
                class="text-control {selectedStorage === storage ? 'active' : ''}"
                onpointerdown={() => (selectedStorage = storage)}
              >
                {storage}
              </button>
            {/each}
          </div>
        </div>
      </div>

      <div class="config-summary">
        <div class="summary-specs">{selectedModel} — {selectedFinish} — {selectedStorage}</div>
        <button class="order-btn">PRE-ORDER NOW</button>
      </div>
    </div>
  </section>

  <!-- 08. PRODUCT GALLERY -->
  <section class="gallery-section">
    <div class="gallery-container">
      <div class="gallery-counter">0{currentGalleryIndex + 1} / 0{galleryImages.length}</div>
      <div class="gallery-card">
        <h3>{galleryImages[currentGalleryIndex].title}</h3>
        <p>{galleryImages[currentGalleryIndex].desc}</p>
      </div>
      <div class="gallery-nav">
        <button
          class="gallery-btn"
          onpointerdown={() => (currentGalleryIndex = (currentGalleryIndex - 1 + galleryImages.length) % galleryImages.length)}
        >
          ← PREV
        </button>
        <button
          class="gallery-btn"
          onpointerdown={() => (currentGalleryIndex = (currentGalleryIndex + 1) % galleryImages.length)}
        >
          NEXT →
        </button>
      </div>
    </div>
  </section>

  <!-- 09. SPECS SECTION -->
  <section class="specs-section">
    <div class="specs-grid">
      <div class="spec-item"><span class="spec-val">6.8"</span><span class="spec-lbl">OLED</span></div>
      <div class="spec-item"><span class="spec-val">120Hz</span><span class="spec-lbl">REFRESH</span></div>
      <div class="spec-item"><span class="spec-val">5 CAMERA</span><span class="spec-lbl">OPTICS</span></div>
      <div class="spec-item"><span class="spec-val">5000mAh</span><span class="spec-lbl">BATTERY</span></div>
      <div class="spec-item"><span class="spec-val">1TB</span><span class="spec-lbl">MAX STORAGE</span></div>
    </div>
  </section>

  <!-- FOOTER -->
  <footer class="global-footer">
    <div class="footer-inner">
      <div>© 2026 NOVA TECHNOLOGIES. ALL RIGHTS RESERVED.</div>
      <div>BUILT WITH SVELTEKIT & THREE.JS</div>
    </div>
  </footer>
</main>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    background-color: #050508;
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
    overflow-x: hidden;
    scroll-behavior: smooth;
    -webkit-font-smoothing: antialiased;
  }

  /* Fixed 3D Canvas */
  .canvas-viewport {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 1;
    pointer-events: none;
  }

  /* Custom Cursor */
  .custom-cursor {
    position: fixed;
    top: -6px;
    left: -6px;
    width: 12px;
    height: 12px;
    background-color: rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    pointer-events: none;
    z-index: 9999;
    transition: transform 0.05s linear, width 0.2s, height 0.2s, background-color 0.2s;
    mix-blend-mode: difference;
  }

  /* Loader */
  .loader-overlay {
    position: fixed;
    inset: 0;
    background: #050508;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .loader-content {
    text-align: center;
  }
  .loader-logo {
    font-size: 3rem;
    letter-spacing: 0.5rem;
    font-weight: 300;
    margin: 0 0 0.5rem 0;
  }
  .loader-subtitle {
    font-size: 0.75rem;
    letter-spacing: 0.2rem;
    color: #888;
    margin-bottom: 2rem;
  }
  .loader-bar-bg {
    width: 200px;
    height: 2px;
    background: rgba(255, 255, 255, 0.1);
    margin: 0 auto 1rem auto;
  }
  .loader-bar-fill {
    height: 100%;
    background: #00f0ff;
    transition: width 0.2s ease;
  }
  .loader-num {
    font-size: 0.85rem;
    letter-spacing: 0.1rem;
    color: #888;
  }

  /* Header */
  .global-header {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    z-index: 1000;
    padding: 1.5rem 2rem;
    box-sizing: border-box;
    backdrop-filter: blur(12px);
    background: rgba(5, 5, 8, 0.4);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  .header-inner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1400px;
    margin: 0 auto;
  }
  .brand-logo {
    font-size: 1.25rem;
    font-weight: 600;
    letter-spacing: 0.25rem;
  }
  .desktop-nav {
    display: flex;
    gap: 2rem;
  }
  .nav-item {
    color: #888;
    text-decoration: none;
    font-size: 0.8rem;
    letter-spacing: 0.15rem;
    transition: color 0.2s;
  }
  .nav-item:hover {
    color: #fff;
  }
  .mobile-menu-btn {
    display: none;
    background: none;
    border: none;
    color: #fff;
    font-size: 1.5rem;
    cursor: pointer;
  }

  /* Mobile Drawer */
  .mobile-menu-drawer {
    position: fixed;
    inset: 0;
    background: #050508;
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mobile-nav {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    text-align: center;
  }
  .mobile-nav a {
    color: #fff;
    text-decoration: none;
    font-size: 1.5rem;
    letter-spacing: 0.2rem;
  }

  /* Content Sections */
  .content-container {
    position: relative;
    z-index: 2;
  }

  /* Hero */
  .hero-section {
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 0 1.5rem;
  }
  .eyebrow {
    font-size: 0.8rem;
    letter-spacing: 0.3rem;
    color: #00f0ff;
    display: block;
    margin-bottom: 1rem;
  }
  .hero-title {
    font-size: clamp(2.5rem, 8vw, 6rem);
    font-weight: 200;
    letter-spacing: 0.4rem;
    margin: 0 0 1.5rem 0;
  }
  .hero-desc {
    max-width: 500px;
    margin: 0 auto 3rem auto;
    color: #a0a5b5;
    font-size: 0.95rem;
    line-height: 1.6;
  }
  .scroll-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  .scroll-text {
    font-size: 0.65rem;
    letter-spacing: 0.2rem;
    color: #666;
  }
  .scroll-line {
    width: 1px;
    height: 30px;
    background: linear-gradient(to bottom, #00f0ff, transparent);
  }

  /* Generic Section Wrappers */
  .section-wrapper {
    height: 100vh;
    display: flex;
    align-items: center;
    padding: 0 5vw;
    box-sizing: border-box;
  }
  .section-card {
    max-width: 450px;
    background: rgba(10, 12, 18, 0.65);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 2.5rem;
    border-radius: 4px;
  }
  .section-card.right {
    margin-left: auto;
  }
  .badge {
    font-size: 0.65rem;
    letter-spacing: 0.2rem;
    color: #00f0ff;
    display: block;
    margin-bottom: 0.75rem;
  }
  .section-card h2 {
    font-size: 2rem;
    font-weight: 300;
    letter-spacing: 0.15rem;
    margin: 0 0 1rem 0;
  }
  .section-card p {
    color: #a0a5b5;
    font-size: 0.9rem;
    line-height: 1.6;
    margin: 0;
  }

  /* Layers HUD */
  .layers-hud {
    margin-top: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 1rem;
  }
  .hud-item {
    font-size: 0.75rem;
    letter-spacing: 0.1rem;
    color: #888;
  }
  .hud-item span {
    color: #00f0ff;
    margin-right: 0.5rem;
  }

  /* Configurator */
  .configurator-section {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 5rem 1.5rem;
    background: rgba(5, 5, 8, 0.85);
  }
  .config-container {
    max-width: 700px;
    width: 100%;
    text-align: center;
  }
  .config-grid {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    margin: 3rem 0;
  }
  .config-group .group-label {
    display: block;
    font-size: 0.7rem;
    letter-spacing: 0.2rem;
    color: #666;
    margin-bottom: 0.75rem;
  }
  .controls-row {
    display: flex;
    justify-content: center;
    gap: 1.5rem;
  }
  .text-control {
    background: none;
    border: none;
    color: #888;
    font-size: 0.9rem;
    letter-spacing: 0.1rem;
    padding: 0.5rem 0;
    cursor: pointer;
    position: relative;
    transition: color 0.2s;
  }
  .text-control.active {
    color: #fff;
  }
  .text-control.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: #00f0ff;
    box-shadow: 0 0 8px #00f0ff;
  }
  .config-summary {
    margin-top: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }
  .summary-specs {
    font-size: 0.85rem;
    letter-spacing: 0.15rem;
    color: #a0a5b5;
  }
  .order-btn {
    background: #fff;
    color: #050508;
    border: none;
    padding: 1rem 2.5rem;
    font-size: 0.8rem;
    letter-spacing: 0.2rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  .order-btn:hover {
    background: #00f0ff;
  }

  /* Gallery */
  .gallery-section {
    min-height: 80vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem 1.5rem;
  }
  .gallery-container {
    max-width: 600px;
    width: 100%;
    text-align: center;
  }
  .gallery-counter {
    font-size: 0.8rem;
    letter-spacing: 0.2rem;
    color: #00f0ff;
    margin-bottom: 1.5rem;
  }
  .gallery-card {
    background: rgba(10, 12, 18, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 3rem 2rem;
    border-radius: 4px;
    margin-bottom: 2rem;
  }
  .gallery-card h3 {
    font-size: 1.5rem;
    font-weight: 300;
    letter-spacing: 0.15rem;
    margin: 0 0 1rem 0;
  }
  .gallery-card p {
    color: #a0a5b5;
    font-size: 0.9rem;
    margin: 0;
  }
  .gallery-nav {
    display: flex;
    justify-content: center;
    gap: 2rem;
  }
  .gallery-btn {
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #fff;
    padding: 0.75rem 1.5rem;
    font-size: 0.75rem;
    letter-spacing: 0.15rem;
    cursor: pointer;
  }

  /* Specs */
  .specs-section {
    padding: 8rem 2rem;
    background: rgba(5, 5, 8, 0.95);
  }
  .specs-grid {
    max-width: 1100px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 3rem;
    text-align: center;
  }
  .spec-val {
    display: block;
    font-size: 3.5rem;
    font-weight: 200;
    letter-spacing: 0.1rem;
    color: #fff;
  }
  .spec-lbl {
    font-size: 0.65rem;
    letter-spacing: 0.2rem;
    color: #666;
    margin-top: 0.5rem;
  }

  /* Footer */
  .global-footer {
    padding: 3rem 2rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    font-size: 0.7rem;
    letter-spacing: 0.15rem;
    color: #555;
  }
  .footer-inner {
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
  }

  /* Media Queries */
  @media (max-width: 768px) {
    .desktop-nav {
      display: none;
    }
    .mobile-menu-btn {
      display: block;
    }
    .section-card {
      max-width: 100%;
    }
    .footer-inner {
      flex-direction: column;
      gap: 1rem;
      text-align: center;
    }
  }
</style>
