import AppKit
let size=NSSize(width:1024,height:1024)
let image=NSImage(size:size)
image.lockFocus()
NSColor(calibratedRed:0.09,green:0.17,blue:0.29,alpha:1).setFill()
NSBezierPath(roundedRect:NSRect(x:32,y:32,width:960,height:960),xRadius:210,yRadius:210).fill()
NSColor(calibratedRed:0.25,green:0.48,blue:1,alpha:1).setFill()
NSBezierPath(roundedRect:NSRect(x:246,y:180,width:532,height:664),xRadius:48,yRadius:48).fill()
NSColor.white.setFill()
for i in 0..<4 { NSBezierPath(roundedRect:NSRect(x:334,y:650-i*105,width:i==3 ? 210:356,height:28),xRadius:14,yRadius:14).fill() }
image.unlockFocus()
let data=NSBitmapImageRep(data:image.tiffRepresentation!)!.representation(using:.png,properties:[:])!
try data.write(to:URL(fileURLWithPath:CommandLine.arguments[1]))
