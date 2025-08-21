export async function loadAllFontsInNode(textNode: TextNode): Promise<void> {
  const len = textNode.characters.length
  if (len === 0) return
  if (textNode.fontName !== figma.mixed) { await figma.loadFontAsync(textNode.fontName as FontName); return }
  let i = 0
  while (i < len) {
    const font = textNode.getRangeFontName(i, i + 1) as FontName
    await figma.loadFontAsync(font)
    let j = i + 1
    while (j < len) {
      const f2 = textNode.getRangeFontName(j, j + 1) as FontName
      if (f2.family !== font.family || f2.style !== font.style) break
      j++
    }
    i = j
  }
}


