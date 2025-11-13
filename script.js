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
  const content = document.getElementById("post-content").value.trim();
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
    document.getElementById("post-content").value = "";
  });
};

// ====================== LOAD POSTS ======================
function loadPosts() {
  const container = document.getElementById("posts-container");
  container.innerHTML = "";

  rtdb.ref("posts").orderByChild("timestamp").on("value", snapshot => {
    const posts = [];
    snapshot.forEach(child => {
      posts.unshift({ id: child.key, ...child.val() });
    });

    container.innerHTML = "";

    posts.forEach(post => {
      const div = document.createElement("div");

      // ✅ Sungani line breaks & ma link mu post content
      let preview = post.content;
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      preview = preview.replace(urlRegex, url => `<a href="${url}" target="_blank" style="color:#2563eb;text-decoration:underline;">${url}</a>`);

      if (post.content.length > 100) {
        preview = post.content.substring(0, 100) + "...";
      }

      div.innerHTML = `
        <p><strong>${post.authorName || "Anonymous"}</strong></p>
        <p style="white-space:pre-wrap;">${preview}</p>
        ${post.content.length > 100 ? `<button onclick="viewFullPost('${post.id}')">See more</button>` : ""}
        <div style="display:flex; gap:6px; margin-top:6px;">
          <button id="like-btn-${post.id}" style="flex:1;" onclick="likePost('${post.id}')">❤️ (${post.likes || 0})</button>
          <button id="comment-btn-${post.id}" style="flex:1;" onclick="openCommentView('${post.id}')">💬 (0)</button>
        </div>
      `;
      container.appendChild(div);

      // ✅ Listener pa likes
      rtdb.ref(`posts/${post.id}/likes`).on("value", snapLikes => {
        const btn = document.getElementById(`like-btn-${post.id}`);
        if (btn) btn.textContent = `❤️ (${snapLikes.val() || 0})`;
      });

      // ✅ Listener pa comments (counter imasinthika pompo)
      rtdb.ref(`posts/${post.id}/comments`).on("value", snapComments => {
        const btn = document.getElementById(`comment-btn-${post.id}`);
        if (btn) btn.textContent = `💬 (${snapComments.numChildren()})`;
      });
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
  panel.style = "position:fixed;top:0;left:0;right:0;bottom:0;background:#f0f9ff;z-index:20;display:flex;flex-direction:column;";

  panel.innerHTML = `
    <button onclick="closeCommentView()">⬅️ Back to Posts</button>
    <h3>Comments (<span id="comment-count-${postId}">0</span>)</h3>
    <div id="comment-list-${postId}" style="flex:1;overflow-y:auto;padding-bottom:60px;"></div>
    <div style="position:fixed;bottom:0;left:0;right:0;display:flex;border-top:1px solid #ccc;background:#fff;padding:6px;">
      <textarea id="comment-input-${postId}" placeholder="Lemba comment..." style="flex:1;height:42px;resize:none;padding:6px;"></textarea>
      <button onclick="addComment('${postId}')" style="width:100px;background:#22c55e;color:#fff;border:none;font-weight:600;">Tumiza</button>
    </div>
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
  const commentsRef = rtdb.ref(`posts/${postId}/comments`);

  commentsRef.off();
  commentsRef.on("value", snapshot => {
    list.innerHTML = "";
    let count = 0;

    snapshot.forEach(child => {
      const comment = child.val();
      const commentId = child.key;
      count++;

      let text = comment.text;
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      text = text.replace(urlRegex, url => `<a href="${url}" target="_blank" style="color:#2563eb;text-decoration:underline;">${url}</a>`);

      const div = document.createElement("div");
      div.innerHTML = `
        <p><strong>${comment.authorName || "Anonymous"}</strong></p>
        <p style="white-space:pre-wrap;">${text}</p>
        <button onclick="openReplyView('${postId}','${commentId}')">↩️ Replies</button>
      `;
      list.appendChild(div);
    });

    const counterEl = document.getElementById(`comment-count-${postId}`);
    if (counterEl) counterEl.textContent = count;
  });
}

window.addComment = function (postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  const text = input.value.trim();
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
  const text = input.value.trim();
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
  panel.style = "position:fixed;top:0;left:0;right:0;bottom:0;background:#f0f9ff;z-index:30;display:flex;flex-direction:column;";

  panel.innerHTML = `
    <button onclick="closeReplyView('${postId}')">⬅️ Back to Comments</button>
    <h4>Replies</h4>
    <div id="reply-list-${commentId}" style="flex:1;overflow-y:auto;padding-bottom:60px;"></div>
    <div style="position:fixed;bottom:0;left:0;right:0;display:flex;border-top:1px solid #ccc;background:#fff;padding:6px;">
      <textarea id="reply-input-${commentId}" placeholder="Lemba reply..." style="flex:1;height:42px;resize:none;padding:6px;"></textarea>
      <button onclick="addReply('${postId}','${commentId}')" style="width:100px;background:#22c55e;color:#fff;border:none;font-weight:600;">Tumiza</button>
    </div>
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
  const repliesRef = rtdb.ref(`posts/${postId}/comments/${commentId}/replies`);

  repliesRef.off();
  repliesRef.on("value", snapshot => {
    list.innerHTML = "";
    snapshot.forEach(child => {
      const reply = child.val();

      // ✅ Sungani line breaks & ma link
      let text = reply.text;
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      text = text.replace(
        urlRegex,
        url =>
          `<a href="${url}" target="_blank" style="color:#2563eb;text-decoration:underline;">${url}</a>`
      );

      const div = document.createElement("div");
      div.innerHTML = `
        <p><strong>${reply.authorName || "Anonymous"}</strong></p>
        <p style="white-space:pre-wrap;">${text}</p>
      `;
      list.appendChild(div);
    });
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
  const box = document.getElementById("message-box");
  box.classList.remove("hidden");

  // Header bar pamwamba: Back + Clear + dzina
  const backBtn = box.querySelector("button[onclick='closeChat()']");
  if (!box.querySelector("#clear-btn")) {
    const clearBtn = document.createElement("button");
    clearBtn.id = "clear-btn";
    clearBtn.textContent = "Chotsa";
    clearBtn.style = `
      margin-left:8px;
      background:#ef4444;
      color:#fff;
      border:none;
      font-weight:600;
      padding:6px 10px;
    `;
    clearBtn.onclick = clearChat;
    backBtn.after(clearBtn); // ikani pafupi ndi Back button pamwamba penipeni
  }

  document.getElementById("chat-with").textContent = `Mukuyankhula ndi ${name}`;

  // 📦 Malo a ma message
  const messages = document.getElementById("chat-messages");
  messages.style = `
    display:flex;
    flex-direction:column;
    gap:6px;
    padding:10px 10px 70px; /* malo a pansi kuti bar isaphimbe */
    overflow:auto;
    max-height:70vh;
  `;

  // ✍️ Textarea pansi pa screen, osafika mbali zonse
  const input = document.getElementById("message-input");
  input.style = `
    position:fixed;
    bottom:0;
    left:0;
    width:calc(100% - 100px); /* siyani malo a Send button */
    height:42px;
    resize:none;
    padding:6px;
    border-top:1px solid #ccc;
    background:#fff;
    z-index:100;
  `;

  // ✅ Send button pansi pa screen, pafupi ndi textarea
  const sendBtn = box.querySelector("button[onclick='sendMessage()']");
  sendBtn.textContent = "Tumiza";
  sendBtn.style = `
    position:fixed;
    bottom:0;
    right:0;
    width:100px;
    height:42px;
    background:#22c55e;
    color:#fff;
    border:none;
    font-weight:600;
    z-index:101;
  `;

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

function loadMessages() {
  const sender = auth.currentUser.uid;
  const receiver = currentChatUser;
  const chatId = [sender, receiver].sort().join("_");
  const chatRef = rtdb.ref(`messages/${chatId}`);

  chatRef.off();
  chatRef.on("value", snapshot => {
    const container = document.getElementById("chat-messages");
    container.innerHTML = "";

    snapshot.forEach(child => {
      const msg = child.val();

      // Row container
      const row = document.createElement("div");
      row.className = (msg.from === sender) ? "row sent" : "row received";

      // Bubble
      const bubble = document.createElement("div");
      bubble.className = "bubble";
      
      // ✅ Text processing: ma link azikhala clickable
      let text = msg.message;
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      text = text.replace(urlRegex, url => 
        `<a href="${url}" target="_blank">${url}</a>`
      );

      bubble.innerHTML = text;
      row.appendChild(bubble);
      container.appendChild(row);
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
    alert("Chat yachotsedwa bwino ✅");
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