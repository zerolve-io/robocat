import Phaser from 'phaser';
import { phaserConfig } from './config';

new Phaser.Game(phaserConfig);

const loader = document.getElementById('loading');
if (loader) loader.remove();
