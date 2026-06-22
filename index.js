import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================== 【設定エリア】 ==================
const PORT = process.env.PORT || 3000;
const CHATWORK_API_TOKEN = "47f3a071fe49e7259100d70071c986b7";
const CHATWORK_ROOM_ID = "440162416"; // 案内を流したいチャット部屋のID

// 【あなたの量産したサブ垢のCodeSandbox URLリスト】（末尾のスラッシュは無し）
const SANDBOX_URLS = [
  "https://jhsnlx-8080.csb.app",
  "https://v52l6d-8080.csb.app/"
];
// ===================================================

// 直近で生きていると判定されたURLを保存する変数
let latestAvailableUrl = "現在、利用可能なサーバーがありません。";

// ---------------------------------------------------
// 🛠️ 全サブ垢の生存確認レースを行う共通関数
// ---------------------------------------------------
async function checkAllInstances() {
  console.log(`[${new Date().toLocaleString("ja-JP")}] 全サブ垢の生存確認を開始します...`);

  const raceTask = async (baseUrl) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 3秒でタイムアウト（死んでる垢は応答が遅いため）

    try {
      // 💡 超軽量のピンポンダッシュでクレジット消費を完全に防ぐ
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
    // すべてのURLへ一斉にアクセスし、一番最初に200 OKを返したアカウントを特定
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
// 🌐 ① cron-job.org から15分おきに叩かれる定期チェック
// ---------------------------------------------------
app.get('/', async (req, res) => {
  // 日本時間の現在時刻を取得
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const hour = now.getHours();

  console.log(`[JST: ${hour}時] 定期巡回アクセスを受信しました。`);

  // 🔔 ご指定の時間帯【7:00〜16:00(15:59)】および【23:00〜翌2:00(1:59)】だけ動かす
  const isTargetTime = (hour >= 7 && hour < 16) || (hour >= 23 || hour < 2);

  if (isTargetTime) {
    await checkAllInstances();
    res.status(200).send(`時間内です。巡回完了。現在の最適URL: ${latestAvailableUrl}`);
  } else {
    console.log("➔ スリープ時間帯（夕方・深夜）のため、サブ垢へのアクセスをスキップしてクレジットを保護します。");
    res.status(200).send("お休み時間帯のため、サブ垢のチェックをスキップしました（クレジット保護モード）");
  }
});

// ---------------------------------------------------
// 💬 Chatworkにメッセージを送信する関数
// ---------------------------------------------------
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
  if (!res.ok) console.log("Chatwork送信エラー:", await res.text());
}

// ---------------------------------------------------
// 💬 ② Chatworkに「/youtube」と打たれた時の手動いつでも受付
// ---------------------------------------------------
app.post('/webhook', async (req, res) => {
  res.status(200).send("OK"); // タイムアウトしないよう即座に応答

  const webhookBody = req.body;
  if (!webhookBody || !webhookBody.webhook_event) return;

  const messageText = webhookBody.webhook_event.body || "";

  if (messageText.includes("/youtube")) {
    console.log("👤 手動コマンドを受信。時間帯に関係なく即座に全サブ垢をチェックします。");
    
    // 手動の時はお休み時間とか関係なく、その場で最新の生存URLを探しに行く
    await checkAllInstances();

    const replyMessage = 
`📺 自作YouTubeサイト案内Bot

現在クレジットが残っていて快適に動くURLはこちらです！
👇
${latestAvailableUrl}`;

    await sendChatworkMessage(replyMessage);
  }
});

// 待受
app.listen(PORT, () => {
  console.log(`Watcher Bot running on port ${PORT}`);
});
