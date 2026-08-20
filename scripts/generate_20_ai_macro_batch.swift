#!/usr/bin/env swift

import AppKit
import Foundation
import CoreGraphics
import ImageIO

struct MacroSpec {
  let id: String
  let title: String
  let category: String
  let pack: String
  let packId: String
  let difficulty: String
  let localBasePath: String?
  let localVarPath: String?
  let url: String?
  let targetX: Double // percent
  let targetY: Double // percent (top-down)
  let radius: Double  // percent
  let sampleOffsetX: Double
  let sampleOffsetY: Double
  let hint: String
}

let specs: [MacroSpec] = [
  // 1. Woodcarver
  MacroSpec(
    id: "ai_macro_woodcarver_001",
    title: "Artisan Woodcarver Chisel Rack",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    localBasePath: "/Users/leemosupreemo/.gemini/antigravity-cli/brain/f0be84e1-5a69-4bf4-8859-f2381e9aac49/woodcarver_base_1787176628263.jpg",
    localVarPath: "/Users/leemosupreemo/.gemini/antigravity-cli/brain/f0be84e1-5a69-4bf4-8859-f2381e9aac49/woodcarver_variant_1787176648172.jpg",
    url: nil,
    targetX: 44.1,
    targetY: 74.2,
    radius: 4.5,
    sampleOffsetX: 0,
    sampleOffsetY: 0,
    hint: "Check the carved decorative relief piece next to the wooden spoon."
  ),
  // 2. Spice Bazaar
  MacroSpec(
    id: "ai_macro_spice_bazaar_001",
    title: "Artisan Exotic Spice Board",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    localBasePath: "/Users/leemosupreemo/.gemini/antigravity-cli/brain/f0be84e1-5a69-4bf4-8859-f2381e9aac49/spice_base_1787176669585.jpg",
    localVarPath: "/Users/leemosupreemo/.gemini/antigravity-cli/brain/f0be84e1-5a69-4bf4-8859-f2381e9aac49/spice_variant_inpainted.png",
    url: nil,
    targetX: 24.0,
    targetY: 52.5,
    radius: 4.2,
    sampleOffsetX: 0,
    sampleOffsetY: 0,
    hint: "Examine the star anise cluster near the cumin wooden bowl."
  ),
  // 3. Watchmaker Parts Drawer
  MacroSpec(
    id: "ai_macro_watchmaker_002",
    title: "Horology Watch Parts Tray",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    localBasePath: nil,
    localVarPath: nil,
    url: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=1200&auto=format&fit=crop",
    targetX: 48.0,
    targetY: 54.0,
    radius: 4.2,
    sampleOffsetX: -6.0,
    sampleOffsetY: 4.0,
    hint: "Notice the brass pinion wheel resting on the center tray."
  ),
  // 4. Locksmith Keys
  MacroSpec(
    id: "ai_macro_locksmith_001",
    title: "Master Locksmith Skeleton Keys",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    localBasePath: nil,
    localVarPath: nil,
    url: "https://images.unsplash.com/photo-1582139329536-e7284fece509?q=80&w=1200&auto=format&fit=crop",
    targetX: 62.0,
    targetY: 46.0,
    radius: 4.2,
    sampleOffsetX: 6.0,
    sampleOffsetY: -5.0,
    hint: "Inspect the antique brass key ring with assorted mortise keys."
  ),
  // 5. Calligraphy Desk
  MacroSpec(
    id: "ai_macro_calligraphy_001",
    title: "Medieval Scribe Calligraphy Desk",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    localBasePath: nil,
    localVarPath: nil,
    url: "https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?q=80&w=1200&auto=format&fit=crop",
    targetX: 38.0,
    targetY: 62.0,
    radius: 4.5,
    sampleOffsetX: -5.0,
    sampleOffsetY: -5.0,
    hint: "Look near the brass inkwell and sealing wax stamp."
  ),
  // 6. Chef Knife Prep
  MacroSpec(
    id: "ai_macro_chef_knife_001",
    title: "Culinary Herb & Prep Station",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    localBasePath: nil,
    localVarPath: nil,
    url: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?q=80&w=1200&auto=format&fit=crop",
    targetX: 56.0,
    targetY: 48.0,
    radius: 4.2,
    sampleOffsetX: 6.0,
    sampleOffsetY: 5.0,
    hint: "Spot the whole garlic clove near the rosemary cutting board."
  ),
  // 7. Cartographer Maps
  MacroSpec(
    id: "ai_macro_cartography_001",
    title: "Vintage Cartographer Sea Chart",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    localBasePath: nil,
    localVarPath: nil,
    url: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?q=80&w=1200&auto=format&fit=crop",
    targetX: 42.0,
    targetY: 58.0,
    radius: 4.5,
    sampleOffsetX: -6.0,
    sampleOffsetY: 5.0,
    hint: "Check the brass divider caliper near the sea chart compass."
  ),
  // 8. Cobbler Bench
  MacroSpec(
    id: "ai_macro_cobbler_tools_001",
    title: "Cobbler Leather Shoe Last",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    localBasePath: nil,
    localVarPath: nil,
    url: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?q=80&w=1200&auto=format&fit=crop",
    targetX: 65.0,
    targetY: 52.0,
    radius: 4.2,
    sampleOffsetX: 6.0,
    sampleOffsetY: -6.0,
    hint: "Inspect the brass shoe tacks resting in the cobbler tray."
  ),
  // 9. Fine Jewelry Smith
  MacroSpec(
    id: "ai_macro_jewelry_smith_001",
    title: "Goldsmith Jewelry Bench",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    localBasePath: nil,
    localVarPath: nil,
    url: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?q=80&w=1200&auto=format&fit=crop",
    targetX: 46.0,
    targetY: 64.0,
    radius: 4.2,
    sampleOffsetX: -5.0,
    sampleOffsetY: -5.0,
    hint: "Find the silver bezel wire ring on the jeweler wooden peg."
  ),
  // 10. Camera Lens Repair
  MacroSpec(
    id: "ai_macro_camera_optics_001",
    title: "Camera Optics Workbench",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    localBasePath: nil,
    localVarPath: nil,
    url: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1200&auto=format&fit=crop",
    targetX: 54.0,
    targetY: 42.0,
    radius: 4.2,
    sampleOffsetX: 6.0,
    sampleOffsetY: 6.0,
    hint: "Look at the spanner wrench tool near the aperture ring."
  ),
  // 11. Fly Tying Bench
  MacroSpec(
    id: "ai_macro_fishing_fly_001",
    title: "Fly Tying Feather Bench",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Hard",
    localBasePath: nil,
    localVarPath: nil,
    url: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=1200&auto=format&fit=crop",
    targetX: 60.0,
    targetY: 56.0,
    radius: 3.8,
    sampleOffsetX: -6.0,
    sampleOffsetY: 5.0,
    hint: "Check the tungsten bead head hook in the tying tray."
  ),
  // 12. Pottery Sculptor Table
  MacroSpec(
    id: "ai_macro_pottery_tools_001",
    title: "Artisan Ceramic Modeling Tools",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Hard",
    localBasePath: nil,
    localVarPath: nil,
    url: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?q=80&w=1200&auto=format&fit=crop",
    targetX: 36.0,
    targetY: 48.0,
    radius: 4.0,
    sampleOffsetX: 6.0,
    sampleOffsetY: -6.0,
    hint: "Spot the boxwood ribbon loop tool resting on the canvas cloth."
  ),
  // 13. Gongfu Tea Tasting
  MacroSpec(
    id: "ai_macro_tea_ceremony_001",
    title: "Traditional Gongfu Tea Board",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Hard",
    localBasePath: nil,
    localVarPath: nil,
    url: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?q=80&w=1200&auto=format&fit=crop",
    targetX: 68.0,
    targetY: 54.0,
    radius: 3.8,
    sampleOffsetX: -5.0,
    sampleOffsetY: 5.0,
    hint: "Notice the bamboo tea needle pick resting by the porcelain gaiwan."
  ),
  // 14. Vacuum Tube Radio
  MacroSpec(
    id: "ai_macro_vintage_radio_001",
    title: "Vacuum Tube Audio Assembly",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Hard",
    localBasePath: nil,
    localVarPath: nil,
    url: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&auto=format&fit=crop",
    targetX: 52.0,
    targetY: 62.0,
    radius: 3.8,
    sampleOffsetX: 5.0,
    sampleOffsetY: -5.0,
    hint: "Examine the silver contact pin on the vintage socket."
  ),
  // 15. Sourdough Baker Table
  MacroSpec(
    id: "ai_macro_bakers_prep_001",
    title: "Artisan Sourdough Proofing Mat",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Hard",
    localBasePath: nil,
    localVarPath: nil,
    url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=1200&auto=format&fit=crop",
    targetX: 38.0,
    targetY: 58.0,
    radius: 4.0,
    sampleOffsetX: -6.0,
    sampleOffsetY: -5.0,
    hint: "Find the brass lame scoring razor resting near the flour bowl."
  ),
  // 16. Mineral Gemstone Study
  MacroSpec(
    id: "ai_macro_mineral_study_001",
    title: "Geologist Mineral & Crystal Study",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Hard",
    localBasePath: nil,
    localVarPath: nil,
    url: "https://images.unsplash.com/photo-1516962215378-7fa2e137ae93?q=80&w=1200&auto=format&fit=crop",
    targetX: 62.0,
    targetY: 44.0,
    radius: 3.8,
    sampleOffsetX: 6.0,
    sampleOffsetY: 5.0,
    hint: "Look at the quartz crystal point in the wooden specimen tray."
  ),
  // 17. Mechanical Typewriter
  MacroSpec(
    id: "ai_macro_typewriter_repair_001",
    title: "Mechanical Typewriter Workshop",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Hard",
    localBasePath: nil,
    localVarPath: nil,
    url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?q=80&w=1200&auto=format&fit=crop",
    targetX: 46.0,
    targetY: 50.0,
    radius: 3.8,
    sampleOffsetX: -5.0,
    sampleOffsetY: -6.0,
    hint: "Inspect the steel typebar linkage spring on the assembly plate."
  ),
  // 18. Espresso Station
  MacroSpec(
    id: "ai_macro_barista_coffee_001",
    title: "Specialty Espresso Barista Mat",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Hard",
    localBasePath: nil,
    localVarPath: nil,
    url: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?q=80&w=1200&auto=format&fit=crop",
    targetX: 58.0,
    targetY: 66.0,
    radius: 4.0,
    sampleOffsetX: 6.0,
    sampleOffsetY: -5.0,
    hint: "Spot the stainless distribution puck screen near the tamper."
  ),
  // 19. Washi Bookbinding
  MacroSpec(
    id: "ai_macro_washi_paper_001",
    title: "Japanese Washi Bookbinding Desk",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Hard",
    localBasePath: nil,
    localVarPath: nil,
    url: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?q=80&w=1200&auto=format&fit=crop",
    targetX: 34.0,
    targetY: 56.0,
    radius: 4.0,
    sampleOffsetX: -6.0,
    sampleOffsetY: 5.0,
    hint: "Examine the bone folder creaser on the decorative washi paper."
  ),
  // 20. Couture Sewing Notions
  MacroSpec(
    id: "ai_macro_sewing_notions_001",
    title: "Couture Tailor Notions Box",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Hard",
    localBasePath: nil,
    localVarPath: nil,
    url: "https://images.unsplash.com/photo-1504148455328-c376907d081c?q=80&w=1200&auto=format&fit=crop",
    targetX: 64.0,
    targetY: 48.0,
    radius: 3.8,
    sampleOffsetX: 5.0,
    sampleOffsetY: -5.0,
    hint: "Find the carved mother-of-pearl button in the sewing tray."
  )
]

let repoRoot = FileManager.default.currentDirectoryPath
let outputBaseDir = "\(repoRoot)/public/levels/photo-pairs"
let manifestPath = "\(repoRoot)/public/levels/photo_pair_manifest.json"
let fileManager = FileManager.default

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
  guard let destination = CGImageDestinationCreateWithURL(URL(fileURLWithPath: path) as CFURL, "public.png" as CFString, 1, nil) else {
    return false
  }
  CGImageDestinationAddImage(destination, image, nil)
  return CGImageDestinationFinalize(destination)
}

func inpaintTexture(baseImage: CGImage, spec: MacroSpec) -> CGImage? {
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

  ctx.draw(baseImage, in: CGRect(x: 0, y: 0, width: w, height: h))

  let targetPixelX = (spec.targetX / 100.0) * Double(w)
  let targetPixelY = ((100.0 - spec.targetY) / 100.0) * Double(h)
  let samplePixelX = targetPixelX + (spec.sampleOffsetX / 100.0) * Double(w)
  let samplePixelY = targetPixelY - (spec.sampleOffsetY / 100.0) * Double(h)
  let radiusPixels = (spec.radius / 100.0) * Double(w)

  let sampleRect = CGRect(x: samplePixelX - radiusPixels * 1.2, y: samplePixelY - radiusPixels * 1.2, width: radiusPixels * 2.4, height: radiusPixels * 2.4)
  let destRect = CGRect(x: targetPixelX - radiusPixels * 1.2, y: targetPixelY - radiusPixels * 1.2, width: radiusPixels * 2.4, height: radiusPixels * 2.4)

  guard let sampleCG = baseImage.cropping(to: sampleRect) else { return nil }

  let maskW = Int(radiusPixels * 2.4)
  let maskH = Int(radiusPixels * 2.4)

  if let maskCtx = CGContext(
    data: nil,
    width: maskW,
    height: maskH,
    bitsPerComponent: 8,
    bytesPerRow: maskW,
    space: CGColorSpaceCreateDeviceGray(),
    bitmapInfo: CGImageAlphaInfo.none.rawValue
  ) {
    let center = CGPoint(x: maskW / 2, y: maskH / 2)
    let maxR = CGFloat(radiusPixels)
    for my in 0..<maskH {
      for mx in 0..<maskW {
        let dx = CGFloat(mx) - center.x
        let dy = CGFloat(my) - center.y
        let d = sqrt(dx*dx + dy*dy)
        let alpha = d < maxR * 0.6 ? 1.0 : (d > maxR ? 0.0 : (1.0 - (d - maxR * 0.6) / (maxR * 0.4)))
        let b = UInt8(max(0, min(255, alpha * 255.0)))
        maskCtx.data?.advanced(by: my * maskW + mx).storeBytes(of: b, as: UInt8.self)
      }
    }
    if let mask = maskCtx.makeImage() {
      ctx.saveGState()
      ctx.clip(to: destRect, mask: mask)
      ctx.draw(sampleCG, in: destRect)
      ctx.restoreGState()
    }
  }

  return ctx.makeImage()
}

print("🌟 Generating 20 Ultra-Dense Macro Photographic Pairs...")

var newEntries: [[String: Any]] = []

for spec in specs {
  print("Processing: \(spec.id) - \(spec.title)")
  var baseCG: CGImage?
  var varCG: CGImage?

  if let localBase = spec.localBasePath, let localBaseCG = NSImage(contentsOfFile: localBase)?.cgImage(forProposedRect: nil, context: nil, hints: nil) {
    baseCG = localBaseCG
    if let localVar = spec.localVarPath, let localVarCG = NSImage(contentsOfFile: localVar)?.cgImage(forProposedRect: nil, context: nil, hints: nil) {
      varCG = localVarCG
    } else {
      varCG = inpaintTexture(baseImage: localBaseCG, spec: spec)
    }
  } else if let url = spec.url, let downloaded = downloadImage(from: url) {
    baseCG = downloaded
    varCG = inpaintTexture(baseImage: downloaded, spec: spec)
  }

  guard let baseFinal = baseCG, let varFinal = varCG else {
    print("❌ Failed preparing images for \(spec.id)")
    continue
  }

  let folder = "\(outputBaseDir)/\(spec.id)"
  try? fileManager.createDirectory(atPath: folder, withIntermediateDirectories: true, attributes: nil)

  let origPath = "\(folder)/original.png"
  let varPath = "\(folder)/variant.png"

  guard savePNG(image: baseFinal, to: origPath),
        savePNG(image: varFinal, to: varPath) else {
    print("❌ Failed saving PNGs for \(spec.id)")
    continue
  }

  print("✅ Successfully generated \(spec.id)")

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
  newEntries.append(entry)
}

// Update manifest
if let data = try? Data(contentsOf: URL(fileURLWithPath: manifestPath)),
   var existingManifest = (try? JSONSerialization.jsonObject(with: data, options: [])) as? [[String: Any]] {

  let newIds = Set(newEntries.compactMap { $0["id"] as? String })
  existingManifest.removeAll { entry in
    if let id = entry["id"] as? String {
      return newIds.contains(id)
    }
    return false
  }

  // Prepend brand-new entries to front!
  let combined = newEntries + existingManifest
  if let updatedData = try? JSONSerialization.data(withJSONObject: combined, options: [.prettyPrinted, .sortedKeys]) {
    try? updatedData.write(to: URL(fileURLWithPath: manifestPath))
    print("🎉 Successfully updated manifest with \(newEntries.count) brand new levels at the front!")
  }
}
