#!/usr/bin/env swift

import AppKit
import Foundation

let canvasWidth = 1448.0
let canvasHeight = 1086.0
let repoRoot = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)

struct HardSpec {
  let id: String
  let folder: String
  let title: String
  let category: String
  let pack: String
  let packId: String
  let scene: HardSceneKind
  let seed: UInt64
  let targetX: Double
  let targetY: Double
  let radius: Double
  let hint: String
}

enum HardSceneKind {
  case horologyGears
  case circuitSmd
  case botanicalPress
  case apothecaryHerbs
  case bookbindingTools
  case opticsBench
  case mosaicLabyrinth
  case topographyGrid
  case tapestryThreads
  case mechanicalPuzzle
}

final class RNG {
  private var state: UInt64

  init(_ seed: UInt64) {
    state = seed == 0 ? 1 : seed
  }

  func next() -> Double {
    state = state &* 2862933555777941757 &+ 3037000493
    return Double((state >> 11) & ((1 << 53) - 1)) / Double(1 << 53)
  }

  func range(_ min: Double, _ max: Double) -> Double {
    min + (max - min) * next()
  }

  func int(_ min: Int, _ max: Int) -> Int {
    min + Int(next() * Double(max - min + 1))
  }

  func chance(_ probability: Double) -> Bool {
    next() < probability
  }

  func choice<T>(_ items: [T]) -> T {
    items[int(0, items.count - 1)]
  }
}

func color(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat, _ a: CGFloat = 1) -> NSColor {
  NSColor(calibratedRed: r / 255, green: g / 255, blue: b / 255, alpha: a)
}

func rectTop(_ x: Double, _ y: Double, _ w: Double, _ h: Double) -> NSRect {
  NSRect(x: x, y: canvasHeight - y - h, width: w, height: h)
}

func pointTop(_ x: Double, _ y: Double) -> NSPoint {
  NSPoint(x: x, y: canvasHeight - y)
}

func fillRect(_ rect: NSRect, _ fill: NSColor) {
  fill.setFill()
  rect.fill()
}

func fillRounded(_ rect: NSRect, _ radius: Double, _ fill: NSColor) {
  fill.setFill()
  NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()
}

func strokeRounded(_ rect: NSRect, _ radius: Double, _ stroke: NSColor, _ lineWidth: Double = 2) {
  stroke.setStroke()
  let path = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
  path.lineWidth = lineWidth
  path.stroke()
}

func fillOval(_ rect: NSRect, _ fill: NSColor) {
  fill.setFill()
  NSBezierPath(ovalIn: rect).fill()
}

func drawLine(_ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double, _ stroke: NSColor, _ lineWidth: Double) {
  stroke.setStroke()
  let path = NSBezierPath()
  path.move(to: pointTop(x1, y1))
  path.line(to: pointTop(x2, y2))
  path.lineWidth = lineWidth
  path.lineCapStyle = .round
  path.stroke()
}

func polygon(_ points: [(Double, Double)], fill: NSColor, stroke: NSColor? = nil, lineWidth: Double = 1) {
  guard let first = points.first else { return }
  let path = NSBezierPath()
  path.move(to: pointTop(first.0, first.1))
  for point in points.dropFirst() {
    path.line(to: pointTop(point.0, point.1))
  }
  path.close()
  fill.setFill()
  path.fill()
  if let stroke = stroke {
    stroke.setStroke()
    path.lineWidth = lineWidth
    path.stroke()
  }
}

func rotatedRect(centerX: Double, centerY: Double, width: Double, height: Double, angle: Double, fill: NSColor, radius: Double = 3) {
  NSGraphicsContext.saveGraphicsState()
  let transform = NSAffineTransform()
  transform.translateX(by: centerX, yBy: canvasHeight - centerY)
  transform.rotate(byDegrees: angle)
  transform.concat()
  fillRounded(NSRect(x: -width / 2, y: -height / 2, width: width, height: height), radius, fill)
  NSGraphicsContext.restoreGraphicsState()
}

func drawShadow(_ blur: CGFloat = 6, _ alpha: CGFloat = 0.25, _ draw: () -> Void) {
  let shadow = NSShadow()
  shadow.shadowBlurRadius = blur
  shadow.shadowOffset = NSSize(width: 0, height: -2)
  shadow.shadowColor = NSColor.black.withAlphaComponent(alpha)
  NSGraphicsContext.saveGraphicsState()
  shadow.set()
  draw()
  NSGraphicsContext.restoreGraphicsState()
}

func drawNoise(_ rng: RNG, tint: NSColor, count: Int = 1800) {
  for _ in 0..<count {
    let size = rng.range(0.7, 2.2)
    fillOval(rectTop(rng.range(0, canvasWidth), rng.range(0, canvasHeight), size, size), tint.withAlphaComponent(rng.range(0.04, 0.12)))
  }
}

func avoidTarget(_ rng: RNG, targetX: Double, targetY: Double, minDistance: Double) -> (Double, Double) {
  for _ in 0..<20 {
    let x = rng.range(60, canvasWidth - 60)
    let y = rng.range(60, canvasHeight - 60)
    if hypot(x - targetX, y - targetY) > minDistance {
      return (x, y)
    }
  }
  return (rng.range(60, canvasWidth - 60), rng.range(60, canvasHeight - 60))
}

// Gear drawing helper
func drawGear(x: Double, y: Double, radius: Double, teeth: Int, fill: NSColor, toothFill: NSColor, innerCutout: Double) {
  drawShadow(4, 0.28) {
    fillOval(rectTop(x - radius, y - radius, radius * 2, radius * 2), fill)
    for i in 0..<teeth {
      let angle = Double(i) * (360.0 / Double(teeth))
      rotatedRect(centerX: x + cos(angle * .pi / 180) * radius, centerY: y + sin(angle * .pi / 180) * radius, width: radius * 0.22, height: radius * 0.18, angle: angle, fill: toothFill, radius: 1.5)
    }
    if innerCutout > 0 {
      fillOval(rectTop(x - innerCutout, y - innerCutout, innerCutout * 2, innerCutout * 2), fill.blended(withFraction: 0.45, of: .black) ?? fill)
      fillOval(rectTop(x - innerCutout * 0.4, y - innerCutout * 0.4, innerCutout * 0.8, innerCutout * 0.8), color(220, 180, 70, 0.95))
    }
  }
}

// Draw subtle target difference
func drawHardTarget(_ spec: HardSpec, variant: Bool) {
  let x = spec.targetX / 100 * canvasWidth
  let y = spec.targetY / 100 * canvasHeight

  switch spec.scene {
  case .horologyGears:
    // Ruby jewel balance pivot - subtle hue drift between deep ruby and pink tourmaline
    let jewelColor = variant ? color(228, 55, 115, 0.98) : color(185, 30, 60, 0.98)
    drawShadow(3, 0.3) {
      fillOval(rectTop(x - 14, y - 14, 28, 28), color(205, 170, 80, 0.95))
      fillOval(rectTop(x - 9, y - 9, 18, 18), jewelColor)
      fillOval(rectTop(x - 4, y - 4, 8, 8), color(255, 230, 240, 0.85))
    }

  case .circuitSmd:
    // SMD resistor micro band shift (102 vs 103 code marking / subtle stripe shift)
    let bodyColor = color(38, 40, 44, 0.98)
    let bandColor = variant ? color(195, 145, 45, 0.95) : color(80, 140, 195, 0.95)
    drawShadow(3, 0.35) {
      fillRounded(rectTop(x - 18, y - 10, 36, 20), 2, bodyColor)
      fillRounded(rectTop(x - 18, y - 10, 6, 20), 1, color(190, 195, 200, 0.95))
      fillRounded(rectTop(x + 12, y - 10, 6, 20), 1, color(190, 195, 200, 0.95))
      drawLine(x - 4, y - 7, x - 4, y + 7, bandColor, 3)
      drawLine(x + 3, y - 7, x + 3, y + 7, color(230, 230, 230, 0.85), 2.5)
    }

  case .botanicalPress:
    // Stamen dried pollen capsule detail - subtle angle and presence
    let stemColor = color(95, 75, 48, 0.95)
    let antherColor = variant ? color(198, 160, 68, 0.96) : color(145, 110, 52, 0.96)
    drawLine(x - 12, y + 14, x + 8, y - 10, stemColor, 2.5)
    rotatedRect(centerX: x + 8, centerY: y - 10, width: 14, height: 8, angle: variant ? 40 : -15, fill: antherColor, radius: 3)

  case .apothecaryHerbs:
    // Star anise / herb seed pod facet
    let podColor = variant ? color(155, 88, 42, 0.98) : color(108, 62, 32, 0.98)
    polygon([
      (x - 14, y - 12), (x + 12, y - 16), (x + 16, y + 10), (x - 6, y + 15)
    ], fill: podColor, stroke: color(60, 32, 18, 0.7), lineWidth: 1.5)
    fillOval(rectTop(x - 3, y - 3, 6, 6), color(215, 175, 95, 0.9))

  case .bookbindingTools:
    // Linen binding stitch notch
    let stitchColor = variant ? color(225, 205, 160, 0.95) : color(175, 145, 105, 0.95)
    let notchAngle = variant ? 45.0 : -45.0
    rotatedRect(centerX: x, centerY: y, width: 22, height: 6, angle: notchAngle, fill: stitchColor, radius: 2)

  case .opticsBench:
    // Lens barrel calibration index notch
    let barrelColor = color(45, 48, 52, 0.98)
    let tickColor = variant ? color(240, 110, 50, 0.98) : color(240, 210, 60, 0.98)
    drawShadow(3, 0.3) {
      fillRounded(rectTop(x - 20, y - 14, 40, 28), 3, barrelColor)
      drawLine(x, y - 10, x, y + 10, tickColor, 3)
      drawLine(x - 10, y - 6, x - 10, y + 6, color(200, 200, 200, 0.8), 1.5)
      drawLine(x + 10, y - 6, x + 10, y + 6, color(200, 200, 200, 0.8), 1.5)
    }

  case .mosaicLabyrinth:
    // Mosaic stone tessera micro color harmonic
    let tileColor = variant ? color(215, 138, 72, 0.98) : color(182, 94, 62, 0.98)
    polygon([
      (x - 12, y - 11), (x + 13, y - 9), (x + 11, y + 12), (x - 10, y + 13)
    ], fill: tileColor, stroke: color(40, 24, 20, 0.55), lineWidth: 1.5)

  case .topographyGrid:
    // Contour elevation hash mark
    let lineColor = variant ? color(178, 142, 85, 0.98) : color(135, 102, 60, 0.98)
    drawLine(x - 18, y + (variant ? -4 : 4), x + 18, y + (variant ? 4 : -4), lineColor, 2.5)
    fillOval(rectTop(x - 3, y - 3, 6, 6), lineColor)

  case .tapestryThreads:
    // Warp/weft thread intersection
    let threadColor = variant ? color(198, 78, 92, 0.95) : color(148, 52, 70, 0.95)
    drawLine(x - 12, y - 12, x + 12, y + 12, threadColor, 3)
    drawLine(x - 12, y + 12, x + 12, y - 12, color(215, 185, 120, 0.9), 2)

  case .mechanicalPuzzle:
    // Puzzle maze tooth notch
    let toothFill = variant ? color(210, 165, 75, 0.98) : color(165, 125, 55, 0.98)
    rotatedRect(centerX: x, centerY: y, width: 16, height: 10, angle: variant ? 90 : 0, fill: toothFill, radius: 2)
  }
}

// Scene Drawing Renderers with dense clutter
func drawHorologyGearsScene(_ rng: RNG, spec: HardSpec, variant: Bool) {
  // Dark brass/steel watchmaker bench
  fillRect(NSRect(x: 0, y: 0, width: canvasWidth, height: canvasHeight), color(35, 34, 32))
  let brassColors = [color(195, 155, 75), color(218, 182, 92), color(165, 130, 58), color(175, 180, 185), color(130, 135, 140)]
  for _ in 0..<180 {
    let (gx, gy) = avoidTarget(rng, targetX: spec.targetX / 100 * canvasWidth, targetY: spec.targetY / 100 * canvasHeight, minDistance: 70)
    let radius = rng.range(22, 95)
    let teeth = rng.int(12, 38)
    let c = rng.choice(brassColors)
    drawGear(x: gx, y: gy, radius: radius, teeth: teeth, fill: c, toothFill: c.blended(withFraction: 0.15, of: .white) ?? c, innerCutout: radius * 0.38)
  }
  for _ in 0..<450 {
    let (sx, sy) = avoidTarget(rng, targetX: spec.targetX / 100 * canvasWidth, targetY: spec.targetY / 100 * canvasHeight, minDistance: 55)
    let size = rng.range(6, 16)
    fillOval(rectTop(sx - size / 2, sy - size / 2, size, size), rng.choice(brassColors))
    drawLine(sx - size * 0.3, sy, sx + size * 0.3, sy, color(20, 20, 20, 0.85), 1.5)
  }
  drawHardTarget(spec, variant: variant)
  drawNoise(rng, tint: color(240, 220, 170), count: 2500)
}

func drawCircuitSmdScene(_ rng: RNG, spec: HardSpec, variant: Bool) {
  // PCB Green substrate with copper traces
  fillRect(NSRect(x: 0, y: 0, width: canvasWidth, height: canvasHeight), color(24, 56, 38))
  // Traces
  for _ in 0..<320 {
    let x1 = rng.range(20, canvasWidth - 20)
    let y1 = rng.range(20, canvasHeight - 20)
    let x2 = x1 + rng.range(-150, 150)
    let y2 = y1 + rng.range(-150, 150)
    drawLine(x1, y1, x2, y2, color(185, 142, 60, 0.55), rng.range(1.5, 4.0))
    fillOval(rectTop(x1 - 3, y1 - 3, 6, 6), color(200, 160, 70, 0.8))
  }
  // SMD Components
  let compPalette = [color(32, 34, 38), color(45, 48, 54), color(175, 130, 75), color(185, 190, 195)]
  for _ in 0..<380 {
    let (cx, cy) = avoidTarget(rng, targetX: spec.targetX / 100 * canvasWidth, targetY: spec.targetY / 100 * canvasHeight, minDistance: 60)
    let w = rng.range(16, 48)
    let h = rng.range(10, 24)
    let ang = rng.choice([0.0, 90.0, 45.0, -45.0])
    rotatedRect(centerX: cx, centerY: cy, width: w, height: h, angle: ang, fill: rng.choice(compPalette), radius: 2)
  }
  drawHardTarget(spec, variant: variant)
  drawNoise(rng, tint: color(180, 230, 190), count: 2000)
}

func drawBotanicalPressScene(_ rng: RNG, spec: HardSpec, variant: Bool) {
  // Aged paper parchment
  fillRect(NSRect(x: 0, y: 0, width: canvasWidth, height: canvasHeight), color(235, 224, 202))
  let herbGreens = [color(88, 108, 68), color(118, 135, 85), color(142, 118, 72), color(102, 82, 54), color(65, 82, 50)]
  for _ in 0..<580 {
    let (lx, ly) = avoidTarget(rng, targetX: spec.targetX / 100 * canvasWidth, targetY: spec.targetY / 100 * canvasHeight, minDistance: 60)
    let w = rng.range(18, 75)
    let h = rng.range(8, 35)
    let ang = rng.range(-180, 180)
    rotatedRect(centerX: lx, centerY: ly, width: w, height: h, angle: ang, fill: rng.choice(herbGreens).withAlphaComponent(0.85), radius: h / 2)
    drawLine(lx - w * 0.35, ly, lx + w * 0.35, ly, color(50, 40, 25, 0.4), 1.2)
  }
  drawHardTarget(spec, variant: variant)
  drawNoise(rng, tint: color(160, 135, 95), count: 2200)
}

func drawApothecaryHerbsScene(_ rng: RNG, spec: HardSpec, variant: Bool) {
  // Wood curing table with spice clusters
  fillRect(NSRect(x: 0, y: 0, width: canvasWidth, height: canvasHeight), color(58, 44, 34))
  let spiceColors = [color(172, 84, 45), color(198, 142, 56), color(140, 95, 52), color(82, 58, 38), color(215, 175, 92)]
  for _ in 0..<950 {
    let (sx, sy) = avoidTarget(rng, targetX: spec.targetX / 100 * canvasWidth, targetY: spec.targetY / 100 * canvasHeight, minDistance: 55)
    let r = rng.range(5, 18)
    fillOval(rectTop(sx - r / 2, sy - r / 2, r, r), rng.choice(spiceColors).withAlphaComponent(0.92))
  }
  drawHardTarget(spec, variant: variant)
  drawNoise(rng, tint: color(240, 205, 150), count: 2000)
}

func drawBookbindingToolsScene(_ rng: RNG, spec: HardSpec, variant: Bool) {
  fillRect(NSRect(x: 0, y: 0, width: canvasWidth, height: canvasHeight), color(68, 55, 46))
  let toolColors = [color(195, 155, 85), color(142, 95, 58), color(185, 188, 192), color(98, 72, 52)]
  for _ in 0..<360 {
    let (tx, ty) = avoidTarget(rng, targetX: spec.targetX / 100 * canvasWidth, targetY: spec.targetY / 100 * canvasHeight, minDistance: 65)
    let w = rng.range(35, 110)
    let h = rng.range(8, 22)
    rotatedRect(centerX: tx, centerY: ty, width: w, height: h, angle: rng.range(-60, 60), fill: rng.choice(toolColors), radius: 4)
  }
  drawHardTarget(spec, variant: variant)
  drawNoise(rng, tint: color(230, 210, 175), count: 1800)
}

func drawOpticsBenchScene(_ rng: RNG, spec: HardSpec, variant: Bool) {
  fillRect(NSRect(x: 0, y: 0, width: canvasWidth, height: canvasHeight), color(38, 42, 48))
  let opticsTints = [color(65, 120, 165), color(175, 125, 60), color(90, 150, 140), color(120, 95, 150), color(190, 195, 200)]
  for _ in 0..<310 {
    let (ox, oy) = avoidTarget(rng, targetX: spec.targetX / 100 * canvasWidth, targetY: spec.targetY / 100 * canvasHeight, minDistance: 65)
    let diam = rng.range(28, 85)
    fillOval(rectTop(ox - diam / 2, oy - diam / 2, diam, diam), rng.choice(opticsTints).withAlphaComponent(0.78))
    strokeRounded(rectTop(ox - diam / 2, oy - diam / 2, diam, diam), diam / 2, color(255, 255, 255, 0.4), 2)
  }
  drawHardTarget(spec, variant: variant)
  drawNoise(rng, tint: color(200, 220, 255), count: 2000)
}

func drawMosaicLabyrinthScene(_ rng: RNG, spec: HardSpec, variant: Bool) {
  fillRect(NSRect(x: 0, y: 0, width: canvasWidth, height: canvasHeight), color(34, 45, 52))
  let tesseraColors = [color(185, 95, 62), color(215, 152, 75), color(56, 122, 138), color(225, 208, 168), color(92, 138, 105), color(138, 72, 88)]
  let tile = 38.0
  for row in 0..<30 {
    for col in 0..<40 {
      let tx = Double(col) * tile - 15 + rng.range(-2, 2)
      let ty = Double(row) * 37 - 15 + rng.range(-2, 2)
      if hypot(tx - (spec.targetX / 100 * canvasWidth), ty - (spec.targetY / 100 * canvasHeight)) > 45 {
        let c = tesseraColors[(row * 3 + col * 7 + rng.int(0, 2)) % tesseraColors.count]
        polygon([(tx + 3, ty + 3), (tx + 34, ty + 2), (tx + 35, ty + 34), (tx + 4, ty + 35)], fill: c.withAlphaComponent(0.92), stroke: color(18, 24, 28, 0.4), lineWidth: 1)
      }
    }
  }
  drawHardTarget(spec, variant: variant)
  drawNoise(rng, tint: color(240, 225, 195), count: 2400)
}

func drawTopographyGridScene(_ rng: RNG, spec: HardSpec, variant: Bool) {
  fillRect(NSRect(x: 0, y: 0, width: canvasWidth, height: canvasHeight), color(228, 218, 198))
  let topoLines = [color(145, 115, 78), color(172, 138, 92), color(118, 92, 60), color(92, 125, 108)]
  for i in 0..<110 {
    let y = Double(i) * 10.0 + rng.range(-4, 4)
    var pts: [(Double, Double)] = []
    for xStep in stride(from: 0.0, through: canvasWidth, by: 45.0) {
      let wave = sin(xStep * 0.015 + Double(i) * 0.4) * 18.0 + cos(xStep * 0.03) * 9.0
      pts.append((xStep, y + wave))
    }
    for pIdx in 0..<(pts.count - 1) {
      drawLine(pts[pIdx].0, pts[pIdx].1, pts[pIdx + 1].0, pts[pIdx + 1].1, rng.choice(topoLines).withAlphaComponent(0.65), 1.5)
    }
  }
  drawHardTarget(spec, variant: variant)
  drawNoise(rng, tint: color(140, 115, 80), count: 2200)
}

func drawTapestryThreadsScene(_ rng: RNG, spec: HardSpec, variant: Bool) {
  fillRect(NSRect(x: 0, y: 0, width: canvasWidth, height: canvasHeight), color(52, 38, 46))
  let yarnColors = [color(178, 62, 78), color(208, 155, 68), color(58, 112, 132), color(225, 210, 175), color(82, 128, 95), color(125, 78, 138)]
  for _ in 0..<650 {
    let (yx, yy) = avoidTarget(rng, targetX: spec.targetX / 100 * canvasWidth, targetY: spec.targetY / 100 * canvasHeight, minDistance: 60)
    let len = rng.range(35, 120)
    let ang = rng.choice([0.0, 90.0, 45.0, -45.0])
    drawLine(yx - cos(ang * .pi / 180) * len / 2, yy - sin(ang * .pi / 180) * len / 2, yx + cos(ang * .pi / 180) * len / 2, yy + sin(ang * .pi / 180) * len / 2, rng.choice(yarnColors).withAlphaComponent(0.85), rng.range(2.0, 4.5))
  }
  drawHardTarget(spec, variant: variant)
  drawNoise(rng, tint: color(245, 230, 200), count: 2200)
}

func drawMechanicalPuzzleScene(_ rng: RNG, spec: HardSpec, variant: Bool) {
  fillRect(NSRect(x: 0, y: 0, width: canvasWidth, height: canvasHeight), color(44, 46, 50))
  let brass = [color(195, 160, 80), color(218, 185, 95), color(155, 125, 60), color(175, 178, 182)]
  for _ in 0..<140 {
    let (px, py) = avoidTarget(rng, targetX: spec.targetX / 100 * canvasWidth, targetY: spec.targetY / 100 * canvasHeight, minDistance: 70)
    let r = rng.range(25, 80)
    drawGear(x: px, y: py, radius: r, teeth: rng.int(10, 24), fill: rng.choice(brass), toothFill: color(225, 195, 110), innerCutout: r * 0.3)
  }
  drawHardTarget(spec, variant: variant)
  drawNoise(rng, tint: color(220, 205, 160), count: 2200)
}

func renderHardImage(spec: HardSpec, variant: Bool) -> NSImage {
  let rng = RNG(spec.seed)
  let image = NSImage(size: NSSize(width: canvasWidth, height: canvasHeight))
  image.lockFocus()
  NSGraphicsContext.current?.imageInterpolation = .high

  switch spec.scene {
  case .horologyGears:
    drawHorologyGearsScene(rng, spec: spec, variant: variant)
  case .circuitSmd:
    drawCircuitSmdScene(rng, spec: spec, variant: variant)
  case .botanicalPress:
    drawBotanicalPressScene(rng, spec: spec, variant: variant)
  case .apothecaryHerbs:
    drawApothecaryHerbsScene(rng, spec: spec, variant: variant)
  case .bookbindingTools:
    drawBookbindingToolsScene(rng, spec: spec, variant: variant)
  case .opticsBench:
    drawOpticsBenchScene(rng, spec: spec, variant: variant)
  case .mosaicLabyrinth:
    drawMosaicLabyrinthScene(rng, spec: spec, variant: variant)
  case .topographyGrid:
    drawTopographyGridScene(rng, spec: spec, variant: variant)
  case .tapestryThreads:
    drawTapestryThreadsScene(rng, spec: spec, variant: variant)
  case .mechanicalPuzzle:
    drawMechanicalPuzzleScene(rng, spec: spec, variant: variant)
  }

  image.unlockFocus()
  return image
}

func savePNG(_ image: NSImage, to url: URL) throws {
  guard let tiff = image.tiffRepresentation,
        let rep = NSBitmapImageRep(data: tiff),
        let data = rep.representation(using: .png, properties: [.compressionFactor: 0.88]) else {
    throw NSError(domain: "HardPairExport", code: 1)
  }
  try data.write(to: url)
}

// ----------------------------------------------------
// GENERATE 30 ULTRA-HARD AUTHORED IMAGE PAIRS
// ----------------------------------------------------

let hardScenes: [(HardSceneKind, String, String, String, String, String)] = [
  (.horologyGears, "Precision Horology Escapement", "Horology Studio", "Find the Sniper", "find_the_sniper", "Inspect the tiny ruby jewel pivot near the gear cluster."),
  (.circuitSmd, "Electronics SMD Micro Junction", "Workshop Clutter", "Find the Sniper", "find_the_sniper", "Scan the microscopic resistor stripe on the circuit trace."),
  (.botanicalPress, "Herbarium Specimen Anther", "Botanical Garden", "Find the Sniper", "find_the_sniper", "Look closely at the dried pressed pollen stamen."),
  (.apothecaryHerbs, "Apothecary Seed Pod Cluster", "Botanical Garden", "Find the Sniper", "find_the_sniper", "Check the subtle seed pod facet in the spice cluster."),
  (.bookbindingTools, "Bookbinder Linen Binding Stitch", "Craft Studio", "Find the Sniper", "find_the_sniper", "Scan the small linen thread stitch notch."),
  (.opticsBench, "Analog Optics Barrel Index", "Optical Workshop", "Find the Sniper", "find_the_sniper", "Examine the calibration notch mark on the optical barrel."),
  (.mosaicLabyrinth, "Byzantine Tessera Micro Harmonic", "Pattern Clutter", "Abstract Animated", "abstract_animated", "Compare the stone tessera hue harmonic in the dense mosaic."),
  (.topographyGrid, "Cartographic Elevation Tick", "Illustrated Abstract", "Abstract Animated", "abstract_animated", "Scan the subtle elevation contour tick mark."),
  (.tapestryThreads, "Loom Tapestry Warp Intersection", "Pattern Clutter", "Abstract Animated", "abstract_animated", "Inspect the subtle thread cross-weave variation."),
  (.mechanicalPuzzle, "Cryptography Labyrinth Tooth", "Illustrated Abstract", "Abstract Animated", "abstract_animated", "Look for the shifted puzzle gear tooth index.")
]

var hardSpecs: [HardSpec] = []
let levelsPerScene = 3

for (sIdx, (sceneKind, baseTitle, cat, packName, packId, hintBase)) in hardScenes.enumerated() {
  for l in 1...levelsPerScene {
    let index = sIdx * levelsPerScene + l
    let id = "hard_authored_\(String(format: "%03d", index))"
    let seed = UInt64(880000 + index * 1013)
    let rng = RNG(seed)

    let targetX = Double(round(rng.range(22, 78) * 10) / 10)
    let targetY = Double(round(rng.range(22, 78) * 10) / 10)
    let radius = Double(round(rng.range(3.4, 4.2) * 10) / 10)

    let spec = HardSpec(
      id: id,
      folder: "hard-authored-sniper",
      title: "\(baseTitle) #\(l)",
      category: cat,
      pack: packName,
      packId: packId,
      scene: sceneKind,
      seed: seed,
      targetX: targetX,
      targetY: targetY,
      radius: radius,
      hint: hintBase
    )
    hardSpecs.append(spec)
  }
}

print("----------------------------------------------------")
print("🚀 GENERATING \(hardSpecs.count) ULTRA-HARD IMAGE PAIRS...")
print("----------------------------------------------------")

for (idx, spec) in hardSpecs.enumerated() {
  autoreleasepool {
    let dir = repoRoot
      .appendingPathComponent("public/levels/photo-pairs")
      .appendingPathComponent(spec.folder)
      .appendingPathComponent(spec.id)

    do {
      try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
      let baseImg = renderHardImage(spec: spec, variant: false)
      let varImg = renderHardImage(spec: spec, variant: true)
      try savePNG(baseImg, to: dir.appendingPathComponent("base.png"))
      try savePNG(varImg, to: dir.appendingPathComponent("variant.png"))
      print("  [✓] Generated \(idx + 1)/\(hardSpecs.count): \(spec.id) - \(spec.title)")
    } catch {
      print("  [ERROR] Failed to generate \(spec.id): \(error)")
    }
  }
}

// Update photo_pair_manifest.json
let manifestURL = repoRoot.appendingPathComponent("public/levels/photo_pair_manifest.json")
var manifestEntries: [[String: Any]] = []

if let existingData = try? Data(contentsOf: manifestURL),
   let parsed = try? JSONSerialization.jsonObject(with: existingData) as? [[String: Any]] {
  manifestEntries = parsed.filter { entry in
    guard let id = entry["id"] as? String else { return true }
    return !id.hasPrefix("hard_authored_")
  }
}

for spec in hardSpecs {
  let entry: [String: Any] = [
    "id": spec.id,
    "title": spec.title,
    "pack": spec.pack,
    "packId": spec.packId,
    "category": spec.category,
    "difficulty": "Hard",
    "baseImage": "/levels/photo-pairs/\(spec.folder)/\(spec.id)/base.png",
    "variantImage": "/levels/photo-pairs/\(spec.folder)/\(spec.id)/variant.png",
    "diffs": [
      [
        "id": 1,
        "x": spec.targetX,
        "y": spec.targetY,
        "radius": spec.radius,
        "hint": spec.hint
      ]
    ]
  ]
  manifestEntries.append(entry)
}

let updatedJson = try JSONSerialization.data(withJSONObject: manifestEntries, options: [.prettyPrinted, .sortedKeys])
try updatedJson.write(to: manifestURL)

print("----------------------------------------------------")
print("✅ SUCCESSFULLY GENERATED \(hardSpecs.count) ULTRA-HARD LEVELS!")
print("📁 Manifest updated: \(manifestURL.path)")
print("📊 Total manifest entries: \(manifestEntries.count)")
print("----------------------------------------------------")
