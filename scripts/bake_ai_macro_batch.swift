#!/usr/bin/env swift

import AppKit
import Foundation
import CoreGraphics
import ImageIO

struct SceneBake {
  let id: String
  let title: String
  let category: String
  let pack: String
  let packId: String
  let difficulty: String
  let basePath: String
  let varPath: String
  let targetX: Double // percent
  let targetY: Double // percent (top-down)
  let radius: Double  // percent
  let hint: String
}

let scenes: [SceneBake] = [
  SceneBake(
    id: "ai_macro_watchmaker_001",
    title: "Horology Watchmaker Tray",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    basePath: "/Users/leemosupreemo/.gemini/antigravity-cli/brain/f0be84e1-5a69-4bf4-8859-f2381e9aac49/watchmaker_base_1787175115551.jpg",
    varPath: "/Users/leemosupreemo/.gemini/antigravity-cli/brain/f0be84e1-5a69-4bf4-8859-f2381e9aac49/watchmaker_variant_1787175126664.jpg",
    targetX: 65.8,
    targetY: 30.6,
    radius: 4.8,
    hint: "Look inside the small brass cleaning cup in the upper right section."
  ),
  SceneBake(
    id: "ai_macro_leathercraft_001",
    title: "Master Leathercraft Workbench",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    basePath: "/Users/leemosupreemo/.gemini/antigravity-cli/brain/f0be84e1-5a69-4bf4-8859-f2381e9aac49/leathercraft_base_1787175157528.jpg",
    varPath: "/Users/leemosupreemo/.gemini/antigravity-cli/brain/f0be84e1-5a69-4bf4-8859-f2381e9aac49/leathercraft_variant_1787175170808.jpg",
    targetX: 63.0,
    targetY: 44.0,
    radius: 4.5,
    hint: "Inspect the dark walnut wooden tool handle between the two bone folders."
  ),
  SceneBake(
    id: "ai_macro_botanist_001",
    title: "Botanist Herbarium Study",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    basePath: "/Users/leemosupreemo/.gemini/antigravity-cli/brain/f0be84e1-5a69-4bf4-8859-f2381e9aac49/botanist_base_1787175182706.jpg",
    varPath: "/Users/leemosupreemo/.gemini/antigravity-cli/brain/f0be84e1-5a69-4bf4-8859-f2381e9aac49/botanist_variant_1787175197387.jpg",
    targetX: 38.0,
    targetY: 69.5,
    radius: 4.5,
    hint: "Examine the lower left margin of the center poppy illustration card."
  ),
  SceneBake(
    id: "ai_macro_machinist_001",
    title: "Machinist Precision Hardware Mat",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Hard",
    basePath: "/Users/leemosupreemo/.gemini/antigravity-cli/brain/f0be84e1-5a69-4bf4-8859-f2381e9aac49/machinist_base_1787175210149.jpg",
    varPath: "/Users/leemosupreemo/.gemini/antigravity-cli/brain/f0be84e1-5a69-4bf4-8859-f2381e9aac49/machinist_variant_1787175225265.jpg",
    targetX: 45.6,
    targetY: 73.8,
    radius: 4.2,
    hint: "Count the row of copper ring washers beneath the ball bearings."
  ),
  SceneBake(
    id: "ai_macro_electronics_001",
    title: "Audio Circuit Repair Workbench",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Hard",
    basePath: "/Users/leemosupreemo/.gemini/antigravity-cli/brain/f0be84e1-5a69-4bf4-8859-f2381e9aac49/electronics_base_1787175241903.jpg",
    varPath: "/Users/leemosupreemo/.gemini/antigravity-cli/brain/f0be84e1-5a69-4bf4-8859-f2381e9aac49/electronics_variant_1787175254994.jpg",
    targetX: 69.2,
    targetY: 29.8,
    radius: 4.2,
    hint: "Check the bat lever color on the miniature toggle switches."
  )
]

let repoRoot = FileManager.default.currentDirectoryPath
let outputBaseDir = "\(repoRoot)/public/levels/photo-pairs"
let manifestPath = "\(repoRoot)/public/levels/photo_pair_manifest.json"
let fileManager = FileManager.default

func savePNG(image: CGImage, to path: String) -> Bool {
  guard let destination = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, "public.png" as CFString, 1, nil) else {
    return false
  }
  CGImageDestinationAddImage(destination, image, nil)
  return CGImageDestinationFinalize(destination)
}

func blendIsolatedPatch(baseImage: CGImage, varImage: CGImage, spec: SceneBake) -> CGImage? {
  let w = baseImage.width
  let h = baseImage.height
  let colorSpace = CGColorSpaceCreateDeviceRGB()

  guard let ctx = CGContext(
    data: nil,
    width: w,
    height: h,
    bitsPerComponent: 8,
    bytesPerRow: w * 4,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
  ) else {
    return nil
  }

  // Draw base
  ctx.draw(baseImage, in: CGRect(x: 0, y: 0, width: w, height: h))

  // Coordinates: convert top-down targetY to CG inverted y
  let targetPixelX = (spec.targetX / 100.0) * Double(w)
  let targetPixelY = ((100.0 - spec.targetY) / 100.0) * Double(h)
  let radiusPixels = (spec.radius / 100.0) * Double(w)

  let patchRect = CGRect(
    x: targetPixelX - radiusPixels * 1.3,
    y: targetPixelY - radiusPixels * 1.3,
    width: radiusPixels * 2.6,
    height: radiusPixels * 2.6
  )

  ctx.saveGState()
  ctx.addEllipse(in: patchRect)
  ctx.clip()
  ctx.draw(varImage, in: CGRect(x: 0, y: 0, width: w, height: h))
  ctx.restoreGState()

  return ctx.makeImage()
}

var manifestEntries: [[String: Any]] = []

for spec in scenes {
  print("Processing scene: \(spec.id) - \(spec.title)")
  guard let baseCG = NSImage(contentsOfFile: spec.basePath)?.cgImage(forProposedRect: nil, context: nil, hints: nil),
        let varCG = NSImage(contentsOfFile: spec.varPath)?.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    print("❌ Failed loading source images for \(spec.id)")
    continue
  }

  guard let finalVariantCG = blendIsolatedPatch(baseImage: baseCG, varImage: varCG, spec: spec) else {
    print("❌ Failed blending patch for \(spec.id)")
    continue
  }

  let folder = "\(outputBaseDir)/\(spec.id)"
  try? fileManager.createDirectory(atPath: folder, withIntermediateDirectories: true, attributes: nil)

  let origPath = "\(folder)/original.png"
  let varFinalPath = "\(folder)/variant.png"

  guard savePNG(image: baseCG, to: origPath),
        savePNG(image: finalVariantCG, to: varFinalPath) else {
    print("❌ Failed writing PNGs for \(spec.id)")
    continue
  }

  print("✅ Successfully authored \(spec.id)")

  let entry: [String: Any] = [
    "id": spec.id,
    "title": spec.title,
    "category": spec.category,
    "pack": spec.pack,
    "packId": spec.packId,
    "difficulty": spec.difficulty,
    "originalImage": "levels/photo-pairs/\(spec.id)/original.png",
    "variantImage": "levels/photo-pairs/\(spec.id)/variant.png",
    "baseImage": "levels/photo-pairs/\(spec.id)/original.png",
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
  manifestEntries.append(entry)
}

// Update manifest
if let data = try? Data(contentsOf: URL(fileURLWithPath: manifestPath)),
   var existingManifest = (try? JSONSerialization.jsonObject(with: data, options: [])) as? [[String: Any]] {

  let newIds = Set(manifestEntries.compactMap { $0["id"] as? String })
  existingManifest.removeAll { entry in
    if let id = entry["id"] as? String {
      return newIds.contains(id)
    }
    return false
  }

  let combined = manifestEntries + existingManifest
  if let updatedData = try? JSONSerialization.data(withJSONObject: combined, options: [.prettyPrinted, .sortedKeys]) {
    try? updatedData.write(to: URL(fileURLWithPath: manifestPath))
    print("🎉 Successfully updated manifest with \(manifestEntries.count) top-tier AI macro photographic levels at the front!")
  }
}
