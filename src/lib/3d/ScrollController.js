export class ScrollController {
  constructor() {
    this.targetProgress = 0;
    this.currentProgress = 0;
    this.velocity = 0;
    this.lastProgress = 0;
    this.lerpFactor = 0.08;

    this.handleScroll = this.handleScroll.bind(this);
    window.addEventListener('scroll', this.handleScroll, { passive: true });
  }

  handleScroll() {
    const scrollTop = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    this.targetProgress = Math.min(Math.max(scrollTop / (maxScroll || 1), 0), 1);
  }

  update() {
    const delta = (this.targetProgress - this.currentProgress) * this.lerpFactor;
    this.currentProgress += delta;
    this.velocity = Math.abs(this.currentProgress - this.lastProgress);
    this.lastProgress = this.currentProgress;
    return this.currentProgress;
  }

  destroy() {
    window.removeEventListener('scroll', this.handleScroll);
  }
}
