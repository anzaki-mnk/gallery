import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithPopup, 
  OAuthProvider, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. Firebaseの設定 (Firebase Console > プロジェクト設定 から取得)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "anzakicity-d2534.firebaseapp.com",
  projectId: "anzakicity-d2534",
  storageBucket: "anzakicity-d2534.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// 2. 初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app);

// DOM要素の取得
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

let currentUser = null;

// ----------------------------------------------------
// A. ログイン状態の監視
// ----------------------------------------------------
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    // ログイン中の画面切り替え
    userDisplayName.textContent = user.displayName || "Discordユーザー";
    loggedOutView.classList.add("hidden");
    loggedInView.classList.remove("hidden");
  } else {
    // 未ログイン状態の画面切り替え
    loggedOutView.classList.remove("hidden");
    loggedInView.classList.add("hidden");
  }
});

// ----------------------------------------------------
// B. Discord ログイン処理 (OpenID Connect / OIDC)
// ----------------------------------------------------
loginBtn.addEventListener("click", async () => {
  // 設定時のプロバイダID（oidc.discord または設定したプロバイダID）
  const provider = new OAuthProvider('oidc.discord');

  try {
    statusMessage.textContent = "";
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("ログインエラー:", error);
    alert("ログインに失敗しました: " + error.message);
  }
});

// ログアウト処理
logoutBtn.addEventListener("click", () => {
  signOut(auth);
});

// ----------------------------------------------------
// C. 画像ファイルが選択された時のプレビュー表示
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
// D. 写真のアップロード ＆ DB登録処理
// ----------------------------------------------------
uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const file = photoFileInput.files[0];
  const title = photoTitleInput.value.trim();

  if (!file || !title || !currentUser) {
    alert("必須項目を入力してください。");
    return;
  }

  // ボタンを無効化して連打・重複送信を防止
  submitBtn.disabled = true;
  statusMessage.textContent = "画像を送信中...";

  try {
    // 1. Cloud Storageに画像を保存 (ファイル名衝突防止のためタイムスタンプを付与)
    const timestamp = Date.now();
    const storagePath = `photos/\({currentUser.uid}/\){timestamp}_${file.name}`;
    const storageRef = ref(storage, storagePath);

    const uploadResult = await uploadBytes(storageRef, file);
    // 画像の公開用URLを取得
    const imageUrl = await getDownloadURL(uploadResult.ref);

    statusMessage.textContent = "データをデータベースに記録中...";

    // 2. Cloud Firestore にメタデータを保存
    await addDoc(collection(db, "photos"), {
      title: title,
      imageUrl: imageUrl,
      authorName: currentUser.displayName,
      authorUid: currentUser.uid,
      status: "pending", // 管理者確認用 (デフォルトは「保留」)
      createdAt: serverTimestamp()
    });

    // 成功時処理
    statusMessage.textContent = "";
    alert("投稿が完了しました！確認後にギャラリーへ掲載されます。");

    // フォームリセット
    uploadForm.reset();
    previewBox.classList.add("hidden");

  } catch (error) {
    console.error("アップロードエラー:", error);
    statusMessage.textContent = "";
    alert("アップロードに失敗しました: " + error.message);
  } finally {
    submitBtn.disabled = false;
  }
});
