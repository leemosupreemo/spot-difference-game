#!/usr/bin/env swift

import AppKit
import Foundation

let canvasWidth = 1448.0
let canvasHeight = 1086.0
let repoRoot = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)

struct PairSpec {
  let id: String
  let folder: String
  let title: String
  let category: String
  let difficulty: String
  let scene: SceneKind
  let seed: UInt64
  let targetX: Double
  let targetY: Double
  let radius: Double
  let hint: String
}

enum SceneKind {
  case kitchen
  case buttonBox
  case seedTag
  case screwTray
  case leafTwig
  case gravelKey
  case camoPatch
  case rugPick
  case tilePiece
  case bookLabel
  case wireClip
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

func rotatedRect(centerX: Double, centerY: Double, width: Double, height: Double, angle: Double, fill: NSColor, radius: Double = 4) {
  NSGraphicsContext.saveGraphicsState()
  let transform = NSAffineTransform()
  transform.translateX(by: centerX, yBy: canvasHeight - centerY)
  transform.rotate(byDegrees: angle)
  transform.concat()
  fillRounded(NSRect(x: -width / 2, y: -height / 2, width: width, height: height), radius, fill)
  NSGraphicsContext.restoreGraphicsState()
}

func drawShadow(_ blur: CGFloat = 7, _ alpha: CGFloat = 0.22, _ draw: () -> Void) {
  let shadow = NSShadow()
  shadow.shadowBlurRadius = blur
  shadow.shadowOffset = NSSize(width: 0, height: -2)
  shadow.shadowColor = NSColor.black.withAlphaComponent(alpha)
  NSGraphicsContext.saveGraphicsState()
  shadow.set()
  draw()
  NSGraphicsContext.restoreGraphicsState()
}

func drawNoise(_ rng: RNG, tint: NSColor, count: Int = 1400) {
  for _ in 0..<count {
    let size = rng.range(0.8, 2.6)
    fillOval(rectTop(rng.range(0, canvasWidth), rng.range(0, canvasHeight), size, size), tint.withAlphaComponent(rng.range(0.035, 0.12)))
  }
}

func drawBaseBoard(_ rng: RNG, top: NSColor, bottom: NSColor) {
  let gradient = NSGradient(colors: [top, bottom])!
  gradient.draw(in: NSRect(x: 0, y: 0, width: canvasWidth, height: canvasHeight), angle: 90)
  for i in 0...16 {
    let y = Double(i) * canvasHeight / 16.0 + rng.range(-8, 8)
    drawLine(0, y, canvasWidth, y + rng.range(-3, 3), color(15, 13, 12, 0.18), rng.range(1, 4))
  }
  drawNoise(rng, tint: color(255, 245, 220), count: 900)
}

func avoidTarget(_ rng: RNG, targetX: Double, targetY: Double, minDistance: Double) -> (Double, Double) {
  for _ in 0..<15 {
    let x = rng.range(70, canvasWidth - 70)
    let y = rng.range(70, canvasHeight - 70)
    if hypot(x - targetX, y - targetY) > minDistance {
      return (x, y)
    }
  }
  return (rng.range(70, canvasWidth - 70), rng.range(70, canvasHeight - 70))
}

func drawLeaf(_ x: Double, _ y: Double, _ w: Double, _ h: Double, _ angle: Double, _ fill: NSColor) {
  NSGraphicsContext.saveGraphicsState()
  let transform = NSAffineTransform()
  transform.translateX(by: x, yBy: canvasHeight - y)
  transform.rotate(byDegrees: angle)
  transform.concat()
  let path = NSBezierPath()
  path.move(to: NSPoint(x: -w / 2, y: 0))
  path.curve(to: NSPoint(x: 0, y: h / 2), controlPoint1: NSPoint(x: -w * 0.3, y: h * 0.45), controlPoint2: NSPoint(x: -w * 0.1, y: h * 0.52))
  path.curve(to: NSPoint(x: w / 2, y: 0), controlPoint1: NSPoint(x: w * 0.18, y: h * 0.48), controlPoint2: NSPoint(x: w * 0.35, y: h * 0.22))
  path.curve(to: NSPoint(x: 0, y: -h / 2), controlPoint1: NSPoint(x: w * 0.35, y: -h * 0.25), controlPoint2: NSPoint(x: w * 0.12, y: -h * 0.5))
  path.curve(to: NSPoint(x: -w / 2, y: 0), controlPoint1: NSPoint(x: -w * 0.15, y: -h * 0.5), controlPoint2: NSPoint(x: -w * 0.34, y: -h * 0.25))
  path.close()
  fill.setFill()
  path.fill()
  drawLine(-w * 0.28, 0, w * 0.32, 0, fill.blended(withFraction: 0.35, of: .black) ?? fill, 1.2)
  NSGraphicsContext.restoreGraphicsState()
}

func drawScrew(_ x: Double, _ y: Double, _ size: Double, _ fill: NSColor, _ angle: Double) {
  drawShadow(4, 0.18) {
    fillOval(rectTop(x - size / 2, y - size / 2, size, size), fill)
    drawLine(x - size * 0.28, y, x + size * 0.28, y, fill.blended(withFraction: 0.58, of: .black) ?? .black, 2)
    if angle > 45 {
      drawLine(x, y - size * 0.28, x, y + size * 0.28, fill.blended(withFraction: 0.58, of: .black) ?? .black, 2)
    }
  }
}

// Draw target single mutation
func drawTarget(_ spec: PairSpec, variant: Bool) {
  let x = spec.targetX / 100 * canvasWidth
  let y = spec.targetY / 100 * canvasHeight

  switch spec.scene {
  case .kitchen:
    let shiftColor = variant ? color(235, 78, 62, 0.98) : color(68, 142, 218, 0.98)
    drawShadow(5, 0.25) {
      fillRounded(rectTop(x - 24, y - 28, 48, 56), 7, shiftColor)
      strokeRounded(rectTop(x - 24, y - 28, 48, 56), 7, color(255, 255, 255, 0.6), 2)
      strokeRounded(rectTop(x + 20, y - 16, 16, 32), 6, shiftColor, 4)
    }

  case .rugPick:
    if variant {
      polygon([
        (x - 28, y - 18), (x + 34, y - 3), (x - 9, y + 35)
      ], fill: color(214, 176, 72, 0.98), stroke: color(92, 66, 35, 0.7), lineWidth: 2)
    }

  case .buttonBox:
    let shift = variant ? 34.0 : 0.0
    let btnColor = variant ? color(225, 80, 110, 0.98) : color(96, 114, 160, 0.98)
    fillOval(rectTop(x - 31 + shift, y - 31, 62, 62), btnColor)
    fillOval(rectTop(x - 10 + shift, y - 10, 8, 8), color(225, 220, 205, 0.92))
    fillOval(rectTop(x + 4 + shift, y - 10, 8, 8), color(225, 220, 205, 0.92))
    fillOval(rectTop(x - 10 + shift, y + 4, 8, 8), color(225, 220, 205, 0.92))
    fillOval(rectTop(x + 4 + shift, y + 4, 8, 8), color(225, 220, 205, 0.92))

  case .bookLabel:
    let labelColor = variant ? color(235, 140, 42, 0.98) : color(225, 63, 55, 0.96)
    fillRounded(rectTop(x - 38, y - 13 + (variant ? 32 : 0), 76, 26), 6, labelColor)
    drawLine(x - 26, y + (variant ? 32 : 0), x + 24, y + (variant ? 32 : 0), color(255, 226, 160, 0.9), 3)

  case .leafTwig:
    if !variant {
      drawLine(x - 56, y + 19, x + 58, y - 18, color(105, 75, 42, 0.98), 9)
      fillOval(rectTop(x - 64, y + 11, 21, 21), color(84, 112, 55, 0.96))
    }

  case .screwTray:
    if !variant {
      drawScrew(x, y, 42, color(176, 171, 153, 0.98), 0)
    }

  case .tilePiece:
    let offset = variant ? 27.0 : 0.0
    let tileColor = variant ? color(228, 92, 120, 0.98) : color(212, 156, 74, 0.98)
    polygon([
      (x - 29 + offset, y - 27), (x + 23 + offset, y - 18), (x + 28 + offset, y + 26), (x - 19 + offset, y + 31)
    ], fill: tileColor, stroke: color(94, 57, 34, 0.42), lineWidth: 2)

  case .gravelKey:
    if variant {
      drawLine(x - 34, y + 6, x + 31, y - 7, color(139, 122, 76, 0.88), 6)
      fillOval(rectTop(x - 49, y - 2, 24, 24), color(139, 122, 76, 0.88))
      fillOval(rectTop(x - 42, y + 5, 9, 9), color(70, 66, 58, 0.9))
    }

  case .camoPatch:
    if !variant {
      drawLeaf(x, y, 86, 42, -22, color(80, 104, 55, 0.98))
      drawLeaf(x + 24, y - 7, 43, 25, 25, color(110, 132, 72, 0.98))
    } else {
      drawLeaf(x, y, 86, 42, -22, color(80, 104, 55, 0.98))
    }

  case .wireClip:
    let angle = variant ? 44.0 : -18.0
    rotatedRect(centerX: x, centerY: y, width: 74, height: 18, angle: angle, fill: color(145, 132, 105, 0.9), radius: 9)
    fillOval(rectTop(x - 13, y - 13, 26, 26), color(151, 84, 68, 0.86))

  case .seedTag:
    fillRounded(rectTop(x - 22, y - 68, 44, 136), 6, color(225, 214, 142, 0.98))
    drawLine(x - 12, y - 10, x + 12, y - 10, color(77, 91, 54, 0.85), 3)
    if !variant {
      fillRounded(rectTop(x + 6, y + 25, 24, 18), 5, color(91, 111, 60, 0.9))
    }
  }
}

// Scene renderers
func drawKitchenScene(_ rng: RNG, spec: PairSpec, variant: Bool) {
  drawBaseBoard(rng, top: color(220, 210, 195), bottom: color(175, 160, 140))
  // Backsplash tiles
  for r in 0..<12 {
    let y = Double(r) * 90.0
    drawLine(0, y, canvasWidth, y, color(140, 130, 120, 0.3), 1.5)
  }
  for c in 0..<20 {
    let x = Double(c) * 75.0
    drawLine(x, 0, x, canvasHeight, color(140, 130, 120, 0.3), 1.5)
  }

  let utensilColors = [color(190, 80, 70), color(70, 130, 180), color(210, 170, 60), color(90, 140, 90), color(140, 90, 150)]
  for _ in 0..<450 {
    let (x, y) = avoidTarget(rng, targetX: spec.targetX / 100 * canvasWidth, targetY: spec.targetY / 100 * canvasHeight, minDistance: 80)
    let c = rng.choice(utensilColors)
    if rng.chance(0.4) {
      // Cutting boards / plates
      fillRounded(rectTop(x - 25, y - 35, 50, 70), 8, c.withAlphaComponent(0.85))
    } else if rng.chance(0.5) {
      // Bowls / Lemons
      fillOval(rectTop(x - 18, y - 18, 36, 36), c.withAlphaComponent(0.9))
    } else {
      // Knives / Spoons
      rotatedRect(centerX: x, centerY: y, width: 8, height: 50, angle: rng.range(-60, 60), fill: c.withAlphaComponent(0.85), radius: 3)
    }
  }
  drawTarget(spec, variant: variant)
  drawNoise(rng, tint: color(255, 240, 210), count: 1000)
}

func drawRugPickScene(_ rng: RNG, spec: PairSpec, variant: Bool) {
  fillRect(NSRect(x: 0, y: 0, width: canvasWidth, height: canvasHeight), color(77, 39, 55))
  let palette = [color(126, 56, 78), color(42, 77, 94), color(199, 155, 76), color(232, 207, 142), color(74, 118, 86)]
  let cell = 55.0
  for row in 0..<22 {
    for col in 0..<30 {
      let x = Double(col) * cell + rng.range(-7, 7)
      let y = Double(row) * 51 + rng.range(-7, 7)
      let c = palette[(row * 3 + col * 5 + rng.int(0, 2)) % palette.count]
      polygon([(x + 28, y + 4), (x + 52, y + 27), (x + 27, y + 51), (x + 3, y + 28)], fill: c.withAlphaComponent(0.88), stroke: color(25, 20, 25, 0.45), lineWidth: 1.5)
      if rng.chance(0.45) {
        fillOval(rectTop(x + 18, y + 18, 19, 19), c.blended(withFraction: 0.25, of: .white) ?? c)
      }
    }
  }
  for _ in 0..<150 {
    let (x, y) = avoidTarget(rng, targetX: spec.targetX / 100 * canvasWidth, targetY: spec.targetY / 100 * canvasHeight, minDistance: 90)
    polygon([(x, y), (x + rng.range(18, 38), y + rng.range(-8, 14)), (x + rng.range(4, 18), y + rng.range(18, 38))], fill: rng.choice(palette).withAlphaComponent(0.76))
  }
  drawNoise(rng, tint: color(255, 224, 185), count: 1200)
  drawTarget(spec, variant: variant)
}

func drawButtonBoxScene(_ rng: RNG, spec: PairSpec, variant: Bool) {
  drawBaseBoard(rng, top: color(89, 74, 63), bottom: color(42, 36, 34))
  let palette = [color(188, 68, 74), color(76, 119, 153), color(214, 172, 84), color(84, 135, 93), color(139, 88, 148), color(230, 221, 194)]
  for _ in 0..<520 {
    let (x, y) = avoidTarget(rng, targetX: spec.targetX / 100 * canvasWidth, targetY: spec.targetY / 100 * canvasHeight, minDistance: 95)
    let size = rng.range(18, 56)
    let c = rng.choice(palette)
    fillOval(rectTop(x - size / 2, y - size / 2, size, size), c.withAlphaComponent(0.96))
    if rng.chance(0.75) {
      fillOval(rectTop(x - size * 0.16, y - size * 0.16, size * 0.12, size * 0.12), color(245, 238, 220, 0.9))
      fillOval(rectTop(x + size * 0.05, y - size * 0.16, size * 0.12, size * 0.12), color(245, 238, 220, 0.9))
      fillOval(rectTop(x - size * 0.16, y + size * 0.05, size * 0.12, size * 0.12), color(245, 238, 220, 0.9))
      fillOval(rectTop(x + size * 0.05, y + size * 0.05, size * 0.12, size * 0.12), color(245, 238, 220, 0.9))
    }
  }
  drawTarget(spec, variant: variant)
}

func drawBookLabelScene(_ rng: RNG, spec: PairSpec, variant: Bool) {
  fillRect(NSRect(x: 0, y: 0, width: canvasWidth, height: canvasHeight), color(48, 42, 42))
  let shelfColor = color(104, 74, 48)
  for shelf in 0..<7 {
    let y = 86 + Double(shelf) * 142
    fillRounded(rectTop(40, y, canvasWidth - 80, 24), 6, shelfColor)
    for col in 0..<36 {
      let x = 56 + Double(col) * 37 + rng.range(-4, 4)
      let h = rng.range(72, 128)
      let w = rng.range(20, 34)
      let book = [color(111, 61, 67), color(48, 85, 113), color(68, 111, 76), color(188, 143, 72), color(126, 96, 142)][rng.int(0, 4)]
      fillRounded(rectTop(x, y - h + 5, w, h), 4, book)
      if rng.chance(0.5) {
        drawLine(x + w / 2, y - h + 16, x + w / 2, y - 10, color(230, 205, 137, 0.58), 2)
      }
    }
  }
  drawTarget(spec, variant: variant)
  drawNoise(rng, tint: color(244, 221, 182), count: 750)
}

func drawLeafTwigScene(_ rng: RNG, spec: PairSpec, variant: Bool) {
  fillRect(NSRect(x: 0, y: 0, width: canvasWidth, height: canvasHeight), color(67, 58, 43))
  let leaves = [color(69, 90, 45), color(93, 119, 60), color(126, 91, 49), color(157, 113, 49), color(63, 72, 43)]
  for _ in 0..<720 {
    let (x, y) = avoidTarget(rng, targetX: spec.targetX / 100 * canvasWidth, targetY: spec.targetY / 100 * canvasHeight, minDistance: 85)
    drawLeaf(x, y, rng.range(34, 96), rng.range(17, 48), rng.range(-180, 180), rng.choice(leaves).withAlphaComponent(rng.range(0.72, 0.98)))
    if rng.chance(0.2) {
      drawLine(x - rng.range(15, 45), y + rng.range(-10, 10), x + rng.range(15, 45), y + rng.range(-10, 10), color(88, 63, 37, 0.82), rng.range(2, 6))
    }
  }
  drawTarget(spec, variant: variant)
  drawNoise(rng, tint: color(223, 192, 128), count: 1800)
}

func drawScrewTrayScene(_ rng: RNG, spec: PairSpec, variant: Bool) {
  drawBaseBoard(rng, top: color(78, 79, 76), bottom: color(40, 42, 42))
  for _ in 0..<470 {
    let (x, y) = avoidTarget(rng, targetX: spec.targetX / 100 * canvasWidth, targetY: spec.targetY / 100 * canvasHeight, minDistance: 90)
    if rng.chance(0.72) {
      drawScrew(x, y, rng.range(18, 45), rng.choice([color(168, 165, 150), color(98, 105, 106), color(206, 158, 78)]), rng.range(0, 90))
    } else {
      rotatedRect(centerX: x, centerY: y, width: rng.range(44, 110), height: rng.range(8, 22), angle: rng.range(-80, 80), fill: rng.choice([color(162, 92, 48), color(66, 100, 113), color(187, 169, 120)]), radius: 5)
    }
  }
  drawTarget(spec, variant: variant)
}

func drawTilePieceScene(_ rng: RNG, spec: PairSpec, variant: Bool) {
  fillRect(NSRect(x: 0, y: 0, width: canvasWidth, height: canvasHeight), color(43, 64, 70))
  let palette = [color(43, 111, 126), color(205, 154, 80), color(129, 63, 74), color(225, 207, 159), color(87, 128, 93)]
  let tile = 46.0
  for row in 0..<25 {
    for col in 0..<34 {
      let x = Double(col) * tile - 20 + rng.range(-3, 3)
      let y = Double(row) * 45 - 18 + rng.range(-3, 3)
      let c = palette[(row + col + rng.int(0, 2)) % palette.count]
      polygon([(x + 4, y + 5), (x + 41, y + 3), (x + 44, y + 40), (x + 8, y + 43)], fill: c.withAlphaComponent(0.9), stroke: color(16, 22, 24, 0.3), lineWidth: 1)
    }
  }
  for _ in 0..<120 {
    let (x, y) = avoidTarget(rng, targetX: spec.targetX / 100 * canvasWidth, targetY: spec.targetY / 100 * canvasHeight, minDistance: 85)
    polygon([(x, y), (x + rng.range(22, 50), y + rng.range(-9, 8)), (x + rng.range(15, 52), y + rng.range(24, 48)), (x + rng.range(-5, 13), y + rng.range(24, 48))], fill: rng.choice(palette).withAlphaComponent(0.88))
  }
  drawTarget(spec, variant: variant)
}

func drawGravelKeyScene(_ rng: RNG, spec: PairSpec, variant: Bool) {
  fillRect(NSRect(x: 0, y: 0, width: canvasWidth, height: canvasHeight), color(73, 70, 64))
  let stones = [color(63, 61, 58), color(91, 88, 80), color(118, 111, 96), color(52, 59, 54), color(132, 109, 83)]
  for _ in 0..<1500 {
    let (x, y) = avoidTarget(rng, targetX: spec.targetX / 100 * canvasWidth, targetY: spec.targetY / 100 * canvasHeight, minDistance: 70)
    let w = rng.range(11, 43)
    fillOval(rectTop(x - w / 2, y - w * 0.34, w, w * rng.range(0.48, 0.9)), rng.choice(stones).withAlphaComponent(rng.range(0.78, 0.98)))
  }
  for _ in 0..<120 {
    let (x, y) = avoidTarget(rng, targetX: spec.targetX / 100 * canvasWidth, targetY: spec.targetY / 100 * canvasHeight, minDistance: 90)
    drawLine(x - rng.range(16, 62), y, x + rng.range(16, 62), y + rng.range(-12, 12), color(113, 86, 54, 0.8), rng.range(2, 7))
  }
  drawTarget(spec, variant: variant)
  drawNoise(rng, tint: color(230, 213, 170), count: 1400)
}

func drawCamoPatchScene(_ rng: RNG, spec: PairSpec, variant: Bool) {
  fillRect(NSRect(x: 0, y: 0, width: canvasWidth, height: canvasHeight), color(39, 49, 37))
  let palette = [color(45, 67, 39), color(74, 92, 48), color(100, 117, 61), color(88, 75, 42), color(31, 43, 30)]
  for _ in 0..<1150 {
    let (x, y) = avoidTarget(rng, targetX: spec.targetX / 100 * canvasWidth, targetY: spec.targetY / 100 * canvasHeight, minDistance: 75)
    if rng.chance(0.64) {
      drawLeaf(x, y, rng.range(25, 88), rng.range(14, 48), rng.range(-180, 180), rng.choice(palette).withAlphaComponent(rng.range(0.78, 0.98)))
    } else {
      polygon([(x, y), (x + rng.range(25, 70), y + rng.range(3, 22)), (x + rng.range(9, 45), y + rng.range(35, 80)), (x - rng.range(8, 40), y + rng.range(18, 60))], fill: rng.choice(palette).withAlphaComponent(0.86))
    }
  }
  drawTarget(spec, variant: variant)
  drawNoise(rng, tint: color(190, 171, 115), count: 2100)
}

func drawWireClipScene(_ rng: RNG, spec: PairSpec, variant: Bool) {
  drawBaseBoard(rng, top: color(47, 50, 56), bottom: color(26, 28, 32))
  let wireColors = [color(52, 117, 137), color(191, 77, 55), color(214, 170, 82), color(90, 138, 87), color(91, 79, 127), color(190, 183, 160)]
  for _ in 0..<260 {
    let (x, y) = avoidTarget(rng, targetX: spec.targetX / 100 * canvasWidth, targetY: spec.targetY / 100 * canvasHeight, minDistance: 75)
    let length = rng.range(75, 220)
    let angle = rng.range(-180, 180)
    let c = rng.choice(wireColors).withAlphaComponent(0.88)
    drawLine(x - cos(angle) * length / 2, y - sin(angle) * length / 2, x + cos(angle) * length / 2, y + sin(angle) * length / 2, c, rng.range(4, 10))
    if rng.chance(0.24) {
      fillOval(rectTop(x - 13, y - 13, 26, 26), c.blended(withFraction: 0.2, of: .white) ?? c)
    }
  }
  drawTarget(spec, variant: variant)
}

func drawSeedTagScene(_ rng: RNG, spec: PairSpec, variant: Bool) {
  drawBaseBoard(rng, top: color(69, 83, 56), bottom: color(39, 46, 35))
  let greens = [color(57, 104, 55), color(83, 132, 66), color(105, 152, 78), color(73, 89, 54)]
  for row in 0..<11 {
    for col in 0..<17 {
      let x = 70 + Double(col) * 78 + rng.range(-10, 10)
      let y = 66 + Double(row) * 88 + rng.range(-10, 10)
      fillRounded(rectTop(x, y, rng.range(44, 72), rng.range(34, 62)), 12, color(105, 84, 50, 0.84))
      if rng.chance(0.55) {
        drawLeaf(x + rng.range(12, 54), y + rng.range(6, 48), rng.range(25, 48), rng.range(16, 30), rng.range(-140, 140), rng.choice(greens))
      }
      if rng.chance(0.3) {
        fillRounded(rectTop(x + rng.range(7, 38), y + rng.range(4, 26), 24, 66), 5, color(226, 214, 146, 0.88))
      }
    }
  }
  for _ in 0..<240 {
    let (x, y) = avoidTarget(rng, targetX: spec.targetX / 100 * canvasWidth, targetY: spec.targetY / 100 * canvasHeight, minDistance: 80)
    fillOval(rectTop(x, y, rng.range(5, 12), rng.range(5, 12)), color(213, 188, 98, 0.88))
  }
  drawTarget(spec, variant: variant)
}

func drawImage(spec: PairSpec, variant: Bool) -> NSImage {
  let rng = RNG(spec.seed)
  let image = NSImage(size: NSSize(width: canvasWidth, height: canvasHeight))
  image.lockFocus()
  NSGraphicsContext.current?.imageInterpolation = .high

  switch spec.scene {
  case .kitchen:
    drawKitchenScene(rng, spec: spec, variant: variant)
  case .rugPick:
    drawRugPickScene(rng, spec: spec, variant: variant)
  case .buttonBox:
    drawButtonBoxScene(rng, spec: spec, variant: variant)
  case .bookLabel:
    drawBookLabelScene(rng, spec: spec, variant: variant)
  case .leafTwig:
    drawLeafTwigScene(rng, spec: spec, variant: variant)
  case .screwTray:
    drawScrewTrayScene(rng, spec: spec, variant: variant)
  case .tilePiece:
    drawTilePieceScene(rng, spec: spec, variant: variant)
  case .gravelKey:
    drawGravelKeyScene(rng, spec: spec, variant: variant)
  case .camoPatch:
    drawCamoPatchScene(rng, spec: spec, variant: variant)
  case .wireClip:
    drawWireClipScene(rng, spec: spec, variant: variant)
  case .seedTag:
    drawSeedTagScene(rng, spec: spec, variant: variant)
  }

  image.unlockFocus()
  return image
}

func savePNG(_ image: NSImage, to url: URL) throws {
  guard let tiff = image.tiffRepresentation,
        let rep = NSBitmapImageRep(data: tiff),
        let data = rep.representation(using: .png, properties: [.compressionFactor: 0.85]) else {
    throw NSError(domain: "DensePairExport", code: 1)
  }
  try data.write(to: url)
}

// ----------------------------------------------------
// BUILD 100 PHOTO-STYLE + 100 ILLUSTRATED/ABSTRACT IMAGE PAIRS
// ----------------------------------------------------

struct CategoryConfig {
  let categoryName: String
  let folder: String
  let idPrefix: String
  let pack: String
  let packId: String
  let sceneKinds: [SceneKind]
}

let categoriesConfig: [CategoryConfig] = [
  CategoryConfig(
    categoryName: "Generated Photo Style",
    folder: "mass-photo",
    idPrefix: "mass_photo",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    sceneKinds: [.kitchen, .buttonBox, .seedTag, .screwTray, .wireClip, .leafTwig]
  ),
  CategoryConfig(
    categoryName: "Generated Illustrated Abstract",
    folder: "mass-abstract",
    idPrefix: "mass_abstract",
    pack: "Abstract Animated",
    packId: "abstract_animated",
    sceneKinds: [.rugPick, .tilePiece, .bookLabel, .gravelKey, .camoPatch]
  )
]

var allSpecs: [PairSpec] = []
let targetPairsPerCategory = 100

for (catIdx, config) in categoriesConfig.enumerated() {
  for i in 1...targetPairsPerCategory {
    let id = "\(config.idPrefix)_\(String(format: "%03d", i))"
    let scene = config.sceneKinds[(i - 1) % config.sceneKinds.count]
    let seed = UInt64(900000 + catIdx * 10000 + i * 37)
    let rng = RNG(seed)

    let targetX = Double(round(rng.range(18, 82) * 10) / 10)
    let targetY = Double(round(rng.range(18, 82) * 10) / 10)

    let difficulty: String
    let radius: Double
    if i % 3 == 1 {
      difficulty = "Easy"
      radius = Double(round(rng.range(8.0, 9.8) * 10) / 10)
    } else if i % 3 == 2 {
      difficulty = "Medium"
      radius = Double(round(rng.range(5.5, 7.5) * 10) / 10)
    } else {
      difficulty = "Hard"
      radius = Double(round(rng.range(3.8, 5.2) * 10) / 10)
    }

    let title = "\(config.categoryName) #\(i)"
    let hint = "Examine the region around (\(Int(targetX))%, \(Int(targetY))%) carefully."

    let spec = PairSpec(
      id: id,
      folder: config.folder,
      title: title,
      category: config.categoryName,
      difficulty: difficulty,
      scene: scene,
      seed: seed,
      targetX: targetX,
      targetY: targetY,
      radius: radius,
      hint: hint
    )
    allSpecs.append(spec)
  }
}

print("----------------------------------------------------")
print("🚀 GENERATING 100 PHOTO-STYLE + 100 ILLUSTRATED/ABSTRACT PAIRS (\(allSpecs.count) PAIRS TOTAL)...")
print("----------------------------------------------------")

let lock = NSLock()
var completedCount = 0

// Fast sequential memory-efficient rendering without CoreGraphics lock contention
for (index, spec) in allSpecs.enumerated() {
  autoreleasepool {
    let dir = repoRoot
      .appendingPathComponent("public/levels/photo-pairs")
      .appendingPathComponent(spec.folder)
      .appendingPathComponent(spec.id)

    do {
      try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
      let baseImg = drawImage(spec: spec, variant: false)
      let varImg = drawImage(spec: spec, variant: true)
      try savePNG(baseImg, to: dir.appendingPathComponent("base.png"))
      try savePNG(varImg, to: dir.appendingPathComponent("variant.png"))

      completedCount += 1
      if completedCount % 50 == 0 || completedCount == allSpecs.count {
        print("  [PROGRESS] Generated \(completedCount)/\(allSpecs.count) image pairs...")
      }
    } catch {
      print("  [ERROR] Failed generating \(spec.id): \(error)")
    }
  }
}

// Generate photo_pair_manifest.json entries
var manifestEntries: [[String: Any]] = []

for (index, spec) in allSpecs.enumerated() {
  let config = categoriesConfig[index / targetPairsPerCategory]
  let entry: [String: Any] = [
    "id": spec.id,
    "title": spec.title,
    "pack": config.pack,
    "packId": config.packId,
    "category": spec.category,
    "difficulty": spec.difficulty,
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

let manifestURL = repoRoot.appendingPathComponent("public/levels/photo_pair_manifest.json")
var existingEntries: [[String: Any]] = []
if let existingData = try? Data(contentsOf: manifestURL),
   let parsed = try? JSONSerialization.jsonObject(with: existingData) as? [[String: Any]] {
  existingEntries = parsed.filter { entry in
    guard let id = entry["id"] as? String else { return true }
    return !id.hasPrefix("mass_photo_") && !id.hasPrefix("mass_abstract_")
  }
}
let jsonData = try JSONSerialization.data(withJSONObject: existingEntries + manifestEntries, options: [.prettyPrinted, .sortedKeys])
try jsonData.write(to: manifestURL)

print("----------------------------------------------------")
print("✅ SUCCESSFULLY GENERATED \(allSpecs.count) IMAGE PAIR LEVELS!")
print("📁 Manifest updated: \(manifestURL.path)")
print("----------------------------------------------------")
