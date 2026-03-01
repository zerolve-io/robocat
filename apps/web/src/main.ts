import Phaser from 'phaser';
import { phaserConfig } from './config';

/* eslint-disable no-undef */
try {
  const game = new Phaser.Game(phaserConfig);

  // Remove loading screen once Phaser is ready
  game.events.once('ready', () => {
    const loader = document.getElementById('loading');
    if (loader) loader.remove();
  });

  // Fallback: remove after 3s even if 'ready' doesn't fire
  setTimeout(() => {
    const loader = document.getElementById('loading');
    if (loader) loader.remove();
  }, 3000);
} catch (err) {
  console.error('Phaser init failed:', err);
  const loader = document.getElementById('loading');
  if (loader) {
    loader.innerHTML = `<span style="color: #ff2a6d">FAILED TO LOAD</span><br><span style="font-size: 0.6rem; color: #666">${err}</span>`;
  }
}
