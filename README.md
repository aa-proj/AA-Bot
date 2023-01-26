# AA-Bot

## 環境構築
Node 16以降

```shell
git clone https://github.com/aa-proj/AA-Bot/
cd AA-Bot
npm i
```

## 開発
srcフォルダを編集します。  
ファイル構造は
```
├── .gitignore
├── assets
│   └── ここにアプリごとの画像ファイルとかホストしたいやつとかDBとかを入れる
├── src
│   ├── apps
│   │   ├── ここにアプリごとのソースコードが入る
│   ├── lib
│   │   └── 共通化できるコードはここ
│   └── main.ts これがBot本体
...
```

アプリを追加する際は、`src/apps`以下にAppBaseを継承してBotを作成してください。

デバッグ時は`CMD_PREFIX`、`DISCORD_TOKEN`環境変数を使用してください。  
`CMD_PREFIX`はスラッシュコマンドの前に`CMD_PREFIX`がつきます。
