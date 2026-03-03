// Cat memes & pictures for death screens and zone transitions
// Uses free cat image APIs — no assets to bundle

const CAT_MEME_CAPTIONS = [
  // Death memes — the more the merrier
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
  { text: 'I meant to do that', context: 'death' },
  { text: 'Task failed: be alive', context: 'death' },
  { text: 'Instructions unclear', context: 'death' },
  { text: 'git commit -m "fix: death"', context: 'death' },
  { text: 'sudo avoid --death', context: 'death' },
  { text: 'Have you tried NOT dying?', context: 'death' },
  { text: 'Paws for thought...', context: 'death' },
  { text: 'Are you even trying?', context: 'death' },
  { text: 'Meow meow I am dead', context: 'death' },
  { text: 'Plot twist: the floor wins', context: 'death' },
  { text: 'Nap time (permanent)', context: 'death' },
  { text: 'Wasted.', context: 'death' },
  { text: 'To be continued...', context: 'death' },
  { text: 'Connection lost: life.exe', context: 'death' },
  { text: 'Cat.exe has stopped working', context: 'death' },
  { text: 'Ctrl+Z! CTRL+Z!!!', context: 'death' },
  { text: 'I blame lag', context: 'death' },
  { text: 'Respawning in 3... 2...', context: 'death' },
  { text: 'Your free trial of life has ended', context: 'death' },
  { text: 'Unsubscribe from gravity', context: 'death' },
  { text: 'Alexa, play Despacito', context: 'death' },
  { text: "*record scratch* Yep, that's me", context: 'death' },
  { text: 'You died. But in a cool way.', context: 'death' },
  { text: 'Achievement unlocked: Floor Inspector', context: 'death' },
  { text: "It's giving... dead", context: 'death' },
  { text: 'EMOTIONAL DAMAGE', context: 'death' },
  { text: 'That was purrfectly terrible', context: 'death' },
  { text: 'Well that was a cat-astrophe', context: 'death' },
  { text: 'Fur real? Again?', context: 'death' },
  { text: "You've cat to be kitten me", context: 'death' },
  { text: 'One does not simply survive', context: 'death' },
  { text: "I see dead cats (it's me)", context: 'death' },
  { text: 'POV: you missed the jump', context: 'death' },
  { text: 'Skill tree: needs watering', context: 'death' },
  { text: 'This message was paid for by Drones Inc.', context: 'death' },

  // Zone transition memes
  { text: 'Level up, buttercup!', context: 'zone' },
  { text: "*hacker voice* I'm in", context: 'zone' },
  { text: 'New area unlocked! 🔓', context: 'zone' },
  { text: 'Things are about to get spicy', context: 'zone' },
  { text: 'Hold onto your whiskers', context: 'zone' },
  { text: 'Did someone turn up the difficulty?', context: 'zone' },
  { text: 'TURBO MODE ENGAGED', context: 'zone' },
  { text: "This isn't even my final form", context: 'zone' },
  { text: "We're not in Kansas anymore", context: 'zone' },
  { text: 'New hood, who dis', context: 'zone' },
  { text: 'The vibes just shifted', context: 'zone' },
  { text: 'Loading better graphics...', context: 'zone' },
  { text: 'Warning: fun levels increasing', context: 'zone' },
  { text: 'You call that a zone? THIS is a zone', context: 'zone' },
  { text: 'Congratulations, you survived!', context: 'zone' },
  { text: 'Plot thickens... meow', context: 'zone' },
  { text: 'Entering the danger zone 🎵', context: 'zone' },
  { text: 'Achievement: Still Alive', context: 'zone' },
  { text: 'Speed: yes', context: 'zone' },
  { text: "It's giving cyberpunk", context: 'zone' },

  // Scrap collection (shown occasionally)
  { text: 'Ooh shiny!', context: 'scrap' },
  { text: 'Mine mine mine!', context: 'scrap' },
  { text: 'Cha-ching!', context: 'scrap' },
  { text: 'Stonks 📈', context: 'scrap' },
  { text: 'Yoink!', context: 'scrap' },

  // High score
  { text: "You're basically a pro now", context: 'highscore' },
  { text: 'New personal best! Mom would be proud', context: 'highscore' },
  { text: 'Speed. I am speed.', context: 'highscore' },
  { text: 'Put this on your resume', context: 'highscore' },
  { text: 'Screenshot this before it disappears', context: 'highscore' },
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

export function getScrapMeme(): string | null {
  // Only show occasionally (20% chance)
  if (Math.random() > 0.2) return null;
  const memes = CAT_MEME_CAPTIONS.filter((m) => m.context === 'scrap');
  return memes[Math.floor(Math.random() * memes.length)].text;
}

export function getHighScoreMeme(): string {
  const memes = CAT_MEME_CAPTIONS.filter((m) => m.context === 'highscore');
  return memes[Math.floor(Math.random() * memes.length)].text;
}
