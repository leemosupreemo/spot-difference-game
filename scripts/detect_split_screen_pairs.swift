import Foundation
import CoreGraphics
import AppKit

struct ManifestEntry: Codable {
    let id: String
    let title: String?
    let baseImage: String?
    let variantImage: String?
    let packId: String?
}

let root = FileManager.default.currentDirectoryPath
let manifestUrl = URL(fileURLWithPath: "\(root)/public/levels/photo_pair_manifest.json")

guard let data = try? Data(contentsOf: manifestUrl),
      let entries = try? JSONDecoder().decode([ManifestEntry].self, from: data) else {
    print("Failed to load manifest")
    exit(1)
}

print("Loaded \(entries.count) entries from manifest.")

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

    // Render image into RGB bitmap
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

    // 1. Check Vertical Split (Left half vs Right half comparison)
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

    // 2. Check Center Seam / Vertical Dividing Line (x in [halfW - 2 ... halfW + 2])
    var centerColEnergy: Double = 0
    var offCenterEnergy: Double = 0
    var seamSamples: Double = 0

    for y in stride(from: 5, to: height - 5, by: 2) {
        let centerIdx = (y * width + halfW) * bytesPerPixel
        let leftIdx = (y * width + (halfW - 3)) * bytesPerPixel
        let rightIdx = (y * width + (halfW + 3)) * bytesPerPixel

        let crDiff = abs(Double(rawData[leftIdx]) - Double(rawData[rightIdx]))
        let cgDiff = abs(Double(rawData[leftIdx + 1]) - Double(rawData[rightIdx + 1]))
        let cbDiff = abs(Double(rawData[leftIdx + 2]) - Double(rawData[rightIdx + 2]))
        let centerEdge = (crDiff + cgDiff + cbDiff) / (3.0 * 255.0)

        centerColEnergy += centerEdge
        seamSamples += 1
    }
    let avgCenterSeam = centerColEnergy / seamSamples

    // 3. Check Horizontal Split (Top half vs Bottom half comparison)
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

    // Detection Thresholds:
    // If left and right halves are very similar (avg diff < 0.12 = 12%), it's a side-by-side split comparison image!
    if avgSideBySideDiff < 0.10 {
        return (true, "Left/Right halves identical (Side-by-side diff: \(String(format: "%.2f%%", avgSideBySideDiff * 100)))", avgSideBySideDiff)
    }

    if avgTopBottomDiff < 0.10 {
        return (true, "Top/Bottom halves identical (Top-bottom diff: \(String(format: "%.2f%%", avgTopBottomDiff * 100)))", avgTopBottomDiff)
    }

    return (false, "normal", avgSideBySideDiff)
}

var splitScreenIds = [String]()

for entry in entries {
    guard let baseImgPath = entry.baseImage, let img = loadImage(relativePath: baseImgPath) else {
        continue
    }
    let result = checkSplitScreen(image: img)
    if result.isSplit {
        print("❌ [SPLIT SCREEN DETECTED] \(entry.id) (\(entry.title ?? "")) -> \(result.reason)")
        splitScreenIds.append(entry.id)
    }
}

print("\n--- SUMMARY ---")
print("Total split screen images found: \(splitScreenIds.count) of \(entries.count)")
print("IDs: \(splitScreenIds)")
