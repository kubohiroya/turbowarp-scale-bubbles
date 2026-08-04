# TurboWarp SVG Text

TurboWarpのstageサイズに追従する、名前付きスタイル対応のテキスト機能拡張です。同じスタイルをsay／think吹き出しと、スプライト自身をテキスト表示にするSVGスキンで共有できます。

利用方法と動作例は、[English guide](https://kubohiroya.github.io/turbowarp-svg-text/)または[日本語ガイド](https://kubohiroya.github.io/turbowarp-svg-text/ja/)を参照してください。TurboWarpの拡張パレットからも`docsURI`で英語ガイドを開けます。

## 機能

- 背景色・文字色・フォント・相対フォントサイズ・左／中央／右揃えを、任意のスタイル名で定義
- 吹き出しの表示方向を、上下左右と斜め4方向の計8方向から指定
- 名前付きスタイルでsay／think吹き出しを表示
- `set this sprite text`でスプライト自身のスキンを複数行SVGテキストへ置換
- 標準のsay／think／ask吹き出しには、再定義可能な`default`スタイルを適用
- 文字列中のリテラル`\n`、`\r\n`、`\r`を実際の改行へ変換
- 表示中のスタイル再定義やstageサイズ変更を、吹き出しとSVGテキストへ即時反映
- 旧サイズ指定say／think opcodeを、保存済みプロジェクトとの互換性のため非表示で維持

アニメーション機能は0.1.0の対象外です。

## ブロック

### `define text style [STYLE] background [BACKGROUND] text [TEXT_COLOR] font [FONT] size [SIZE] align [ALIGN] bubble direction [DIRECTION]`

名前付きスタイルを定義または再定義します。`ALIGN`は`left`、`center`、`right`、`DIRECTION`は`up`、`up-right`、`right`、`down-right`、`down`、`down-left`、`left`、`up-left`です。方向は吹き出しだけに適用されます。

同じ名前を再定義すると、そのスタイルを使用中の吹き出しとSVGテキストをすぐ再描画します。スタイル定義は実行時の状態なので、通常は緑の旗を押した直後に実行してください。空欄または未定義の名前は`default`へフォールバックします。

### `set this sprite text [TEXT] with style [STYLE]`

現在のスプライトのdrawableへ新しいSVGスキンを設定し、スプライト自身をテキスト表示にします。背景色・文字色・フォント・サイズ・文字揃えを指定したスタイルから取得します。`\n`を含む文字列は複数行の`<tspan>`として安全にエスケープして描画します。

### `say [MESSAGE] with style [STYLE]`

指定した名前のスタイルでsay吹き出しを表示します。

### `think [MESSAGE] with style [STYLE]`

指定した名前のスタイルでthink吹き出しを表示します。

## サイズ計算

480×360の標準stageにおけるTurboWarp既定の14pxをサイズ100とし、吹き出しとSVGテキストに同じ式を適用します。

```text
stageScale = min(stageWidth / 480, stageHeight / 360)
fontSize = 14 × stageScale × styleSize / 100
```

| stage   | styleSize | fontSize |
| ------- | --------: | -------: |
| 480×360 |       100 |     14px |
| 960×720 |       100 |     28px |
| 960×720 |       150 |     42px |

サイズは1〜1000に制限され、空文字や有限でない値は100として扱われます。

## 利用方法

TurboWarpの「カスタム拡張を読み込む」で次のURLを読み込み、unsandboxed実行を許可します。

```text
https://cdn.jsdelivr.net/npm/@kubohiroya/turbowarp-svg-text@0.1.0/dist/svg-text.js
```

```text
define text style [narration] background [#fff4cc] text [#332200] font [Noto Sans JP] size [125] align [center] bubble direction [up]
say [むかし、むかし\nあるところに…] with style [narration]
set this sprite text [第一幕\n浦島太郎] with style [narration]
```

## 開発

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
```

TypeScriptソースは、`@kubohiroya/vite-plugin-turbowarp-extension`を通して単一の`dist/svg-text.js`へビルドされます。ビルド時には保存プロジェクトとのAPI互換性確認用に`dist/extension-manifest.json`も生成します。

## 互換性と制約

この拡張はTurboWarp VMとrendererへアクセスするためunsandboxedで実行します。吹き出しは`SAY`／`STAGE_SIZE_CHANGED`イベント、`Scratch.looks` custom state、drawable位置更新、および`scratch-render`の`TextBubbleSkin.setStyle()`をfeature detectionして利用します。SVGテキストは`createSVGSkin`、`updateDrawableSkinId`、`destroySkin`を使用します。

中央／右揃えの吹き出しでrenderer内部処理が互換でない場合は左揃えへ、位置更新APIがない場合はTurboWarp標準配置へフォールバックします。SVG skin APIがない環境では`setText`は明示的なエラーにします。通常のsay／think停止、位置追従、330文字制限、数値丸めは標準実装へ委譲します。

## ライセンス

MPL-2.0
