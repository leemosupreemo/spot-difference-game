// High-quality Canvas Level Definitions & Renderers for Spot The Difference

export const LEVELS = [
  {
    id: 'synthwave',
    title: 'Neon Synthwave City',
    category: 'Cyberpunk',
    difficulty: 'Easy',
    totalDifferences: 5,
    bgGradient: ['#120428', '#2d0854'],
    accentColor: '#ff007f',
    diffs: [
      { id: 1, x: 25, y: 18, radius: 6, hint: 'Check near the glowing synthwave sun' },
      { id: 2, x: 72, y: 35, radius: 5, hint: 'Look at the skyscraper windows' },
      { id: 3, x: 45, y: 68, radius: 6, hint: 'Examine the sports car taillights' },
      { id: 4, x: 88, y: 22, radius: 5, hint: 'Spot the neon sign on the right tower' },
      { id: 5, x: 12, y: 82, radius: 5, hint: 'Check the palm tree grid reflection' }
    ],
    render: (ctx, width, height, isModified) => {
      // Background Grid & Sun
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#0b001a');
      grad.addColorStop(0.5, '#2c004d');
      grad.addColorStop(1, '#660066');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Grid Floor
      const horizon = height * 0.6;
      ctx.strokeStyle = '#ff00aa';
      ctx.lineWidth = 1.5;
      
      // Horizontal perspective grid lines
      for (let i = 0; i <= 10; i++) {
        const y = horizon + Math.pow(i / 10, 2) * (height - horizon);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      
      // Vertical grid lines
      const center = width / 2;
      for (let i = -10; i <= 10; i++) {
        ctx.beginPath();
        ctx.moveTo(center, horizon);
        ctx.lineTo(center + i * (width / 6), height);
        ctx.stroke();
      }

      // Synthwave Sun
      const sunX = width * 0.25;
      const sunY = height * 0.25;
      const sunRadius = width * 0.12;

      ctx.save();
      const sunGrad = ctx.createLinearGradient(0, sunY - sunRadius, 0, sunY + sunRadius);
      sunGrad.addColorStop(0, '#ffea00');
      sunGrad.addColorStop(1, '#ff0055');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
      ctx.fill();

      // DIFF 1: Modified sun has horizontal grid cutouts or extra stripes!
      if (isModified) {
        ctx.fillStyle = '#2c004d';
        ctx.fillRect(sunX - sunRadius, sunY + 5, sunRadius * 2, 4);
        ctx.fillRect(sunX - sunRadius, sunY + 15, sunRadius * 2, 6);
      } else {
        ctx.fillStyle = '#2c004d';
        ctx.fillRect(sunX - sunRadius, sunY + 10, sunRadius * 2, 4);
      }
      ctx.restore();

      // Skyscapers
      const buildings = [
        { x: 0.45, w: 0.1, h: 0.4 },
        { x: 0.58, w: 0.12, h: 0.48 },
        { x: 0.7, w: 0.11, h: 0.35 },
        { x: 0.83, w: 0.12, h: 0.45 }
      ];

      buildings.forEach((b, idx) => {
        const bx = b.x * width;
        const bw = b.w * width;
        const bh = b.h * height;
        const by = horizon - bh;

        ctx.fillStyle = '#110226';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, bw, bh);

        // Windows
        ctx.fillStyle = '#00ffff';
        for (let wx = bx + 5; wx < bx + bw - 8; wx += 12) {
          for (let wy = by + 10; wy < horizon - 10; wy += 15) {
            // DIFF 2: Skyscraper window pattern difference
            if (idx === 1 && isModified && wx > bx + bw/2 && wy < by + 50) {
              ctx.fillStyle = '#ff00aa'; // Different color window!
            } else {
              ctx.fillStyle = (wx + wy) % 3 === 0 ? '#00ffff' : '#ffea00';
            }
            ctx.fillRect(wx, wy, 6, 8);
          }
        }
      });

      // Neon Sign on Right Tower (DIFF 4)
      const signX = width * 0.88;
      const signY = height * 0.22;
      ctx.fillStyle = isModified ? '#00ffaa' : '#ff00aa'; // DIFF 4: Sign color difference
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isModified ? 'CYBER 2099' : 'NEON 2099', signX, signY);

      // Sports Car on Grid (DIFF 3)
      const carX = width * 0.45;
      const carY = height * 0.68;
      const carW = width * 0.14;
      const carH = height * 0.08;

      ctx.fillStyle = '#000';
      ctx.fillRect(carX, carY, carW, carH);
      ctx.fillStyle = '#ff0055';
      ctx.fillRect(carX + 5, carY + 4, carW - 10, carH - 12);
      
      // Taillights
      ctx.fillStyle = isModified ? '#00ffff' : '#ff0000'; // DIFF 3: Taillight cyan vs red
      ctx.fillRect(carX + 8, carY + carH - 12, 12, 6);
      ctx.fillRect(carX + carW - 20, carY + carH - 12, 12, 6);

      // Palm Trees (DIFF 5)
      const palmX = width * 0.12;
      const palmY = height * 0.82;

      ctx.strokeStyle = '#ff00aa';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(palmX, height);
      ctx.quadraticCurveTo(palmX - 10, palmY + 20, palmX, palmY);
      ctx.stroke();

      // Palm leaves
      ctx.fillStyle = '#00ffff';
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
        ctx.beginPath();
        ctx.ellipse(palmX + Math.cos(angle)*15, palmY + Math.sin(angle)*10, 15, 5, angle, 0, Math.PI * 2);
        ctx.fill();
      }

      // DIFF 5: Modified version adds a glowing coconut or extra leaf star
      if (isModified) {
        ctx.fillStyle = '#ffea00';
        ctx.beginPath();
        ctx.arc(palmX, palmY, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
  {
    id: 'enchanted_forest',
    title: 'Enchanted Fairy Forest',
    category: 'Fantasy',
    difficulty: 'Medium',
    totalDifferences: 5,
    bgGradient: ['#04151f', '#183a37'],
    accentColor: '#20fc8e',
    diffs: [
      { id: 1, x: 20, y: 75, radius: 7, hint: 'Examine the giant mushroom cap' },
      { id: 2, x: 52, y: 32, radius: 5, hint: 'Look near the glowing tree hollow' },
      { id: 3, x: 78, y: 65, radius: 6, hint: 'Check the magic fairy light orb' },
      { id: 4, x: 35, y: 22, radius: 5, hint: 'Spot the moon constellation in the canopy' },
      { id: 5, x: 85, y: 85, radius: 6, hint: 'Look at the crystal flowers near the pond' }
    ],
    render: (ctx, width, height, isModified) => {
      // Night Sky Forest Background
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, '#06101e');
      bg.addColorStop(0.5, '#0b253a');
      bg.addColorStop(1, '#051811');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Stars Canopy
      ctx.fillStyle = '#ffffff';
      const stars = [
        [0.1, 0.1], [0.3, 0.15], [0.5, 0.08], [0.7, 0.12], [0.9, 0.18],
        [0.2, 0.25], [0.8, 0.22]
      ];
      stars.forEach(([sx, sy]) => {
        ctx.beginPath();
        ctx.arc(sx * width, sy * height, 2, 0, Math.PI * 2);
        ctx.fill();
      });

      // DIFF 4: Constellation Star in Sky
      const constX = width * 0.35;
      const constY = height * 0.22;
      ctx.fillStyle = '#00ffff';
      ctx.beginPath();
      ctx.arc(constX, constY, isModified ? 6 : 2, 0, Math.PI * 2); // DIFF 4: Extra large star
      ctx.fill();
      if (isModified) {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(constX - 8, constY - 8, 16, 16);
      }

      // Ancient Glowing Tree Trunk
      const treeX = width * 0.5;
      ctx.fillStyle = '#1c140d';
      ctx.beginPath();
      ctx.moveTo(treeX - 40, height);
      ctx.lineTo(treeX - 30, height * 0.3);
      ctx.lineTo(treeX + 30, height * 0.3);
      ctx.lineTo(treeX + 50, height);
      ctx.fill();

      // Hollow Eye in Tree (DIFF 2)
      const hollowX = width * 0.52;
      const hollowY = height * 0.32;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(hollowX, hollowY, 15, 22, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isModified ? '#ffea00' : '#20fc8e'; // DIFF 2: Hollow glow color (Yellow vs Green)
      ctx.beginPath();
      ctx.arc(hollowX, hollowY, 8, 0, Math.PI * 2);
      ctx.fill();

      // Giant Mushroom (DIFF 1)
      const mushX = width * 0.2;
      const mushY = height * 0.75;
      
      // Stem
      ctx.fillStyle = '#e8d7c3';
      ctx.beginPath();
      ctx.rect(mushX - 10, mushY, 20, 40);
      ctx.fill();

      // Cap
      ctx.fillStyle = isModified ? '#9d4edd' : '#ff4d6d'; // DIFF 1: Purple cap vs Red cap
      ctx.beginPath();
      ctx.arc(mushX, mushY, 35, Math.PI, 0);
      ctx.fill();

      // Mushroom spots
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(mushX - 15, mushY - 15, 6, 0, Math.PI * 2);
      ctx.arc(mushX + 10, mushY - 20, 8, 0, Math.PI * 2);
      ctx.arc(mushX, mushY - 28, 5, 0, Math.PI * 2);
      ctx.fill();

      // Fairy Orb (DIFF 3)
      const orbX = width * 0.78;
      const orbY = height * 0.65;
      ctx.fillStyle = 'rgba(32, 252, 142, 0.4)';
      ctx.beginPath();
      ctx.arc(orbX, orbY, 22, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(orbX, orbY, 9, 0, Math.PI * 2);
      ctx.fill();

      // DIFF 3: Wings on Fairy Orb
      if (isModified) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.ellipse(orbX - 16, orbY - 10, 14, 6, -Math.PI / 4, 0, Math.PI * 2);
        ctx.ellipse(orbX + 16, orbY - 10, 14, 6, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Crystal Flowers at Bottom Right (DIFF 5)
      const flowerX = width * 0.85;
      const flowerY = height * 0.85;
      ctx.fillStyle = '#00b4d8';
      for (let i = 0; i < (isModified ? 6 : 4); i++) { // DIFF 5: 6 petals vs 4 petals
        const a = (i * Math.PI * 2) / (isModified ? 6 : 4);
        ctx.beginPath();
        ctx.arc(flowerX + Math.cos(a) * 15, flowerY + Math.sin(a) * 15, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffea00';
      ctx.beginPath();
      ctx.arc(flowerX, flowerY, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  {
    id: 'ocean_depths',
    title: 'Deep Ocean Coral Kingdom',
    category: 'Underwater',
    difficulty: 'Medium',
    totalDifferences: 5,
    bgGradient: ['#02111b', '#003554'],
    accentColor: '#00e5ff',
    diffs: [
      { id: 1, x: 30, y: 40, radius: 6, hint: 'Look at the yellow angelfish stripe' },
      { id: 2, x: 75, y: 25, radius: 5, hint: 'Check the rising bubbles trail' },
      { id: 3, x: 82, y: 78, radius: 6, hint: 'Examine the giant clam jewel' },
      { id: 4, x: 18, y: 82, radius: 6, hint: 'Look at the red sea starfish arms' },
      { id: 5, x: 50, y: 65, radius: 6, hint: 'Spot the sunken treasure chest lock' }
    ],
    render: (ctx, width, height, isModified) => {
      // Ocean Gradient
      const og = ctx.createLinearGradient(0, 0, 0, height);
      og.addColorStop(0, '#001829');
      og.addColorStop(0.6, '#003554');
      og.addColorStop(1, '#006494');
      ctx.fillStyle = og;
      ctx.fillRect(0, 0, width, height);

      // Light Rays from Surface
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.moveTo(width * 0.2, 0);
      ctx.lineTo(width * 0.4, height);
      ctx.lineTo(width * 0.1, height);
      ctx.fill();

      // Angelfish (DIFF 1)
      const fishX = width * 0.3;
      const fishY = height * 0.4;
      ctx.fillStyle = '#ffb703';
      ctx.beginPath();
      ctx.ellipse(fishX, fishY, 25, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      // Tail
      ctx.beginPath();
      ctx.moveTo(fishX + 22, fishY);
      ctx.lineTo(fishX + 38, fishY - 14);
      ctx.lineTo(fishX + 38, fishY + 14);
      ctx.fill();
      // Stripes
      ctx.fillStyle = isModified ? '#ff0055' : '#000000'; // DIFF 1: Pink stripe vs Black stripe
      ctx.fillRect(fishX - 10, fishY - 16, 6, 32);

      // Bubbles Trail (DIFF 2)
      const bubbleX = width * 0.75;
      const bubbles = [0.25, 0.35, 0.45, 0.55];
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      bubbles.forEach((by, idx) => {
        if (idx === 2 && isModified) return; // DIFF 2: Missing middle bubble in modified
        ctx.beginPath();
        ctx.arc(bubbleX + (idx % 2 === 0 ? 5 : -5), by * height, 6 - idx, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Coral Seabed
      ctx.fillStyle = '#051923';
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.quadraticCurveTo(width * 0.3, height * 0.75, width * 0.6, height * 0.85);
      ctx.quadraticCurveTo(width * 0.8, height * 0.8, width, height);
      ctx.fill();

      // Starfish (DIFF 4)
      const starX = width * 0.18;
      const starY = height * 0.82;
      ctx.fillStyle = '#e63946';
      const numPoints = isModified ? 6 : 5; // DIFF 4: 6-pointed vs 5-pointed starfish
      ctx.beginPath();
      for (let i = 0; i < numPoints * 2; i++) {
        const r = i % 2 === 0 ? 16 : 7;
        const a = (i * Math.PI) / numPoints;
        const x = starX + Math.cos(a) * r;
        const y = starY + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      // Giant Clam (DIFF 3)
      const clamX = width * 0.82;
      const clamY = height * 0.78;
      ctx.fillStyle = '#9d4edd';
      ctx.beginPath();
      ctx.arc(clamX, clamY, 25, Math.PI, 0);
      ctx.fill();

      // Pearl inside clam
      ctx.fillStyle = isModified ? '#ffea00' : '#ffffff'; // DIFF 3: Gold pearl vs White pearl
      ctx.beginPath();
      ctx.arc(clamX, clamY - 5, 9, 0, Math.PI * 2);
      ctx.fill();

      // Sunken Treasure Chest (DIFF 5)
      const chestX = width * 0.5;
      const chestY = height * 0.65;
      ctx.fillStyle = '#7f4f24';
      ctx.fillRect(chestX - 20, chestY - 12, 40, 24);
      ctx.fillStyle = '#ffb703';
      ctx.fillRect(chestX - 20, chestY - 12, 40, 4);

      // Lock on chest
      ctx.fillStyle = isModified ? '#00ffcc' : '#333333'; // DIFF 5: Cyan keyhole vs Dark keyhole
      ctx.beginPath();
      ctx.arc(chestX, chestY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  {
    id: 'cozy_bakery',
    title: 'Retro Cozy Bakery Shop',
    category: 'Cozy',
    difficulty: 'Hard',
    totalDifferences: 5,
    bgGradient: ['#3d2612', '#83522f'],
    accentColor: '#ffb703',
    diffs: [
      { id: 1, x: 28, y: 22, radius: 5, hint: 'Check the wall clock hands time' },
      { id: 2, x: 70, y: 45, radius: 6, hint: 'Look at the top tier cake toppings' },
      { id: 3, x: 40, y: 72, radius: 5, hint: 'Examine the coffee cup handle' },
      { id: 4, x: 88, y: 78, radius: 5, hint: 'Spot the croissant sprinkles on the tray' },
      { id: 5, x: 15, y: 55, radius: 6, hint: 'Check the hanging chalk sign illustration' }
    ],
    render: (ctx, width, height, isModified) => {
      // Warm Bakery Wall Background
      ctx.fillStyle = '#fefae0';
      ctx.fillRect(0, 0, width, height);

      // Wooden Shelf & Counter
      ctx.fillStyle = '#bc6c25';
      ctx.fillRect(0, height * 0.35, width, 12); // Shelf
      ctx.fillRect(0, height * 0.6, width, height * 0.4); // Counter

      // Wall Clock (DIFF 1)
      const clockX = width * 0.28;
      const clockY = height * 0.22;
      ctx.fillStyle = '#dda15e';
      ctx.beginPath();
      ctx.arc(clockX, clockY, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(clockX, clockY, 18, 0, Math.PI * 2);
      ctx.fill();

      // Clock Hands
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(clockX, clockY);
      ctx.lineTo(clockX, clockY - 12); // 12 o'clock hour hand
      ctx.moveTo(clockX, clockY);
      // DIFF 1: Minute hand points to 3 o'clock vs 6 o'clock
      if (isModified) {
        ctx.lineTo(clockX + 12, clockY); 
      } else {
        ctx.lineTo(clockX, clockY + 12);
      }
      ctx.stroke();

      // Multi-tier Cake on Counter (DIFF 2)
      const cakeX = width * 0.7;
      const cakeY = height * 0.45;
      // Bottom layer
      ctx.fillStyle = '#f4a261';
      ctx.fillRect(cakeX - 30, cakeY + 15, 60, 20);
      // Top layer
      ctx.fillStyle = '#e76f51';
      ctx.fillRect(cakeX - 20, cakeY - 5, 40, 20);

      // Cherry on top (DIFF 2)
      if (!isModified) {
        ctx.fillStyle = '#d62828';
        ctx.beginPath();
        ctx.arc(cakeX, cakeY - 12, 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Strawberry instead of Cherry!
        ctx.fillStyle = '#ff0055';
        ctx.beginPath();
        ctx.moveTo(cakeX, cakeY - 18);
        ctx.lineTo(cakeX - 7, cakeY - 6);
        ctx.lineTo(cakeX + 7, cakeY - 6);
        ctx.closePath();
        ctx.fill();
      }

      // Coffee Cup on Counter (DIFF 3)
      const cupX = width * 0.4;
      const cupY = height * 0.72;
      ctx.fillStyle = isModified ? '#2a9d8f' : '#e9c46a'; // DIFF 3: Teal mug vs Yellow mug
      ctx.beginPath();
      ctx.arc(cupX, cupY, 14, 0, Math.PI);
      ctx.fillRect(cupX - 14, cupY - 10, 28, 10);
      ctx.fill();

      // Cup handle
      ctx.strokeStyle = isModified ? '#2a9d8f' : '#e9c46a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cupX + 16, cupY - 2, 7, 0, Math.PI * 2);
      ctx.stroke();

      // Croissants Tray (DIFF 4)
      const trayX = width * 0.88;
      const trayY = height * 0.78;
      ctx.fillStyle = '#dda15e';
      ctx.beginPath();
      ctx.ellipse(trayX, trayY, 20, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      if (isModified) {
        // Sprinkles on Croissant
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(trayX - 8, trayY - 4, 3, 3);
        ctx.fillRect(trayX + 4, trayY - 2, 3, 3);
        ctx.fillRect(trayX, trayY + 2, 3, 3);
      }

      // Hanging Chalkboard Sign (DIFF 5)
      const signX = width * 0.15;
      const signY = height * 0.55;
      ctx.fillStyle = '#264653';
      ctx.fillRect(signX - 25, signY - 20, 50, 40);
      ctx.strokeStyle = '#e9c46a';
      ctx.strokeRect(signX - 23, signY - 18, 46, 36);

      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(isModified ? 'SPECIAL' : 'FRESH', signX, signY - 2);
      ctx.fillText(isModified ? '$ 3.99' : '$ 2.99', signX, signY + 12);
    }
  }
];
