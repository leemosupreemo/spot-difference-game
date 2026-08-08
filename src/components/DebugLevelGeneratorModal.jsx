import React, { useState } from 'react';
import { Terminal, Cpu, Play, Download, X, Sparkles, CheckCircle2, Sliders, Layers } from 'lucide-react';
import { SCENE_THEMES, generateProceduralLevelPair } from '../utils/proceduralGenerator';
import { sounds } from '../utils/audio';

export default function DebugLevelGeneratorModal({ isOpen, onClose, onInjectLevels }) {
  const [themeId, setThemeId] = useState('find_the_sniper');
  const [difficulty, setDifficulty] = useState('Medium');
  const [count, setCount] = useState(10);
  const [generatedPack, setGeneratedPack] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = () => {
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
    a.download = `level_pack_${themeId}_${difficulty.toLowerCase()}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 6, 12, 0.85)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '750px',
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
                🛠️ DEBUG LEVEL BUILDER PIPELINE
              </h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--accent-gold)', fontWeight: 600 }}>
                Developer CLI & In-App Procedural Generator Tool
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

        {/* Form Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          
          {/* Theme */}
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

          {/* Difficulty */}
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
              <option value="Easy">Easy (Larger Target)</option>
              <option value="Medium">Medium (Standard)</option>
              <option value="Hard">Hard (Micro Sniper Target)</option>
            </select>
          </div>

          {/* Batch Count */}
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

        {/* Generate Button */}
        <button
          className="glass-btn glass-btn-primary"
          onClick={handleGenerate}
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

        {/* Generated Levels List Preview */}
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
