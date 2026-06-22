import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================== 【設定エリア】 ==================
const PORT = process.env.PORT || 3000;
const CHATWORK_API_TOKEN = "47f3a071fe49e7259100d70071c986b7";
const CHATWORK_ROOM_ID = "440162416"; // 案内を自動投稿したいチャット部屋のID

// 【あなたの量産したサブ垢のCodeSandbox URLリスト】
const SANDBOX_URLS = [
  "https://jhsnlx-8080.csb.app",
  "https://v52l6d-8080.csb.app/"
];
// ===================================================

let latestAvailableUrl = "現在、利用可能なサーバーがありません。";

// 💬 Chatworkにメッセージを送信する共通関数
async function sendChatworkMessage(message) {
  const res = await fetch(
    `https://api.chatwork.com/v2/rooms/${CHATWORK_ROOM_ID}/messages`,
    {
      method: "POST",
      headers: {
        "X-ChatWorkToken": CHATWORK_API_TOKEN,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ body: message }),
    }
  );
  if (!res.ok) {
    console.log("❌ Chatwork送信エラー:", await res.text());
  } else {
    console.log("🚀 Chatworkへの自動通知に成功しました！");
  }
}

// 🛠️ 全サブ垢の生存確認レースを行う関数
async function checkAllInstances() {
  console.log(`[${new Date().toLocaleString("ja-JP")}] 全サブ垢の生存確認を開始します...`);

  const raceTask = async (url) => {
    const baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒タイムアウト

    try {
      const res = await fetch(`${baseUrl}/api/ping`, {
        signal: controller.signal,
        headers: { "User-Agent": "Sandbox-Watcher-Bot" }
      });
      clearTimeout(timeoutId);

      if (res.status === 200) {
        return baseUrl;
      }
      throw new Error(`Status: ${res.status}`);
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  try {
    const fastestLiveUrl = await Promise.any(
      SANDBOX_URLS.map(url => raceTask(url))
    );
    latestAvailableUrl = fastestLiveUrl;
    console.log("🟢 現在の最適生存URL:", latestAvailableUrl);
  } catch (error) {
    latestAvailableUrl = "⚠️ すべてのサブ垢のクレジットが切れているか、停止しています。";
    console.error("❌ 生きているアカウントが一つも見つかりませんでした。");
  }
}

// ---------------------------------------------------
// 🌐 サイトのトップページ（ / ）にアクセスがあった時の処理
// ---------------------------------------------------
app.get('/', async (req, res) => {
  // 日本時間の現在時刻を取得
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const hour = now.getHours();

  console.log(`[JST: ${hour}時] サイトへのアクセスを受信しました。`);

  // ご指定の時間帯【7:00〜16:00(15:59)】および【23:00〜翌2:00(1:59)】
  const isTargetTime = (hour >= 7 && hour < 16) || (hour >= 23 || hour < 2);

  if (isTargetTime) {
    // 1. サブ垢の生存確認を走らせる
    await checkAllInstances();

    // 2. 確定した最新のURLをその場でChatworkに投稿する！
    const replyMessage = 
`📺 自作YouTubeサイト案内Bot (自動巡回完了)

現在クレジットが残っていて快適に動くURLはこちらです！
👇
${latestAvailableUrl}`;

    await sendChatworkMessage(replyMessage);

    res.status(200).send(`時間内です。巡回＆Chatworkへの自動投稿が完了しました！ 最新URL: ${latestAvailableUrl}`);
  } else {
    console.log("➔ スリープ時間帯のため、サブ垢へのアクセスおよびChatwork通知をスキップしました。");
    res.status(200).send("お休み時間帯のため、チェックと通知をスキップしました（クレジット保護モード）");
  }
});

// 待受
app.listen(PORT, () => {
  console.log(`Watcher Bot running on port ${PORT}`);
});
