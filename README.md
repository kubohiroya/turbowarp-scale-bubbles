# Scalable Bubbles

TurboWarpのstageサイズに追従する、名前付きスタイル対応のsay／think吹き出し機能拡張です。stageを480×360から拡大しても、吹き出しの文字・余白・輪郭をstageに対して同じ比率で表示します。

利用方法と動作例は、[English guide](https://kubohiroya.github.io/turbowarp-scale-bubbles/)または[日本語ガイド](https://kubohiroya.github.io/turbowarp-scale-bubbles/ja/)を参照してください。TurboWarpの拡張パレットからも英語ガイドを開けます。

## 機能

- 背景色・文字色・フォント・相対フォントサイズ・左／中央／右揃えを、任意のスタイル名で定義
- 吹き出しの表示方向を、上下左右と斜め4方向の計8方向から指定
- 専用say／thinkブロックで、表示文字列とスタイル名を指定
- 標準のsay／think／ask吹き出しには、再定義可能な`default`スタイルを適用
- 文字列中のリテラル`\n`、`\r\n`、`\r`を実際の改行へ変換
- 表示中のスタイル再定義やstageサイズ変更を、吹き出しへ即時反映
- renderer APIが不足する環境では、標準の吹き出しまたは左揃えへ安全にフォールバック

## ブロック

### `define bubble style [STYLE] background [BACKGROUND] text [TEXT_COLOR] font [FONT] size [SIZE] align [ALIGN] direction [DIRECTION]`

名前付きスタイルを新規定義または再定義します。`ALIGN`は`left`、`center`、`right`から選びます。`DIRECTION`は`up`、`up-right`、`right`、`down-right`、`down`、`down-left`、`left`、`up-left`の8方向です。同じスタイルを使用中の吹き出しが表示されている場合、変更をすぐに反映します。

方向はスプライトのboundsを基準に吹き出しを配置します。スプライトが移動した場合やstageサイズが変わった場合も追従し、吹き出しがstage外へ出る位置では表示領域内へ収めます。`default`の初期方向は`up-right`です。

### `say [MESSAGE] with style [STYLE]`

指定した名前のスタイルでsay吹き出しを表示します。

### `think [MESSAGE] with style [STYLE]`

指定した名前のスタイルでthink吹き出しを表示します。

スタイル名は前後の空白を除いて大文字・小文字を区別します。空欄または未定義の名前は`default`へフォールバックします。スタイル定義は実行時の状態なので、通常は緑の旗を押した直後に定義ブロックを実行してください。

旧版の`MESSAGE`＋`SIZE`形式のsay／think opcodeは、保存済みプロジェクトとの互換性のためパレットに表示せず維持しています。

## サイズ計算

480×360の標準stageにおけるTurboWarp既定の14pxをサイズ100とします。

```text
stageScale = min(stageWidth / 480, stageHeight / 360)
fontSize = 14 × stageScale × styleSize / 100
```

| stage   | styleSize | fontSize |
| ------- | --------: | -------: |
| 480×360 |       100 |     14px |
| 960×720 |       100 |     28px |
| 960×720 |       150 |     42px |

吹き出しの最大幅・最小幅・余白・枠線・角丸・tailは`stageScale`に追従し、スタイルのサイズは文字と行高だけへ追加適用されます。サイズは1〜1000に制限され、空文字や有限でない値は100として扱われます。

## 利用方法

TurboWarpの「カスタム拡張を読み込む」で`dist/scale-bubbles.js`を読み込みます。この拡張はVMとrendererへアクセスするため、unsandboxedで実行する必要があります。

```text
define bubble style [narration] background [#fff4cc] text [#332200] font [Noto Sans JP] size [125] align [center] direction [up]
say [むかし、むかし\nあるところに…] with style [narration]
```

`default`を再定義すると、その後の標準say／think／askにも同じ見た目を適用できます。

## 開発

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
```

TypeScriptソースは、`@kubohiroya/vite-plugin-turbowarp-extension`を通して単一の`dist/scale-bubbles.js`へビルドされます。ビルド時には保存プロジェクトとのAPI互換性確認用に`dist/extension-manifest.json`も生成します。

## 互換性と制約

この拡張はTurboWarp VMの`SAY`／`STAGE_SIZE_CHANGED`イベント、`Scratch.looks` custom state、drawable位置更新、およびscratch-renderの`TextBubbleSkin.setStyle()`をfeature detectionして利用します。中央／右揃えには、対応する`TextBubbleSkin`内部描画処理を存在確認後に補強します。内部処理が互換でない場合は左揃えへ、位置更新APIがない場合はTurboWarp標準配置へフォールバックします。

通常のsay／think停止、位置追従、330文字制限、数値丸めは標準実装へ委譲します。

## ライセンス

MPL-2.0
