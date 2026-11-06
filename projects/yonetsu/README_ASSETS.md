# 余熱アセット状況

## 現状

| 種別 | 状態 |
|------|------|
| 背景 4枚 | 生成済み（夜ホテル／バー／客室／ラウンジ） |
| 立ち絵 8枚 | みお22／せいら24 基幹＋表情仮置き |
| CG 8枚 | **水着着用の全年齢代用**（後で本番差分へ差し替え） |

テキストは成人向けプロットのまま。画像のH枠だけ水着で仮置きしています。

## 差し替え手順

1. 本番CGを `cg_mio_*` / `cg_seira_*` 名で用意
2. 取り込み:

```powershell
cd c:/Users/MasaruShindo/work2/003_ゲーム/novel-studio
py -3 scripts/prepare_yonetsu_assets.py "生成jpgフォルダ"
```

プロンプト台帳: `art/PROMPTS.md`  
水着代用フロー: ElevenLabs `HSonI7lxcGRbGjI4ll4H`
