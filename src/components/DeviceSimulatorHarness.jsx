import React, { useState, useEffect, useMemo } from 'react';
import { 
  Smartphone, 
  Tablet, 
  RotateCw, 
  Maximize2, 
  Minimize2, 
  Sliders, 
  X, 
  Layers, 
  Monitor 
} from 'lucide-react';

const PRESET_DEVICES = [
  {
    id: 'full',
    name: 'Full Window',
    category: 'desktop',
    width: '100%',
    height: '100%',
    icon: Monitor,
    description: 'Native responsive browser window'
  },
  {
    id: 'iphone-se',
    name: 'iPhone SE / Mini',
    category: 'phone',
    landscapeWidth: 667,
    landscapeHeight: 375,
    pixelRatio: 2,
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
    icon: Smartphone,
    description: 'Smallest supported iPhone (375x667)'
  },
  {
    id: 'iphone-standard',
    name: 'iPhone 14 / 15 / 16',
    category: 'phone',
    landscapeWidth: 844,
    landscapeHeight: 390,
    pixelRatio: 3,
    safeArea: { top: 0, bottom: 21, left: 47, right: 47 },
    icon: Smartphone,
    description: 'Standard iPhone form factor (390x844)'
  },
  {
    id: 'iphone-max',
    name: 'iPhone Pro Max / Plus',
    category: 'phone',
    landscapeWidth: 932,
    landscapeHeight: 430,
    pixelRatio: 3,
    safeArea: { top: 0, bottom: 21, left: 59, right: 59 },
    icon: Smartphone,
    description: 'Large iPhone flagship (430x932)'
  },
  {
    id: 'ipad-11',
    name: 'iPad 11" / Air',
    category: 'tablet',
    landscapeWidth: 1180,
    landscapeHeight: 820,
    pixelRatio: 2,
    safeArea: { top: 24, bottom: 20, left: 0, right: 0 },
    icon: Tablet,
    description: 'Standard 10.9" - 11" iPad tablet (820x1180)'
  },
  {
    id: 'ipad-13',
    name: 'iPad Pro 13"',
    category: 'tablet',
    landscapeWidth: 1366,
    landscapeHeight: 1024,
    pixelRatio: 2,
    safeArea: { top: 24, bottom: 20, left: 0, right: 0 },
    icon: Tablet,
    description: 'Large 13" iPad Pro workstation (1024x1366)'
  }
];

export default function DeviceSimulatorHarness({ children }) {
  const isSimulatorFeatureEnabled = useMemo(() => {
    try {
      if (typeof window === 'undefined') return false;
      const params = new URLSearchParams(window.location.search);
      return params.has('sim') || params.has('simulator') || params.has('device') || params.get('debug') === '1' || localStorage.getItem('diff_hunter_sim_flag') === 'true';
    } catch (_) {
      return false;
    }
  }, []);

  const [selectedDeviceId, setSelectedDeviceId] = useState(() => {
    try {
      const urlParam = new URLSearchParams(window.location.search).get('device');
      if (urlParam) return urlParam;
      return localStorage.getItem('diff_hunter_sim_device') || 'full';
    } catch (_) {
      return 'full';
    }
  });

  const [orientation, setOrientation] = useState(() => {
    try {
      return localStorage.getItem('diff_hunter_sim_orientation') || 'landscape';
    } catch (_) {
      return 'landscape';
    }
  });

  const [showToolbar, setShowToolbar] = useState(true);
  const [zoomScale, setZoomScale] = useState('auto'); // 'auto' | 1 | 0.85 | 0.75

  const activeDevice = useMemo(() => {
    return PRESET_DEVICES.find(d => d.id === selectedDeviceId) || PRESET_DEVICES[0];
  }, [selectedDeviceId]);

  // Persist device selection
  useEffect(() => {
    try {
      localStorage.setItem('diff_hunter_sim_device', selectedDeviceId);
      localStorage.setItem('diff_hunter_sim_orientation', orientation);
    } catch (_) {}
  }, [selectedDeviceId, orientation]);

  const isSimulated = isSimulatorFeatureEnabled && activeDevice.id !== 'full';

  // If feature flag is off, return clean children with 0 overlays
  if (!isSimulatorFeatureEnabled) {
    return children;
  }

  // Calculate dimensions based on orientation
  const frameWidth = isSimulated
    ? (orientation === 'landscape' ? activeDevice.landscapeWidth : activeDevice.landscapeHeight)
    : '100%';

  const frameHeight = isSimulated
    ? (orientation === 'landscape' ? activeDevice.landscapeHeight : activeDevice.landscapeWidth)
    : '100%';

  // Auto calculate scale if window is smaller than device frame
  const [computedScale, setComputedScale] = useState(1);

  useEffect(() => {
    if (!isSimulated) {
      setComputedScale(1);
      return;
    }

    const calculateScale = () => {
      if (zoomScale !== 'auto') {
        setComputedScale(Number(zoomScale));
        return;
      }

      const availableWidth = window.innerWidth - 60;
      const availableHeight = window.innerHeight - (showToolbar ? 110 : 40);

      const scaleX = availableWidth / frameWidth;
      const scaleY = availableHeight / frameHeight;
      const autoScale = Math.min(1, Math.min(scaleX, scaleY));

      setComputedScale(Math.max(0.4, autoScale));
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, [isSimulated, frameWidth, frameHeight, zoomScale, showToolbar]);

  // If in native full screen mode with feature flag active, render children with floating toggle
  if (!isSimulated) {
    return (
      <div style={{ width: '100%', minHeight: '100vh', position: 'relative' }}>
        {children}

        {/* Floating Trigger Pill */}
        <button
          onClick={() => setSelectedDeviceId('iphone-standard')}
          className="glass-panel"
          style={{
            position: 'fixed',
            bottom: '16px',
            right: '16px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            background: 'rgba(18, 9, 36, 0.85)',
            border: '1px solid rgba(0, 240, 255, 0.4)',
            borderRadius: '30px',
            color: 'var(--accent-cyan)',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: 'pointer',
            boxShadow: '0 8px 32px rgba(0, 240, 255, 0.25)',
            transition: 'all 0.2s ease'
          }}
          title="Switch to Phone & Tablet Form Factor Testing"
        >
          <Smartphone size={16} />
          <span>Test Device Sizes</span>
        </button>
      </div>
    );
  }

  const simSafeLeft = activeDevice.category === 'phone'
    ? (orientation === 'landscape' ? (activeDevice.id === 'iphone-se' ? 28 : 52) : 0)
    : 24;

  const simSafeRight = activeDevice.category === 'phone'
    ? (orientation === 'landscape' ? (activeDevice.id === 'iphone-se' ? 28 : 52) : 0)
    : 24;

  const simSafeTop = activeDevice.category === 'phone'
    ? (orientation === 'portrait' ? 48 : 12)
    : 16;

  const simSafeBottom = activeDevice.category === 'phone'
    ? (orientation === 'portrait' ? 28 : 12)
    : 16;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#07040e',
        backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(255, 0, 127, 0.08) 0%, rgba(5, 2, 12, 0.98) 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        overflow: 'hidden',
        position: 'relative',
        userSelect: 'none'
      }}
    >
      {/* Top Device Switcher Toolbar */}
      {showToolbar ? (
        <header
          style={{
            width: '100%',
            background: 'rgba(12, 7, 24, 0.92)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            zIndex: 10000
          }}
        >
          {/* Left: Device Selector Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'rgba(255,255,255,0.5)', marginRight: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Device:
            </span>
            {PRESET_DEVICES.map(device => {
              const isSelected = selectedDeviceId === device.id;
              const Icon = device.icon;
              return (
                <button
                  key={device.id}
                  onClick={() => setSelectedDeviceId(device.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    background: isSelected ? 'linear-gradient(135deg, var(--accent-cyan), #0072ff)' : 'rgba(255, 255, 255, 0.06)',
                    color: isSelected ? '#000' : '#e0e0e0',
                    border: isSelected ? '1px solid #00f0ff' : '1px solid rgba(255, 255, 255, 0.1)',
                    fontWeight: isSelected ? 800 : 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Icon size={14} />
                  <span>{device.name}</span>
                </button>
              );
            })}
          </div>

          {/* Right: Controls (Orientation, Scale, Fullscreen toggle) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Active Resolution Badge */}
            <div
              style={{
                fontSize: '0.78rem',
                fontFamily: 'monospace',
                color: 'var(--accent-cyan)',
                background: 'rgba(0, 240, 255, 0.1)',
                border: '1px solid rgba(0, 240, 255, 0.25)',
                padding: '4px 10px',
                borderRadius: '8px',
                fontWeight: 700
              }}
            >
              {frameWidth} × {frameHeight} ({Math.round(computedScale * 100)}%)
            </div>

            {/* Rotate Button */}
            <button
              onClick={() => setOrientation(prev => prev === 'landscape' ? 'portrait' : 'landscape')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
              title="Toggle Landscape / Portrait"
            >
              <RotateCw size={14} />
              <span style={{ textTransform: 'capitalize' }}>{orientation}</span>
            </button>

            {/* Close / Full Window Button */}
            <button
              onClick={() => setSelectedDeviceId('full')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                background: 'rgba(255, 0, 85, 0.15)',
                border: '1px solid rgba(255, 0, 85, 0.35)',
                borderRadius: '10px',
                color: '#ff3366',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
              title="Exit Device Simulator"
            >
              <X size={14} />
              <span>Exit</span>
            </button>
          </div>
        </header>
      ) : (
        /* Minimized Toolbar Restore Pill */
        <button
          onClick={() => setShowToolbar(true)}
          style={{
            position: 'fixed',
            top: '12px',
            right: '12px',
            zIndex: 10000,
            padding: '6px 12px',
            borderRadius: '20px',
            background: 'rgba(12, 7, 24, 0.85)',
            border: '1px solid rgba(0, 240, 255, 0.4)',
            color: 'var(--accent-cyan)',
            fontWeight: 800,
            fontSize: '0.78rem',
            cursor: 'pointer'
          }}
        >
          Show Device Toolbar
        </button>
      )}

      {/* Simulator Staging Area */}
      <main
        style={{
          flex: 1,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: '20px'
        }}
      >
        {/* Device Outer Chassis / Bezel */}
        <div
          style={{
            width: `${frameWidth}px`,
            height: `${frameHeight}px`,
            transform: `scale(${computedScale})`,
            transformOrigin: 'center center',
            borderRadius: activeDevice.category === 'phone' ? '44px' : '28px',
            boxShadow: '0 25px 70px rgba(0, 0, 0, 0.85), 0 0 0 12px #1f1b2c, 0 0 0 14px rgba(255, 255, 255, 0.12)',
            background: '#090a10',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0
          }}
        >
          {/* Top Dynamic Island / Notch Mock */}
          {activeDevice.category === 'phone' && activeDevice.id !== 'iphone-se' && (
            <div
              style={{
                position: 'absolute',
                top: orientation === 'landscape' ? '50%' : '10px',
                left: orientation === 'landscape' ? '12px' : '50%',
                transform: orientation === 'landscape' ? 'translateY(-50%)' : 'translateX(-50%)',
                width: orientation === 'landscape' ? '10px' : '90px',
                height: orientation === 'landscape' ? '70px' : '22px',
                background: '#000',
                borderRadius: '20px',
                zIndex: 9999,
                pointerEvents: 'none'
              }}
            />
          )}

          {/* Device Screen Container with CSS Safe Area simulation */}
          <div
            style={{
              width: '100%',
              height: '100%',
              overflowY: 'auto',
              overflowX: 'hidden',
              position: 'relative',
              background: '#090a10',
              '--safe-left': `${simSafeLeft}px`,
              '--safe-right': `${simSafeRight}px`,
              '--safe-top': `${simSafeTop}px`,
              '--safe-bottom': `${simSafeBottom}px`
            }}
          >
            {children}
          </div>

          {/* Bottom Home Indicator Bar */}
          <div
            style={{
              position: 'absolute',
              bottom: orientation === 'landscape' ? '6px' : '8px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: orientation === 'landscape' ? '140px' : '120px',
              height: '4px',
              background: 'rgba(255, 255, 255, 0.35)',
              borderRadius: '2px',
              pointerEvents: 'none',
              zIndex: 9998
            }}
          />
        </div>
      </main>
    </div>
  );
}
