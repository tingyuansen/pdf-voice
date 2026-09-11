Icon sources. `make-icon.swift` draws the 1024 px master (`swift make-icon.swift icon1024.png`);
the `icon.iconset` sizes come from it (`sips -z <size> <size> icon1024.png --out icon.iconset/icon_<size>x<size>.png`
for each entry) and `iconutil -c icns icon.iconset -o ../resources/icon.icns` writes the bundle icon.
