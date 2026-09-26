import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


// ==================================================
// Supabase設定
// ==================================================

const SUPABASE_URL =
  "https://zuvxowdzzhotesdvorpm.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_ZaVMrfAPNUSE9eprOwMG7w_OdmrQn9n";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);


// ==================================================
// HTML要素
// ==================================================

const loggedOutView =
  document.getElementById("logged-out-view");

const loggedInView =
  document.getElementById("logged-in-view");

const loginBtn =
  document.getElementById("login-btn");

const logoutBtn =
  document.getElementById("logout-btn");

const userDisplayName =
  document.getElementById("user-display-name");

const uploadForm =
  document.getElementById("upload-form");

const photoFileInput =
  document.getElementById("photo-file");

const photoTitleInput =
  document.getElementById("photo-title");

const previewBox =
  document.getElementById("image-preview");

const previewImg =
  document.getElementById("image-preview-img");

const submitBtn =
  document.getElementById("submit-btn");

const message =
  document.getElementById("message");


// ==================================================
// 設定
// ==================================================

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp"
];


// ==================================================
// 初期化
// ==================================================

init();

async function init() {

  // 現在ログインしているユーザーを確認
  const {
    data: { session }
  } = await supabase.auth.getSession();

  updateLoginState(session);


  // ログイン状態が変わったとき
  supabase.auth.onAuthStateChange(
    (_event, session) => {
      updateLoginState(session);
    }
  );
}


// ==================================================
// ログイン状態を画面に反映
// ==================================================

function updateLoginState(session) {

  if (session && session.user) {

    loggedOutView.classList.add("hidden");
    loggedInView.classList.remove("hidden");

    const user = session.user;

    const metadata = user.user_metadata || {};

    const displayName =
      metadata.full_name ||
      metadata.name ||
      metadata.user_name ||
      metadata.preferred_username ||
      user.email ||
      "Discordユーザー";

    userDisplayName.textContent = displayName;

  } else {

    loggedOutView.classList.remove("hidden");
    loggedInView.classList.add("hidden");

    userDisplayName.textContent = "";
  }
}


// ==================================================
// Discordログイン
// ==================================================

loginBtn.addEventListener("click", async () => {

  message.textContent = "";

  const { error } =
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo:
          "https://anzaki-mnk.github.io/gallery/"
      }
    });

  if (error) {

    console.error(error);

    alert(
      "Discordログインに失敗しました。\n" +
      error.message
    );
  }
});


// ==================================================
// ログアウト
// ==================================================

logoutBtn.addEventListener("click", async () => {

  const { error } =
    await supabase.auth.signOut();

  if (error) {

    console.error(error);

    alert(
      "ログアウトに失敗しました。\n" +
      error.message
    );

    return;
  }

  location.reload();
});


// ==================================================
// 写真選択時のプレビュー
// ==================================================

photoFileInput.addEventListener(
  "change",
  () => {

    message.textContent = "";

    const file =
      photoFileInput.files[0];

    if (!file) {

      previewBox.classList.add("hidden");
      previewImg.src = "";

      return;
    }


    // ファイル形式チェック
    if (!ALLOWED_TYPES.includes(file.type)) {

      alert(
        "JPEG・PNG・WebP形式の画像を選択してください。"
      );

      photoFileInput.value = "";

      previewBox.classList.add("hidden");
      previewImg.src = "";

      return;
    }


    // ファイルサイズチェック
    if (file.size > MAX_FILE_SIZE) {

      alert(
        "画像サイズは10MB以下にしてください。"
      );

      photoFileInput.value = "";

      previewBox.classList.add("hidden");
      previewImg.src = "";

      return;
    }


    // プレビュー表示
    const objectUrl =
      URL.createObjectURL(file);

    previewImg.src = objectUrl;

    previewBox.classList.remove("hidden");
  }
);


// ==================================================
// 投稿処理
// ==================================================

uploadForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    message.textContent = "";


    // ----------------------------------------------
    // ログイン確認
    // ----------------------------------------------

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {

      alert(
        "写真を投稿するにはDiscordでログインしてください。"
      );

      return;
    }


    // ----------------------------------------------
    // 入力値取得
    // ----------------------------------------------

    const file =
      photoFileInput.files[0];

    const title =
      photoTitleInput.value.trim();


    // ----------------------------------------------
    // 入力チェック
    // ----------------------------------------------

    if (!file) {

      alert("写真を選択してください。");

      return;
    }

    if (!title) {

      alert("写真タイトルを入力してください。");

      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {

      alert(
        "JPEG・PNG・WebP形式の画像を選択してください。"
      );

      return;
    }

    if (file.size > MAX_FILE_SIZE) {

      alert(
        "画像サイズは10MB以下にしてください。"
      );

      return;
    }


    // ----------------------------------------------
    // ボタンを無効化
    // ----------------------------------------------

    submitBtn.disabled = true;
    submitBtn.textContent = "投稿中...";

    message.textContent =
      "写真をアップロードしています。";


    try {

      // --------------------------------------------
      // ファイル名を安全に作成
      // --------------------------------------------

      const extension =
        getFileExtension(file);

      const fileName =
        `${crypto.randomUUID()}.${extension}`;


      // ユーザーごとのフォルダに保存
      const filePath =
        `${user.id}/${fileName}`;


      // --------------------------------------------
      // Storageへ画像アップロード
      // --------------------------------------------

      const {
        error: uploadError
      } = await supabase.storage
        .from("gallery")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type
        });


      if (uploadError) {

        throw new Error(
          "画像のアップロードに失敗しました。\n" +
          uploadError.message
        );
      }


      // --------------------------------------------
      // 公開URLを取得
      // --------------------------------------------

      const {
        data: publicUrlData
      } = supabase.storage
        .from("gallery")
        .getPublicUrl(filePath);


      const imageUrl =
        publicUrlData.publicUrl;


      // --------------------------------------------
      // Discord表示名
      // --------------------------------------------

      const metadata =
        user.user_metadata || {};

      const authorName =
        metadata.full_name ||
        metadata.name ||
        metadata.user_name ||
        metadata.preferred_username ||
        user.email ||
        "Discordユーザー";


      // --------------------------------------------
      // photosテーブルへ登録
      // --------------------------------------------

      const {
        error: insertError
      } = await supabase
        .from("photos")
        .insert({
          title: title,
          image_url: imageUrl,
          author_name: authorName,
          author_id: user.id,
          approved: true
        });


      if (insertError) {

        // DB登録に失敗した場合、
        // アップロード済み画像を削除しておく
        await supabase.storage
          .from("gallery")
          .remove([filePath]);

        throw new Error(
          "投稿情報の保存に失敗しました。\n" +
          insertError.message
        );
      }


      // --------------------------------------------
      // 投稿成功
      // --------------------------------------------

      message.textContent =
        "投稿しました！\n" +
        "ギャラリーに掲載されました。";

      uploadForm.reset();

      previewBox.classList.add("hidden");
      previewImg.src = "";

    } catch (error) {

      console.error(error);

      message.textContent =
        error.message ||
        "投稿中にエラーが発生しました。";

    } finally {

      submitBtn.disabled = false;
      submitBtn.textContent = "投稿する";
    }
  }
);


// ==================================================
// 拡張子取得
// ==================================================

function getFileExtension(file) {

  if (file.type === "image/jpeg") {
    return "jpg";
  }

  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  return "jpg";
}
