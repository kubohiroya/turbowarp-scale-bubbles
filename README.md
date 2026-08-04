# Scalable Bubbles

TurboWarpのstageサイズに追従するsay／think吹き出し機能拡張です。stageを480×360から拡大しても、吹き出しの文字・余白・輪郭がstageに対して同じ比率で表示されます。

利用方法と動作例は、[English guide](https://kubohiroya.github.io/turbowarp-scale-bubbles/)または[日本語ガイド](https://kubohiroya.github.io/turbowarp-scale-bubbles/ja/)を参照してください。TurboWarpの拡張パレットからも英語ガイドを開けます。

## 機能

- 標準のsay／think／ask吹き出しを、相対フォントサイズ100として自動的に拡大縮小
- 専用say／thinkブロックでは、100を基準とする相対フォントサイズを指定可能
- 文字列中のリテラル`\n`、`\r\n`、`\r`を実際の改行へ変換
- 表示中にstageサイズが変わった場合も、吹き出しを再描画・再配置
- 対応するrenderer APIがない環境では、標準の吹き出し表示へ安全にフォールバック

## ブロック

### `say [MESSAGE] with font size [SIZE]`

指定した相対フォントサイズでsay吹き出しを表示します。

### `think [MESSAGE] with font size [SIZE]`

指定した相対フォントサイズでthink吹き出しを表示します。

`SIZE`は1〜1000へ制限され、空文字や非数値は100として扱われます。`MESSAGE`に`1行目\n2行目`を渡すと2行で表示されます。

## サイズ計算

480×360の標準stageにおけるTurboWarp既定の14pxをサイズ100とします。

```text
stageScale = min(stageWidth / 480, stageHeight / 360)
fontSize = 14 × stageScale × SIZE / 100
```

| stage   | SIZE | fontSize |
| ------- | ---: | -------: |
| 480×360 |  100 |     14px |
| 960×720 |  100 |     28px |
| 960×720 |  150 |     42px |

吹き出しの最大幅・最小幅・余白・枠線・角丸・tailは`stageScale`に追従し、`SIZE`は文字と行高だけへ追加適用されます。

## 利用方法

TurboWarpの「カスタム拡張を読み込む」で`dist/scale-bubbles.js`を読み込みます。この拡張はVMとrendererへアクセスするため、unsandboxedで実行する必要があります。

標準say／think／askも自動的にサイズ100で処理されます。任意サイズが必要な箇所では、この拡張の専用ブロックを使います。

## 開発

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
```

TypeScriptソースは、`@kubohiroya/vite-plugin-turbowarp-extension`を通して単一の`dist/scale-bubbles.js`へビルドされます。ビルド時には保存プロジェクトとのAPI互換性確認用に`dist/extension-manifest.json`も生成します。

## 互換性と制約

この拡張はTurboWarp VMの`SAY`／`STAGE_SIZE_CHANGED`イベント、`Scratch.looks` custom state、およびscratch-renderの`TextBubbleSkin.setStyle()`をfeature detectionして利用します。通常のsay／think停止、位置追従、330文字制限、数値丸めは標準実装へ委譲します。

## ライセンス

MPL-2.0
