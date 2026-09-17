export const SCREENSHOT_MODALS = [
  {
    id: 'offline-banner',
    name: 'Offline Warning Banner',
    description: 'Prominent warning when device is offline, with cached data notice and retry button',
    category: 'System'
  },
  {
    id: 'daily-banner-unattempted',
    name: 'Daily Challenge Banner (Active)',
    description: 'Set of the Day banner on Main Menu showing Time to Beat for unattempted state',
    category: 'Daily'
  },
  {
    id: 'daily-banner-completed',
    name: 'Daily Challenge Banner (Completed)',
    description: 'Set of the Day banner on Main Menu showing completed state with Top Time',
    category: 'Daily'
  },
  {
    id: 'victory-standard',
    name: 'Victory - Stage Set Complete',
    description: 'Standard victory modal with 3 stars, speed points, completion time, and Next Stage button',
    category: 'Victory',
    // VictoryModal always fires a confetti burst, whose particle positions are randomized per render.
    diffThreshold: 0.1
  },
  {
    id: 'victory-world-1st',
    name: 'Victory - World 1st Rank',
    description: 'Top placement in the world with gold trophy and gradient title',
    category: 'Victory',
    diffThreshold: 0.1
  },
  {
    id: 'victory-new-record',
    name: 'Victory - New Personal Best',
    description: 'Personal best completion with golden badge and gold accent glow',
    category: 'Victory',
    diffThreshold: 0.1
  },
  {
    id: 'victory-leaderboard',
    name: 'Victory - Leaderboard Qualified',
    description: 'Leaderboard qualification banner displaying player tag and online status',
    category: 'Victory',
    diffThreshold: 0.1
  },
  {
    id: 'victory-fanfare',
    name: 'Victory - Golden Celebration Fanfare',
    description: 'Celebratory golden confetti particles firing across victory screen',
    category: 'Victory',
    // Two extra confetti bursts on top of the standard one: allow more particle-position noise.
    diffThreshold: 0.12
  },
  {
    id: 'victory-offline',
    name: 'Victory - Leaderboard Offline Sync',
    description: 'Notice explaining score is cached locally and will sync once back online',
    category: 'Victory',
    diffThreshold: 0.1
  },
  {
    id: 'daily-victory-success',
    name: 'Daily Challenge - Victory & World Rank',
    description: 'Daily Challenge completion modal with World 2nd silver trophy and 40px share button',
    category: 'Daily'
  },
  {
    id: 'daily-victory-failed',
    name: 'Daily Challenge - Run Ended',
    description: 'Daily Challenge run ended modal with plain text heading and Today\'s Top 3 leaderboard',
    category: 'Daily'
  },
  {
    id: 'daily-victory-forfeited',
    name: 'Daily Challenge - Forfeited',
    description: 'Daily Challenge forfeited modal with plain text heading and full-width Main Menu button',
    category: 'Daily'
  },
  {
    id: 'daily-victory-name-editing',
    name: 'Daily Victory - Editing Hunter Tag',
    description: 'Editing Hunter Tag input field on Daily Challenge completion',
    category: 'Daily'
  },
  {
    id: 'confirm-exit-standard',
    name: 'Confirm Exit - Standard Quit',
    description: 'Standard quit confirmation modal: "Quit Current Game? Your current stage progress will be lost."',
    category: 'Confirmation'
  },
  {
    id: 'confirm-exit-daily',
    name: 'Confirm Exit - Daily Forfeit Warning',
    description: 'Daily challenge forfeit warning: "Forfeit Set of the Day? This will mark today\'s set as a failure."',
    category: 'Confirmation'
  },
  {
    id: 'game-over',
    name: 'Game Over - Stage Failed',
    description: 'Stage failed modal with Skull icon, 0/3 hearts, Try Again, and Main Menu buttons',
    category: 'Game'
  },
  {
    id: 'share-challenge',
    name: 'Share Result Sheet',
    description: 'Share sheet with social actions (Text, TikTok, Instagram, More, Copy link, Save image)',
    category: 'Social'
  },
  {
    id: 'help',
    name: 'Help & How to Play',
    description: 'Game instructions, rules, scoring breakdown, and options',
    category: 'Info'
  },
  {
    id: 'rating',
    name: 'Rating & Feedback Modal',
    description: '5-star interactive rating prompt and App Store review trigger',
    category: 'Info'
  },
  {
    id: 'progress-leaderboards',
    name: 'Scores - Global Leaderboard (Top 25)',
    description: 'Global leaderboard tab showing world top 25 records and ranks',
    category: 'Leaderboard'
  },
  {
    id: 'progress-daily',
    name: 'Scores - Daily Challenge Tab',
    description: 'Daily Challenge tab with streak, calendar, and today\'s completion details',
    category: 'Leaderboard'
  },
  {
    id: 'progress-my-progress',
    name: 'Scores - My Progress Tab',
    description: 'Player lifetime statistics, sets cleared, accuracy, and difficulty breakdown',
    category: 'Leaderboard'
  },
  {
    id: 'progress-offline',
    name: 'Scores - Offline Mode Banner',
    description: 'Leaderboard modal showing the active Offline Mode notice and retry button',
    category: 'Leaderboard'
  }
];
