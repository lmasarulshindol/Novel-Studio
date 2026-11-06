# 余熱 — 画像生成プロンプト台帳

novel-studio 配置名は `prepare_yonetsu_assets.py` と一致させること。  
生成物は `<作業フォルダ>/<ファイル名>.jpg` で保存し、スクリプトでプロジェクトへ取り込む。

## 共通ルール

| 項目 | 内容 |
| --- | --- |
| 解像度 | 背景・CG: **1920×1080** / 立ち絵: 縦長（同一キャンバスサイズで全表情を生成） |
| 年齢 | 美緒 **22-year-old adult woman** / セイラ **24-year-old adult woman**。必ず **mature adult** を明記 |
| 禁止 | **minor, underage, teenager, high school, student, school uniform, loli, child** — プロンプト・ネガティブ両方に記載 |
| 画風 | anime visual novel, clean lineart, soft cel shading, detailed background (背景/CG) |
| ネガティブ（全カット共通） | `minor, underage, teenager, child, loli, school uniform, student, high school, blurry, low quality, watermark, text, logo, extra fingers, bad anatomy` |

### 美緒（Mio）— キャラ一貫用タグ

```
22-year-old adult woman, mature adult, mio yonetsu, young adult office worker age 22,
shoulder-length dark brown hair, soft waves, amber brown eyes, gentle mature face,
small beauty mark near left eye, slim adult figure, black cocktail dress or elegant hotel lounge wear,
no school uniform, not a student
```

### セイラ（Seira）— キャラ一貫用タグ

```
24-year-old adult woman, mature adult, seira yonetsu, career woman age 24,
long straight black hair, side part, cool gray-blue eyes, sharp elegant mature face,
tall slim adult figure, silver earrings, deep navy off-shoulder dress or mature evening wear,
no school uniform, not a student
```

---

## Backgrounds（人物なし・1920×1080）

### hotel_night

**説明:** 高級ホテルのロビー／エントランス。夜。暖色の間接照明、大理石と観葉植物。無人。

**Prompt:**

```
anime visual novel background, luxury hotel lobby at night, empty scene no people,
grand entrance, marble floor, warm indirect lighting, chandelier soft glow,
reception desk in depth, potted plants, city night through glass doors,
1920x1080, wide shot, highly detailed, atmospheric, no characters
```

**Negative:** 上記共通 + `people, person, crowd, character`

---

### lounge_night

**説明:** ホテル内ラウンジ。ソファ、ローテーブル、バーカウンターが奥に見える。夜の落ち着いた照明。無人。

**Prompt:**

```
anime visual novel background, hotel lounge interior at night, empty no people,
plush sofas, low tables, soft amber lamp light, bar counter in background,
large windows with city lights bokeh, elegant mature atmosphere,
1920x1080, wide shot, detailed anime background art
```

**Negative:** 上記共通 + `people, person, bartender`

---

### room_night

**説明:** デラックス客室。ベッド、窓からの夜景、間接照明。無人。

**Prompt:**

```
anime visual novel background, luxury hotel guest room at night, empty no people,
king bed with white linens, bedside lamps warm glow, floor-to-ceiling window city night view,
minimal elegant furniture, intimate but upscale, 1920x1080, wide shot, detailed
```

**Negative:** 上記共通 + `people, person, couple`

---

### bar_night

**説明:** ホテルバー。カウンター、背の高い椅子、ボトル棚。ムーディな青紫と琥珀の照明。無人。

**Prompt:**

```
anime visual novel background, hotel bar at night, empty no people,
wooden counter, bottle shelves, bar stools, moody blue and amber lighting,
reflections on glass, jazz lounge atmosphere, 1920x1080, wide cinematic shot
```

**Negative:** 上記共通 + `people, person, bartender, customer`

---

## Characters（立ち絵・透明化前提・同一フレーム）

全表情で **同じ canvas size・同じ立ち位置・全身〜膝上** を維持。背景は単色または簡易グラデ（rembg 用）。

### mio_normal

**説明:** 美緒・通常。穏やか、ほんのり緊張。

**Prompt:**

```
full body anime standing sprite, single character, plain soft gray gradient background,
22-year-old adult woman, mature adult, mio yonetsu, shoulder-length dark brown hair,
amber eyes, gentle expression, black cocktail dress, hands relaxed at sides,
visual novel character sprite, consistent face, no school uniform, not a student,
high resolution, clean lineart
```

---

### mio_smile

**説明:** 美緒・微笑み。目が少し細る。

**Prompt:**

```
(same character as mio_normal), 22-year-old adult woman, mature adult,
soft warm smile, slightly narrowed happy eyes, subtle blush on cheeks,
same outfit and pose alignment as other mio sprites, standing sprite, gray background
```

---

### mio_heat

**説明:** 美緒・高揚。頬紅、潤んだ目、息が少し乱れる。

**Prompt:**

```
(same character as mio_normal), 22-year-old adult woman, mature adult,
flushed cheeks, heavy-lidded aroused expression, parted lips, slight sweat,
same pose frame as mio_normal, standing sprite, suggestive but clothed, gray background
```

---

### mio_climax

**説明:** 美緒・絶頂直前/直後の立ち絵差分。目を閉じかけ、強い blush。

**Prompt:**

```
(same character as mio_normal), 22-year-old adult woman, mature adult,
eyes half closed, intense blush, overwhelmed pleasure expression, trembling lips,
same standing pose alignment, standing sprite, gray background, mature adult only
```

---

### seira_normal

**説明:** セイラ・通常。クール、余裕。

**Prompt:**

```
full body anime standing sprite, single character, plain soft gray gradient background,
24-year-old adult woman, mature adult, seira yonetsu, long straight black hair,
gray-blue eyes, calm confident expression, deep navy off-shoulder dress, silver earrings,
visual novel sprite, no school uniform, not a student, consistent face
```

---

### seira_smile

**説明:** セイラ・微笑み。控えめだが色っぽい笑み。

**Prompt:**

```
(same character as seira_normal), 24-year-old adult woman, mature adult,
subtle seductive smile, knowing eyes, minimal blush,
same outfit and pose alignment, standing sprite, gray background
```

---

### seira_heat

**説明:** セイラ・高揚。普段のクールさが崩れる。

**Prompt:**

```
(same character as seira_normal), 24-year-old adult woman, mature adult,
flushed face, aroused gaze, slightly open mouth, hair a bit disheveled,
standing sprite, same frame as seira_normal, gray background, mature adult
```

---

### seira_climax

**説明:** セイラ・絶頂差分。我慢できない表情。

**Prompt:**

```
(same character as seira_normal), 24-year-old adult woman, mature adult,
eyes closed or rolling up slightly, deep blush, ecstatic mature expression,
standing sprite, aligned pose, gray background, not teenager, not student
```

---

## CGs（暫定：水着着用・全年齢代用・後で差し替え）

> テキストは成人向けプロットのまま。画像のみ競技用／プール水着の全年齢仕様で仮置き。

## CGs（1920×1080・水着代用・22+/24+ 明示）

各 CG プロンプトに **22-year-old adult woman** または **24-year-old adult woman** と **mature adult** を必ず含める。  
男性主人公は背中のみ・シルエット程度に留めてもよい（顔は描かない方が安全）。

### cg_mio_kiss

**説明:** 客室またはラウンジの影。美緒（22）との深いキス。成人の雰囲気。

**Prompt:**

```
anime visual novel CG, 1920x1080, hotel room night, warm lamp light,
22-year-old adult woman, mature adult, mio yonetsu, dark brown hair,
passionate kiss close-up, faces adult proportions, elegant black dress,
romantic intimate mood, mature couple adults only, detailed anime illustration
```

**Negative:** 共通 + `school uniform, student, young-looking, childlike face`

---

### cg_mio_undress

**説明:** 美緒（22）がドレスの肩紐をずらす／衣装が緩む。示唆的、露骨すぎない構図から開始可。

**Prompt:**

```
anime visual novel CG, 1920x1080, 22-year-old adult woman, mature adult, mio yonetsu,
slipping shoulder strap of black dress, shy aroused expression, adult body proportions,
hotel room soft lighting, suggestive undressing scene, mature adult only, no minor
```

---

### cg_mio_connect

**説明:** 美緒（22）との結合シーン。ベッド上、ロマンチック照明。成人向け。

**Prompt:**

```
anime visual novel CG, 1920x1080, 22-year-old adult woman, mature adult, mio yonetsu,
intimate adult scene on hotel bed, sheets, passionate embrace, faces show mature adult women,
soft cinematic lighting, explicit suggestive anime art, adults only 22+
```

---

### cg_mio_climax

**説明:** 美緒（22）クライマックス。表情中心＋シルエット。

**Prompt:**

```
anime visual novel CG, 1920x1080, 22-year-old adult woman, mature adult, mio yonetsu,
climax moment, intense pleasure expression, flushed skin, tangled sheets hotel room,
adult proportions, mature adult only, emotional peak scene
```

---

### cg_seira_close

**説明:** セイラ（24）が距離を詰める。顔が近い、視線が絡む。

**Prompt:**

```
anime visual novel CG, 1920x1080, 24-year-old adult woman, mature adult, seira yonetsu,
extreme close distance, foreheads almost touching, seductive gray-blue eyes,
navy off-shoulder dress, hotel lounge night bokeh, mature adult tension
```

---

### cg_seira_lap

**説明:** セイラ（24）がソファで膝上に誘う／寄り添う。支配的な余裕。

**Prompt:**

```
anime visual novel CG, 1920x1080, 24-year-old adult woman, mature adult, seira yonetsu,
sitting on hotel sofa inviting lap pillow, confident smirk, long black hair,
elegant legs, mature seductive pose, adults only, lounge night background
```

---

### cg_seira_connect

**説明:** セイラ（24）との結合シーン。彼女主導の落ち着いた熱。

**Prompt:**

```
anime visual novel CG, 1920x1080, 24-year-old adult woman, mature adult, seira yonetsu,
intimate adult scene, woman on top mood, hotel room night, passionate mature couple,
adult body proportions, 24-year-old adult woman clearly mature, no student
```

---

### cg_seira_climax

**説明:** セイラ（24）クライマックス。普段の仮面が外れる。

**Prompt:**

```
anime visual novel CG, 1920x1080, 24-year-old adult woman, mature adult, seira yonetsu,
climax ecstasy, tears of pleasure, disheveled hair, deep blush,
hotel bed sheets, mature adult only 24+, anime visual novel finish CG
```

---

## 取り込み

```powershell
cd c:/Users/MasaruShindo/work2/003_ゲーム/novel-studio
py -3 scripts/prepare_yonetsu_assets.py "path/to/generated_folder"
```
