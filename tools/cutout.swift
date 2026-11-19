// Cut the subject out of a picture with macOS Vision (the same lift as "Copy Subject" in Photos).
// usage: swift tools/cutout.swift <in.png|jpg> <out.png>   writes a transparent PNG cropped to the subject
import AppKit
import CoreImage
import Vision

let args = CommandLine.arguments
guard args.count == 3 else { print("usage: cutout.swift <in> <out.png>"); exit(2) }
let inURL = URL(fileURLWithPath: args[1]), outURL = URL(fileURLWithPath: args[2])
guard let ci = CIImage(contentsOf: inURL) else { print("cannot read \(inURL.path)"); exit(1) }

let handler = VNImageRequestHandler(ciImage: ci)
let req = VNGenerateForegroundInstanceMaskRequest()
do { try handler.perform([req]) } catch { print("vision failed: \(error)"); exit(1) }
guard let obs = req.results?.first, !obs.allInstances.isEmpty else { print("no subject found"); exit(1) }
let buf = try obs.generateMaskedImage(ofInstances: obs.allInstances, from: handler, croppedToInstancesExtent: true)
let out = CIImage(cvPixelBuffer: buf)
let ctx = CIContext()
guard let cs = CGColorSpace(name: CGColorSpace.sRGB) else { exit(1) }
try ctx.writePNGRepresentation(of: out, to: outURL, format: .RGBA8, colorSpace: cs)
print("\(obs.allInstances.count) subject(s) -> \(outURL.path) \(Int(out.extent.width))x\(Int(out.extent.height))")
