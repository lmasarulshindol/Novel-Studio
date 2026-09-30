/** 枠の中に、縦横比を崩さず収まる表示サイズ。 */
export function containSize(
  frameWidth: number,
  frameHeight: number,
  boxWidth: number,
  boxHeight: number,
): { width: number; height: number } {
  if (frameWidth <= 0 || frameHeight <= 0 || boxWidth <= 0 || boxHeight <= 0) return { width: 0, height: 0 };
  const scale = Math.min(boxWidth / frameWidth, boxHeight / frameHeight);
  return {
    width: Math.max(1, Math.round(frameWidth * scale)),
    height: Math.max(1, Math.round(frameHeight * scale)),
  };
}

/** 表示中のキャンバス上のポインタを、舞台の座標へ戻す。枠の外は null。 */
export function clientToStage(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
  frameWidth: number,
  frameHeight: number,
): { x: number; y: number } | null {
  if (rect.width <= 0 || rect.height <= 0 || frameWidth <= 0 || frameHeight <= 0) return null;
  const x = ((clientX - rect.left) / rect.width) * frameWidth;
  const y = ((clientY - rect.top) / rect.height) * frameHeight;
  if (x < 0 || y < 0 || x > frameWidth || y > frameHeight) return null;
  return { x, y };
}

/** 枠を埋めつつ、絵の縦横比を崩さない拡大率。はみ出した端は隠れる。 */
export function coverScale(imageWidth: number, imageHeight: number, frameWidth: number, frameHeight: number): number {
  if (imageWidth <= 0 || imageHeight <= 0 || frameWidth <= 0 || frameHeight <= 0) return 1;
  return Math.max(frameWidth / imageWidth, frameHeight / imageHeight);
}
