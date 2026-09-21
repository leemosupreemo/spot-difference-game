import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read credentials from mcp_config.json or environment
let serviceAccount = process.env.MIXPANEL_SERVICE_ACCOUNT;
let serviceSecret = process.env.MIXPANEL_SERVICE_SECRET || process.env.MIXPANEL_SERVICE_ACCOUNT_SECRET;
let projectId = process.env.MIXPANEL_PROJECT_ID;

if (!serviceAccount || !serviceSecret || !projectId) {
  try {
    const configPath = path.join(process.env.HOME || '', '.gemini', 'config', 'mcp_config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const env = config?.mcpServers?.mixpanel?.env || {};
      serviceAccount = serviceAccount || env.MIXPANEL_SERVICE_ACCOUNT;
      serviceSecret = serviceSecret || env.MIXPANEL_SERVICE_SECRET || env.MIXPANEL_SERVICE_ACCOUNT_SECRET;
      projectId = projectId || env.MIXPANEL_PROJECT_ID;
    }
  } catch (_) {}
}

if (!serviceAccount || !serviceSecret || !projectId) {
  console.error("Missing Mixpanel credentials in environment or ~/.gemini/config/mcp_config.json");
  process.exit(1);
}

function runJQL(script) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${serviceAccount}:${serviceSecret}`).toString('base64');
    const postData = `script=${encodeURIComponent(script)}&project_id=${projectId}`;

    const req = https.request('https://mixpanel.com/api/2.0/jql', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 400) {
            return reject(new Error(`API Error ${res.statusCode}: ${data}`));
          }
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function fetchAllMetrics() {
  console.log('⚡ Querying Mixpanel for AARRR & Gameplay Performance metrics...');

  // 1. All event totals & platforms
  const eventTotalsScript = `
  function main() {
    return Events({ from_date: "2026-08-01", to_date: "2026-09-20" })
    .groupBy(["name", "properties.platform"], mixpanel.reducer.count());
  }
  `;

  // 2. Gameplay levels detailed difficulty
  const levelDifficultyScript = `
  function main() {
    return Events({
      from_date: "2026-08-01",
      to_date: "2026-09-20"
    })
    .filter(e => e.name === "Image Pair Completed" || e.name === "Image Pair Failed" || e.name === "Image Pair Abandoned")
    .groupBy(["properties.level_id"], function(accs, events) {
      var res = { wins: 0, losses: 0, abandoned: 0, times: [], misses: 0, setId: null };
      accs.forEach(a => {
        res.wins += a.wins;
        res.losses += a.losses;
        res.abandoned += a.abandoned;
        res.misses += a.misses;
        res.times = res.times.concat(a.times);
        if (a.setId) res.setId = a.setId;
      });
      events.forEach(e => {
        if (e.properties.set_id) res.setId = e.properties.set_id;
        if (e.name === "Image Pair Completed") {
          res.wins += 1;
          var t = e.properties.elapsed_time_sec || 0;
          res.times.push(t);
          res.misses += (e.properties.miss_count || 0);
        } else if (e.name === "Image Pair Failed") {
          res.losses += 1;
          res.misses += 3;
        } else if (e.name === "Image Pair Abandoned") {
          res.abandoned += 1;
          res.misses += (e.properties.miss_count || 0);
        }
      });
      return res;
    })
    .map(item => {
      var d = item.value;
      d.times.sort((a,b) => a - b);
      var median = d.times.length ? d.times[Math.floor(d.times.length / 2)] : 0;
      var totalPlays = d.wins + d.losses + d.abandoned;
      var failRate = totalPlays ? ((d.losses + d.abandoned) / totalPlays) : 0;
      var strikeRate = totalPlays ? (d.losses / totalPlays) : 0;
      
      var difficulty = "Medium";
      if (strikeRate > 0.15 || failRate > 0.25 || median > 20) {
        difficulty = "Hard";
      } else if (strikeRate < 0.04 && failRate < 0.08 && median <= 8) {
        difficulty = "Easy";
      }

      return {
        level_id: item.key[0] || "unknown",
        set_id: d.setId || "-",
        wins: d.wins,
        losses: d.losses,
        abandoned: d.abandoned,
        total_plays: totalPlays,
        strike_rate: Number((strikeRate * 100).toFixed(1)),
        fail_rate: Number((failRate * 100).toFixed(1)),
        median_sec: median,
        avg_misses: totalPlays ? Number((d.misses / totalPlays).toFixed(1)) : 0,
        suggested_difficulty: difficulty
      };
    });
  }
  `;

  // 3. Referral viral loop metrics
  const referralScript = `
  function main() {
    return Events({
      from_date: "2026-08-01",
      to_date: "2026-09-20"
    })
    .filter(e => [
      "Result Screen Viewed",
      "Challenge Share Clicked",
      "Challenge Share Completed",
      "Challenge Share Cancelled",
      "Challenge Received",
      "Challenge Match Completed"
    ].indexOf(e.name) !== -1)
    .groupBy(["name"], mixpanel.reducer.count());
  }
  `;

  const [eventTotals, levelStats, referralEvents] = await Promise.all([
    runJQL(eventTotalsScript),
    runJQL(levelDifficultyScript),
    runJQL(referralScript)
  ]);

  return { eventTotals, levelStats, referralEvents };
}

function buildHtmlDashboard({ eventTotals, levelStats, referralEvents }) {
  // Aggregate event counts
  const counts = {};
  const platformCounts = { ios: 0, web: 0, other: 0 };

  eventTotals.forEach(item => {
    const eventName = item.key[0];
    const platform = (item.key[1] || '').toLowerCase();
    counts[eventName] = (counts[eventName] || 0) + item.value;

    if (platform === 'ios') platformCounts.ios += item.value;
    else if (platform === 'web') platformCounts.web += item.value;
    else platformCounts.other += item.value;
  });

  const referralCounts = {};
  referralEvents.forEach(item => {
    referralCounts[item.key[0]] = item.value;
  });

  // Sort levels by plays
  levelStats.sort((a, b) => b.total_plays - a.total_plays);

  const easyCount = levelStats.filter(l => l.suggested_difficulty === 'Easy').length;
  const medCount = levelStats.filter(l => l.suggested_difficulty === 'Medium').length;
  const hardCount = levelStats.filter(l => l.suggested_difficulty === 'Hard').length;

  const firstLaunches = counts['First Launch'] || 0;
  const gamesStarted = counts['Game Started'] || 0;
  const imageWins = counts['Image Pair Completed'] || 0;
  const imageLosses = counts['Image Pair Failed'] || 0;
  const stagesCleared = counts['Stage Set Cleared'] || 0;
  const appOpens = counts['App Open'] || 0;
  const totalSessions = counts['Session End'] || 0;
  const resultViews = referralCounts['Result Screen Viewed'] || 0;
  const shareClicks = referralCounts['Challenge Share Clicked'] || 0;
  const shareCompletions = referralCounts['Challenge Share Completed'] || 0;

  const activationRate = firstLaunches > 0 ? ((gamesStarted / firstLaunches) * 100).toFixed(1) : '100';
  const shareConversionRate = resultViews > 0 ? ((shareCompletions / resultViews) * 100).toFixed(1) : '0';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DiffHunter — Executive & Gameplay Telemetry Dashboard</title>
  <style>
    :root {
      --bg-dark: #0a0915;
      --card-bg: rgba(22, 20, 42, 0.75);
      --card-border: rgba(255, 255, 255, 0.08);
      --accent-cyan: #00f0ff;
      --accent-pink: #ff007f;
      --accent-gold: #ffd700;
      --accent-green: #00ff88;
      --text-main: #f0f3f8;
      --text-muted: #8e9bb0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg-dark); color: var(--text-main); padding: 32px 24px; min-height: 100vh; }
    .container { max-width: 1280px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px; border-bottom: 1px solid var(--card-border); padding-bottom: 20px; }
    h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; background: linear-gradient(90deg, #fff, var(--accent-cyan)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .subtitle { color: var(--text-muted); font-size: 14px; margin-top: 4px; }
    .timestamp { font-size: 12px; color: var(--text-muted); background: rgba(255,255,255,0.05); padding: 6px 12px; border-radius: 20px; border: 1px solid var(--card-border); }
    
    .section-title { font-size: 18px; font-weight: 700; color: #fff; margin: 28px 0 16px 0; display: flex; align-items: center; gap: 8px; }
    .section-title::before { content: ""; display: inline-block; width: 4px; height: 16px; background: var(--accent-cyan); border-radius: 2px; }
    
    .grid-kpi { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 14px; padding: 20px; backdrop-filter: blur(12px); }
    .card-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted); margin-bottom: 8px; }
    .card-val { font-size: 32px; font-weight: 800; color: #fff; }
    .card-meta { font-size: 12px; color: var(--text-muted); margin-top: 6px; }

    .split-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 20px; margin-bottom: 24px; }
    
    .funnel-step { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; margin-bottom: 8px; background: rgba(255,255,255,0.02); border-radius: 8px; border-left: 3px solid var(--accent-cyan); }
    .funnel-step.step-pink { border-left-color: var(--accent-pink); }
    .funnel-step.step-gold { border-left-color: var(--accent-gold); }
    .funnel-step.step-green { border-left-color: var(--accent-green); }
    .funnel-name { font-size: 14px; font-weight: 500; }
    .funnel-count { font-size: 15px; font-weight: 700; }

    table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
    th { padding: 12px 14px; color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; border-bottom: 1px solid var(--card-border); }
    td { padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.03); }
    tr:hover td { background: rgba(255,255,255,0.02); }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .badge-easy { background: rgba(0,255,136,0.15); color: var(--accent-green); border: 1px solid rgba(0,255,136,0.3); }
    .badge-medium { background: rgba(255,215,0,0.15); color: var(--accent-gold); border: 1px solid rgba(255,215,0,0.3); }
    .badge-hard { background: rgba(255,0,127,0.15); color: var(--accent-pink); border: 1px solid rgba(255,0,127,0.3); }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>DiffHunter Telemetry & AARRR Dashboard</h1>
        <div class="subtitle">Live Mixpanel Performance Analysis • Project ID: ${projectId}</div>
      </div>
      <div class="timestamp">Generated: ${new Date().toLocaleString()}</div>
    </header>

    <!-- Top KPI row -->
    <div class="grid-kpi">
      <div class="card">
        <div class="card-label">Acquisition (Installs)</div>
        <div class="card-val" style="color: var(--accent-cyan);">${firstLaunches.toLocaleString()}</div>
        <div class="card-meta">First Launches Recorded</div>
      </div>
      <div class="card">
        <div class="card-label">Activation Rate</div>
        <div class="card-val" style="color: var(--accent-green);">${activationRate}%</div>
        <div class="card-meta">${gamesStarted.toLocaleString()} Games Started</div>
      </div>
      <div class="card">
        <div class="card-label">Puzzles Solved</div>
        <div class="card-val" style="color: var(--accent-gold);">${imageWins.toLocaleString()}</div>
        <div class="card-meta">${imageLosses.toLocaleString()} Strikes (${((imageLosses / (imageWins + imageLosses || 1)) * 100).toFixed(1)}% Loss Rate)</div>
      </div>
      <div class="card">
        <div class="card-label">Stages Cleared</div>
        <div class="card-val" style="color: #fff;">${stagesCleared.toLocaleString()}</div>
        <div class="card-meta">Full 5-image set clearances</div>
      </div>
      <div class="card">
        <div class="card-label">Referral Shares</div>
        <div class="card-val" style="color: var(--accent-pink);">${shareCompletions.toLocaleString()}</div>
        <div class="card-meta">${shareConversionRate}% of Results Shared</div>
      </div>
    </div>

    <!-- Funnels & Segments -->
    <div class="split-grid">
      <!-- AARRR Funnel Breakdown -->
      <div class="card">
        <div class="card-label" style="margin-bottom: 16px;">AARRR Pirate Funnel Overview</div>
        
        <div class="funnel-step">
          <div>
            <div class="funnel-name">1. Acquisition — First Launch</div>
            <div style="font-size: 11px; color: var(--text-muted);">New players opening app</div>
          </div>
          <div class="funnel-count">${firstLaunches}</div>
        </div>

        <div class="funnel-step step-green">
          <div>
            <div class="funnel-name">2. Activation — Game Started</div>
            <div style="font-size: 11px; color: var(--text-muted);">Entered first game round</div>
          </div>
          <div class="funnel-count">${gamesStarted}</div>
        </div>

        <div class="funnel-step step-gold">
          <div>
            <div class="funnel-name">3. Retention — App Opens / Visits</div>
            <div style="font-size: 11px; color: var(--text-muted);">${totalSessions} completed sessions</div>
          </div>
          <div class="funnel-count">${appOpens}</div>
        </div>

        <div class="funnel-step step-pink">
          <div>
            <div class="funnel-name">4. Referral — Challenge Shares</div>
            <div style="font-size: 11px; color: var(--text-muted);">${resultViews} result screens viewed</div>
          </div>
          <div class="funnel-count">${shareCompletions} (${shareConversionRate}%)</div>
        </div>

        <div class="funnel-step">
          <div>
            <div class="funnel-name">5. Reviews / Value — Rating Prompt</div>
            <div style="font-size: 11px; color: var(--text-muted);">${counts['Rating Prompt Shown'] || 0} prompted</div>
          </div>
          <div class="funnel-count">${counts['Rating Prompt Action'] || 0} reviews</div>
        </div>
      </div>

      <!-- Difficulty Distribution Summary -->
      <div class="card">
        <div class="card-label" style="margin-bottom: 16px;">Empirical Image Difficulty Breakdown</div>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">
          Categorized dynamically based on player completion times and 3-strike failure rates.
        </p>

        <div style="display: flex; gap: 12px; margin-bottom: 20px;">
          <div style="flex: 1; padding: 14px; background: rgba(0,255,136,0.06); border: 1px solid rgba(0,255,136,0.2); border-radius: 10px; text-align: center;">
            <div style="font-size: 24px; font-weight: 800; color: var(--accent-green);">${easyCount}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px; font-weight: 600;">EASY LEVELS</div>
          </div>
          <div style="flex: 1; padding: 14px; background: rgba(255,215,0,0.06); border: 1px solid rgba(255,215,0,0.2); border-radius: 10px; text-align: center;">
            <div style="font-size: 24px; font-weight: 800; color: var(--accent-gold);">${medCount}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px; font-weight: 600;">MEDIUM LEVELS</div>
          </div>
          <div style="flex: 1; padding: 14px; background: rgba(255,0,127,0.06); border: 1px solid rgba(255,0,127,0.2); border-radius: 10px; text-align: center;">
            <div style="font-size: 24px; font-weight: 800; color: var(--accent-pink);">${hardCount}</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px; font-weight: 600;">HARD LEVELS</div>
          </div>
        </div>

        <div class="card-label" style="margin-bottom: 8px;">Criteria Thresholds Applied:</div>
        <ul style="font-size: 12px; color: var(--text-muted); line-height: 1.8; padding-left: 18px;">
          <li><b>Easy:</b> Loss rate &lt; 8%, Median solve time &le; 8s.</li>
          <li><b>Medium:</b> Loss rate 8% – 25%, Median solve time 9s – 20s.</li>
          <li><b>Hard:</b> Loss rate &gt; 25% or 3-strike rate &gt; 15% or Median solve time &gt; 20s.</li>
        </ul>
      </div>
    </div>

    <!-- Detailed Level Breakdown Table -->
    <div class="section-title">Gameplay Performance & Difficulty Analysis by Level</div>
    <div class="card" style="overflow-x: auto; padding: 0;">
      <table>
        <thead>
          <tr>
            <th>Level ID</th>
            <th>Set ID</th>
            <th style="text-align: right;">Total Plays</th>
            <th style="text-align: right;">Wins</th>
            <th style="text-align: right;">3 Strikes</th>
            <th style="text-align: right;">Failure Rate</th>
            <th style="text-align: right;">Median Time</th>
            <th style="text-align: right;">Avg Misses</th>
            <th style="text-align: center;">Categorization</th>
          </tr>
        </thead>
        <tbody>
          ${levelStats.map(l => `
            <tr>
              <td class="mono" style="color: #fff; font-weight: 600;">${l.level_id}</td>
              <td class="mono" style="color: var(--text-muted);">${l.set_id}</td>
              <td style="text-align: right; font-weight: 700;">${l.total_plays}</td>
              <td style="text-align: right; color: var(--accent-green);">${l.wins}</td>
              <td style="text-align: right; color: var(--accent-pink);">${l.losses}</td>
              <td style="text-align: right; font-weight: 700; color: ${l.fail_rate > 20 ? 'var(--accent-pink)' : (l.fail_rate > 5 ? 'var(--accent-gold)' : 'var(--text-main)')};">${l.fail_rate}%</td>
              <td style="text-align: right; font-weight: 600;">${l.median_sec}s</td>
              <td style="text-align: right; color: var(--text-muted);">${l.avg_misses}</td>
              <td style="text-align: center;">
                <span class="badge badge-${l.suggested_difficulty.toLowerCase()}">${l.suggested_difficulty}</span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}

async function main() {
  try {
    const metrics = await fetchAllMetrics();
    const html = buildHtmlDashboard(metrics);
    const outputPath = path.join(__dirname, '..', 'dashboard.html');
    fs.writeFileSync(outputPath, html, 'utf8');
    console.log(`✅ Dashboard generated successfully: ${outputPath}`);
  } catch (err) {
    console.error('Error generating dashboard:', err);
    process.exit(1);
  }
}

main();
