import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read credentials from mcp_config.json or environment
let serviceAccount = process.env.MIXPANEL_SERVICE_ACCOUNT;
let serviceSecret = process.env.MIXPANEL_SERVICE_SECRET || process.env.MIXPANEL_SERVICE_ACCOUNT_SECRET;
let projectId = process.env.MIXPANEL_PROJECT_ID ? parseInt(process.env.MIXPANEL_PROJECT_ID, 10) : 4058300;
let workspaceId = 4554660;

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

if (!serviceAccount || !serviceSecret) {
  console.error("Missing Mixpanel credentials in environment or ~/.gemini/config/mcp_config.json");
  process.exit(1);
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
      try {
        return JSON.parse(line.slice(6));
      } catch (_) {}
    }
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    return { raw };
  }
}

async function callTool(sessionId, name, args) {
  const res = await sendMCP({
    jsonrpc: '2.0',
    id: Math.floor(Math.random() * 1000000),
    method: 'tools/call',
    params: {
      name,
      arguments: args
    }
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
      clientInfo: { name: 'diffhunter-dashboard-builder', version: '1.0.0' }
    }
  });
  const sid = init.sid;
  await sendMCP({ jsonrpc: '2.0', method: 'notifications/initialized' }, sid);

  // Clean up previous temporary test board 11536855 if exists
  try {
    console.log("Cleaning up temporary test board 11536855...");
    await callTool(sid, 'Delete-Dashboard', { project_id: projectId, dashboard_id: 11536855 });
    console.log("Deleted old test board 11536855");
  } catch (err) {
    // ignore if doesn't exist
  }

  console.log("\n--- Step 1: Running Queries to Generate Report IDs ---");
  const queriesToRun = [
    {
      key: 'acquisition',
      report_type: 'insights',
      report: {
        name: 'Acquisition - First Launch by Platform',
        chartType: 'bar',
        metrics: [{ eventName: 'First Launch', measurement: { type: 'basic', math: 'total' } }],
        breakdowns: [{ metric: { type: 'property', propertyName: 'platform' } }]
      },
      cardName: 'Acquisition - First Launch by Platform',
      desc: 'Daily new user installs segmented by platform (Web, iOS, Android)'
    },
    {
      key: 'activation',
      report_type: 'funnels',
      report: {
        name: 'Activation - Onboarding Funnel',
        metrics: [
          { eventName: 'First Launch' },
          { eventName: 'Game Started' },
          { eventName: 'Image Pair Completed' },
          { eventName: 'Stage Set Cleared' }
        ]
      },
      cardName: 'Activation - Onboarding Funnel',
      desc: 'First Launch -> Game Started -> Image Pair Completed -> Stage Set Cleared'
    },
    {
      key: 'retention',
      report_type: 'retention',
      report: {
        name: 'Retention - User Return Rate',
        metrics: [
          { eventName: 'First Launch' },
          { eventName: '$mp_anything_event' }
        ]
      },
      cardName: 'Retention - User Return Rate',
      desc: 'Cohort retention from First Launch to subsequent return play'
    },
    {
      key: 'referral',
      report_type: 'funnels',
      report: {
        name: 'Referral - Viral Challenge Loop',
        metrics: [
          { eventName: 'Result Screen Viewed' },
          { eventName: 'Challenge Share Clicked' },
          { eventName: 'Challenge Share Completed' },
          { eventName: 'Challenge Received' },
          { eventName: 'Challenge Match Completed' }
        ]
      },
      cardName: 'Referral - Viral Challenge Loop',
      desc: 'Result Screen -> Share Clicked -> Share Sent -> Received -> Match Played'
    },
    {
      key: 'difficulty_time',
      report_type: 'insights',
      report: {
        name: 'Image Difficulty - Median Completion Time by Level',
        chartType: 'bar',
        metrics: [
          {
            eventName: 'Image Pair Completed',
            measurement: {
              type: 'aggregate-property',
              math: 'median',
              propertyName: 'elapsed_time_sec'
            }
          }
        ],
        breakdowns: [{ metric: { type: 'property', propertyName: 'level_id' } }]
      },
      cardName: 'Difficulty - Median Completion Time by Level',
      desc: 'Median elapsed seconds to clear all differences per image level ID'
    },
    {
      key: 'difficulty_fails',
      report_type: 'insights',
      report: {
        name: 'Image Difficulty - Level Failures & Dropouts',
        chartType: 'bar',
        metrics: [
          {
            eventName: 'Image Pair Failed',
            measurement: { type: 'basic', math: 'total' }
          }
        ],
        breakdowns: [{ metric: { type: 'property', propertyName: 'level_id' } }]
      },
      cardName: 'Difficulty - Total Failures by Level',
      desc: 'Total strikeouts / failed attempts recorded per image level ID'
    },
    {
      key: 'stage_balance',
      report_type: 'insights',
      report: {
        name: 'Stage Sets - Cleared vs Failed vs Abandoned',
        chartType: 'bar',
        metrics: [
          { eventName: 'Stage Set Cleared', measurement: { type: 'basic', math: 'total' } },
          { eventName: 'Stage Set Failed', measurement: { type: 'basic', math: 'total' } },
          { eventName: 'Stage Set Abandoned', measurement: { type: 'basic', math: 'total' } }
        ]
      },
      cardName: 'Stage Sets - Cleared vs Failed vs Abandoned',
      desc: 'Volume of completed 3-stage sets vs 3-strike total failures vs forfeits'
    }
  ];

  const queryMap = {};

  for (const q of queriesToRun) {
    const res = await callTool(sid, 'Run-Query', {
      project_id: projectId,
      report_type: q.report_type,
      report: q.report
    });
    const qid = res.structuredContent?.result?.query_id || res.structuredContent?.query_id;
    queryMap[q.key] = { qid, cardName: q.cardName, desc: q.desc };
    console.log(`✓ ${q.cardName} => query_id: ${qid}`);
  }

  console.log("\n--- Step 2: Creating Dashboard with Layout & Cards ---");
  const dashboardRows = [
    {
      contents: [
        {
          type: 'text',
          html_content: '<h2>🚀 DiffHunter Growth & Gameplay Telemetry</h2><p>Real-time AARRR Funnel & Empirical Level Difficulty Analysis</p>'
        }
      ]
    },
    {
      contents: [
        {
          type: 'report',
          query_id: queryMap.acquisition.qid,
          name: queryMap.acquisition.cardName,
          description: queryMap.acquisition.desc
        }
      ]
    },
    {
      contents: [
        {
          type: 'text',
          html_content: '<h3>⚡ Activation & Retention Funnels</h3><p>Conversion from app install to first game victory and cohort retention</p>'
        }
      ]
    },
    {
      contents: [
        {
          type: 'report',
          query_id: queryMap.activation.qid,
          name: queryMap.activation.cardName,
          description: queryMap.activation.desc
        },
        {
          type: 'report',
          query_id: queryMap.retention.qid,
          name: queryMap.retention.cardName,
          description: queryMap.retention.desc
        }
      ]
    },
    {
      contents: [
        {
          type: 'text',
          html_content: '<h3>🔄 Referral & Viral Challenge Loop</h3><p>Organic virality generated through social challenges</p>'
        }
      ]
    },
    {
      contents: [
        {
          type: 'report',
          query_id: queryMap.referral.qid,
          name: queryMap.referral.cardName,
          description: queryMap.referral.desc
        }
      ]
    },
    {
      contents: [
        {
          type: 'text',
          html_content: '<h3>🧩 Empirical Level Difficulty & Balancing Matrix</h3><p>Empirical metrics to dynamically categorize levels into Easy, Medium, and Hard</p>'
        }
      ]
    },
    {
      contents: [
        {
          type: 'report',
          query_id: queryMap.difficulty_time.qid,
          name: queryMap.difficulty_time.cardName,
          description: queryMap.difficulty_time.desc
        },
        {
          type: 'report',
          query_id: queryMap.difficulty_fails.qid,
          name: queryMap.difficulty_fails.cardName,
          description: queryMap.difficulty_fails.desc
        }
      ]
    },
    {
      contents: [
        {
          type: 'report',
          query_id: queryMap.stage_balance.qid,
          name: queryMap.stage_balance.cardName,
          description: queryMap.stage_balance.desc
        }
      ]
    }
  ];

  const dashRes = await callTool(sid, 'Create-Dashboard', {
    project_id: projectId,
    title: 'DiffHunter AARRR & Gameplay Funnels',
    description: 'AARRR Funnels (Acquisition, Activation, Retention, Referral) and Empirical Difficulty Analytics',
    is_private: false,
    is_restricted: false,
    workspace_id: workspaceId,
    rows: dashboardRows
  });

  const createdId = dashRes.structuredContent?.id;
  const createdUrl = dashRes.structuredContent?.url || `https://mixpanel.com/project/${projectId}/app/boards#id=${createdId}`;

  console.log(`\n🎉 Dashboard Created Successfully!`);
  console.log(`Dashboard ID: ${createdId}`);
  console.log(`Direct URL: ${createdUrl}`);

  console.log("\n--- Step 3: Verifying Dashboard Structure ---");
  const getDash = await callTool(sid, 'Get-Dashboard', {
    project_id: projectId,
    dashboard_id: createdId,
    include_layout: true
  });

  const layout = getDash.structuredContent?.layout || [];
  console.log(`Verified ${layout.length} rows created on board.`);
  for (let i = 0; i < layout.length; i++) {
    const [rowId, cells] = layout[i];
    const cellSummary = cells.map(c => `${c[1]}: ${c[2]?.name || c[2]?.html_content?.slice(0, 30)}...`).join(' | ');
    console.log(`  Row ${i + 1} (${rowId}): ${cellSummary}`);
  }

  console.log("\nMixpanel Dashboard setup complete!");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
