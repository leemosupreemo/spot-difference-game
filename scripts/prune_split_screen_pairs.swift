import Foundation
import CoreGraphics
import AppKit

struct Diff: Codable {
    let id: Int
    let x: Double
    let y: Double
    let radius: Double
    let hint: String?
}

struct ManifestEntry: Codable {
    let id: String
    let title: String?
    let baseImage: String?
    let variantImage: String?
    let packId: String?
    let pack: String?
    let difficulty: String?
    let category: String?
    let diffs: [Diff]?
}

let root = FileManager.default.currentDirectoryPath
let manifestUrl = URL(fileURLWithPath: "\(root)/public/levels/photo_pair_manifest.json")
let backupUrl = URL(fileURLWithPath: "\(root)/public/levels/photo_pair_manifest.backup.json")

guard let data = try? Data(contentsOf: manifestUrl),
      let entries = try? JSONDecoder().decode([ManifestEntry].self, from: data) else {
    print("❌ Failed to load manifest")
    exit(1)
}

// Backup original manifest
try? data.write(to: backupUrl)
print("💾 Backed up manifest to \(backupUrl.path)")

func loadImage(relativePath: String) -> CGImage? {
    let cleanPath = relativePath.hasPrefix("/") ? String(relativePath.dropFirst()) : relativePath
    let fullPath = "\(root)/public/\(cleanPath)"
    guard let nsImage = NSImage(contentsOfFile: fullPath) else { return nil }
    var rect = CGRect(origin: .zero, size: nsImage.size)
    return nsImage.cgImage(forProposedRect: &rect, context: nil, hints: nil)
}

func checkSplitScreen(image: CGImage) -> (isSplit: Bool, reason: String, score: Double) {
    let width = image.width
    let height = image.height
    guard width > 100 && height > 100 else { return (false, "too small", 0) }

    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bytesPerPixel = 4
    let bytesPerRow = bytesPerPixel * width
    var rawData = [UInt8](repeating: 0, count: height * bytesPerRow)
    guard let context = CGContext(
        data: &rawData,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: bytesPerRow,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
        return (false, "context error", 0)
    }
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))

    let halfW = width / 2
    let sampleStep = 4
    var diffSum: Double = 0
    var totalSamples: Double = 0

    for y in stride(from: 0, to: height, by: sampleStep) {
        for x in stride(from: 0, to: halfW, by: sampleStep) {
            let leftIdx = (y * width + x) * bytesPerPixel
            let rightIdx = (y * width + (x + halfW)) * bytesPerPixel

            let rDiff = abs(Double(rawData[leftIdx]) - Double(rawData[rightIdx]))
            let gDiff = abs(Double(rawData[leftIdx + 1]) - Double(rawData[rightIdx + 1]))
            let bDiff = abs(Double(rawData[leftIdx + 2]) - Double(rawData[rightIdx + 2]))

            let pixelDiff = (rDiff + gDiff + bDiff) / (3.0 * 255.0)
            diffSum += pixelDiff
            totalSamples += 1
        }
    }
    let avgSideBySideDiff = diffSum / totalSamples

    let halfH = height / 2
    var hDiffSum: Double = 0
    var hTotalSamples: Double = 0

    for y in stride(from: 0, to: halfH, by: sampleStep) {
        for x in stride(from: 0, to: width, by: sampleStep) {
            let topIdx = (y * width + x) * bytesPerPixel
            let botIdx = ((y + halfH) * width + x) * bytesPerPixel

            let rDiff = abs(Double(rawData[topIdx]) - Double(rawData[botIdx]))
            let gDiff = abs(Double(rawData[topIdx + 1]) - Double(rawData[botIdx + 1]))
            let bDiff = abs(Double(rawData[topIdx + 2]) - Double(rawData[botIdx + 2]))

            let pixelDiff = (rDiff + gDiff + bDiff) / (3.0 * 255.0)
            hDiffSum += pixelDiff
            hTotalSamples += 1
        }
    }
    let avgTopBottomDiff = hDiffSum / hTotalSamples

    if avgSideBySideDiff < 0.10 {
        return (true, "Side-by-side split (similarity: \(String(format: "%.1f%%", (1.0 - avgSideBySideDiff) * 100)))", avgSideBySideDiff)
    }

    if avgTopBottomDiff < 0.10 {
        return (true, "Top-bottom split (similarity: \(String(format: "%.1f%%", (1.0 - avgTopBottomDiff) * 100)))", avgTopBottomDiff)
    }

    return (false, "normal", avgSideBySideDiff)
}

var cleanEntries = [ManifestEntry]()
var prunedEntries = [ManifestEntry]()

for entry in entries {
    guard let baseImgPath = entry.baseImage, let img = loadImage(relativePath: baseImgPath) else {
        cleanEntries.append(entry)
        continue
    }
    let result = checkSplitScreen(image: img)
    if result.isSplit {
        print("✂️ Pruning [\(entry.id)]: \(entry.title ?? "") -> \(result.reason)")
        prunedEntries.append(entry)
    } else {
        cleanEntries.append(entry)
    }
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]

if let outputData = try? encoder.encode(cleanEntries) {
    try? outputData.write(to: manifestUrl)
    print("\n✅ Successfully pruned \(prunedEntries.count) split-screen levels.")
    print("📊 Clean remaining levels in manifest: \(cleanEntries.count) (from \(entries.count) original)")
} else {
    print("❌ Failed to encode clean manifest")
}
