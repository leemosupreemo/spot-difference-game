import React, { useState, useRef } from 'react';
import { Upload, Plus, Trash2, Play, Sparkles, Image as ImageIcon } from 'lucide-react';
import { sounds } from '../utils/audio';

export default function CustomLevelMaker({ onSaveCustomLevel }) {
  const [title, setTitle] = useState('My Custom Photo Pair');
  const [imageSrc, setImageSrc] = useState(null);
  const [diffs, setDiffs] = useState([]);
  const canvasRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageSrc(event.target.result);
        sounds.playSuccess();
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCanvasClick = (e) => {
    if (!canvasRef.current || diffs.length >= 8) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

    const newDiff = {
      id: diffs.length + 1,
      x,
      y,
      radius: 6,
      hint: `Custom Difference #${diffs.length + 1}`
    };

    sounds.playTap();
    setDiffs(prev => [...prev, newDiff]);
  };

  const removeDiff = (id) => {
    sounds.playTap();
    setDiffs(prev => prev.filter(d => d.id !== id).map((d, idx) => ({ ...d, id: idx + 1 })));
  };

  const handleCreateLevel = () => {
    if (diffs.length === 0) {
      alert('Please click on the image to add at least 1 difference hotspot!');
      return;
    }

    const customLevel = {
      id: `custom_${Date.now()}`,
      title: title || 'Custom Pair',
      category: 'Custom',
      difficulty: 'Custom',
      totalDifferences: diffs.length,
      bgGradient: ['#10002b', '#240046'],
      accentColor: '#00f0ff',
      diffs,
      render: (ctx, width, height, isModified) => {
        if (imageSrc) {
          const img = new Image();
          img.src = imageSrc;
          ctx.drawImage(img, 0, 0, width, height);

          // Render subtle modifications on the modified canvas
          if (isModified) {
            diffs.forEach(d => {
              const px = (d.x / 100) * width;
              const py = (d.y / 100) * height;
              ctx.fillStyle = 'rgba(255, 0, 127, 0.7)';
              ctx.beginPath();
              ctx.arc(px, py, 12, 0, Math.PI * 2);
              ctx.fill();
            });
          }
        } else {
          // Default procedural background if no image uploaded
          ctx.fillStyle = isModified ? '#1a0933' : '#090a10';
          ctx.fillRect(0, 0, width, height);
          ctx.fillStyle = '#00f0ff';
          ctx.font = 'bold 20px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(title, width / 2, height / 2);
        }
      }
    };

    sounds.playWin();
    onSaveCustomLevel(customLevel);
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '20px auto', padding: '0 20px' }}>
      <div className="glass-panel" style={{ padding: '28px' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <Sparkles size={24} color="var(--accent-cyan)" />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>CUSTOM LEVEL MAKER</h2>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
          Upload your own photo to create a custom Spot the Difference pair! Click on the photo to drop target hotspot differences.
        </p>

        {/* Inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', color: 'var(--accent-cyan)' }}>
              LEVEL TITLE
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. My Cat Spot the Diff"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid var(--border-glass)',
                color: '#fff',
                fontFamily: 'var(--font-main)',
                fontSize: '0.95rem'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', color: 'var(--accent-gold)' }}>
              UPLOAD IMAGE
            </label>
            <label className="glass-btn" style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
              <Upload size={18} /> Choose File
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {/* Interactive Image Hotspot Canvas */}
        <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '2px dashed var(--border-glass)', marginBottom: '24px', background: '#000' }}>
          {imageSrc ? (
            <div
              ref={canvasRef}
              onClick={handleCanvasClick}
              style={{ position: 'relative', cursor: 'crosshair' }}
            >
              <img src={imageSrc} alt="Custom Level Preview" style={{ width: '100%', display: 'block', height: 'auto', maxHeight: '500px', objectFit: 'contain' }} />

              {/* Render Hotspots */}
              {diffs.map(d => (
                <div
                  key={d.id}
                  style={{
                    position: 'absolute',
                    left: `${d.x}%`,
                    top: `${d.y}%`,
                    transform: 'translate(-50%, -50%)',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(255, 0, 127, 0.4)',
                    border: '2px solid var(--accent-pink)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '12px',
                    boxShadow: '0 0 12px var(--accent-pink)'
                  }}
                >
                  {d.id}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <ImageIcon size={48} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
              <p style={{ color: 'var(--text-muted)' }}>Upload an image above to start clicking and setting differences!</p>
            </div>
          )}
        </div>

        {/* Hotspots Summary List */}
        {diffs.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px' }}>
              ADDED DIFFERENCES ({diffs.length} / 8)
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {diffs.map(d => (
                <div
                  key={d.id}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid var(--border-glass)',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.8rem'
                  }}
                >
                  <span>Diff #{d.id} ({d.x}%, {d.y}%)</span>
                  <Trash2 size={14} color="var(--accent-pink)" style={{ cursor: 'pointer' }} onClick={() => removeDiff(d.id)} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Launch Button */}
        <button
          className="glass-btn glass-btn-primary"
          onClick={handleCreateLevel}
          disabled={diffs.length === 0}
          style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '1rem', opacity: diffs.length === 0 ? 0.5 : 1 }}
        >
          <Play size={20} /> Launch Custom Pair & Start Timer!
        </button>

      </div>
    </div>
  );
}
