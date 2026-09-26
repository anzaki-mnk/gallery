import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ----------------------------------------------------
// Supabase設定
// ----------------------------------------------------

const SUPABASE_URL = "https://zuvxowdzzhotesdvorpm.supabase.co";

const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ZaVMrfAPNUSE9eprOwMG7w_OdmrQn9n";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);


// ----------------------------------------------------
// DOM要素の取得
// ----------------------------------------------------

const loggedOutView = document.getElementById("logged-out-view");
const loggedInView = document.getElementById("logged-in-view");

const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");

const userDisplayName = document.getElementById("user-display-name");

const uploadForm = document.getElementById("upload-form");
const photoFileInput = document.getElementById("photo-file");
const photoTitleInput = document.getElementById("photo-title");

const previewBox = document.getElementById("image-preview");
const previewImg = document.getElementById("preview-img");

const submitBtn = document.getElementById("submit-btn");
const statusMessage = document.getElementById("status-message");


// ----------------------------------------------------
// 現在のログインユーザー
// ----------------------------------------------------

let currentUser = null;


// ----------------------------------------------------
// A. ログイン状態の監視
// ----------------------------------------------------

async function checkUser() {

  const {
    data: { user }
  } = await supabase.auth.getUser();

  currentUser = user;

  updateLoginView(user);
}


// ----------------------------------------------------
// ログイン画面 / ログイン後画面の切り替え
// ----------------------------------------------------

function updateLoginView(user) {

  if (user) {

    currentUser = user;

    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.preferred_username ||
      "Discordユーザー";

    userDisplayName.textContent = displayName;

    loggedOutView.classList.add("hidden");
    loggedInView.classList.remove("hidden");

  } else {

    currentUser = null;

    loggedOutView.classList.remove("hidden");
    loggedInView.classList.add("hidden");
  }
}


// ----------------------------------------------------
// Supabase Authの状態変化を監視
// ----------------------------------------------------

supabase.auth.onAuthStateChange((event, session) => {

  const user = session?.user ?? null;

  updateLoginView(user);

});


// 初回チェック
checkUser();


// ----------------------------------------------------
// B. Discordログイン
// ----------------------------------------------------

loginBtn.addEventListener("click", async () => {

  try {

    statusMessage.textContent = "";

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: "https://anzaki-mnk.github.io/gallery/"
      }
    });

    if (error) {
      throw error;
    }

  } catch (error) {

    console.error("ログインエラー:", error);

    alert(
      "ログインに失敗しました: " +
      error.message
    );

  }

});


// ----------------------------------------------------
// ログアウト
// ----------------------------------------------------

logoutBtn.addEventListener("click", async () => {

  try {

    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

  } catch (error) {

    console.error("ログアウトエラー:", error);

    alert(
      "ログアウトに失敗しました: " +
      error.message
    );

  }

});


// ----------------------------------------------------
// C. 画像プレビュー
// ----------------------------------------------------

photoFileInput.addEventListener("change", (e) => {

  const file = e.target.files[0];

  if (file) {

    const reader = new FileReader();

    reader.onload = (e) => {

      previewImg.src = e.target.result;

      previewBox.classList.remove("hidden");

    };

    reader.readAsDataURL(file);

  } else {

    previewBox.classList.add("hidden");

  }

});


// ----------------------------------------------------
// D. 写真アップロード ＆ DB登録
// ----------------------------------------------------

uploadForm.addEventListener("submit", async (e) => {

  e.preventDefault();


  // ---------------------------------------------
  // 入力値取得
  // ---------------------------------------------

  const file = photoFileInput.files[0];

  const title = photoTitleInput.value.trim();


  // ---------------------------------------------
  // ログイン確認
  // ---------------------------------------------

  if (!currentUser) {

    alert("先にDiscordでログインしてください。");

    return;
  }


  // ---------------------------------------------
  // 必須項目確認
  // ---------------------------------------------

  if (!file || !title) {

    alert("写真とタイトルを入力してください。");

    return;
  }


  // ---------------------------------------------
  // ファイル形式確認
  // ---------------------------------------------

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!allowedTypes.includes(file.type)) {

    alert(
      "JPEG、PNG、WebP形式の画像を選択してください。"
    );

    return;
  }


  // ---------------------------------------------
  // ファイルサイズ確認
  // ---------------------------------------------

  if (file.size > 10 * 1024 * 1024) {

    alert("画像サイズは10MB以下にしてください。");

    return;
  }


  // ---------------------------------------------
  // 二重送信防止
  // ---------------------------------------------

  submitBtn.disabled = true;

  statusMessage.textContent = "画像を送信中...";


  try {

    // -------------------------------------------
    // 1. Storageに画像をアップロード
    // -------------------------------------------

    const fileExtension =
      file.name.split(".").pop().toLowerCase();

    const fileName =
      `${Date.now()}_${crypto.randomUUID()}.${fileExtension}`;

    const filePath =
      `${currentUser.id}/${fileName}`;


    const {
      error: uploadError
    } = await supabase.storage
      .from("gallery")
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false
      });


    if (uploadError) {
      throw uploadError;
    }


    // -------------------------------------------
    // 2. 公開URLを取得
    // -------------------------------------------

    const {
      data: publicUrlData
    } = supabase.storage
      .from("gallery")
      .getPublicUrl(filePath);


    const imageUrl =
      publicUrlData.publicUrl;


    // -------------------------------------------
    // 3. photosテーブルに保存
    // -------------------------------------------

    statusMessage.textContent =
      "投稿情報を登録中...";


    const displayName =
      currentUser.user_metadata?.full_name ||
      currentUser.user_metadata?.name ||
      currentUser.user_metadata?.preferred_username ||
      "Discordユーザー";


    const {
      error: databaseError
    } = await supabase
      .from("photos")
      .insert({

        title: title,

        image_url: imageUrl,

        author_name: displayName,

        author_id: currentUser.id,

        approved: false

      });


    if (databaseError) {
      throw databaseError;
    }


    // -------------------------------------------
    // 成功
    // -------------------------------------------

    statusMessage.textContent = "";

    alert(
      "投稿が完了しました！\n\n" +
      "管理者による確認後、ギャラリーに掲載されます。"
    );


    // フォームリセット

    uploadForm.reset();

    previewBox.classList.add("hidden");


  } catch (error) {

    console.error(
      "アップロードエラー:",
      error
    );

    statusMessage.textContent = "";

    alert(
      "アップロードに失敗しました:\n" +
      error.message
    );


  } finally {

    submitBtn.disabled = false;

  }

});
