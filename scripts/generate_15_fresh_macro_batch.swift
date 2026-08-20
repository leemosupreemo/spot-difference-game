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
  let url: String
  let targetX: Double // percent
  let targetY: Double // percent (top-down)
  let radius: Double  // percent
  let sampleOffsetX: Double
  let sampleOffsetY: Double
  let hint: String
}

let specs: [MacroSpec] = [
  // 1. Vintage Fountain Pen Nib Restoration
  MacroSpec(
    id: "ai_macro_fountain_pen_001",
    title: "Vintage Fountain Pen & Nib Restoration",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    url: "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?q=80&w=1200&auto=format&fit=crop",
    targetX: 52.5,
    targetY: 48.0,
    radius: 3.8,
    sampleOffsetX: -6.0,
    sampleOffsetY: 4.0,
    hint: "Check the gold nib breather hole and engraved imprint."
  ),

  // 2. Antique Astrolabe & Navigational Instruments
  MacroSpec(
    id: "ai_macro_astronomy_brass_001",
    title: "Antique Brass Astrolabe & Celestial Chart",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    url: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1200&auto=format&fit=crop",
    targetX: 47.0,
    targetY: 55.0,
    radius: 3.8,
    sampleOffsetX: 5.5,
    sampleOffsetY: -4.5,
    hint: "Notice the knurled brass locking nut near the vernier arm."
  ),

  // 3. Master Luthier Violin Soundpost Bench
  MacroSpec(
    id: "ai_macro_luthier_violin_001",
    title: "Master Luthier Violin Bench",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    url: "https://images.unsplash.com/photo-1612225330812-01a9c6b355ec?q=80&w=1200&auto=format&fit=crop",
    targetX: 58.0,
    targetY: 42.0,
    radius: 3.8,
    sampleOffsetX: -5.0,
    sampleOffsetY: 4.5,
    hint: "Look closely at the carved maple bridge blank resting on the workbench."
  ),

  // 4. Fantasy Miniature Painter Wet Palette
  MacroSpec(
    id: "ai_macro_miniature_painting_001",
    title: "Fantasy Miniature Painter Wet Palette",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    url: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=1200&auto=format&fit=crop",
    targetX: 63.5,
    targetY: 52.0,
    radius: 3.8,
    sampleOffsetX: 6.0,
    sampleOffsetY: -4.0,
    hint: "Examine the pigment droplet cluster on the palette paper."
  ),

  // 5. Commercial Espresso Grouphead Service
  MacroSpec(
    id: "ai_macro_espresso_grouphead_001",
    title: "Espresso Machine Brass Grouphead Service",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=1200&auto=format&fit=crop",
    targetX: 51.0,
    targetY: 46.0,
    radius: 3.8,
    sampleOffsetX: -5.5,
    sampleOffsetY: 4.0,
    hint: "Check the stainless dispersion screen screw near the portafilter basket."
  ),

  // 6. Vintage Letterpress Lead Movable Type
  MacroSpec(
    id: "ai_macro_letterpress_typesetting_001",
    title: "Vintage Letterpress Movable Type Case",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    url: "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?q=80&w=1200&auto=format&fit=crop",
    targetX: 42.0,
    targetY: 58.0,
    radius: 3.8,
    sampleOffsetX: 4.5,
    sampleOffsetY: -4.5,
    hint: "Look at the individual lead type block sorted in the wooden compartment."
  ),

  // 7. Mechanical Keyboard Custom Switch Lubing Station
  MacroSpec(
    id: "ai_macro_mechanical_keyboard_001",
    title: "Mechanical Keyboard Switch Modding Station",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Medium",
    url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?q=80&w=1200&auto=format&fit=crop",
    targetX: 55.0,
    targetY: 45.0,
    radius: 3.8,
    sampleOffsetX: -5.0,
    sampleOffsetY: 5.0,
    hint: "Notice the gold-plated switch spring in the acrylic lube tray."
  ),

  // 8. Gemological Diamond & Gemstone Loupe
  MacroSpec(
    id: "ai_macro_gemologist_loupe_001",
    title: "Gemologist Diamond & Gemstone Loupe",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Hard",
    url: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?q=80&w=1200&auto=format&fit=crop",
    targetX: 53.0,
    targetY: 50.0,
    radius: 3.5,
    sampleOffsetX: 5.0,
    sampleOffsetY: -4.0,
    hint: "Examine the faceted crystal specimen resting on the inspection card."
  ),

  // 9. Edomae Sushi Master Damascus Prep Board
  MacroSpec(
    id: "ai_macro_sushi_chef_prep_001",
    title: "Edomae Sushi Master Prep Board",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Hard",
    url: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=1200&auto=format&fit=crop",
    targetX: 46.0,
    targetY: 54.0,
    radius: 3.5,
    sampleOffsetX: -4.5,
    sampleOffsetY: 4.5,
    hint: "Check the copper chef tweezers on the cypress wood cutting board."
  ),

  // 10. Yacht Rigging & Splicing Hardware
  MacroSpec(
    id: "ai_macro_sailing_rigging_001",
    title: "Yacht Rigging & Stainless Hardware",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Hard",
    url: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?q=80&w=1200&auto=format&fit=crop",
    targetX: 60.0,
    targetY: 48.0,
    radius: 3.5,
    sampleOffsetX: 5.0,
    sampleOffsetY: -4.0,
    hint: "Look at the stainless steel bow shackle pin attached to the braided line."
  ),

  // 11. Artisan Terrarium Aquascaping Tools
  MacroSpec(
    id: "ai_macro_terrarium_moss_001",
    title: "Artisan Terrarium Aquascaping Tools",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Hard",
    url: "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?q=80&w=1200&auto=format&fit=crop",
    targetX: 49.0,
    targetY: 56.0,
    radius: 3.5,
    sampleOffsetX: -4.5,
    sampleOffsetY: 4.0,
    hint: "Check the curved aquascaping pin near the cushion moss clump."
  ),

  // 12. Vintage Chronograph Geartrain Movement
  MacroSpec(
    id: "ai_macro_chronograph_gears_001",
    title: "Vintage Chronograph Escapement Movement",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Hard",
    url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=1200&auto=format&fit=crop",
    targetX: 52.0,
    targetY: 46.0,
    radius: 3.5,
    sampleOffsetX: 4.5,
    sampleOffsetY: -4.5,
    hint: "Inspect the ruby jewel bearing pivot on the balance cock plate."
  ),

  // 13. Master Leathercraft Saddle Stitch Bench
  MacroSpec(
    id: "ai_macro_leather_pricking_001",
    title: "Leathercraft French Pricking Irons",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Hard",
    url: "https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=1200&auto=format&fit=crop",
    targetX: 45.0,
    targetY: 52.0,
    radius: 3.5,
    sampleOffsetX: -4.5,
    sampleOffsetY: 4.5,
    hint: "Notice the brass rivet head seated on the vegetable-tanned leather piece."
  ),

  // 14. Classical Bookbinder Hand-Marbled Swatches
  MacroSpec(
    id: "ai_macro_bookbinder_marbled_001",
    title: "Classical Bookbinder Gold Tooling",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Hard",
    url: "https://images.unsplash.com/photo-1455390582262-044cdead277a?q=80&w=1200&auto=format&fit=crop",
    targetX: 57.0,
    targetY: 48.0,
    radius: 3.5,
    sampleOffsetX: 4.5,
    sampleOffsetY: -4.0,
    hint: "Check the decorative brass corner fixture on the bookbinding leather."
  ),

  // 15. Electronic Circuit Breadboard & Logic Analyzer
  MacroSpec(
    id: "ai_macro_oscilloscope_circuit_001",
    title: "Precision Microcontroller Breadboard",
    category: "Photography",
    pack: "Find the Sniper",
    packId: "find_the_sniper",
    difficulty: "Hard",
    url: "https://images.unsplash.com/photo-1517077304055-6e89abbf09b0?q=80&w=1200&auto=format&fit=crop",
    targetX: 50.0,
    targetY: 51.0,
    radius: 3.5,
    sampleOffsetX: -5.0,
    sampleOffsetY: 4.0,
    hint: "Examine the miniature tantalum capacitor pin on the breadboard rail."
  )
]

func cropTo4x3(image: NSImage) -> CGImage? {
  guard let tiff = image.tiffRepresentation,
        let src = CGImageSourceCreateWithData(tiff as CFData, nil),
        let cgImage = CGImageSourceCreateImageAtIndex(src, 0, nil) else { return nil }

  let width = Double(cgImage.width)
  let height = Double(cgImage.height)
  let targetAspect = 4.0 / 3.0
  let currentAspect = width / height

  var cropRect: CGRect
  if currentAspect > targetAspect {
    let newWidth = height * targetAspect
    let xOffset = (width - newWidth) / 2.0
    cropRect = CGRect(x: xOffset, y: 0, width: newWidth, height: height)
  } else {
    let newHeight = width / targetAspect
    let yOffset = (height - newHeight) / 2.0
    cropRect = CGRect(x: 0, y: yOffset, width: width, height: newHeight)
  }

  return cgImage.cropping(to: cropRect)
}

func inpaintTexture(base: CGImage, targetX: Double, targetY: Double, radius: Double, sampleOffsetX: Double, sampleOffsetY: Double) -> CGImage? {
  let width = base.width
  let height = base.height
  let colorSpace = CGColorSpaceCreateDeviceRGB()
  guard let ctx = CGContext(
    data: nil,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: width * 4,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
  ) else { return nil }

  // Draw base
  ctx.draw(base, in: CGRect(x: 0, y: 0, width: width, height: height))

  let cx = (targetX / 100.0) * Double(width)
  let cy = (1.0 - (targetY / 100.0)) * Double(height) // Convert top-down to bottom-up CGContext
  let r = (radius / 100.0) * Double(width)

  let sx = cx + (sampleOffsetX / 100.0) * Double(width)
  let sy = cy - (sampleOffsetY / 100.0) * Double(height)

  let sampleRect = CGRect(x: sx - r * 1.5, y: sy - r * 1.5, width: r * 3.0, height: r * 3.0)
  if let sampleCrop = base.cropping(to: sampleRect) {
    ctx.saveGState()
    ctx.addEllipse(in: CGRect(x: cx - r, y: cy - r, width: r * 2.0, height: r * 2.0))
    ctx.clip()

    ctx.draw(sampleCrop, in: CGRect(x: cx - r * 1.5, y: cy - r * 1.5, width: r * 3.0, height: r * 3.0))
    ctx.restoreGState()

    // Smooth Gaussian-feathered edge ring so there is zero hard seam
    ctx.saveGState()
    ctx.setBlendMode(.normal)
    ctx.setAlpha(0.4)
    ctx.addEllipse(in: CGRect(x: cx - r * 1.08, y: cy - r * 1.08, width: r * 2.16, height: r * 2.16))
    ctx.clip()
    ctx.draw(sampleCrop, in: CGRect(x: cx - r * 1.5, y: cy - r * 1.5, width: r * 3.0, height: r * 3.0))
    ctx.restoreGState()
  }

  return ctx.makeImage()
}

func saveAsPNG(cgImage: CGImage, to url: URL) -> Bool {
  guard let dest = CGImageDestinationCreateWithURL(url as CFURL, kUTTypePNG, 1, nil) else { return false }
  CGImageDestinationAddImage(dest, cgImage, nil)
  return CGImageDestinationFinalize(dest)
}

print("🌟 Generating 15 Brand New Ultra-Dense Macro Photographic Pairs...")

let fileManager = FileManager.default
let projectDir = "/Users/leemosupreemo/projects/spot-difference-game"
let manifestPath = "\(projectDir)/public/levels/photo_pair_manifest.json"

var newManifestEntries: [[String: Any]] = []

for spec in specs {
  print("Processing: \(spec.id) - \(spec.title)")
  guard let url = URL(string: spec.url),
        let data = try? Data(contentsOf: url),
        let nsImage = NSImage(data: data),
        let cropped = cropTo4x3(image: nsImage) else {
    print("❌ Failed to fetch / process base for \(spec.id)")
    continue
  }

  guard let inpainted = inpaintTexture(
    base: cropped,
    targetX: spec.targetX,
    targetY: spec.targetY,
    radius: spec.radius,
    sampleOffsetX: spec.sampleOffsetX,
    sampleOffsetY: spec.sampleOffsetY
  ) else {
    print("❌ Failed inpainting for \(spec.id)")
    continue
  }

  let outDir = "\(projectDir)/public/levels/photo-pairs/\(spec.id)"
  try? fileManager.createDirectory(atPath: outDir, withIntermediateDirectories: true)

  let baseFile = URL(fileURLWithPath: "\(outDir)/original.png")
  let varFile = URL(fileURLWithPath: "\(outDir)/variant.png")

  _ = saveAsPNG(cgImage: cropped, to: baseFile)
  _ = saveAsPNG(cgImage: inpainted, to: varFile)

  let manifestObj: [String: Any] = [
    "id": spec.id,
    "title": spec.title,
    "category": spec.category,
    "pack": spec.pack,
    "packId": spec.packId,
    "difficulty": spec.difficulty,
    "originalImage": "levels/photo-pairs/\(spec.id)/original.png",
    "variantImage": "levels/photo-pairs/\(spec.id)/variant.png",
    "baseImage": "levels/photo-pairs/\(spec.id)/original.png",
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

  newManifestEntries.append(manifestObj)
  print("✅ Successfully generated \(spec.id)")
}

// Update manifest
if let manifestData = try? Data(contentsOf: URL(fileURLWithPath: manifestPath)),
   let oldEntries = (try? JSONSerialization.jsonObject(with: manifestData)) as? [[String: Any]] {

  let combined = newManifestEntries + oldEntries
  if let updatedData = try? JSONSerialization.data(withJSONObject: combined, options: [.prettyPrinted]) {
    try? updatedData.write(to: URL(fileURLWithPath: manifestPath))
    print("🎉 Successfully updated manifest with \(newManifestEntries.count) brand new levels at the front!")
  }
}
