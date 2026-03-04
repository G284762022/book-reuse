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


// --- 意思決定支援：利用者条件（profile） ---
const saveProfileBtn = document.getElementById("saveProfileBtn");
const profileSavedMsg = document.getElementById("profileSavedMsg");
const bookConditionSel = document.getElementById("bookCondition");
const p2pResistanceRange = document.getElementById("p2pResistance");

function getRadioValue(name){
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : "";
}
function setRadioValue(name, value){
  const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (el) el.checked = true;
}

function loadProfile(){
  try{
    const raw = localStorage.getItem("reuse_profile_v1");
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){
    console.warn("profile load failed", e);
    return null;
  }
}
function saveProfile(profile){
  try{
    localStorage.setItem("reuse_profile_v1", JSON.stringify(profile));
    return true;
  }catch(e){
    console.warn("profile save failed", e);
    return false;
  }
}
function getProfileFromUI(){
  return {
    priority: getRadioValue("priority") || "effort",
    bookCondition: bookConditionSel?.value || "ok",
    canShip: getRadioValue("canShip") || "yes",
    canVisit: getRadioValue("canVisit") || "yes",
    p2pResistance: Number(p2pResistanceRange?.value ?? 1), // 0 low, 1 mid, 2 high
    avoidDiscard: getRadioValue("avoidDiscard") || "yes"
  };
}
function applyProfileToUI(p){
  if(!p) return;
  setRadioValue("priority", p.priority || "effort");
  if (bookConditionSel && p.bookCondition) bookConditionSel.value = p.bookCondition;
  setRadioValue("canShip", p.canShip || "yes");
  setRadioValue("canVisit", p.canVisit || "yes");
  if (p2pResistanceRange) p2pResistanceRange.value = String(p.p2pResistance ?? 1);
  setRadioValue("avoidDiscard", p.avoidDiscard || "yes");
}

function getActiveProfile(){
  const p = getProfileFromUI();
  // UIがまだ無いケース（古いHTML）でも落ちないように
  return p;
}

// 保存ボタン
saveProfileBtn?.addEventListener?.("click", () => {
  const p = getProfileFromUI();
  const ok = saveProfile(p);
  if (profileSavedMsg){
    profileSavedMsg.textContent = ok ? "保存しました（おすすめ判定に反映されます）" : "保存に失敗しました";
    setTimeout(()=>{ profileSavedMsg.textContent = ""; }, 2500);
  }
});


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


// --- 意思決定支援：スコアリング（if/ルールベース） ---
function scoreOptions(book, profile){
  // 5分類：捨てる / 売る / 寄附 / 交換 / その他
  const scores = {
    discard: 50,
    sell: 55,
    donate: 50,
    exchange: 45,
    other: 45 // 友人に譲る等
  };
  const why = { discard: [], sell: [], donate: [], exchange: [], other: [] };

  const cond = profile.bookCondition || "ok"; // good/ok/bad
  const priority = profile.priority || "effort";
  const canShip = profile.canShip === "yes";
  const canVisit = profile.canVisit === "yes";
  const p2p = Number(profile.p2pResistance ?? 1);
  const avoidDiscard = profile.avoidDiscard === "yes";

  // 状態
  if (cond === "good"){
    scores.sell += 12; why.sell.push("状態が良いので売却で価値が出やすい");
    scores.donate += 6; why.donate.push("状態が良く受け入れられやすい");
    scores.exchange += 6; why.exchange.push("状態が良いと交換しやすい");
  } else if (cond === "bad"){
    scores.sell -= 18; why.sell.push("状態が悪いと値段がつきにくい／手間に見合いにくい");
    scores.donate -= 10; why.donate.push("状態によっては受入不可のことがある");
    scores.exchange -= 8; why.exchange.push("状態が悪いと交換に出しにくい");
    scores.discard += 10; why.discard.push("状態が悪い場合は処分が早いことが多い");
  }

  // 優先
  if (priority === "money"){
    scores.sell += 18; why.sell.push("お金を重視 → 売却が有利");
    scores.discard -= 8;
  } else if (priority === "effort"){
    scores.sell -= 6; why.sell.push("売却は手続きが増えやすい");
    scores.donate += 10; why.donate.push("寄附は手間が少ない選択肢が多い（送付/持込など）");
    scores.discard += 8; why.discard.push("最小手間なら捨てるが最短になりやすい");
    scores.other += 8; why.other.push("知人に譲るなら手間少なく完結しやすい");
  } else if (priority === "speed"){
    scores.discard += 16; why.discard.push("早さ重視 → すぐ終わる手段が有利");
    scores.sell += 4; why.sell.push("店頭なら即日で終わる可能性がある");
    scores.exchange -= 8; 
  } else if (priority === "social"){
    scores.donate += 16; why.donate.push("誰かの役に立つ重視 → 寄附が合いやすい");
    scores.exchange += 12; why.exchange.push("交換会は本が次の持ち主に渡りやすい");
    scores.discard -= 10;
  }

  // 可否（発送/持込）
  if (!canShip){
    scores.sell -= 10; why.sell.push("発送できない → フリマ系がやりにくい");
    scores.donate -= 4; why.donate.push("送付寄附が使えない場合がある");
  } else {
    scores.sell += 4; why.sell.push("発送できる → フリマ/買取発送が使える");
    scores.donate += 4; why.donate.push("送付寄附が使える");
  }
  if (!canVisit){
    scores.sell -= 8; why.sell.push("持ち込み不可 → 店頭買取が使いにくい");
    scores.exchange -= 6; why.exchange.push("会場参加が難しい");
  } else {
    scores.sell += 4; why.sell.push("持ち込み可 → 店頭買取が使える");
    scores.exchange += 3; why.exchange.push("近場の交換会に行ける");
  }

  // 個人取引抵抗
  if (p2p === 2){
    scores.sell -= 10; why.sell.push("個人取引の抵抗が高い → フリマのやりとりが負担");
    scores.exchange -= 5; why.exchange.push("対面交流が負担になる場合");
    scores.other += 4; why.other.push("身内に譲るなど“相手が分かる”方法が安心");
  } else if (p2p === 0){
    scores.sell += 6; why.sell.push("個人取引OK → フリマで高く売れる可能性");
  }

  // 捨てたくない
  if (avoidDiscard){
    scores.discard -= 16; why.discard.push("捨てるのは避けたい → 他の選択肢を優先");
    scores.donate += 4;
    scores.exchange += 4;
  }

  // ISBNが無い（手動タイトル）場合は売却の精度が落ちる
  if (!book.isbn || String(book.isbn).startsWith("manual-")){
    scores.sell -= 6; why.sell.push("ISBNが無い/曖昧 → 検索や相場確認が難しい");
  }

  // スコアまとめ
  const entries = Object.entries(scores).map(([k,v]) => ({ key:k, score:v }));
  entries.sort((a,b)=>b.score-a.score);

  const label = {
    discard:"捨てる",
    sell:"売る",
    donate:"寄附",
    exchange:"交換",
    other:"その他（譲る等）"
  };

  return {
    ranking: entries.map(e => ({...e, label: label[e.key], reasons: why[e.key] })),
    scores, why
  };
}

function buildCompareTable(ranking){
  const rows = ranking.map(r => `
    <tr>
      <td><strong>${escapeHtml(r.label)}</strong></td>
      <td>${r.score}</td>
      <td style="font-size:0.9rem;color:#334155">
        <ul style="margin:0;padding-left:1.1rem">
          ${(r.reasons && r.reasons.length ? r.reasons.slice(0,3) : ["（条件から大きなマイナスなし）"]).map(x=>`<li>${escapeHtml(x)}</li>`).join("")}
        </ul>
      </td>
    </tr>
  `).join("");
  return `
    <table class="compare-table">
      <thead>
        <tr><th>方法</th><th>おすすめ度</th><th>理由（上位）</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function getBenefitsByKey(key){
  const map = {
    discard: [
      "最短で片付く（手続きが少ない）",
      "状態が悪い本でも確実に処分できる",
      "急ぎのときの最終手段になりやすい"
    ],
    sell: [
      "お金にできる（状態が良いほど有利）",
      "店頭ならその場で完了しやすい",
      "フリマなら高く売れる可能性もある"
    ],
    donate: [
      "社会貢献につながる",
      "捨てる罪悪感が減る",
      "送付/持込など選択肢が多い"
    ],
    exchange: [
      "次の読み手につながる体験がある",
      "無料で別の本と出会える",
      "イベントとして楽しめる"
    ],
    other: [
      "知人に譲るなら安心・早い",
      "本の価値（思い出）を伝えられる",
      "梱包や出品の手間が少ない"
    ]
  };
  return map[key] || [];
}

function showDecisionSupport(book){
  const profile = getActiveProfile();
  const { ranking } = scoreOptions(book, profile);
  const best = ranking[0];
  const second = ranking[1];

  const benefits = getBenefitsByKey(best.key).map(x=>`<li>${escapeHtml(x)}</li>`).join("");
  const compare = buildCompareTable(ranking);

  modalBody.innerHTML = `
    <h3 style="margin-top:0">診断結果：<span style="color:#0c6befd6">${escapeHtml(best.label)}</span> が最有力</h3>
    <div style="color:#64748b;margin-bottom:10px">
      対象：${escapeHtml(book.title || "")}（${escapeHtml(book.authors || "")}）
    </div>

    <div class="recommend-box">
      <div class="recommend-head">
        <div class="badge">おすすめ1位</div>
        <div>
          <div class="recommend-title">${escapeHtml(best.label)}</div>
          <div class="recommend-sub">次点：${escapeHtml(second ? second.label : "—")}</div>
        </div>
      </div>

      <div class="recommend-cols">
        <div>
          <h4>この方法のメリット</h4>
          <ul style="margin:0;padding-left:1.1rem">${benefits}</ul>
        </div>
        <div>
          <h4>今回の条件での理由</h4>
          <ul style="margin:0;padding-left:1.1rem">
            ${(best.reasons && best.reasons.length ? best.reasons.slice(0,5) : ["（条件から大きなマイナスなし）"]).map(x=>`<li>${escapeHtml(x)}</li>`).join("")}
          </ul>
        </div>
      </div>

      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="action-btn primary" id="goBestBtn">この方法を詳しく見る</button>
        <button class="action-btn" id="goSecondBtn">次点を詳しく見る</button>
      </div>
      <p style="font-size:0.85rem;color:#94a3b8;margin:10px 0 0">
        ※ ルール（if文）による簡易スコアです。状況により最適解は変わります。
      </p>
    </div>

    <h4 style="margin-top:14px">比較（おすすめ度・理由）</h4>
    ${compare}
  `;

  detailModal.classList.remove("hidden");

  // ボタン導線：既存のモーダル（売却/寄付/交換）にジャンプ
  modalBody.querySelector("#goBestBtn")?.addEventListener("click", ()=>{
    if (best.key === "sell") handleAction("sell", bookList.indexOf(book));
    else if (best.key === "donate") handleAction("donate", bookList.indexOf(book));
    else if (best.key === "exchange") handleAction("exchange", bookList.indexOf(book));
    else if (best.key === "discard") showDiscardGuide(book);
    else showOtherGuide(book);
  });
  modalBody.querySelector("#goSecondBtn")?.addEventListener("click", ()=>{
    if (!second) return;
    if (second.key === "sell") handleAction("sell", bookList.indexOf(book));
    else if (second.key === "donate") handleAction("donate", bookList.indexOf(book));
    else if (second.key === "exchange") handleAction("exchange", bookList.indexOf(book));
    else if (second.key === "discard") showDiscardGuide(book);
    else showOtherGuide(book);
  });
}

function showDiscardGuide(book){
  modalBody.innerHTML = `
    <h3 style="margin-top:0">捨てる（処分）のガイド</h3>
    <p style="color:#64748b;margin-top:4px">
      状態が悪い／急ぎ／手間を最小にしたい場合の最終手段です。
    </p>
    <ul style="padding-left:1.1rem">
      <li>自治体の分別ルール（紙類/資源ごみ等）を確認</li>
      <li>段ボール等でまとめて出すと運びやすい</li>
      <li>まだ読めるなら、寄附や譲渡も検討</li>
    </ul>
    <div class="link-list">
      <a target="_blank" href="https://www.google.com/search?q=${encodeURIComponent("自治体 古本 捨て方 分別")}">自治体の分別ルールを検索</a>
    </div>
  `;
  detailModal.classList.remove("hidden");
}

function showOtherGuide(book){
  modalBody.innerHTML = `
    <h3 style="margin-top:0">その他（譲る等）のガイド</h3>
    <p style="color:#64748b;margin-top:4px">
      「友人に譲る」「学内/地域の掲示板で引き取り手を探す」など、相手が見える方法です。
    </p>
    <ul style="padding-left:1.1rem">
      <li>友人・後輩・サークル内で声かけ</li>
      <li>大学の掲示板や地域SNSで募集（個人情報に注意）</li>
      <li>複数冊あるなら“まとめて引き取り”にすると成立しやすい</li>
    </ul>
    <div class="link-list">
      <a target="_blank" href="https://www.google.com/search?q=${encodeURIComponent("本 譲る 方法 学内 掲示板")}">譲渡の方法を検索</a>
    </div>
  `;
  detailModal.classList.remove("hidden");
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


  if (action === "decide") {
    showDecisionSupport(b);
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

      <hr style="margin:16px 0;">

      <h4 style="margin:0 0 6px">相場メモ（比較用・手入力）</h4>
      <p style="font-size:0.9rem;color:#64748b;margin-top:4px">
        価格は自動取得できない（CORS/規約の都合）ので、外部リンクで見た金額を入力して比較できます。
        入力はこのブラウザ内に保存されます。
      </p>

      <div class="price-grid">
        <div>
          <label>メルカリ（売れそうな価格）</label>
          <input id="priceMercari" type="number" inputmode="numeric" placeholder="例：1200">
        </div>
        <div>
          <label>Yahoo!オークション（落札相場）</label>
          <input id="priceYahoo" type="number" inputmode="numeric" placeholder="例：900">
        </div>
        <div>
          <label>BOOKOFF等（店頭/宅配の目安）</label>
          <input id="priceStore" type="number" inputmode="numeric" placeholder="例：200">
        </div>
        <div>
          <label>Amazon中古など（参考）</label>
          <input id="priceAmazon" type="number" inputmode="numeric" placeholder="例：1500">
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <button class="action-btn primary" id="savePricesBtn">保存して比較</button>
        <span id="priceSummary" style="color:#64748b;font-size:0.9rem"></span>
      </div>

      <p style="font-size:0.9rem;color:#64748b;margin-top:8px">
        ※ 実際の買取・出品条件は各サービス・店舗のページを確認してください。
      </p>
    `;
    detailModal.classList.remove("hidden");


    // 相場メモ（手入力）の保存/表示
    const pm = modalBody.querySelector("#priceMercari");
    const py = modalBody.querySelector("#priceYahoo");
    const ps = modalBody.querySelector("#priceStore");
    const pa = modalBody.querySelector("#priceAmazon");
    const savePricesBtn = modalBody.querySelector("#savePricesBtn");
    const priceSummary = modalBody.querySelector("#priceSummary");

    const stored = loadPrices(b);
    if (pm) pm.value = stored.mercari ?? "";
    if (py) py.value = stored.yahoo ?? "";
    if (ps) ps.value = stored.store ?? "";
    if (pa) pa.value = stored.amazon ?? "";
    if (priceSummary) priceSummary.textContent = summarizePrices(stored);

    savePricesBtn?.addEventListener("click", () => {
      const prices = {
        mercari: pm?.value ? Number(pm.value) : null,
        yahoo: py?.value ? Number(py.value) : null,
        store: ps?.value ? Number(ps.value) : null,
        amazon: pa?.value ? Number(pa.value) : null
      };
      savePrices(b, prices);
      if (priceSummary) priceSummary.textContent = summarizePrices(prices);
    });

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

// --- 価格メモ（相場比較用：手入力） ---
function priceKeyForBook(book){
  const id = book?.isbn ? String(book.isbn) : "";
  return `reuse_prices_v1:${id}`;
}
function loadPrices(book){
  try{
    const raw = localStorage.getItem(priceKeyForBook(book));
    if(!raw) return {};
    return JSON.parse(raw);
  }catch(e){
    return {};
  }
}
function savePrices(book, prices){
  try{
    localStorage.setItem(priceKeyForBook(book), JSON.stringify(prices));
    return true;
  }catch(e){
    return false;
  }
}
function summarizePrices(p){
  const vals = [p.mercari, p.yahoo, p.store, p.amazon].map(x=>Number(x)).filter(x=>Number.isFinite(x) && x>0);
  if(!vals.length) return "まだ入力がありません";
  const maxv = Math.max(...vals);
  const minv = Math.min(...vals);
  const avg = Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
  return `入力${vals.length}件：最高 ${maxv}円 / 最低 ${minv}円 / 平均 ${avg}円`;
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
  // 保存済みの条件をUIへ反映
  const saved = loadProfile();
  if (saved) applyProfileToUI(saved);
  startScanner();
});

// モーダルをクリックで閉じる
detailModal.addEventListener("click", (e) => {
  if (e.target === detailModal) detailModal.classList.add("hidden");
});
