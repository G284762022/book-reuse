// html5-qrcode を index.html に読み込んでおく

let html5QrCode = null;
let scanning = false;
const bookList = []; // {isbn, title, authors, publishedDate, description, thumbnail}
const GOOGLE_BOOKS_API_KEY = "AIzaSyAgP-R0vo_ac7_0KYuoOViHoLKeo1tD3DE";

// htmlから要素を取得して使えるようにする
const scanResultEl = document.getElementById("scanResult");
const bookListEl = document.getElementById("bookList");
const emptyMsg = document.getElementById("emptyMsg");
const manualIsbn = document.getElementById("manualIsbn");
const manualAddBtn = document.getElementById("manualAddBtn");
const manualTitle = document.getElementById("manualTitle");
const manualTitleBtn = document.getElementById("manualTitleBtn");

// モーダルの部分も同様に要素を使えるようにする
const detailModal = document.getElementById("detailModal");
const modalBody = document.getElementById("modalBody");
const closeModalBtn = document.getElementById("closeModal");

// 空白やハイフン、改行などを数字だけに整える
function normalizeIsbn(input) {
  if (!input) return "";
  return input.replace(/[^0-9Xx]/g, "");
}

// Google Books API から取得
async function fetchBookInfo(isbn) {
  const qIsbn = normalizeIsbn(isbn);
  if (!qIsbn) {
    showMessage("無効なISBNです。");
    return null;
  }

    const baseUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(qIsbn)}`;
    const url = GOOGLE_BOOKS_API_KEY
        ? `${baseUrl}&key=${encodeURIComponent(GOOGLE_BOOKS_API_KEY)}`
        : baseUrl;


  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("APIエラー");
    const data = await res.json();
    if (!data.items || data.items.length === 0) {
      return null;
    }
    const info = data.items[0].volumeInfo;
    return {
      isbn: qIsbn,
      title: info.title || "（タイトル不明）",
      authors: info.authors ? info.authors.join(", ") : "（著者不明）",
      publishedDate: info.publishedDate || "（出版日不明）",
      description: info.description ? info.description : "",
      thumbnail: info.imageLinks ? (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail || "") : ""
    };
  } catch (err) {
    console.error(err);
    showMessage("書誌情報の取得に失敗しました。");
    return null;
  }
}

// 表示用メッセージ
function showMessage(msg) {
  scanResultEl.innerText = msg;
  setTimeout(() => {
    scanResultEl.innerText = "スキャン待ち…です";
  }, 3000);
}

// 一覧を再描画
// 登録された本一覧をカード形式で HTML に描画する
function renderBookList() {
  bookListEl.innerHTML = "";
  if (bookList.length === 0) {
    emptyMsg.classList.remove("hidden");
    return;
  }
  emptyMsg.classList.add("hidden");
  bookList.forEach((b, idx) => {
    const card = document.createElement("div");
    card.className = "book-card";
    card.innerHTML = `
      <div class="thumb">${b.thumbnail ? `<img src="${b.thumbnail}" alt="cover">` : `<div style="padding:8px;color:#64748b;font-size:0.85rem">表紙なし</div>`}</div>
      <div class="card-body">
        <h3>${escapeHtml(b.title)}</h3>
        <div class="meta">著者: ${escapeHtml(b.authors)} ・ 出版: ${escapeHtml(b.publishedDate)}</div>
        <div class="desc">${b.description ? escapeHtml(truncate(b.description, 180)) : '<span style="color:#64748b">説明なし</span>'}</div>
        <div class="actions">
          <button class="action-btn" data-idx="${idx}" data-action="details">詳細</button>
          <button class="action-btn" data-idx="${idx}" data-action="exchange">交換会</button>
          <button class="action-btn" data-idx="${idx}" data-action="donate">寄付</button>
          <button class="action-btn" data-idx="${idx}" data-action="sell">売却</button>
        </div>
      </div>
    `;
    bookListEl.appendChild(card);
  });

  // 本カードの下にある4つのボタンにクリックしたら何をするかを設定
    // idx  何番目の本か
    // action  "details" / "exchange" / "donate" / "sell" のいずれか
  bookListEl.querySelectorAll(".action-btn").forEach(btn => {
    btn.onclick = (e) => {
      const idx = Number(btn.getAttribute("data-idx"));
      const action = btn.getAttribute("data-action");
      handleAction(action, idx);
    }
  });
}

// アクション処理
function handleAction(action, idx) {
  const b = bookList[idx];
  if (!b) return;

  if (action === "details") {
    // 書誌情報の詳細表示（もともとの詳細ボタン）
    showDetails(b);
    return;
  }

  if (action === "exchange") {
    // 交換会：実際に存在する団体を例に紹介
    // 街中で行われる、本のジャンルを問わない交換会のイメージを伝える

    modalBody.innerHTML = `
      <h3 style="margin-top:0">${escapeHtml(`交換会情報 - ${b.title}`)}</h3>
      <div style="color:#64748b;margin-bottom:8px">
        ${escapeHtml(b.authors)} ・ ${escapeHtml(b.publishedDate)}
      </div>

      <p>
        街中で開催されている、本のジャンルを問わない本の交換会の紹介です。<br>
        交換会では、小説・実用書・雑誌などいろいろな本が集まる場で、現在定期的に開催されている交換会をピックアップして載せています。
      </p>

      <hr style="margin:12px 0;">

      <!-- 1. 荒川区立図書館 ティーンズイベント「本の交換会」 -->
      <h4>1 ★ティーンズイベント★「本の交換会」＠ゆいの森あらかわ（荒川区）</h4>
      <p>
        場所：ゆいの森あらかわ（東京都荒川区）<br>
        開催：ティーンズスタッフ主催の不定期イベント（過去には夏休み期間などに開催）
      </p>
      <p style="font-size:0.9rem;color:#64748b;">
        特徴：図書館のティーンズスタッフが企画する、子どもから大人まで参加できる本の交換会。<br>
        事前に集めた本と当日持ち寄られた本を並べて、ジャンルを問わず自由に交換できます。
      </p>
      <iframe
        class="map-frame"
        src="https://www.google.com/maps?q=${encodeURIComponent("ゆいの森あらかわ")}&output=embed">
      </iframe>
      <div class="link-list">
        <a href="https://www.library.city.arakawa.tokyo.jp/teenscontents?8&pid=2721" target="_blank">
          荒川区立図書館 ティーンズイベント「本の交換会」活動報告ページ
        </a>
      </div>

      <hr style="margin:16px 0;">

      <!-- 2. 東京読書交換会（池袋・ふじみ野） -->
      <h4> 東京読書交換会（池袋・ふじみ野）</h4>
      <p>
        場所：東京都豊島区・埼玉県ふじみ野市など（としま産業振興プラザ ほか）<br>
        開催例：平日夜（19時過ぎ〜）や週末午後に定期開催
      </p>
      <p style="font-size:0.9rem;color:#64748b;">
        特徴：池袋やふじみ野市周辺で、本を持ち寄ってお互いの本を交換したり、読書経験を語り合う会。<br>
        小説・ドキュメンタリー・学習参考書・雑誌など、ジャンル不問でいろんな本が集まり、開催も頻繁に行われています。
      </p>
      <iframe
        class="map-frame"
        src="https://www.google.com/maps?q=${encodeURIComponent("としま産業振興プラザ 池袋 読書交換会")}&output=embed">
      </iframe>
      <div class="link-list">
        <a href="https://event.saori.cc/" target="_blank">
          東京読書交換会 公式サイト（開催スケジュール・会場など）
        </a>
      </div>

      <hr style="margin:16px 0;">

      <!-- 3. POPEYE Web「ブックスワップ・ミーティング」 -->
      <h4> 「ブックスワップ・ミーティング」｜POPEYE Web</h4>
      <p>
        場所：都内のカフェやイベントスペースなど（例：渋谷エリアの会場など）<br>
        開催：不定期開催（詳細は公式記事・最新情報を確認）
      </p>
      <p style="font-size:0.9rem;color:#64748b;">
        特徴：雑誌『POPEYE』が主催する、本好き・カルチャー好きが集まるブック・スワップ。<br>
        会場に本棚や席が用意されていて、飲み物を片手に本を交換しながらゆるく交流できます。
      </p>
      <iframe
        class="map-frame"
        src="https://www.google.com/maps?q=${encodeURIComponent("ブックスワップミーティング 渋谷 本の交換会")}&output=embed">
      </iframe>
      <div class="link-list">
        <a href="https://popeyemagazine.jp/post-246131/" target="_blank">
          POPEYE Web「ブックスワップ・ミーティング」においでよ。
        </a>
      </div>

      <hr style="margin:16px 0;">

      <!-- 4. 本の交換会（中野 東部区民活動センター） -->
      <h4> 本の交換会＠東部区民活動センター（中野区）</h4>
      <p>
        場所：東部区民活動センター（東京都中野区中央2丁目18-21）<br>
        開催日：2026年1月11日（日）第10回目予定<br>
        時間：午後1時〜4時（本の寄贈受付は12時〜）
      </p>
      <p style="font-size:0.9rem;color:#64748b;">
        特徴：地域の人が不要になった本を持ち寄り、会場に並んだ本の中から読みたい本を選んで持ち帰れる街の本の交換会。<br>
        絵本の読み聞かせや朗読もあり、世代を超えて本を通じてつながれる場になっています。ジャンルも年齢も問わず、本を通じた交流を楽しめます。
      </p>
      <iframe
        class="map-frame"
        src="https://www.google.com/maps?q=${encodeURIComponent("東部区民活動センター 中野区中央2-18-21")}&output=embed">
      </iframe>
      <div class="link-list">
        <a href="https://tokyo-nakano.genki365.net/G0000851/event/4602.html" target="_blank">
          中野の図書館とあゆむ会「第10回本の交換会」イベントページ
        </a>
      </div>

      <hr style="margin:16px 0 4px;">

      <p style="font-size:0.85rem;color:#94a3b8;">
        ※ 開催日・時間・会場などの詳細は、必ず各団体の公式ページで最新情報を確認してください。
      </p>
    `;
    detailModal.classList.remove("hidden");
    return;
  }


  if (action === "donate") {
    // 寄付：近くの図書館マップ，ネット寄付サイトのリンクを表示

    const defaultQuery = "図書館";
    const defaultMapSrc = `https://www.google.com/maps?q=${encodeURIComponent(defaultQuery)}&output=embed`;

    modalBody.innerHTML = `
      <h3 style="margin-top:0">${escapeHtml(`寄付の候補 - ${b.title}`)}</h3>
      <div style="color:#64748b;margin-bottom:8px">
        ${escapeHtml(b.authors)} ・ ${escapeHtml(b.publishedDate)}
      </div>

      <!--  近くの図書館を地図で探す -->
      <p> 自分の地域の図書館を地図で探す</p>
      <p style="font-size:0.9rem;color:#64748b;margin-top:4px">
        「現在地から探す」を押すと、今いる場所の近くの図書館を表示します。<br>
        位置情報を許可したくない場合は、市区町村名などを入力して「エリア名で検索」を使ってください。
      </p>

      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
        <button id="libraryNearBtn"
          style="padding:0.4rem 0.8rem;border-radius:6px;border:none;background:#0c6befd6;color:white;cursor:pointer;">
          現在地から探す
        </button>
        <input id="libraryInput"
          placeholder="例：〇〇市 図書館"
          style="flex:1;min-width:180px;padding:0.4rem;border-radius:6px;border:1px solid #e2e8f0;">
        <button id="librarySearchBtn"
          style="padding:0.4rem 0.8rem;border-radius:6px;border:none;background:#e5e7eb;color:#111827;cursor:pointer;">
          エリア名で検索
        </button>
      </div>

      <iframe id="libraryMapFrame"
        class="map-frame"
        src="${defaultMapSrc}">
      </iframe>

      <hr style="margin:16px 0;">

      <!--  ネットでいらない本を寄付できるサイト -->
      <p> ネットでいらない本を寄付できるサイト</p>
      <p style="font-size:0.9rem;color:#64748b;margin-top:4px">
        詳細条件（受け付けている本の状態・ジャンルなど）は各サイトのページで必ず確認してください。
      </p>
      <div class="link-list">
        <a target="_blank" href="https://www.charibon.jp/">
           チャリボン（本を送ると支援団体への寄付になるサービス）
        </a>
        <a target="_blank" href="https://www.bookoffonline.co.jp/files/sellfund/">
           ブックオフ・オンライン寄付（買取額を寄付にできる）
        </a>
        <a target="_blank" href="https://www.39book.jp/">
           ありがとうブック（子ども支援系団体への本寄付受付サイト）
        </a>
      </div>
    `;
    detailModal.classList.remove("hidden");

    // 図書館マップのボタン処理
    const libraryNearBtn = modalBody.querySelector("#libraryNearBtn");
    const libraryInput = modalBody.querySelector("#libraryInput");
    const librarySearchBtn = modalBody.querySelector("#librarySearchBtn");
    const libraryMapFrame = modalBody.querySelector("#libraryMapFrame");

    // 現在地から探す
    if (libraryNearBtn && libraryMapFrame) {
      libraryNearBtn.addEventListener("click", () => {
        if (!navigator.geolocation) {
          alert("位置情報が利用できません。エリア名で検索してください。");
          return;
        }
        libraryNearBtn.disabled = true;
        libraryNearBtn.textContent = "検索中…";

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            // 現在地付近の図書館を表示
            const url = `https://www.google.com/maps?q=${encodeURIComponent(
              "図書館"
            )}&ll=${lat},${lng}&output=embed`;
            libraryMapFrame.src = url;
            libraryNearBtn.disabled = false;
            libraryNearBtn.textContent = "現在地から探す";
          },
          (err) => {
            console.error(err);
            alert("位置情報を取得できませんでした。エリア名で検索を利用してください。");
            libraryNearBtn.disabled = false;
            libraryNearBtn.textContent = "現在地から探す";
          }
        );
      });
    }

    // エリア名で検索
    if (librarySearchBtn && libraryInput && libraryMapFrame) {
      librarySearchBtn.addEventListener("click", () => {
        const keyword = libraryInput.value.trim();
        const q = keyword ? keyword : "図書館";
        libraryMapFrame.src = `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
      });
    }

    return;
  }

  if (action === "sell") {
    // 売却　近くのリサイクルショップとメルカリ・ヤフオク検索

    const isbnQuery = b.isbn || "";

    // デフォルト地図（リサイクルショップ）
    const defaultMapSrc = `https://www.google.com/maps?q=${encodeURIComponent("リサイクルショップ")}&output=embed`;
    const mercari = `https://www.mercari.com/jp/search/?keyword=${encodeURIComponent(isbnQuery)}`;
    const yahoo = `https://auctions.yahoo.co.jp/search/search?p=${encodeURIComponent(isbnQuery)}`;

    modalBody.innerHTML = `
      <h3 style="margin-top:0">${escapeHtml(`売却候補 - ${b.title}`)}</h3>
      <div style="color:#64748b;margin-bottom:8px">
        ${escapeHtml(b.authors)} ・ ${escapeHtml(b.publishedDate)}
      </div>

      <!--  近くのリサイクルショップを地図で探す -->
      <p> 近くのリサイクルショップを地図で探す</p>
      <p style="font-size:0.9rem;color:#64748b;margin-top:4px">
        「現在地から探す」を押すと、今いる場所の近くのリサイクルショップを表示します。<br>
        位置情報を許可したくない場合は、市区町村名などを入力して「エリア名で検索」を使ってください。
      </p>

      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
        <button id="recycleNearBtn"
          style="padding:0.4rem 0.8rem;border-radius:6px;border:none;background:#0c6befd6;color:white;cursor:pointer;">
          現在地から探す
        </button>
        <input id="recycleInput"
          placeholder="例：〇〇市 リサイクルショップ"
          style="flex:1;min-width:180px;padding:0.4rem;border-radius:6px;border:1px solid #e2e8f0;">
        <button id="recycleSearchBtn"
          style="padding:0.4rem 0.8rem;border-radius:6px;border:none;background:#e5e7eb;color:#111827;cursor:pointer;">
          エリア名で検索
        </button>
      </div>

      <iframe id="recycleMapFrame"
        class="map-frame"
        src="${defaultMapSrc}">
      </iframe>

      <hr style="margin:16px 0;">

      <!--  フリマ・オークションサイトでISBN検索 -->
      <p> フリマ・オークションサイトでこの本の相場をチェック</p>
      <p style="font-size:0.9rem;color:#64748b;margin-top:4px">
        下のリンクから、この本（ISBN）に近い出品や相場を確認できます。
      </p>
      <div class="link-list">
        <a href="${mercari}" target="_blank">
           メルカリでISBN検索（${escapeHtml(isbnQuery)}）
        </a>
        <a href="${yahoo}" target="_blank">
           Yahoo!オークションでISBN検索（${escapeHtml(isbnQuery)}）
        </a>
      </div>

      <p style="font-size:0.9rem;color:#64748b;margin-top:8px">
        ※ 実際の買取・出品条件は各サービス・店舗のページを確認してください。
      </p>
    `;
    detailModal.classList.remove("hidden");

    //リサイクルショップ地図のボタン処理
    const recycleNearBtn = modalBody.querySelector("#recycleNearBtn");
    const recycleInput = modalBody.querySelector("#recycleInput");
    const recycleSearchBtn = modalBody.querySelector("#recycleSearchBtn");
    const recycleMapFrame = modalBody.querySelector("#recycleMapFrame");

    // 現在地から探す
    if (recycleNearBtn && recycleMapFrame) {
      recycleNearBtn.addEventListener("click", () => {
        if (!navigator.geolocation) {
          alert("このブラウザでは位置情報が利用できません。エリア名で検索してください。");
          return;
        }
        recycleNearBtn.disabled = true;
        recycleNearBtn.textContent = "検索中…";

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            // 現在地付近のリサイクルショップを表示
            const url = `https://www.google.com/maps?q=${encodeURIComponent(
              "リサイクルショップ"
            )}&ll=${lat},${lng}&output=embed`;
            recycleMapFrame.src = url;
            recycleNearBtn.disabled = false;
            recycleNearBtn.textContent = "現在地から探す";
          },
          (err) => {
            console.error(err);
            alert("位置情報を取得できませんでした。エリア名で検索を利用してください。");
            recycleNearBtn.disabled = false;
            recycleNearBtn.textContent = "現在地から探す";
          }
        );
      });
    }

    // エリア名で検索
    if (recycleSearchBtn && recycleInput && recycleMapFrame) {
      recycleSearchBtn.addEventListener("click", () => {
        const keyword = recycleInput.value.trim();
        const q = keyword ? keyword : "リサイクルショップ";
        recycleMapFrame.src = `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
      });
    }

    return;
  }
}

// モーダル
function showDetails(obj) {
  modalBody.innerHTML = `
    <h3 style="margin-top:0">${escapeHtml(obj.title || "")}</h3>
    <div style="color:#64748b;margin-bottom:8px">${escapeHtml(obj.authors || "")} ・ ${escapeHtml(obj.publishedDate || "")}</div>
    <div style="white-space:pre-wrap;color:#0f172a">${escapeHtml(obj.description || "")}</div>
    <div style="margin-top:12px"></div>
  `;
  detailModal.classList.remove("hidden");
}
closeModalBtn?.addEventListener?.("click", () => detailModal.classList.add("hidden"));

function truncate(str, n){ return str.length>n? str.slice(0,n-1)+"…":str }
function escapeHtml(unsafe){
  if (!unsafe) return "";
  return unsafe.replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m] });
}

// スキャナー開始
async function startScanner() {
  if (scanning) return;
  const readerId = "reader";
  try {
    html5QrCode = new Html5Qrcode(readerId, /* verbose= */ false);
    const config = { fps: 10, qrbox: { width: 260, height: 180 } };

    await html5QrCode.start(
      { facingMode: "environment" },
      config,
      async (decodedText, decodedResult) => {
        // html5-qrcodeはQRやバーコードの文字列を返す
        const isbn = normalizeIsbn(decodedText);
        if (!isbn) {
          showMessage("ISBNでないコードを検出しました。再スキャンします。");
          return;
        }
        // 一旦停止して処理
        try {
          await html5QrCode.stop();
        } catch(e){
          console.warn("停止に失敗:", e);
        }
        scanning = false;
        scanResultEl.innerText = `読み取り: ${isbn} → 情報取得中…`;
        await handleScannedIsbn(isbn);
        // 少し待って再開
        setTimeout(()=> {
          startScanner();
        }, 800);
      },
      (errorMessage) => {
        // console.debug("scanning...", errorMessage);
      }
    );
    scanning = true;
  } catch (err) {
    console.error("カメラ起動エラー:", err);
    scanResultEl.innerText = "カメラを起動できませんでした。";
  }
}

// スキャンまたは手動で得たISBNの処理
async function handleScannedIsbn(isbn) {
  // 重複チェック
  if (bookList.some(b => b.isbn === isbn)) {
    showMessage("既に登録済みのISBNです。");
    return;
  }
  const info = await fetchBookInfo(isbn);
  if (!info) {
    showMessage("書誌情報が見つかりませんでした。手動で入力してください。");
    return;
  }
  bookList.unshift(info); // 新しいものを先頭に
  renderBookList();
  showMessage(`${info.title} を一覧に追加しました。`);
}

// 手動追加ボタン
manualAddBtn.addEventListener("click", async () => {
  const isbn = normalizeIsbn(manualIsbn.value);
  if (!isbn) { alert("ISBNを入力してください。"); return; }
  if (bookList.some(b => b.isbn === isbn)) { alert("そのISBNは既に登録済みです。"); return; }
  scanResultEl.innerText = `手動ISBN: ${isbn} → 情報取得中…`;
  const info = await fetchBookInfo(isbn);
  if (!info) { alert("書誌情報が見つかりませんでした。手動タイトルで追加してください。"); return; }
  bookList.unshift(info);
  manualIsbn.value = "";
  renderBookList();
  showMessage(`${info.title} を一覧に追加しました。`);
});

// タイトル手動追加（最小限の情報で）
manualTitleBtn.addEventListener("click", () => {
  const title = manualTitle.value.trim();
  if (!title) { alert("タイトルを入力してください。"); return; }
  const fake = {
    isbn: `manual-${Date.now()}`,
    title,
    authors: "（手動登録）",
    publishedDate: "",
    description: "",
    thumbnail: ""
  };
  bookList.unshift(fake);
  manualTitle.value = "";
  renderBookList();
  showMessage(`${title} を手動で追加しました。`);
});

// 起動
window.addEventListener("load", () => {
  renderBookList();
  startScanner();
});

// モーダルをクリックで閉じる
detailModal.addEventListener("click", (e) => {
  if (e.target === detailModal) detailModal.classList.add("hidden");
});
