export type Role =
  | 'show'
  | 'hide'
  | 'bg'
  | 'expr'
  | 'cg'
  | 'fx'
  | 'camera'
  | 'transition'
  | 'particle'
  | 'text';

export type PresetKind =
  | 'opacity'
  | 'transform'
  | 'camera'
  | 'color'
  | 'optical'
  | 'distort'
  | 'composite'
  | 'particle'
  | 'text'
  | 'shader';

export type PresetDef = {
  name: string;
  kind: PresetKind;
  label: string;
  detail: string;
};

export const PRESET_KIND_LABELS: Record<PresetKind, string> = {
  opacity: '現れ方・切り替え',
  transform: '動き',
  camera: 'カメラ',
  color: '色',
  optical: '光とぼかし',
  distort: 'ゆがみ',
  composite: '重ね方',
  particle: '粒子',
  text: '文字',
  shader: 'シェーダ',
};

const defs: PresetDef[] = [
  { name: 'fadeIn', kind: 'opacity', label: 'フェードイン', detail: '透明から現れる。show mitsuki smile at center with fadeIn duration=0.5' },
  { name: 'fadeOut', kind: 'opacity', label: 'フェードアウト', detail: '透明になって消える。hide mitsuki with fadeOut duration=0.5' },
  { name: 'crossfade', kind: 'opacity', label: 'クロスフェード', detail: '古い絵と新しい絵が溶け合う。bg classroom dusk with fade duration=0.8。fade は背景ではこれになる。' },
  { name: 'dissolve', kind: 'opacity', label: 'ディゾルブ', detail: 'まだらに溶けて切り替わる。bg classroom night with dissolve duration=0.7' },
  { name: 'fadeThroughColor', kind: 'opacity', label: '色を挟む', detail: '一度指定色で覆ってから次の絵。color=#000000。bg classroom night with fadeThroughColor duration=0.9' },
  { name: 'flash', kind: 'opacity', label: 'フラッシュ', detail: '画面が一瞬光る。color で色。fx screen flash duration=0.28' },
  { name: 'dipBlack', kind: 'opacity', label: '暗転', detail: '黒く落ちてから戻る。背景と一緒なら暗転のあいだに絵が替わる。bg classroom night with dipBlack duration=0.8' },
  { name: 'wipe', kind: 'opacity', label: 'ワイプ', detail: '端から拭うように切り替わる。direction は left right up down。bg classroom dusk with wipe direction=left duration=0.8' },
  { name: 'iris', kind: 'opacity', label: 'アイリス', detail: '円が開いて次の絵になる。bg classroom day with iris duration=0.7' },
  { name: 'clockWipe', kind: 'opacity', label: '時計ワイプ', detail: '時計の針のように絵が回って替わる。bg classroom dusk with clockWipe duration=0.8' },
  { name: 'barnDoor', kind: 'opacity', label: 'バーンドア', detail: '中央から左右へ開く。bg classroom night with barnDoor duration=0.7' },
  { name: 'moveTo', kind: 'transform', label: '移動', detail: '指定座標へ動く。x と y。fx mitsuki moveTo x=700 y=900 duration=0.6' },
  { name: 'slideIn', kind: 'transform', label: 'スライドイン', detail: '画面外から滑って入る。direction と distance。show mitsuki smile at left with slideIn direction=left duration=0.5' },
  { name: 'slideOut', kind: 'transform', label: 'スライドアウト', detail: '滑って退場する。hide mitsuki with slideOut direction=right duration=0.5' },
  { name: 'zoomIn', kind: 'transform', label: 'ズームイン', detail: '小さく現れて本来の大きさになる。show mitsuki smile at center with zoomIn duration=0.45' },
  { name: 'zoomOut', kind: 'transform', label: 'ズームアウト', detail: '大きくなりながら消える。hide mitsuki with zoomOut duration=0.45' },
  { name: 'punch', kind: 'transform', label: 'パンチ', detail: '一瞬大きく弾む。驚きやツッコミに。fx mitsuki punch duration=0.35' },
  { name: 'spin', kind: 'transform', label: '回転', detail: 'その場で回る。degree が角度。fx mitsuki spin degree=360 duration=0.8' },
  { name: 'rotateTo', kind: 'transform', label: '角度へ', detail: '指定した角度で止まる。fx mitsuki rotateTo degree=12 duration=0.4。戻すときは degree=0。' },
  { name: 'skewTo', kind: 'transform', label: '斜め', detail: '絵を傾ける。degree。fx mitsuki skewTo degree=14 duration=0.35' },
  { name: 'bounceIn', kind: 'transform', label: 'バウンド登場', detail: '上から落ちて弾む。height で高さを足せる。show mitsuki smile at center with bounceIn duration=0.7' },
  { name: 'jump', kind: 'transform', label: 'ジャンプ', detail: 'しゃがんで飛び、着地で潰れる。fx mitsuki jump duration=0.7' },
  { name: 'shake', kind: 'transform', label: '振動', detail: '対象が小刻みに揺れる。amount と frequency。人物なら fx mitsuki shake amount=10 duration=0.4。画面全体は camera shake。' },
  { name: 'bezierPath', kind: 'transform', label: '曲線移動', detail: '制御点を通って移動する。x y が終点、cx cy が曲がり。fx mitsuki bezierPath x=1200 y=900 duration=0.8' },
  { name: 'camPan', kind: 'camera', label: 'カメラ移動', detail: '画面を横や縦にずらす。x と y。戻すときは camera camPan x=0 y=0。' },
  { name: 'camZoom', kind: 'camera', label: 'カメラズーム', detail: '画面の拡大率。zoom=1.2 で寄る。zoom=1 で等倍に戻る。' },
  { name: 'camRotate', kind: 'camera', label: 'カメラ回転', detail: '画面を少し傾ける。degree。degree=0 で水平に戻る。' },
  { name: 'camShake', kind: 'camera', label: 'カメラシェイク', detail: '画面全体が揺れる。amount。camera shake amount=12 duration=0.45 と書いてもこれになる。' },
  { name: 'kenBurns', kind: 'camera', label: 'ケンバーンズ', detail: 'ゆっくり寄りながら流す。zoom x y。写真や背景向け。camera kenBurns duration=4' },
  { name: 'letterbox', kind: 'camera', label: 'レターボックス', detail: '上下に黒い帯。amount が帯の高さ。0 で消える。camera letterbox amount=80 duration=0.45' },
  { name: 'brightness', kind: 'color', label: '明度', detail: '明るさ。1 が元。fx screen brightness amount=1.35 duration=0.4。戻すときは amount=1。' },
  { name: 'contrast', kind: 'color', label: 'コントラスト', detail: '明暗の差。1 が元。fx screen contrast amount=1.35 duration=0.4' },
  { name: 'saturate', kind: 'color', label: '彩度', detail: '色の濃さ。1 が元、0 に近いと灰色。fx screen saturate amount=1.7 duration=0.4' },
  { name: 'hue', kind: 'color', label: '色相', detail: '色味を回す。degree。fx screen hue degree=40 duration=0.4。戻すときは degree=0。' },
  { name: 'exposure', kind: 'color', label: '露出', detail: '写真の露出。0 が元。fx screen exposure amount=0.45 duration=0.4' },
  { name: 'sepia', kind: 'color', label: 'セピア', detail: '茶色い古写真にする。fx screen sepia duration=0.5。彩度を戻すには saturate amount=1。' },
  { name: 'grayscale', kind: 'color', label: 'グレースケール', detail: '色を抜く。fx screen grayscale duration=0.5。戻すときは fx screen saturate amount=1。' },
  { name: 'invert', kind: 'color', label: '反転', detail: '色をネガにする。fx screen invert duration=0.4' },
  { name: 'posterize', kind: 'color', label: 'ポスタリゼーション', detail: '色数を減らしてポスター調に。levels が段数。fx screen posterize levels=4 duration=0.4' },
  { name: 'vignette', kind: 'color', label: 'ビネット', detail: '四隅を暗くする。amount。fx screen vignette amount=0.75 duration=0.4' },
  { name: 'grain', kind: 'color', label: 'グレイン', detail: 'フィルムの粒状ノイズ。amount。fx screen grain amount=0.45 duration=0.4' },
  { name: 'gradientMap', kind: 'color', label: 'グラデーションマップ', detail: '明暗を別の色の帯に塗り替える。fx screen gradientMap duration=0.5' },
  { name: 'blur', kind: 'optical', label: 'ぼかし', detail: 'ピントをぼかす。amount。0 で戻る。fx mitsuki blur amount=8 duration=0.4' },
  { name: 'motionBlur', kind: 'optical', label: 'モーションブラー', detail: '動きの方向にぶれる。amount。fx mitsuki motionBlur amount=28 duration=0.35' },
  { name: 'radialBlur', kind: 'optical', label: '円形ブラー', detail: '中心から放射状にぶれる。fx screen radialBlur amount=12 duration=0.4' },
  { name: 'glow', kind: 'optical', label: 'グロー', detail: '輪郭が光る。amount。fx mitsuki glow amount=3 duration=0.4' },
  { name: 'bloom', kind: 'optical', label: 'ブルーム', detail: '明るい部分がにじむ。amount。fx screen bloom amount=2.2 duration=0.4' },
  { name: 'chromaticAberration', kind: 'optical', label: '色収差', detail: '赤と青がずれてレンズっぽくなる。amount。fx screen chromaticAberration amount=8 duration=0.35' },
  { name: 'dropShadow', kind: 'optical', label: 'ドロップシャドウ', detail: '影を足す。amount。fx mitsuki dropShadow amount=1 duration=0.3' },
  { name: 'wave', kind: 'distort', label: '波', detail: '絵がゆらゆらする。amount。fx mitsuki wave amount=8 duration=0.8' },
  { name: 'ripple', kind: 'distort', label: '波紋', detail: '水面の輪。amount。fx screen ripple amount=1 duration=0.6' },
  { name: 'bulge', kind: 'distort', label: '膨らみ', detail: '中央がレンズのように膨らむ。amount。fx screen bulge amount=0.55 duration=0.45' },
  { name: 'glitch', kind: 'distort', label: 'グリッチ', detail: '映像が崩れてノイズになる。amount。fx screen glitch amount=1 duration=0.35' },
  { name: 'pixelate', kind: 'distort', label: 'ピクセル', detail: 'ドットが粗くなる。amount が大きいほど粗い。fx screen pixelate amount=14 duration=0.4' },
  { name: 'displacement', kind: 'distort', label: 'ディスプレイス', detail: 'ノイズで絵をずらす。amount。fx screen displacement amount=36 duration=0.45' },
  { name: 'blend', kind: 'composite', label: 'ブレンド', detail: '加算や乗算で重ねる。mode は add normal multiply screen。fx mitsuki blend mode=add' },
  { name: 'maskRect', kind: 'composite', label: '矩形マスク', detail: '四角い窓で見せる。direction。fx mitsuki maskRect direction=left duration=0.5' },
  { name: 'maskGradient', kind: 'composite', label: 'グラデーションマスク', detail: '端がにじむマスク。direction。fx mitsuki maskGradient direction=left duration=0.5' },
  { name: 'focusDim', kind: 'composite', label: '話者以外を暗く', detail: '今話している人以外を暗くする。amount。人物が二人以上いるときに効く。fx screen focusDim amount=0.45' },
  { name: 'rain', kind: 'particle', label: '雨', detail: '雨を降らせる。particle rain duration=3。止めるのは particle stop。' },
  { name: 'snow', kind: 'particle', label: '雪', detail: '雪を降らせる。particle snow duration=3。止めるのは particle stop。' },
  { name: 'petals', kind: 'particle', label: '花びら', detail: '花びらが舞う。particle petals duration=3。止めるのは particle stop。' },
  { name: 'sparkle', kind: 'particle', label: '光', detail: 'きらめき。particle sparkle duration=2.5。止めるのは particle stop。' },
  { name: 'embers', kind: 'particle', label: '火の粉', detail: '火の粉が上がる。particle embers duration=3。止めるのは particle stop。' },
  { name: 'typewriter', kind: 'text', label: 'タイプライタ', detail: '一文字ずつ出す。設定の文字速度でも同じ動きになる。「美月」 こんにちは。 with typewriter' },
  { name: 'textFade', kind: 'text', label: 'テキストフェード', detail: 'セリフ枠がふわっと出る。「美月」 こんにちは。 with textFade' },
  { name: 'textShake', kind: 'text', label: 'テキスト振動', detail: 'セリフ枠が揺れる。叫びや衝撃に。「美月」 きゃっ。 with textShake' },
  { name: 'customShader', kind: 'shader', label: 'カスタムシェーダ', detail: '自分のフラグメントシェーダを画面にかける。fragment に .frag のパス、uAmount で強さ。fx screen customShader fragment=sample/shaders/pulse.frag uAmount=0.7 duration=0.6' },
];

export const PRESETS: PresetDef[] = defs;
export const PRESET_NAMES = PRESETS.map((preset) => preset.name);
const PRESET_SET = new Set(PRESET_NAMES);

export function getPreset(name: string): PresetDef | undefined {
  return PRESETS.find((preset) => preset.name === name);
}

export function defaultDuration(name: string): number {
  if (name === 'kenBurns') return 6;
  if (name === 'flash') return 0.28;
  if (name === 'dipBlack' || name === 'fadeThroughColor') return 0.7;
  const preset = getPreset(name);
  if (preset?.kind === 'particle') return 3;
  return 0.5;
}

export function resolvePreset(name: string, role: Role): string {
  const key = name.trim();
  if (key === 'fade') {
    if (role === 'hide') return 'fadeOut';
    if (role === 'show' || role === 'text') return 'fadeIn';
    return 'crossfade';
  }
  if (role === 'camera' && (key === 'shake' || key === 'camShake')) return 'camShake';
  if (PRESET_SET.has(key)) return key;
  const alias: Record<string, string> = {
    grey: 'grayscale',
    gray: 'grayscale',
    greyscale: 'grayscale',
  };
  return alias[key.toLowerCase()] ?? key;
}

export function roleForPreset(name: string): Role {
  const preset = getPreset(name);
  if (preset?.kind === 'camera') return 'camera';
  if (preset?.kind === 'particle') return 'particle';
  if (preset?.kind === 'text') return 'text';
  return 'fx';
}

export function templateFor(name: string): string {
  const preset = getPreset(name);
  if (!preset) return '';
  if (preset.kind === 'camera') return `camera ${name} duration=0.5`;
  if (preset.kind === 'particle') return `particle ${name} duration=2.5`;
  if (preset.kind === 'text') return `「話者」 セリフ with ${name}`;
  if (name === 'blend') return 'fx mitsuki blend mode=add';
  if (name === 'customShader') return 'fx screen customShader duration=0.6 uAmount=0.7';
  return `fx mitsuki ${name} duration=0.5`;
}
