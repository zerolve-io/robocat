// Cat memes & pictures for death screens and zone transitions
// Uses free cat image APIs — no assets to bundle

const CAT_MEME_CAPTIONS = [
  // Death memes
  { text: 'I has fallen.', context: 'death' },
  { text: 'This is fine.', context: 'death' },
  { text: 'I can haz continue?', context: 'death' },
  { text: 'Not again...', context: 'death' },
  { text: 'Nani?!', context: 'death' },
  { text: 'Error 404: Lives not found', context: 'death' },
  { text: 'Skill issue detected', context: 'death' },
  { text: '*confused screaming*', context: 'death' },
  { text: 'Mission failed successfully', context: 'death' },
  { text: 'Oof.', context: 'death' },
  { text: 'Catastrophic failure', context: 'death' },
  { text: 'Me-owch!', context: 'death' },
  { text: 'RIP in pepperoni', context: 'death' },
  { text: 'F in chat', context: 'death' },
  { text: 'Should have taken the bus', context: 'death' },
  { text: 'brb, using my 8 other lives', context: 'death' },
  { text: 'The floor is lava (literally)', context: 'death' },
  { text: 'Gravity wins again', context: 'death' },
  { text: 'That drone had a family!', context: 'death' },

  // Zone transition memes
  { text: 'Level up, buttercup!', context: 'zone' },
  { text: "*hacker voice* I'm in", context: 'zone' },
  { text: 'New area unlocked! 🔓', context: 'zone' },
  { text: 'Things are about to get spicy', context: 'zone' },
  { text: 'Hold onto your whiskers', context: 'zone' },
  { text: 'Did someone turn up the difficulty?', context: 'zone' },
  { text: 'TURBO MODE ENGAGED', context: 'zone' },
  { text: "This isn't even my final form", context: 'zone' },
];

// Pre-cached cat images from free APIs
const CAT_IMAGE_URLS = [
  'https://cataas.com/cat?width=200&height=150',
  'https://cataas.com/cat/cute?width=200&height=150',
  'https://cataas.com/cat/says/meow?width=200&height=150',
];

export interface CatMeme {
  caption: string;
  imageUrl: string;
}

export function getDeathMeme(): CatMeme {
  const deathMemes = CAT_MEME_CAPTIONS.filter((m) => m.context === 'death');
  const meme = deathMemes[Math.floor(Math.random() * deathMemes.length)];
  // Use cataas with the caption text burned into the image
  const encoded = encodeURIComponent(meme.text);
  return {
    caption: meme.text,
    imageUrl: `https://cataas.com/cat/says/${encoded}?fontSize=24&fontColor=white&width=300&height=200`,
  };
}

export function getZoneMeme(): CatMeme {
  const zoneMemes = CAT_MEME_CAPTIONS.filter((m) => m.context === 'zone');
  const meme = zoneMemes[Math.floor(Math.random() * zoneMemes.length)];
  return {
    caption: meme.text,
    imageUrl: CAT_IMAGE_URLS[Math.floor(Math.random() * CAT_IMAGE_URLS.length)],
  };
}

// Preload images to avoid delay on death
const imageCache: HTMLImageElement[] = [];
export function preloadCatImages(): void {
  for (let i = 0; i < 5; i++) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = `https://cataas.com/cat?width=200&height=150&_=${Date.now()}_${i}`;
    imageCache.push(img);
  }
}
