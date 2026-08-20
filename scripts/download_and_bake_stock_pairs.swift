#!/usr/bin/env swift

import AppKit
import Foundation
import CoreGraphics
import ImageIO

enum MorphType {
  case rotateScoopHandle
  case embossedBookCrest
  case narutomakiSwirlMorph
  case lupineBlossomSprout
  case ceramicGlazeBand
  case mooringFinialCap
  case clownfishBarReshape
  case horologyRubyBearing
  case planterIvyTendril
  case pagodaFallenLeaf
  case brassTelescopeReticule
  case bakeryPastryGlazeStar
}

struct StockSpec {
  let id: String
  let folder: String
  let title: String
  let category: String
  let pack: String
  let packId: String
  let difficulty: String
  let url: String
  let targetX: Double
  let targetY: Double
  let radius: Double
  let morph: MorphType
  let hint: String
}

let stockSpecs: [StockSpec] = [
  StockSpec(
    id: "photo_stock_v2_spice_bazaar_001",
    folder: "photo-spice-table",
    title: "Artisan Spice Bazaar",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    url: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?q=80&w=1200&auto=format&fit=crop",
    targetX: 45.0,
    targetY: 60.0,
    radius: 5.0,
    morph: .rotateScoopHandle,
    hint: "Inspect the wooden spice scoop in the saffron mound."
  ),
  StockSpec(
    id: "photo_stock_v2_parisian_bookstore_001",
    folder: "photo-map-restoration",
    title: "Cozy Parisian Bookstore",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Hard",
    url: "https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=1200&auto=format&fit=crop",
    targetX: 62.0,
    targetY: 48.0,
    radius: 4.5,
    morph: .embossedBookCrest,
    hint: "Check the gold-embossed crest on the book spine."
  ),
  StockSpec(
    id: "photo_stock_v2_tokyo_ramen_001",
    folder: "photo-bakers-table",
    title: "Tokyo Street Ramen Bar",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    url: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?q=80&w=1200&auto=format&fit=crop",
    targetX: 38.0,
    targetY: 54.0,
    radius: 4.8,
    morph: .narutomakiSwirlMorph,
    hint: "Inspect the pattern inside the narutomaki fishcake swirl."
  ),
  StockSpec(
    id: "photo_stock_v2_alpine_wildflowers_001",
    folder: "camouflage",
    title: "Alpine Meadow Wildflowers",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Hard",
    url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop",
    targetX: 72.0,
    targetY: 68.0,
    radius: 4.5,
    morph: .lupineBlossomSprout,
    hint: "Look at the extra flower bud cluster atop the purple lupine stem."
  ),
  StockSpec(
    id: "photo_stock_v2_ceramic_studio_001",
    folder: "photo-pottery-table",
    title: "Artisan Ceramic Studio",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    url: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?q=80&w=1200&auto=format&fit=crop",
    targetX: 52.0,
    targetY: 42.0,
    radius: 4.5,
    morph: .ceramicGlazeBand,
    hint: "Notice the incised runic terracotta rim on the terracotta vase."
  ),
  StockSpec(
    id: "photo_stock_v2_venice_canal_001",
    folder: "photo-fishing-tackle",
    title: "Venice Grand Canal Sunset",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    url: "https://images.unsplash.com/photo-1514890547357-a9ee288728e0?q=80&w=1200&auto=format&fit=crop",
    targetX: 28.0,
    targetY: 62.0,
    radius: 4.5,
    morph: .mooringFinialCap,
    hint: "Check the carved striped brass cap atop the wooden mooring pole."
  ),
  StockSpec(
    id: "photo_stock_v2_coral_reef_001",
    folder: "photo-camping-table",
    title: "Red Sea Coral Reef",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Hard",
    url: "https://images.unsplash.com/photo-1546026423-cc4642628d2b?q=80&w=1200&auto=format&fit=crop",
    targetX: 64.0,
    targetY: 58.0,
    radius: 4.5,
    morph: .clownfishBarReshape,
    hint: "Examine the branched golden brain coral colony in the lower right."
  ),
  StockSpec(
    id: "photo_stock_v2_watchmaker_desk_001",
    folder: "photo-watchmaker-bench",
    title: "Master Horologist Workshop",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Hard",
    url: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=1200&auto=format&fit=crop",
    targetX: 48.0,
    targetY: 52.0,
    radius: 4.2,
    morph: .horologyRubyBearing,
    hint: "Spot the polished synthetic ruby jewel bearing in the gear bridge."
  ),
  StockSpec(
    id: "photo_stock_v2_glasshouse_flora_001",
    folder: "photo-potting-table",
    title: "Victorian Botanical Conservatory",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    url: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?q=80&w=1200&auto=format&fit=crop",
    targetX: 34.0,
    targetY: 46.0,
    radius: 4.8,
    morph: .planterIvyTendril,
    hint: "Look at the cascading English ivy leaf cluster hanging from the planter."
  ),
  StockSpec(
    id: "photo_stock_v2_autumn_maple_garden_001",
    folder: "photo-garden-potting",
    title: "Kyoto Autumn Zen Temple",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    url: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop",
    targetX: 58.0,
    targetY: 64.0,
    radius: 4.5,
    morph: .pagodaFallenLeaf,
    hint: "Notice the crisp fallen Japanese crimson maple leaf on the stone lantern."
  )
]

let fileManager = FileManager.default
let currentDir = fileManager.currentDirectoryPath
let outputBaseDir = "\(currentDir)/public/levels/photo-pairs"
let manifestPath = "\(currentDir)/public/levels/photo_pair_manifest.json"

try? fileManager.createDirectory(atPath: outputBaseDir, withIntermediateDirectories: true, attributes: nil)

func downloadImage(from urlString: String) -> CGImage? {
  guard let url = URL(string: urlString),
        let data = try? Data(contentsOf: url),
        let source = CGImageSourceCreateWithData(data as CFData, nil),
        let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    return nil
  }
  return cgImage
}

func savePNG(image: CGImage, to path: String) -> Bool {
  guard let destination = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, kUTTypePNG, 1, nil) else {
    return false
  }
  CGImageDestinationAddImage(destination, image, nil)
  return CGImageDestinationFinalize(destination)
}

func bakeObjectAwareDifference(baseImage: CGImage, spec: StockSpec) -> CGImage? {
  let width = baseImage.width
  let height = baseImage.height
  let colorSpace = CGColorSpaceCreateDeviceRGB()

  guard let ctx = CGContext(
    data: nil,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: width * 4,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
  ) else {
    return nil
  }

  // Draw original base image
  ctx.draw(baseImage, in: CGRect(x: 0, y: 0, width: width, height: height))

  // Map normalized percent coordinates to CoreGraphics inverted Y coordinates
  let cx = (spec.targetX / 100.0) * Double(width)
  let cy = ((100.0 - spec.targetY) / 100.0) * Double(height)
  let patchRadius = (spec.radius / 100.0) * Double(width) * 1.5

  ctx.saveGState()

  switch spec.morph {
  case .rotateScoopHandle:
    ctx.setShadow(offset: CGSize(width: 4, height: -4), blur: 8, color: CGColor(red: 0.1, green: 0.05, blue: 0, alpha: 0.6))
    ctx.setFillColor(CGColor(red: 0.72, green: 0.45, blue: 0.20, alpha: 0.95))
    ctx.fillEllipse(in: CGRect(x: cx - patchRadius * 0.7, y: cy - patchRadius * 0.4, width: patchRadius * 1.4, height: patchRadius * 0.8))
    ctx.setStrokeColor(CGColor(red: 0.35, green: 0.18, blue: 0.05, alpha: 0.9))
    ctx.setLineWidth(4)
    ctx.move(to: CGPoint(x: cx - patchRadius * 0.6, y: cy))
    ctx.addLine(to: CGPoint(x: cx + patchRadius * 0.6, y: cy - patchRadius * 0.2))
    ctx.strokePath()

  case .embossedBookCrest:
    ctx.setShadow(offset: CGSize(width: 3, height: -3), blur: 6, color: CGColor(red: 0.95, green: 0.80, blue: 0.20, alpha: 0.8))
    ctx.setFillColor(CGColor(red: 0.92, green: 0.78, blue: 0.25, alpha: 0.95))
    ctx.fillEllipse(in: CGRect(x: cx - patchRadius * 0.5, y: cy - patchRadius * 0.5, width: patchRadius, height: patchRadius))
    ctx.setStrokeColor(CGColor(red: 0.45, green: 0.30, blue: 0.05, alpha: 0.9))
    ctx.setLineWidth(3)
    ctx.strokeEllipse(in: CGRect(x: cx - patchRadius * 0.5, y: cy - patchRadius * 0.5, width: patchRadius, height: patchRadius))

  case .narutomakiSwirlMorph:
    ctx.setShadow(offset: CGSize(width: 2, height: -2), blur: 4, color: CGColor(red: 0.9, green: 0.2, blue: 0.5, alpha: 0.7))
    ctx.setFillColor(CGColor(red: 0.98, green: 0.98, blue: 0.98, alpha: 0.95))
    ctx.fillEllipse(in: CGRect(x: cx - patchRadius * 0.6, y: cy - patchRadius * 0.6, width: patchRadius * 1.2, height: patchRadius * 1.2))
    ctx.setStrokeColor(CGColor(red: 0.92, green: 0.15, blue: 0.48, alpha: 0.95))
    ctx.setLineWidth(5)
    ctx.strokeEllipse(in: CGRect(x: cx - patchRadius * 0.35, y: cy - patchRadius * 0.35, width: patchRadius * 0.7, height: patchRadius * 0.7))

  case .lupineBlossomSprout:
    ctx.setShadow(offset: CGSize(width: 3, height: -3), blur: 6, color: CGColor(red: 0.5, green: 0.1, blue: 0.7, alpha: 0.6))
    ctx.setFillColor(CGColor(red: 0.65, green: 0.25, blue: 0.88, alpha: 0.95))
    ctx.fillEllipse(in: CGRect(x: cx - patchRadius * 0.4, y: cy - patchRadius * 0.6, width: patchRadius * 0.8, height: patchRadius * 1.2))
    ctx.setFillColor(CGColor(red: 0.90, green: 0.65, blue: 0.98, alpha: 0.95))
    ctx.fillEllipse(in: CGRect(x: cx - patchRadius * 0.2, y: cy + patchRadius * 0.2, width: patchRadius * 0.4, height: patchRadius * 0.5))

  case .ceramicGlazeBand:
    ctx.setShadow(offset: CGSize(width: 3, height: -3), blur: 6, color: CGColor(red: 0.1, green: 0.2, blue: 0.4, alpha: 0.6))
    ctx.setFillColor(CGColor(red: 0.12, green: 0.48, blue: 0.75, alpha: 0.92))
    ctx.fillEllipse(in: CGRect(x: cx - patchRadius * 0.6, y: cy - patchRadius * 0.3, width: patchRadius * 1.2, height: patchRadius * 0.6))
    ctx.setStrokeColor(CGColor(red: 0.85, green: 0.65, blue: 0.35, alpha: 0.9))
    ctx.setLineWidth(3)
    ctx.strokeEllipse(in: CGRect(x: cx - patchRadius * 0.6, y: cy - patchRadius * 0.3, width: patchRadius * 1.2, height: patchRadius * 0.6))

  case .mooringFinialCap:
    ctx.setShadow(offset: CGSize(width: 4, height: -4), blur: 8, color: CGColor(red: 0, green: 0, blue: 0, alpha: 0.6))
    ctx.setFillColor(CGColor(red: 0.85, green: 0.72, blue: 0.25, alpha: 0.95))
    ctx.fillEllipse(in: CGRect(x: cx - patchRadius * 0.5, y: cy - patchRadius * 0.5, width: patchRadius, height: patchRadius))
    ctx.setStrokeColor(CGColor(red: 0.15, green: 0.35, blue: 0.65, alpha: 0.9))
    ctx.setLineWidth(4)
    ctx.strokeEllipse(in: CGRect(x: cx - patchRadius * 0.5, y: cy - patchRadius * 0.5, width: patchRadius, height: patchRadius))

  case .clownfishBarReshape:
    ctx.setShadow(offset: CGSize(width: 3, height: -3), blur: 7, color: CGColor(red: 0.8, green: 0.6, blue: 0.1, alpha: 0.7))
    ctx.setFillColor(CGColor(red: 0.95, green: 0.82, blue: 0.30, alpha: 0.95))
    ctx.fillEllipse(in: CGRect(x: cx - patchRadius * 0.6, y: cy - patchRadius * 0.5, width: patchRadius * 1.2, height: patchRadius))
    ctx.setFillColor(CGColor(red: 0.15, green: 0.65, blue: 0.85, alpha: 0.9))
    ctx.fillEllipse(in: CGRect(x: cx - patchRadius * 0.3, y: cy - patchRadius * 0.25, width: patchRadius * 0.6, height: patchRadius * 0.5))

  case .horologyRubyBearing:
    ctx.setShadow(offset: CGSize(width: 2, height: -2), blur: 5, color: CGColor(red: 0.9, green: 0.05, blue: 0.2, alpha: 0.8))
    ctx.setFillColor(CGColor(red: 0.88, green: 0.05, blue: 0.25, alpha: 0.95))
    ctx.fillEllipse(in: CGRect(x: cx - patchRadius * 0.45, y: cy - patchRadius * 0.45, width: patchRadius * 0.9, height: patchRadius * 0.9))
    ctx.setFillColor(CGColor(red: 1.0, green: 0.8, blue: 0.85, alpha: 0.9))
    ctx.fillEllipse(in: CGRect(x: cx - patchRadius * 0.15, y: cy + patchRadius * 0.1, width: patchRadius * 0.3, height: patchRadius * 0.3))

  case .planterIvyTendril:
    ctx.setShadow(offset: CGSize(width: 3, height: -3), blur: 6, color: CGColor(red: 0.05, green: 0.3, blue: 0.1, alpha: 0.6))
    ctx.setFillColor(CGColor(red: 0.18, green: 0.58, blue: 0.25, alpha: 0.95))
    ctx.fillEllipse(in: CGRect(x: cx - patchRadius * 0.5, y: cy - patchRadius * 0.6, width: patchRadius, height: patchRadius * 1.2))
    ctx.setFillColor(CGColor(red: 0.45, green: 0.85, blue: 0.35, alpha: 0.95))
    ctx.fillEllipse(in: CGRect(x: cx - patchRadius * 0.25, y: cy + patchRadius * 0.1, width: patchRadius * 0.5, height: patchRadius * 0.6))

  case .pagodaFallenLeaf:
    ctx.setShadow(offset: CGSize(width: 3, height: -3), blur: 6, color: CGColor(red: 0.6, green: 0.05, blue: 0.05, alpha: 0.7))
    ctx.setFillColor(CGColor(red: 0.88, green: 0.15, blue: 0.10, alpha: 0.95))
    ctx.fillEllipse(in: CGRect(x: cx - patchRadius * 0.5, y: cy - patchRadius * 0.4, width: patchRadius, height: patchRadius * 0.8))
    ctx.setFillColor(CGColor(red: 0.98, green: 0.45, blue: 0.15, alpha: 0.95))
    ctx.fillEllipse(in: CGRect(x: cx - patchRadius * 0.25, y: cy - patchRadius * 0.15, width: patchRadius * 0.5, height: patchRadius * 0.4))

  case .brassTelescopeReticule:
    ctx.setShadow(offset: CGSize(width: 3, height: -3), blur: 6, color: CGColor(red: 0.8, green: 0.6, blue: 0.1, alpha: 0.7))
    ctx.setFillColor(CGColor(red: 0.85, green: 0.72, blue: 0.25, alpha: 0.95))
    ctx.fillEllipse(in: CGRect(x: cx - patchRadius * 0.5, y: cy - patchRadius * 0.5, width: patchRadius, height: patchRadius))

  case .bakeryPastryGlazeStar:
    ctx.setShadow(offset: CGSize(width: 3, height: -3), blur: 6, color: CGColor(red: 0.9, green: 0.8, blue: 0.2, alpha: 0.7))
    ctx.setFillColor(CGColor(red: 0.98, green: 0.90, blue: 0.35, alpha: 0.95))
    ctx.fillEllipse(in: CGRect(x: cx - patchRadius * 0.5, y: cy - patchRadius * 0.5, width: patchRadius, height: patchRadius))
  }

  ctx.restoreGState()

  return ctx.makeImage()
}

print("🌟 Starting Download & Object-Aware Morph Baking for Batch 2...")

var newEntries: [[String: Any]] = []

for spec in stockSpecs {
  print("📸 Processing spec: \(spec.id) - \(spec.title)")
  guard let baseCG = downloadImage(from: spec.url) else {
    print("❌ Failed downloading \(spec.url)")
    continue
  }

  let folderPath = "\(outputBaseDir)/\(spec.id)"
  try? fileManager.createDirectory(atPath: folderPath, withIntermediateDirectories: true, attributes: nil)

  let originalPath = "\(folderPath)/original.png"
  let variantPath = "\(folderPath)/variant.png"

  guard savePNG(image: baseCG, to: originalPath) else {
    print("❌ Failed saving original image to \(originalPath)")
    continue
  }

  guard let modifiedCG = bakeObjectAwareDifference(baseImage: baseCG, spec: spec),
        savePNG(image: modifiedCG, to: variantPath) else {
    print("❌ Failed baking modified image to \(variantPath)")
    continue
  }

  print("✅ Saved pair to \(folderPath)")

  let entry: [String: Any] = [
    "id": spec.id,
    "title": spec.title,
    "category": spec.category,
    "pack": spec.pack,
    "packId": spec.packId,
    "difficulty": spec.difficulty,
    "originalImage": "levels/photo-pairs/\(spec.id)/original.png",
    "variantImage": "levels/photo-pairs/\(spec.id)/variant.png",
    "totalDifferences": 1,
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
  newEntries.append(entry)
}

// Update public/levels/photo_pair_manifest.json with new entries at the top
if let data = try? Data(contentsOf: URL(fileURLWithPath: manifestPath)),
   var existingManifest = (try? JSONSerialization.jsonObject(with: data, options: [])) as? [[String: Any]] {

  // Remove previous instances if any
  let newIds = Set(newEntries.compactMap { $0["id"] as? String })
  existingManifest.removeAll { entry in
    if let id = entry["id"] as? String {
      return newIds.contains(id)
    }
    return false
  }

  // Prepend brand new entries to the front of the manifest!
  let combinedManifest = newEntries + existingManifest

  if let updatedData = try? JSONSerialization.data(withJSONObject: combinedManifest, options: [.prettyPrinted, .sortedKeys]) {
    try? updatedData.write(to: URL(fileURLWithPath: manifestPath))
    print("🎉 Successfully updated \(manifestPath) with \(newEntries.count) new photo pairs at the front!")
  }
}

print("✨ Done!")
