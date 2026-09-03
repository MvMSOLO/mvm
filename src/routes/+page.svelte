<script>
  import { onMount, onDestroy } from 'svelte';
  import { PhoneSceneEngine } from '$lib/3d/phoneEngine.js';
  import { ScrollController } from '$lib/3d/ScrollController.js';
  import ProgressRail from '$lib/components/ProgressRail.svelte';

  // Configurator state
  let selectedModel = $state('NOVA ONE');
  let selectedFinish = $state('Titanium');
  let selectedStorage = $state('512GB');

  // Interactive mouse parallax & cursor
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
  let scrollController = null;
  let currentProg = $state(0);
  let animFrameId = null;

  onMount(() => {
    scrollController = new ScrollController();

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

    const updateLoop = () => {
      animFrameId = requestAnimationFrame(updateLoop);
      if (scrollController && engine) {
        currentProg = scrollController.update();
        engine.updateProgress(currentProg);
      }
    };
    animFrameId = requestAnimationFrame(updateLoop);

    const handleMouseMove = (e) => {
      cursorX = e.clientX;
      cursorY = e.clientY;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      if (scrollController) scrollController.destroy();
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
  <meta name="description" content="Cinematic 3D flagship smartphone web experience." />
</svelte:head>

<!-- Vertical Progress Rail -->
<ProgressRail progress={currentProg} />

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
      <p class="loader-subtitle">BUILDING EXPERIENCE</p>

      <div class="checklist">
        <div class="check-item"><span>GLASS</span> <span class="check-mark">✓</span></div>
        <div class="check-item"><span>OLED DISPLAY</span> <span class="check-mark">✓</span></div>
        <div class="check-item"><span>PENTA OPTICS</span> <span class="check-mark">✓</span></div>
        <div class="check-item"><span>NEURAL CORE</span> <span class="check-mark">✓</span></div>
      </div>

      <div class="loader-bar-bg">
        <div class="loader-bar-fill" style="width: {loadProgress}%;"></div>
      </div>
      <div class="loader-num">{loadProgress}%</div>
    </div>
  </div>
{/if}

<!-- Fixed 3D Canvas Viewport -->
<div class="canvas-viewport" bind:this={canvasContainer}></div>

<!-- Sticky Header & Mobile Drawer -->
<header class="global-header">
  <div class="header-inner">
    <div class="brand-logo">NOVA</div>

    <nav class="desktop-nav">
      <a href="#hero" class="nav-item">FORM</a>
      <a href="#display" class="nav-item">DISPLAY</a>
      <a href="#camera" class="nav-item">OPTICS</a>
      <a href="#exploded" class="nav-item">ARCHITECTURE</a>
      <a href="#performance" class="nav-item">NPU</a>
      <a href="#configurator" class="nav-item">PRE-ORDER</a>
    </nav>

    <button
      class="mobile-menu-btn"
      onclick={() => { isMobileMenuOpen = !isMobileMenuOpen; }}
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
    <div class="hero-editorial-grid">
      <div class="hero-title-group">
        <span class="eyebrow">NOVA ONE</span>
        <h1 class="hero-title">THE NEXT<br />FORM.</h1>
      </div>
      <div class="hero-meta">
        <span class="meta-num">01 / 08</span>
        <span class="meta-label">SCROLL TO EXPLORE</span>
        <div class="scroll-line"></div>
      </div>
    </div>
  </section>

  <!-- 02. DISPLAY SECTION -->
  <section id="display" class="section-wrapper display-section">
    <div class="editorial-card left">
      <span class="badge">02 — DISPLAY</span>
      <h2>120Hz PURE MOTION</h2>
      <p>
        Adaptive OLED panel with 0.0ms pixel response latency. Dynamic sweep GLSL shader calibration for absolute color precision and zero eye strain.
      </p>
    </div>
  </section>

  <!-- 03. MACRO CAMERA SECTION -->
  <section id="camera" class="section-wrapper camera-section">
    <div class="editorial-card right">
      <span class="badge">03 — OPTICS</span>
      <h2>SEE MORE.</h2>
      <p>
        Five lens modules engineered with optical sapphire glass and periscope zoom architecture. Capture high-fidelity raw detail in low light.
      </p>
      <div class="spec-callout">
        <span class="callout-num">50 MP</span>
        <span class="callout-label">PURE DETAIL SENSOR</span>
      </div>
    </div>
  </section>

  <!-- 04. EXPLODED VIEW SECTION -->
  <section id="exploded" class="section-wrapper exploded-section">
    <div class="editorial-card left">
      <span class="badge">04 — ARCHITECTURE</span>
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

  <!-- 05. PERFORMANCE SECTION -->
  <section id="performance" class="section-wrapper performance-section">
    <div class="editorial-card right">
      <span class="badge">05 — COMPUTE ENGINE</span>
      <h2>4nm NPU ARCHITECTURE</h2>
      <p>
        On-device real-time neural inference with dedicated array accelerators. Instantaneous computational photography and multi-thread efficiency.
      </p>
    </div>
  </section>

  <!-- 06. BATTERY & ENERGY SECTION -->
  <section id="battery" class="section-wrapper battery-section">
    <div class="editorial-card left">
      <span class="badge">06 — ENERGY</span>
      <h2>5000mAh ARCHITECTURE</h2>
      <p>
        Ultra-high energy density cell designed for continuous high-load GPU/NPU throughput. Smart charging logic ensures long-term longevity.
      </p>
    </div>
  </section>

  <!-- 07. PRODUCT CONFIGURATOR -->
  <section id="configurator" class="configurator-section">
    <div class="config-container">
      <span class="badge">07 — CONFIGURATOR</span>
      <h2>SELECT YOUR SPECIFICATION</h2>

      <div class="config-grid">
        <!-- Model -->
        <div class="config-group">
          <span class="group-label">MODEL</span>
          <div class="controls-row">
            {#each ['NOVA ONE', 'NOVA ONE PRO'] as model}
              <button
                class="text-control {selectedModel === model ? 'active' : ''}"
                onclick={() => (selectedModel = model)}
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
                onclick={() => setFinish(finish)}
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
                onclick={() => (selectedStorage = storage)}
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
          onclick={() => (currentGalleryIndex = (currentGalleryIndex - 1 + galleryImages.length) % galleryImages.length)}
        >
          ← PREV
        </button>
        <button
          class="gallery-btn"
          onclick={() => (currentGalleryIndex = (currentGalleryIndex + 1) % galleryImages.length)}
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
    background-color: #050609;
    color: #ffffff;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    overflow-x: hidden;
    scroll-behavior: smooth;
    -webkit-font-smoothing: antialiased;
  }

  /* Canvas Viewport */
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
    transition: transform 0.05s linear;
    mix-blend-mode: difference;
  }

  /* Loader */
  .loader-overlay {
    position: fixed;
    inset: 0;
    background: #050609;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .loader-content {
    text-align: center;
  }
  .loader-logo {
    font-family: 'Syne', sans-serif;
    font-size: 3.5rem;
    letter-spacing: 0.6rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
  }
  .loader-subtitle {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 0.75rem;
    letter-spacing: 0.25rem;
    color: #888;
    margin-bottom: 1.5rem;
  }
  .checklist {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 2rem;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 0.65rem;
    letter-spacing: 0.1rem;
    color: #666;
  }
  .check-mark {
    color: #00f0ff;
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
    font-family: 'Space Grotesk', sans-serif;
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
    background: rgba(5, 6, 9, 0.4);
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
    font-family: 'Syne', sans-serif;
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: 0.3rem;
  }
  .desktop-nav {
    display: flex;
    gap: 2rem;
  }
  .nav-item {
    font-family: 'Space Grotesk', sans-serif;
    color: #888;
    text-decoration: none;
    font-size: 0.75rem;
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

  /* Content */
  .content-container {
    position: relative;
    z-index: 2;
  }

  /* Hero Section */
  .hero-section {
    height: 100vh;
    display: flex;
    align-items: center;
    padding: 0 10vw 0 16vw;
    box-sizing: border-box;
  }
  .hero-editorial-grid {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    width: 100%;
  }
  .eyebrow {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 0.8rem;
    letter-spacing: 0.3rem;
    color: #00f0ff;
    display: block;
    margin-bottom: 1rem;
  }
  .hero-title {
    font-family: 'Syne', sans-serif;
    font-size: clamp(3rem, 8vw, 6.5rem);
    font-weight: 800;
    letter-spacing: 0.2rem;
    line-height: 1.05;
    margin: 0;
  }
  .hero-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
  }
  .meta-num {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 0.8rem;
    letter-spacing: 0.2rem;
    color: #00f0ff;
  }
  .meta-label {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 0.65rem;
    letter-spacing: 0.2rem;
    color: #666;
  }
  .scroll-line {
    width: 1px;
    height: 40px;
    background: linear-gradient(to bottom, #00f0ff, transparent);
  }

  /* Editorial Section Cards */
  .section-wrapper {
    height: 100vh;
    display: flex;
    align-items: center;
    padding: 0 10vw 0 16vw;
    box-sizing: border-box;
  }
  .editorial-card {
    max-width: 420px;
  }
  .editorial-card.right {
    margin-left: auto;
  }
  .badge {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 0.65rem;
    letter-spacing: 0.2rem;
    color: #00f0ff;
    display: block;
    margin-bottom: 0.75rem;
  }
  .editorial-card h2 {
    font-family: 'Syne', sans-serif;
    font-size: 2.4rem;
    font-weight: 700;
    letter-spacing: 0.1rem;
    margin: 0 0 1rem 0;
  }
  .editorial-card p {
    color: #a0a5b5;
    font-size: 0.95rem;
    line-height: 1.6;
    margin: 0;
  }

  .spec-callout {
    margin-top: 2rem;
    border-left: 2px solid #aa00ff;
    padding-left: 1rem;
  }
  .callout-num {
    font-family: 'Syne', sans-serif;
    font-size: 2.8rem;
    font-weight: 700;
    display: block;
    color: #fff;
  }
  .callout-label {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 0.65rem;
    letter-spacing: 0.2rem;
    color: #888;
  }

  .layers-hud {
    margin-top: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 1rem;
  }
  .hud-item {
    font-family: 'Space Grotesk', sans-serif;
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
    background: rgba(5, 6, 9, 0.85);
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
    font-family: 'Space Grotesk', sans-serif;
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
    font-family: 'Space Grotesk', sans-serif;
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
    font-family: 'Space Grotesk', sans-serif;
    font-size: 0.85rem;
    letter-spacing: 0.15rem;
    color: #a0a5b5;
  }
  .order-btn {
    background: #fff;
    color: #050609;
    border: none;
    padding: 1rem 2.5rem;
    font-family: 'Space Grotesk', sans-serif;
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
    font-family: 'Space Grotesk', sans-serif;
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
    font-family: 'Syne', sans-serif;
    font-size: 1.6rem;
    font-weight: 700;
    letter-spacing: 0.1rem;
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
    font-family: 'Space Grotesk', sans-serif;
    padding: 0.75rem 1.5rem;
    font-size: 0.75rem;
    letter-spacing: 0.15rem;
    cursor: pointer;
  }

  /* Specs */
  .specs-section {
    padding: 8rem 2rem;
    background: rgba(5, 6, 9, 0.95);
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
    font-family: 'Syne', sans-serif;
    font-size: 3.8rem;
    font-weight: 700;
    letter-spacing: 0.05rem;
    color: #fff;
  }
  .spec-lbl {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 0.65rem;
    letter-spacing: 0.2rem;
    color: #666;
    margin-top: 0.5rem;
  }

  /* Footer */
  .global-footer {
    padding: 3rem 2rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    font-family: 'Space Grotesk', sans-serif;
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
  @media (max-width: 1024px) {
    .hero-section, .section-wrapper {
      padding-left: 5vw;
    }
  }

  @media (max-width: 768px) {
    .desktop-nav {
      display: none;
    }
    .mobile-menu-btn {
      display: block;
    }
    .hero-editorial-grid {
      flex-direction: column;
      align-items: flex-start;
      gap: 2rem;
    }
    .hero-meta {
      align-items: flex-start;
    }
    .editorial-card {
      max-width: 100%;
    }
    .footer-inner {
      flex-direction: column;
      gap: 1rem;
      text-align: center;
    }
  }
</style>
