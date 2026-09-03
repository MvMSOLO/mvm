<script>
  let { progress = 0 } = $props();

  const sections = [
    '01 FORM',
    '02 DISPLAY',
    '03 CAMERA',
    '04 EXPLODED',
    '05 NPU CORE',
    '06 BATTERY',
    '07 AI MODEL',
    '08 REASSEMBLY'
  ];

  let activeIndex = $derived(Math.min(Math.floor(progress * sections.length), sections.length - 1));
</script>

<div class="progress-rail">
  {#each sections as sec, idx}
    <div class="rail-item {idx === activeIndex ? 'active' : ''}">
      <div class="rail-line"></div>
      <span class="rail-label">{sec}</span>
    </div>
  {/each}
</div>

<style>
  .progress-rail {
    position: fixed;
    left: 2rem;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
    pointer-events: none;
  }
  .rail-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    opacity: 0.25;
    transition: opacity 0.3s ease;
  }
  .rail-item.active {
    opacity: 1;
  }
  .rail-line {
    width: 10px;
    height: 1px;
    background: #fff;
    transition: width 0.3s ease, background 0.3s ease;
  }
  .rail-item.active .rail-line {
    width: 20px;
    background: #00f0ff;
    box-shadow: 0 0 8px #00f0ff;
  }
  .rail-label {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 0.6rem;
    letter-spacing: 0.15rem;
    color: #fff;
    font-weight: 400;
  }
  @media (max-width: 1024px) {
    .progress-rail {
      display: none;
    }
  }
</style>
