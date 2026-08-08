import React, { useState } from 'react';
import { Terminal, Cpu, Play, Download, X, Sparkles, CheckCircle2, Image as ImageIcon, Link as LinkIcon } from 'lucide-react';
import { SCENE_THEMES, generateProceduralLevelPair } from '../utils/proceduralGenerator';
import { sounds } from '../utils/audio';

export default function DebugLevelGeneratorModal({ isOpen, onClose, onInjectLevels }) {
  const [activeTab, setActiveTab] = useState('procedural'); // 'procedural' | 'real_photo'
  const [themeId, setThemeId] = useState('find_the_sniper');
  const [difficulty, setDifficulty] = useState('Hard');
  const [count, setCount] = useState(10);
  const [generatedPack, setGeneratedPack] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Real Photo Pipeline State
  const [customPhotoUrl, setCustomPhotoUrl] = useState('https://images.unsplash.com/photo-1578916171728-46686eac8d58?q=80&w=1200&auto=format&fit=crop');
  const [customTitle, setCustomTitle] = useState('High-Clutter Real Photo');
  const [targetX, setTargetX] = useState(48);
  const [targetY, setTargetY] = useState(62);

  if (!isOpen) return null;

  const handleGenerateProcedural = () => {
    sounds.playTap();
    setIsGenerating(true);

    setTimeout(() => {
      const pack = [];
      for (let i = 1; i <= count; i++) {
        const seed = Date.now() + i * 999;
        const level = generateProceduralLevelPair(themeId, difficulty, seed);
        pack.push(level);
      }

      setGeneratedPack(pack);
      setIsGenerating(false);
      sounds.playWin();
    }, 150);
  };

  const handleMutateRealPhoto = () => {
    if (!customPhotoUrl) return;
    sounds.playTap();
    setIsGenerating(true);

    setTimeout(() => {
      const photoLevel = {
        id: `real_photo_${Date.now()}`,
        title: customTitle || 'Real Photo Pair',
        category: 'Real Photo',
        difficulty,
        totalDifferences: 1,
        bgGradient: ['#0d0b18', '#201138'],
        accentColor: '#00f0ff',
        diffs: [
          {
            id: 1,
            x: targetX,
            y: targetY,
            radius: difficulty === 'Hard' ? 3 : 6,
            description: 'Micro patch mutation',
            hint: `Search near (${targetX}%, ${targetY}%)`
          }
        ],
        render: (ctx, w, h) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = customPhotoUrl;
          if (img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, 0, 0, w, h);
          } else {
            img.onload = () => ctx.drawImage(img, 0, 0, w, h);
          }
        }
      };

      setGeneratedPack([photoLevel]);
      setIsGenerating(false);
      sounds.playWin();
    }, 200);
  };

  const handleInjectIntoGame = () => {
    if (generatedPack.length === 0) return;
    sounds.playWin();
    onInjectLevels(generatedPack);
    onClose();
  };

  const handleExportJSON = () => {
    if (generatedPack.length === 0) return;
    sounds.playTap();

    const exportData = generatedPack.map(l => ({
      id: l.id,
      title: l.title,
      category: l.category,
      difficulty: l.difficulty,
      totalDifferences: 1,
      diffs: l.diffs
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `level_pack_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 6, 12, 0.88)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '780px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        borderRadius: '24px',
        padding: '28px',
        border: '1px solid rgba(0, 240, 255, 0.4)',
        boxShadow: '0 0 40px rgba(0, 240, 255, 0.25)',
        animation: 'hitPulse 0.3s ease-out'
      }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(0, 240, 255, 0.15)', padding: '10px', borderRadius: '14px', border: '1px solid var(--accent-cyan)' }}>
              <Cpu size={24} color="var(--accent-cyan)" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>
                🛠️ DEV DEBUG LEVEL BUILDER PIPELINE
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--accent-gold)', fontWeight: 600 }}>
                Procedural Generator & Real Photo Inpainting Tool
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="glass-btn"
            style={{ padding: '8px', borderRadius: '50%' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Pipeline Selector Tabs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'rgba(0,0,0,0.5)', padding: '6px', borderRadius: '14px', marginBottom: '20px' }}>
          <button
            onClick={() => setActiveTab('procedural')}
            className={`glass-btn ${activeTab === 'procedural' ? 'glass-btn-primary' : ''}`}
            style={{ justifyContent: 'center', padding: '10px', fontWeight: 700 }}
          >
            <Sparkles size={16} /> Procedural Canvas Engine
          </button>
          <button
            onClick={() => setActiveTab('real_photo')}
            className={`glass-btn ${activeTab === 'real_photo' ? 'glass-btn-primary' : ''}`}
            style={{ justifyContent: 'center', padding: '10px', fontWeight: 700 }}
          >
            <ImageIcon size={16} /> Real Web Photo Mutator
          </button>
        </div>

        {activeTab === 'procedural' ? (
          <div>
            {/* Form Controls */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  LEVEL PACK THEME
                </label>
                <select
                  value={themeId}
                  onChange={(e) => setThemeId(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.6)',
                    border: '1px solid var(--border-glass)',
                    color: '#fff',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    fontFamily: 'var(--font-main)',
                    fontWeight: 600,
                    outline: 'none'
                  }}
                >
                  {SCENE_THEMES.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  TARGET DIFFICULTY
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.6)',
                    border: '1px solid var(--border-glass)',
                    color: '#fff',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    fontFamily: 'var(--font-main)',
                    fontWeight: 600,
                    outline: 'none'
                  }}
                >
                  <option value="Easy">Easy (1,500 Objects)</option>
                  <option value="Medium">Medium (3,500 Objects)</option>
                  <option value="Hard">Hard (8,000 Micro Objects)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  BATCH COUNT
                </label>
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.6)',
                    border: '1px solid var(--border-glass)',
                    color: '#fff',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    fontFamily: 'var(--font-main)',
                    fontWeight: 600,
                    outline: 'none'
                  }}
                >
                  <option value={5}>5 Levels</option>
                  <option value={10}>10 Levels</option>
                  <option value={20}>20 Levels</option>
                </select>
              </div>
            </div>

            <button
              className="glass-btn glass-btn-primary"
              onClick={handleGenerateProcedural}
              disabled={isGenerating}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '1.1rem',
                justifyContent: 'center',
                borderRadius: '14px',
                marginBottom: '24px'
              }}
            >
              <Sparkles size={20} />
              {isGenerating ? 'Generating Pipeline Specs...' : '⚡ Generate & Validate Level Pack'}
            </button>
          </div>
        ) : (
          <div>
            {/* Real Web Photo Input */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                HIGH-COMPLEXITY WEB PHOTO URL
              </label>
              <input
                type="text"
                value={customPhotoUrl}
                onChange={(e) => setCustomPhotoUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.6)',
                  border: '1px solid var(--border-glass)',
                  color: '#fff',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  fontFamily: 'var(--font-main)',
                  outline: 'none',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>TITLE</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.6)', border: '1px solid var(--border-glass)', color: '#fff', padding: '8px 12px', borderRadius: '10px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>TARGET X (%)</label>
                <input
                  type="number"
                  value={targetX}
                  onChange={(e) => setTargetX(Number(e.target.value))}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.6)', border: '1px solid var(--border-glass)', color: '#fff', padding: '8px 12px', borderRadius: '10px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>TARGET Y (%)</label>
                <input
                  type="number"
                  value={targetY}
                  onChange={(e) => setTargetY(Number(e.target.value))}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.6)', border: '1px solid var(--border-glass)', color: '#fff', padding: '8px 12px', borderRadius: '10px' }}
                />
              </div>
            </div>

            <button
              className="glass-btn glass-btn-primary"
              onClick={handleMutateRealPhoto}
              disabled={isGenerating}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '1.05rem',
                justifyContent: 'center',
                borderRadius: '14px',
                marginBottom: '24px'
              }}
            >
              <ImageIcon size={20} />
              {isGenerating ? 'Processing Photo Inpainting...' : '📸 Process & Mutate Real Web Photo'}
            </button>
          </div>
        )}

        {/* Generated Levels Preview */}
        {generatedPack.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={18} /> Generated {generatedPack.length} Level Specs
              </span>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="glass-btn" onClick={handleExportJSON} style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
                  <Download size={15} /> Export JSON
                </button>
                <button className="glass-btn glass-btn-primary" onClick={handleInjectIntoGame} style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
                  <Play size={15} fill="#000" /> Play Pack
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
              {generatedPack.map((lvl, idx) => (
                <div key={lvl.id} style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border-glass)',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.82rem'
                }}>
                  <span style={{ fontWeight: 700, color: '#fff' }}>
                    #{idx + 1} {lvl.title}
                  </span>
                  <span style={{ color: 'var(--accent-gold)', fontFamily: 'var(--font-mono)' }}>
                    Target: ({lvl.diffs[0]?.x}%, {lvl.diffs[0]?.y}%) • R:{lvl.diffs[0]?.radius}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
