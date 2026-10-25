# sphere/config.json の書き方

Sphere VERSE のワールドが起動時に読む設定ファイルです。手で書き換えて GitHub に置くと、ワールドを上げ直さずに反映されます（反映まで GitHub Pages のキャッシュで最大 10 分ほど）。

公開 URL: `https://loy6161.github.io/clubVERSE-assets/images/sphere/config.json`
（clubVERSE の `images/` が自動で clubVERSE-assets にコピーされる仕組みなので、`images/` の外には置けません）

書き方の決まり（Udon の VRCJson で読めるように）: 文字コードは UTF-8。使えるのは `{ }`・`[ ]`・数値・文字列・`true`/`false` だけ。コメントや末尾のカンマは書けません。壊すと読めず、ワールドは「全部 ON・事前の一覧なし」で動きます。

## version
`1` のまま。形を変えたときだけ増やします。

## posters（ポスターのケースの初期状態）
ワールドを開いたときに ON にするケース。`true` で読み込み、`false` で最初は読み込まない。**書いていないキーは `false`（読み込まない）扱い**。config.json が読めなかったときは全部 ON。開いた後は clubVERSE の PA 卓の「POSTERS」ボタンで切り替えられます。

| キー | ボタン | 枚数 |
|---|---|---|
| `info1_5` | INFO 1-5 | 5 |
| `info6_10` | INFO 6-10 | 5 |
| `weekly` | WEEKLY | 5 |
| `today` | TODAY | 1 |
| `members` | MEMBERS（出演者） | 20 |
| `cd` | CD BOOTH（CD とポスター） | 9 |
| `info11_15` | INFO 11-15 | 5 |
| `info_wide` | INFO WIDE | 9 |

例: Sphere でライブの日は clubVERSE の一部を最初から切る
```
"posters": { "info1_5": false, "info6_10": false, "weekly": true, "today": true, "members": false, "cd": false, "info11_15": false, "info_wide": false }
```

## sky（空の写真）
キーは mode 番号（文字列）。値は画像の URL の配列。

- 配列が 1 つ: 2048 幅以下の写真。
- 配列が 2 つ: 左半分、右半分の順。4096 幅などの写真を 2 枚に分けてあり、ワールド側でつないで貼ります。
- mode 11 は空の写真なし。mode 18（ビーチ）は mode 13（seaside）と同じ写真なので、同じ URL を指しています。

| mode | 写真 | mode | 写真 |
|---|---|---|---|
| 1 | heavens | 12 | ruins |
| 2 | planetarium | 13 | seaside |
| 3 | space | 14 | desert |
| 4 | shallow | 15 | starry |
| 5 | deepsea | 16 | medieval（VR 用の遠景） |
| 6 | neon | 17 | kowloon |
| 7 | aurora | 18 | seaside（13 と同じ） |
| 8 | forest | 19 | moonlit |
| 9 | cherry | 20 | seabed |
| 10 | arena | 21 | stadium |
| | | 22 | snowcity |

画像は `images/sphere/sky/` に `<名前>_L.jpg`・`<名前>_R.jpg`（分けた物）または `<名前>.jpg`（1 枚の物）として置きます。写真を差し替えるときは同じ名前で上書きするか、`sky` の URL を書き換えます。1 枚は最大 2048×2048。差し替えても URL が同じだとキャッシュで古い絵が出ることがあるので、確実に変えたいときは名前を変えます（例 `cherry2_L.jpg`）。

## sets（出演者ごとの 4 プリセットの事前の一覧）
`name` は出演者や回の名前、`presets` は mode 番号を 4 つまで（`sky` に書いてある番号だけ）。PA 卓の「次の出演者」で、この順に 4 つ読み込みます。

```
"sets": [
  { "name": "出演者A", "presets": [9, 16, 21, 22] },
  { "name": "出演者B", "presets": [1, 2, 3, 13] }
]
```
今は書き換え用の空の例が 1 つだけ入っています（`presets` が空）。
