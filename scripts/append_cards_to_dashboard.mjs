import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serviceAccount = process.env.MIXPANEL_SERVICE_ACCOUNT;
let serviceSecret = process.env.MIXPANEL_SERVICE_SECRET || process.env.MIXPANEL_SERVICE_ACCOUNT_SECRET;
let projectId = process.env.MIXPANEL_PROJECT_ID ? parseInt(process.env.MIXPANEL_PROJECT_ID, 10) : 4058300;
let dashboardId = 11536857;

if (!serviceAccount || !serviceSecret) {
  try {
    const configPath = path.join(process.env.HOME || '', '.gemini', 'config', 'mcp_config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const env = config?.mcpServers?.mixpanel?.env || {};
      serviceAccount = serviceAccount || env.MIXPANEL_SERVICE_ACCOUNT;
      serviceSecret = serviceSecret || env.MIXPANEL_SERVICE_SECRET || env.MIXPANEL_SERVICE_ACCOUNT_SECRET;
      projectId = parseInt(env.MIXPANEL_PROJECT_ID || projectId, 10);
    }
  } catch (_) {}
}

const auth = Buffer.from(`${serviceAccount}:${serviceSecret}`).toString('base64');

function sendMCP(reqBody, sessionId) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Authorization': `Bearer Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    };
    if (sessionId) headers['mcp-session-id'] = sessionId;
    const req = https.request('https://mcp.mixpanel.com/mcp', {
      method: 'POST',
      headers
    }, res => {
      let data = '';
      const sid = res.headers['mcp-session-id'] || sessionId;
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data, sid }));
    });
    req.on('error', reject);
    req.write(JSON.stringify(reqBody));
    req.end();
  });
}

function parseSSE(raw) {
  const lines = raw.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try { return JSON.parse(line.slice(6)); } catch (_) {}
    }
  }
  try { return JSON.parse(raw); } catch (e) { return { raw }; }
}

async function callTool(sessionId, name, args) {
  const res = await sendMCP({
    jsonrpc: '2.0',
    id: Math.floor(Math.random() * 1000000),
    method: 'tools/call',
    params: { name, arguments: args }
  }, sessionId);

  const parsed = parseSSE(res.data);
  if (parsed.result?.isError) {
    throw new Error(`Tool ${name} failed: ${parsed.result?.content?.[0]?.text || JSON.stringify(parsed)}`);
  }
  return parsed.result;
}

async function main() {
  console.log(`Connecting to Mixpanel MCP for Project ${projectId}...`);
  const init = await sendMCP({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'diffhunter-card-updater', version: '1.0.0' }
    }
  });
  const sid = init.sid;
  await sendMCP({ jsonrpc: '2.0', method: 'notifications/initialized' }, sid);

  console.log("Generating queries for the 4 requested categories...");

  const queries = [
    {
      key: 'dropoff_no_action',
      report_type: 'funnels',
      report: {
        name: 'Drop-off - Launch to First Action',
        metrics: [
          { eventName: 'First Launch' },
          { eventName: 'Game Started' }
        ]
      }
    },
    {
      key: 'dropoff_no_return',
      report_type: 'funnels',
      report: {
        name: 'Drop-off - Never Returned',
        metrics: [
          { eventName: 'First Launch' },
          { eventName: 'App Open' }
        ]
      }
    },
    {
      key: 'mode_selection_ctr',
      report_type: 'funnels',
      report: {
        name: 'Mode Selection CTR',
        metrics: [
          { eventName: 'App Open' },
          { eventName: 'Category Selected' }
        ],
        breakdowns: [
          { metric: { type: 'property', propertyName: 'category_name' } }
        ]
      }
    },
    {
      key: 'mode_play_conversion',
      report_type: 'funnels',
      report: {
        name: 'Mode Gameplay Conversion',
        metrics: [
          { eventName: 'App Open' },
          { eventName: 'Game Started' }
        ],
        breakdowns: [
          { metric: { type: 'property', propertyName: 'category_name' } }
        ]
      }
    },
    {
      key: 'mode_selection_volume',
      report_type: 'insights',
      report: {
        name: 'Mode Selection Volume',
        chartType: 'bar',
        metrics: [
          { eventName: 'Category Selected', measurement: { type: 'basic', math: 'total' } }
        ],
        breakdowns: [
          { metric: { type: 'property', propertyName: 'category_name' } }
        ]
      }
    },
    {
      key: 'daily_challenge_funnel',
      report_type: 'funnels',
      report: {
        name: 'Daily Challenge CTR & Funnel',
        metrics: [
          { eventName: 'Daily Challenge Banner Impressed' },
          { eventName: 'Daily Challenge Clicked' },
          { eventName: 'Daily Challenge Started' },
          { eventName: 'Daily Challenge Completed' }
        ]
      }
    },
    {
      key: 'daily_completer_retention',
      report_type: 'retention',
      report: {
        name: 'Daily Challenge Completer Return Rate',
        metrics: [
          { eventName: 'Daily Challenge Completed' },
          { eventName: 'App Open' }
        ]
      }
    },
    {
      key: 'help_taps',
      report_type: 'insights',
      report: {
        name: 'Help Button Taps Over Time',
        chartType: 'bar',
        metrics: [
          { eventName: 'Help Button Tapped', measurement: { type: 'basic', math: 'total' } },
          { eventName: 'Help Button Tapped', measurement: { type: 'basic', math: 'unique' } }
        ],
        breakdowns: [
          { metric: { type: 'property', propertyName: 'source' } }
        ]
      }
    },
    {
      key: 'help_session_rate',
      report_type: 'funnels',
      report: {
        name: 'Help Engagement Session Rate',
        metrics: [
          { eventName: 'App Open' },
          { eventName: 'Help Button Tapped' }
        ]
      }
    }
  ];

  const qMap = {};
  for (const q of queries) {
    const res = await callTool(sid, 'Run-Query', {
      project_id: projectId,
      report_type: q.report_type,
      report: q.report
    });
    const qid = res.structuredContent?.result?.query_id || res.structuredContent?.query_id;
    qMap[q.key] = qid;
    console.log(`✓ ${q.report.name} => query_id: ${qid}`);
  }

  console.log(`\nAdding cards to Board ${dashboardId}...`);

  const rowsToAdd = [
    ['row-dropoff-hdr', 'add'],
    ['row-dropoff-cards', 'add'],
    ['row-mode-hdr', 'add'],
    ['row-mode-cards-1', 'add'],
    ['row-mode-cards-2', 'add'],
    ['row-daily-hdr', 'add'],
    ['row-daily-cards', 'add'],
    ['row-help-hdr', 'add'],
    ['row-help-cards', 'add']
  ];

  const cellsToAdd = [
    // 1. Drop-off Header
    [
      'cell-dropoff-hdr',
      'create',
      'text',
      {
        row_id: 'row-dropoff-hdr',
        type: 'text',
        html_content: '<h3>📉 Drop-off &amp; Inaction Analysis</h3><p>Measuring first-launch bounce (% who launch but take no action) and permanent churn (% who never return).</p>'
      }
    ],
    // 1. Drop-off Cards
    [
      'cell-dropoff-1',
      'create',
      'report',
      {
        row_id: 'row-dropoff-cards',
        type: 'report',
        query_id: qMap.dropoff_no_action,
        name: 'Drop-off: Launch to First Action',
        description: '% of new installs who start a game vs bounce immediately with zero action'
      }
    ],
    [
      'cell-dropoff-2',
      'create',
      'report',
      {
        row_id: 'row-dropoff-cards',
        type: 'report',
        query_id: qMap.dropoff_no_return,
        name: 'Drop-off: Never Returned / Churned',
        description: '% of first-time installers who never opened the app a second time'
      }
    ],

    // 2. Mode Header
    [
      'cell-mode-hdr',
      'create',
      'text',
      {
        row_id: 'row-mode-hdr',
        type: 'text',
        html_content: '<h3>📸 vs 🎨 Photography vs. Abstract CTR &amp; Preference</h3><p>Menu mode card click-through rates and game start conversion comparing Photo vs Abstract.</p>'
      }
    ],
    // 2. Mode Cards
    [
      'cell-mode-1',
      'create',
      'report',
      {
        row_id: 'row-mode-cards-1',
        type: 'report',
        query_id: qMap.mode_selection_ctr,
        name: 'Mode Selection CTR (Photo vs Abstract)',
        description: 'Conversion from app open to selecting Photography vs Abstract'
      }
    ],
    [
      'cell-mode-2',
      'create',
      'report',
      {
        row_id: 'row-mode-cards-1',
        type: 'report',
        query_id: qMap.mode_play_conversion,
        name: 'Mode Gameplay Conversion',
        description: 'Conversion from app open to actual game starts by category'
      }
    ],
    [
      'cell-mode-3',
      'create',
      'report',
      {
        row_id: 'row-mode-cards-2',
        type: 'report',
        query_id: qMap.mode_selection_volume,
        name: 'Mode Selection Volume (Photo vs Abstract)',
        description: 'Total category selections broken down by category'
      }
    ],

    // 3. Daily Challenge Header
    [
      'cell-daily-hdr',
      'create',
      'text',
      {
        row_id: 'row-daily-hdr',
        type: 'text',
        html_content: '<h3>📅 Daily Challenge CTR &amp; Retention</h3><p>Banner click-through rates and return retention of players who clear at least 1 daily challenge.</p>'
      }
    ],
    // 3. Daily Challenge Cards
    [
      'cell-daily-1',
      'create',
      'report',
      {
        row_id: 'row-daily-cards',
        type: 'report',
        query_id: qMap.daily_challenge_funnel,
        name: 'Daily Challenge Funnel & CTR',
        description: 'Banner Impressed -> Banner Clicked (CTR) -> Started -> Completed'
      }
    ],
    [
      'cell-daily-2',
      'create',
      'report',
      {
        row_id: 'row-daily-cards',
        type: 'report',
        query_id: qMap.daily_completer_retention,
        name: 'Daily Challenge Completer Return Rate',
        description: 'Day-over-day return retention of players who completed a daily challenge'
      }
    ],

    // 4. Help Header
    [
      'cell-help-hdr',
      'create',
      'text',
      {
        row_id: 'row-help-hdr',
        type: 'text',
        html_content: '<h3>❓ Help Button Tap Tracking</h3><p>Frequency of how-to-play checks and session help engagement rate.</p>'
      }
    ],
    // 4. Help Cards
    [
      'cell-help-1',
      'create',
      'report',
      {
        row_id: 'row-help-cards',
        type: 'report',
        query_id: qMap.help_taps,
        name: 'Help Button Taps (Total & Unique)',
        description: 'Total and unique players tapping the Help button across Header and Menu'
      }
    ],
    [
      'cell-help-2',
      'create',
      'report',
      {
        row_id: 'row-help-cards',
        type: 'report',
        query_id: qMap.help_session_rate,
        name: 'Help Engagement Session Rate',
        description: '% of app sessions that open the Help & How to Play modal'
      }
    ]
  ];

  const updateRes = await callTool(sid, 'Update-Dashboard', {
    project_id: projectId,
    dashboard_id: dashboardId,
    rows: rowsToAdd,
    cells: cellsToAdd
  });

  console.log(`\n🎉 Board ${dashboardId} updated successfully!`);

  const getDash = await callTool(sid, 'Get-Dashboard', {
    project_id: projectId,
    dashboard_id: dashboardId,
    include_layout: true
  });

  const layout = getDash.structuredContent?.layout || [];
  console.log(`\nTotal Rows on Board: ${layout.length}`);
  for (let i = 0; i < layout.length; i++) {
    const [rowId, cells] = layout[i];
    const cellSummary = cells.map(c => `${c[1]}: ${c[2]?.name || c[2]?.html_content?.slice(0, 35)}...`).join(' | ');
    console.log(`  Row ${i + 1} (${rowId}): ${cellSummary}`);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
