// Gurt's Waddle — medal definitions, shared by the game and the medal wall.
// id, name, how to earn it, and how it looks.
window.MEDALS = [
  { id: 'first-step',   name: 'First Step',        how: 'finish your first level',            icon: '🥚', color: '#8fd6a8' },
  { id: 'frozen-foot',  name: 'Frozen Foot',       how: 'reach level 21, the frozen north',   icon: '❄️', color: '#9fd8ff' },
  { id: 'lantern-lamp', name: 'Lantern Lamp',      how: 'reach level 41, the lantern woods',  icon: '🏮', color: '#ffd23f' },
  { id: 'star-chaser',  name: 'Star Chaser',       how: 'reach level 61, the starfall coast', icon: '⭐', color: '#c9b6ff' },
  { id: 'root-digger',  name: 'Root Digger',       how: 'reach level 81, the root cellar',     icon: '🌱', color: '#c9a27a' },
  { id: 'moon-moth',    name: 'Moon Moth Slayer',  how: 'beat the moon moth',                 icon: '🦋', color: '#e8c6ff' },
  { id: 'lantern-moth', name: 'Lantern Moth Slayer', how: 'beat the lantern moth',            icon: '🏮', color: '#ffb347' },
  { id: 'star-moth',    name: 'Starfall Slayer',   how: 'beat the starfall moth',             icon: '🌠', color: '#a0e7ff' },
  { id: 'root-moth',    name: 'Root Moth Slayer',  how: 'beat the root moth',                 icon: '🪱', color: '#ff9f68' },
  { id: 'hundred',      name: 'Hundred Steps',     how: 'finish all one hundred levels',      icon: '💯', color: '#ffd23f' },
  { id: 'wind-walker',  name: 'Wind Walker',       how: 'reach level 101, the wind gardens',  icon: '🍃', color: '#bfe9ff' },
  { id: 'wind-moth',    name: 'Wind Moth Slayer',  how: 'beat the wind moth',                 icon: '🦋', color: '#9fe8ff' },
  { id: 'twenty',       name: 'One Hundred Twenty', how: 'finish all one hundred twenty levels', icon: '🌬️', color: '#8fd6ff' },
  { id: 'story-1',      name: 'Garden Wake',       how: 'finish story chapter one',            icon: '🌱', color: '#a8e6a1' },
  { id: 'story-2',      name: 'Frost Line',        how: 'finish story chapter two',            icon: '❄️', color: '#9fd8ff' },
  { id: 'story-3',      name: 'Lantern Road',      how: 'finish story chapter three',          icon: '🏮', color: '#ffd23f' },
  { id: 'story-4',      name: 'Starfall Path',     how: 'finish story chapter four',           icon: '⭐', color: '#c9b6ff' },
  { id: 'story-5',      name: 'Root of the Story', how: 'finish story chapter five',           icon: '🌳', color: '#c9a27a' },
  { id: 'coin-100',     name: 'Pocket Full',       how: 'collect one hundred coins in a run', icon: '🪙', color: '#ffd23f' },
  { id: 'score-500',    name: 'Five Hundred',      how: 'score five hundred in one run',      icon: '💯', color: '#ff9f68' },
  { id: 'daily-waddle', name: 'Daily Waddler',     how: 'finish a daily waddle',              icon: '📅', color: '#a0e7ff' },
  { id: 'builder',      name: 'Level Builder',     how: 'share a level from the workshop',    icon: '🛠️', color: '#c9b6ff' },
  { id: 'playwright',   name: 'Playwright',        how: 'play a level someone else built',    icon: '🎭', color: '#8fd6a8' }
];
window.MEDAL_BY_ID = {};
for (const m of window.MEDALS) window.MEDAL_BY_ID[m.id] = m;
