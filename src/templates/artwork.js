// Illustrated frame geometry is measured from each asset's transparent openings.
// The authored four-photo strip uses the complete image without stretching it.
export function computeArtworkLayout(artwork, width) {
  const scale = width / artwork.width;
  const slots = artwork.windows.map(({ x, y, w, h }) => ({ x: x * scale, y: y * scale, w: w * scale, h: h * scale }));
  return { W: width, H: Math.round(artwork.height * scale), slots, rowRects: slots, baseW: slots[0].w, artworkNative: true };
}

// Adapt other photo arrangements without slicing characters into partial stickers.
// Header/footer illustrations keep their original proportions at the new width.
export function adaptArtworkLayout(template, geo) {
  const { artwork, layout } = template;
  const first = artwork.windows[0];
  const last = artwork.windows[artwork.windows.length - 1];
  const header = Math.round((first.y - 12) * geo.W / artwork.width) + 10;
  const footer = Math.round((artwork.height - last.y - last.h - 12) * geo.W / artwork.width) + 10;
  const shift = header - layout.top;
  const move = (r) => ({ ...r, y: r.y + shift });
  return {
    ...geo,
    H: geo.H + shift + footer - layout.bottom,
    slots: geo.slots.map(move),
    rowRects: geo.rowRects.map(move),
    artworkHeader: header,
    artworkFooter: footer,
  };
}

export function drawArtwork(ctx, image, template, geo) {
  const { artwork } = template;
  const { W, H, slots } = geo;
  if (geo.artworkNative) {
    ctx.drawImage(image, 0, 0, W, H);
    return;
  }

  const first = artwork.windows[0];
  const imageScale = { x: (image.naturalWidth || artwork.width) / artwork.width, y: (image.naturalHeight || artwork.height) / artwork.height };
  const last = artwork.windows[artwork.windows.length - 1];
  const footerY = last.y + last.h + 12;
  // The original title and footer illustration remain part of every arrangement.
  ctx.drawImage(image, 0, 0, artwork.width * imageScale.x, (first.y - 12) * imageScale.y, 0, 0, W, geo.artworkHeader - 10);
  ctx.drawImage(image, 0, footerY * imageScale.y, artwork.width * imageScale.x, (artwork.height - footerY) * imageScale.y, 0, H - geo.artworkFooter + 10, W, geo.artworkFooter - 10);
  ctx.save();
  ctx.strokeStyle = template.placeholder.bg[1];
  ctx.lineWidth = 3;
  slots.forEach((r) => ctx.strokeRect(r.x - 1.5, r.y - 1.5, r.w + 3, r.h + 3));
  ctx.restore();
}
