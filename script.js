document.addEventListener("DOMContentLoaded", () => {
  const firebaseConfig = {
    apiKey: "AIzaSyBBZxCwywnv_ZVXYezOV8IKG6iKWK5sL10",
  authDomain: "studio-ywlo1.firebaseapp.com",
  projectId: "studio-ywlo1",
  storageBucket: "studio-ywlo1.firebasestorage.app",
  messagingSenderId: "791958850921",
  appId: "1:791958850921:web:149be668e7f132e59f41f8"
};

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const rtdb = firebase.database();

  let currentChatUser = null;

  window.toggleForm = function () {
    document.getElementById("login-form").classList.toggle("hidden");
    document.getElementById("register-form").classList.toggle("hidden");
  };

  window.register = function () {
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;
    const firstName = document.getElementById("first-name").value;
    const lastName = document.getElementById("last-name").value;
    const phone = document.getElementById("phone").value;
    const country = document.getElementById("country").value;
    const gender = document.getElementById("gender").value;

    auth.createUserWithEmailAndPassword(email, password)
      .then(cred => {
        return db.collection("users").doc(cred.user.uid).set({
          firstName, lastName, email, phone, country, gender
        });
      })
      .then(() => showDashboard())
      .catch(err => alert(err.message));
  };

  window.login = function () {
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    auth.signInWithEmailAndPassword(email, password)
      .then(() => showDashboard())
      .catch(err => alert(err.message));
  };

  function showDashboard() {
    document.getElementById("auth-section").classList.add("hidden");
    document.getElementById("dashboard").classList.remove("hidden");
    showSection("public");
    loadPosts();
    loadUsers();
    listenNotifications();
  }

  window.showSection = function (section) {
    document.getElementById("public-section").classList.add("hidden");
    document.getElementById("privet-section").classList.add("hidden");
    document.getElementById("notification-panel").classList.add("hidden");
    document.getElementById("message-box").classList.add("hidden");
    document.getElementById(`${section}-section`).classList.remove("hidden");
  };
  
// ====================== CREATE POST ======================
window.createPost = function () {
  const uid = auth.currentUser.uid;
  const contentEl = document.getElementById("post-content");
  if (!contentEl) return;
  const content = contentEl.value;
  if (!content) return;

  db.collection("users").doc(uid).get().then(doc => {
    const name = `${doc.data().firstName} ${doc.data().lastName}`;
    const postRef = rtdb.ref("posts").push();
    postRef.set({
      id: postRef.key,
      author: uid,
      authorName: name,
      content,
      likes: 0,
      timestamp: Date.now()
    });
    contentEl.value = "";
  });
};

// ====================== LOAD POSTS ======================
function loadPosts() {
  const container = document.getElementById("posts-container");
  container.innerHTML = "";

  // ✅ Gwiritsani ntchito child_added kuti post yatsopano iwonetsedwe pompo
  rtdb.ref("posts").orderByChild("timestamp").on("child_added", snapshot => {
    const post = { id: snapshot.key, ...snapshot.val() };
    const div = document.createElement("div");
    const preview = post.content.length > 100
      ? post.content.substring(0, 100) + "..."
      : post.content;

    div.innerHTML = `
      <p><strong>${post.authorName || "Anonymous"}</strong></p>
      <p>${preview}</p>
      ${post.content.length > 100 ? `<button onclick="viewFullPost('${post.id}')">See more</button>` : ""}
      <div style="display:flex; gap:6px; margin-top:6px;">
        <button id="like-btn-${post.id}" style="flex:1;" onclick="likePost('${post.id}')">❤️ (${post.likes || 0})</button>
        <button id="comment-btn-${post.id}" style="flex:1;" onclick="openCommentView('${post.id}')">💬 (0)</button>
      </div>
    `;
    container.prepend(div);

    // ✅ Listener pa likes
    rtdb.ref(`posts/${post.id}/likes`).on("value", snapLikes => {
      const btn = document.getElementById(`like-btn-${post.id}`);
      if (btn) btn.textContent = `❤️ (${snapLikes.val() || 0})`;
    });

    // ✅ Listener pa comments count
    rtdb.ref(`posts/${post.id}/comments`).on("value", snapComments => {
      const btn = document.getElementById(`comment-btn-${post.id}`);
      if (btn) btn.textContent = `💬 (${snapComments.numChildren()})`;
    });
  });
}

// ====================== VIEW FULL POST ======================
window.viewFullPost = function (postId) {
  rtdb.ref(`posts/${postId}`).once("value", snapshot => {
    const post = snapshot.val();
    const container = document.getElementById("posts-container");
    container.innerHTML = `
      <div>
        <p><strong>${post.authorName || "Anonymous"}</strong></p>
        <p>${post.content}</p>
        <button onclick="goBackToPosts()">⬅️ Back</button>
      </div>
    `;
  });
};

window.goBackToPosts = function () {
  // ✅ Chotsani listener yakale
  rtdb.ref("posts").off();
  // ✅ Bwezerani ma posts onse
  loadPosts();
};

// ====================== LIKE POST ======================
window.likePost = function (postId) {
  const likeRef = rtdb.ref(`posts/${postId}/likes`);
  likeRef.transaction(current => (current || 0) + 1);
};

// ====================== COMMENTS ======================
window.openCommentView = function (postId) {
  const panel = document.createElement("div");
  panel.id = "comment-panel";
  panel.style = "position:fixed;top:0;left:0;right:0;bottom:0;background:#f0f9ff;z-index:20;padding:15px;overflow:auto;";
  panel.innerHTML = `
    <button onclick="closeCommentView()">⬅️ Back to Posts</button>
    <h3>Comments</h3>
    <div id="comment-list-${postId}"></div>
    <input type="text" id="comment-input-${postId}" placeholder="Lemba comment..." />
    <button onclick="addComment('${postId}')">Tumiza Comment</button>
  `;
  document.body.appendChild(panel);
  loadComments(postId);
};

window.closeCommentView = function () {
  const panel = document.getElementById("comment-panel");
  if (panel) panel.remove();
};

function loadComments(postId) {
  const list = document.getElementById(`comment-list-${postId}`);
  rtdb.ref(`posts/${postId}/comments`).on("child_added", snapshot => {
    const comment = snapshot.val();
    const commentId = snapshot.key;
    const div = document.createElement("div");
    div.innerHTML = `
      <p><strong>${comment.authorName || "Anonymous"}</strong></p>
      <p>${comment.text}</p>
      <button onclick="openReplyView('${postId}','${commentId}')">↩️ Replies</button>
    `;
    list.appendChild(div);
  });
}

window.addComment = function (postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  const text = input.value;
  const user = auth.currentUser;
  if (!text || !user) return;

  db.collection("users").doc(user.uid).get().then(doc => {
    const name = `${doc.data().firstName} ${doc.data().lastName}`;
    rtdb.ref(`posts/${postId}/comments`).push({
      text,
      uid: user.uid,
      authorName: name,
      timestamp: Date.now()
    });
    input.value = "";
  });
};

// ====================== REPLIES ======================
window.addReply = function (postId, commentId) {
  const input = document.getElementById(`reply-input-${commentId}`);
  const text = input.value;
  const user = auth.currentUser;
  if (!text || !user) return;

  db.collection("users").doc(user.uid).get().then(doc => {
    const name = `${doc.data().firstName} ${doc.data().lastName}`;
    rtdb.ref(`posts/${postId}/comments/${commentId}/replies`).push({
      text,
      uid: user.uid,
      authorName: name,
      timestamp: Date.now()
    }).then(() => {
      input.value = "";
    });
  });
};

window.openReplyView = function (postId, commentId) {
  const panel = document.createElement("div");
  panel.id = "reply-panel";
  panel.style = "position:fixed;top:0;left:0;right:0;bottom:0;background:#f0f9ff;z-index:30;padding:15px;overflow:auto;";
  panel.innerHTML = `
    <button onclick="closeReplyView('${postId}')">⬅️ Back to Comments</button>
    <h4>Replies</h4>
    <div id="reply-list-${commentId}"></div>
    <input type="text" id="reply-input-${commentId}" placeholder="Lemba reply..." />
    <button onclick="addReply('${postId}','${commentId}')">Tumiza Reply</button>
  `;
  document.body.appendChild(panel);
  loadReplies(postId, commentId);
};

window.closeReplyView = function (postId) {
  const panel = document.getElementById("reply-panel");
  if (panel) panel.remove();
  loadComments(postId);
};

function loadReplies(postId, commentId) {
  const list = document.getElementById(`reply-list-${commentId}`);
  rtdb.ref(`posts/${postId}/comments/${commentId}/replies`).on("child_added", snapshot => {
    const reply = snapshot.val();
    const div = document.createElement("div");
    div.innerHTML = `
      <p><strong>${reply.authorName || "Anonymous"}</strong></p>
      <p>${reply.text}</p>
    `;
    list.appendChild(div);
  });
}
  
   // 🔍 Kuwonetsa mndandanda wa ma users
function loadUsers() {
  db.collection("users").get().then(snapshot => {
    const list = document.getElementById("user-list");
    list.innerHTML = "";
    snapshot.forEach(doc => {
      const user = doc.data();
      const div = document.createElement("div");
      div.textContent = `${user.firstName} ${user.lastName}`;
      div.onclick = () => openChat(doc.id, `${user.firstName} ${user.lastName}`);
      list.appendChild(div);
    });
  });
}

// 💬 Kutsegula chat
function openChat(uid, name) {
  currentChatUser = uid;
  document.getElementById("chat-with").textContent = `Chating With ${name}`;
  const box = document.getElementById("message-box");
  box.classList.remove("hidden");

  // 📦 Malo a ma message
  const messages = document.getElementById("chat-messages");
  messages.style = `
    display:flex;
    flex-direction:column;
    gap:6px;
    padding:10px 10px 70px; /* malo a pansi kuti bar isaphimbe */
    overflow-y:scroll;
    max-height:70vh;
  `;

  // ✍️ Textarea yomwe ilipo kale (ikhale yokhazikika pansi)
  const input = document.getElementById("message-input");
  input.style = `
    position:fixed;
    bottom:0;
    left:0;
    right:500px;
    height:42px;
    resize:none;
    padding:6px;
    border-top:1px solid #ccc;
    background:#fff;
    z-index:100;
  `;

  // ✅ Button ya Tumiza yomwe ilipo kale (ikhale yokhazikika pansi)
  const sendBtn = box.querySelector("button[onclick='sendMessage()']");
  sendBtn.textContent = "Tumiza";
  sendBtn.style = `
    position:fixed;
    bottom: 0;
    right:80px;
    width:80px;
    height:42px;
    background:#22c55e;
    color:#fff;
    border:none;
    font-weight:600;
    z-index:101;
  `;

  // 🗑️ Onjezani Clear button yokhazikika pansi ngati ilibe
  if (!document.getElementById("clear-btn")) {
    const clearBtn = document.createElement("button");
    clearBtn.id = "clear-btn";
    clearBtn.textContent = "Chotsa";
    clearBtn.style = `
      position:fixed;
      bottom:0;
      right:0;
      width:80px;
      height:42px;
      background:#ef4444;
      color:#fff;
      border:none;
      font-weight:600;
      z-index:102;
    `;
    clearBtn.onclick = clearChat;
    document.body.appendChild(clearBtn);
  }

  loadMessages();
}

// ❌ Kutseka chat
window.closeChat = function () {
  document.getElementById("message-box").classList.add("hidden");
  const clearBtn = document.getElementById("clear-btn");
  if (clearBtn) clearBtn.remove();
};

// 📤 Kutumiza message
window.sendMessage = function () {
  const input = document.getElementById("message-input");
  const message = (input.value || "").trim();
  const sender = auth.currentUser?.uid;
  const receiver = currentChatUser;
  if (!message || !sender || !receiver) return;

  const chatId = [sender, receiver].sort().join("_");
  const chatRef = rtdb.ref(`messages/${chatId}`);

  chatRef.push({
    from: sender,
    to: receiver,
    message,
    timestamp: Date.now()
  }).then(() => {
    input.value = ""; // yeretsani textarea

    db.collection("users").doc(sender).get().then(doc => {
      const d = doc.data();
      const senderName = (d.firstName || "") + " " + (d.lastName || "");
      rtdb.ref(`notifications/${receiver}`).push({
        from: sender,
        name: senderName,
        message,
        type: "message",
        timestamp: Date.now()
      });
    });
  });
};

// 📥 Kuwonetsa ma message
function loadMessages() {
  const sender = auth.currentUser.uid;
  const receiver = currentChatUser;
  const chatId = [sender, receiver].sort().join("_");
  const chatRef = rtdb.ref(`messages/${chatId}`);

  chatRef.off(); // pewani duplicate listeners
  chatRef.on("value", snapshot => {
    const container = document.getElementById("chat-messages");
    container.innerHTML = "";

    snapshot.forEach(child => {
      const msg = child.val();
      const bubble = document.createElement("div");

      if (msg.from === sender) {
        bubble.style = "align-self:flex-end;background:#dcf8c6;padding:8px 10px;margin:2px 0;border-radius:12px;max-width:78%;";
      } else {
        bubble.style = "align-self:flex-start;background:#ffffff;padding:8px 10px;margin:2px 0;border-radius:12px;max-width:78%;box-shadow:0 1px 1px rgba(0,0,0,0.06);";
      }

      bubble.textContent = msg.message;
      container.appendChild(bubble);
    });

    container.scrollTop = container.scrollHeight;
  });
}

// 🧹 Chotsa ma message onse
window.clearChat = function () {
  const sender = auth.currentUser?.uid;
  const receiver = currentChatUser;
  if (!sender || !receiver) return;

  const chatId = [sender, receiver].sort().join("_");
  if (!confirm("Mukufuna kuchotsa ma message onse mu chat iyi?")) return;

  rtdb.ref(`messages/${chatId}`).remove().then(() => {
    const container = document.getElementById("chat-messages");
    if (container) container.innerHTML = "";
    alert("Chat clear Successful ✅");
  });
};

// 🔔 Kuwerengera ma notification
function listenNotifications() {
  const uid = auth.currentUser.uid;
  const notifRef = rtdb.ref(`notifications/${uid}`);
  notifRef.on("value", snapshot => {
    const count = snapshot.numChildren();
    const el = document.getElementById("notif-count");
    if (el) el.textContent = count;
  });
}

  window.openNotifications = function () {
  const uid = auth.currentUser.uid;
  rtdb.ref(`notifications/${uid}`).once("value", snapshot => {
    const list = document.getElementById("notif-list");
    list.innerHTML = "";

    snapshot.forEach(child => {
      const notif = child.val();
      const li = document.createElement("li");

      // ✅ Dzina la sender (bold) + message + input + reply button
      li.innerHTML = `
        <p><strong>${notif.name}</strong>: ${notif.message}</p>
        <input type="text" id="reply-${child.key}" placeholder="Yankhani pompo..." style="width:100%; margin-top:6px;" />
        <button onclick="sendNotifReply('${notif.from}','${child.key}')" style="margin-top:4px;">✉️ Tumiza Reply</button>
      `;

      list.appendChild(li);
    });

    document.getElementById("notification-panel").classList.remove("hidden");
    rtdb.ref(`notifications/${uid}`).remove();
    document.getElementById("notif-count").textContent = "0";
  });
};
  
  window.sendNotifReply = function (receiverId, notifKey) {
     const input = document.getElementById(`reply-${notifKey}`);
     const message = input.value;
     const sender = auth.currentUser?.uid;
     if (!message || !sender || !receiverId) return;

  // 🔁 Chat ID imakhala yokhazikika pakati pa awiriwa
  const chatId = [sender, receiverId].sort().join("_");
  const chatRef = rtdb.ref(`messages/${chatId}`);

  // ✅ Tumiza message ku chat
  chatRef.push({
    from: sender,
    to: receiverId,
    message,
    timestamp: Date.now()
  }).then(() => {
    input.value = "";

    // 🔔 Tumizanso notification ku receiver
    db.collection("users").doc(sender).get().then(doc => {
      const senderData = doc.data();
      const senderName = `${senderData.firstName} ${senderData.lastName}`;
      rtdb.ref(`notifications/${receiverId}`).push({
        from: sender,
        name: senderName,   // dzina lonse (first + last)
        message,
        type: "message",
        timestamp: Date.now()
      });
    });
  });
};

  window.closeNotifications = function () {
    document.getElementById("notification-panel").classList.add("hidden");
  };
});
