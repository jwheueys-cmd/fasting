let socket;
let myId = '';
let myUsername = '';
let currentChatFriend = null;
let currentGroupId = null;
let friends = [];
let pendingRequests = [];
let groups = [];
let isLoginMode = false;
let isRecoverMode = false;
let typingTimeout = null;
let isTyping = false;

// ===== طلبات موثّقة (ترفق التوكن تلقائياً) =====
function authFetch(url, options = {}) {
    const token = localStorage.getItem('authToken');
    options.headers = Object.assign({}, options.headers, {
        'Authorization': 'Bearer ' + token
    });
    return fetch(url, options).then(res => {
        if (res.status === 401 || res.status === 403) {
            // الجلسة انتهت أو غير صالحة
            if (res.status === 401) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('myId');
                localStorage.removeItem('myUsername');
            }
        }
        return res;
    });
}

// ===== متغيرات الضغط المطول =====
let longPressTimer = null;
let longPressTarget = null;
let replyTarget = null;

// ===== الأصوات =====
function playSound(type) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        if (type === 'send') {
            oscillator.frequency.value = 800;
            gainNode.gain.value = 0.1;
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
        } else if (type === 'receive') {
            oscillator.frequency.value = 600;
            gainNode.gain.value = 0.15;
            oscillator.start();
            setTimeout(() => {
                oscillator.frequency.value = 900;
            }, 100);
            oscillator.stop(audioContext.currentTime + 0.2);
        } else if (type === 'notification') {
            oscillator.frequency.value = 500;
            gainNode.gain.value = 0.2;
            oscillator.start();
            setTimeout(() => {
                oscillator.frequency.value = 700;
            }, 100);
            setTimeout(() => {
                oscillator.frequency.value = 900;
            }, 200);
            oscillator.stop(audioContext.currentTime + 0.3);
        }
    } catch (e) {
        console.log('⚠️ الصوت غير مدعوم');
    }
}

// ===== Toast Notifications =====
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 300);
    }, duration);
}

function toastSuccess(msg) { showToast(msg, 'success'); }
function toastError(msg) { showToast(msg, 'error'); }
function toastWarning(msg) { showToast(msg, 'warning'); }
function toastInfo(msg) { showToast(msg, 'info'); }

// ===== Custom Modal =====
function showModal(options) {
    const modal = document.getElementById('customModal');
    const icon = document.getElementById('modalIcon');
    const title = document.getElementById('modalTitle');
    const message = document.getElementById('modalMessage');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');

    icon.textContent = options.icon || '✅';
    title.textContent = options.title || 'تم!';
    message.textContent = options.message || '';
    confirmBtn.textContent = options.confirmText || 'موافق';
    confirmBtn.style.display = 'inline-block';
    confirmBtn.style.background = options.confirmColor || '#25d366';
    
    if (options.showCancel) {
        cancelBtn.style.display = 'inline-block';
        cancelBtn.textContent = options.cancelText || 'إلغاء';
    } else {
        cancelBtn.style.display = 'none';
    }

    modal.style.display = 'flex';

    function closeModal() {
        modal.style.display = 'none';
    }

    confirmBtn.onclick = function() {
        closeModal();
        if (options.onConfirm) options.onConfirm();
    };

    cancelBtn.onclick = function() {
        closeModal();
        if (options.onCancel) options.onCancel();
    };

    modal.onclick = function(e) {
        if (e.target === modal) {
            closeModal();
            if (options.onCancel) options.onCancel();
        }
    };
}

function modalSuccess(message, onConfirm = null) {
    showModal({
        icon: '✅',
        title: 'نجاح',
        message: message,
        confirmText: 'حسناً',
        confirmColor: '#25d366',
        onConfirm: onConfirm
    });
}

function modalError(message, onConfirm = null) {
    showModal({
        icon: '❌',
        title: 'خطأ',
        message: message,
        confirmText: 'حسناً',
        confirmColor: '#e74c3c',
        onConfirm: onConfirm
    });
}

function modalWarning(message, onConfirm = null) {
    showModal({
        icon: '⚠️',
        title: 'تنبيه',
        message: message,
        confirmText: 'موافق',
        confirmColor: '#f1c40f',
        onConfirm: onConfirm
    });
}

function modalInfo(message, onConfirm = null) {
    showModal({
        icon: 'ℹ️',
        title: 'معلومات',
        message: message,
        confirmText: 'حسناً',
        confirmColor: '#3498db',
        onConfirm: onConfirm
    });
}

function modalConfirm(message, onConfirm, onCancel = null) {
    showModal({
        icon: '❓',
        title: 'تأكيد',
        message: message,
        confirmText: 'نعم',
        confirmColor: '#25d366',
        cancelText: 'إلغاء',
        showCancel: true,
        onConfirm: onConfirm,
        onCancel: onCancel
    });
}

// ===== تجاوز alert و confirm =====
(function() {
    window.alert = function(message) {
        let type = 'info';
        let icon = 'ℹ️';
        let title = 'معلومات';
        if (message.includes('✅') || message.includes('تم') || message.includes('نجاح')) {
            type = 'success';
            icon = '✅';
            title = 'نجاح';
        } else if (message.includes('❌') || message.includes('خطأ') || message.includes('فشل')) {
            type = 'error';
            icon = '❌';
            title = 'خطأ';
        } else if (message.includes('⚠️') || message.includes('تنبيه') || message.includes('انتبه')) {
            type = 'warning';
            icon = '⚠️';
            title = 'تنبيه';
        }
        showModal({
            icon: icon,
            title: title,
            message: message.replace(/[✅❌⚠️ℹ️]/g, '').trim(),
            confirmText: 'حسناً',
            confirmColor: type === 'success' ? '#25d366' : 
                          type === 'error' ? '#e74c3c' : 
                          type === 'warning' ? '#f1c40f' : '#3498db'
        });
    };

    window.confirm = function(message) {
        return new Promise((resolve) => {
            showModal({
                icon: '❓',
                title: 'تأكيد',
                message: message,
                confirmText: 'نعم',
                confirmColor: '#25d366',
                cancelText: 'إلغاء',
                showCancel: true,
                onConfirm: function() { resolve(true); },
                onCancel: function() { resolve(false); }
            });
        });
    };
})();

// ===== تبديل وضع تسجيل/دخول =====
function toggleMode() {
    isLoginMode = !isLoginMode;
    isRecoverMode = false;
    document.getElementById('recoverBox').style.display = 'none';
    const btn = document.getElementById('loginBtn');
    const sub = document.getElementById('loginSub');
    if (isLoginMode) {
        btn.textContent = 'دخول';
        sub.textContent = 'سجل دخولك بحسابك';
        document.getElementById('toggleLogin').textContent = '🔄 ليس لديك حساب؟';
    } else {
        btn.textContent = 'تسجيل حساب';
        sub.textContent = 'سجل حساب جديد';
        document.getElementById('toggleLogin').textContent = '🔄 لدي حساب بالفعل';
    }
    document.getElementById('errorMsg').textContent = '';
}

// ===== تبديل وضع استرجاع =====
function toggleRecover() {
    isRecoverMode = !isRecoverMode;
    const box = document.getElementById('recoverBox');
    box.style.display = isRecoverMode ? 'block' : 'none';
    if (isRecoverMode) {
        document.getElementById('loginSub').textContent = '🔑 استرجاع كلمة السر';
    } else {
        document.getElementById('loginSub').textContent = isLoginMode ? 'سجل دخولك بحسابك' : 'سجل حساب جديد';
    }
    document.getElementById('errorMsg').textContent = '';
}

// ===== استرجاع الحساب =====
function recoverAccount() {
    const username = document.getElementById('recoverUsername').value.trim();
    const userId = document.getElementById('recoverId').value.trim();
    const result = document.getElementById('recoverResult');

    if (!username || !userId) {
        result.innerHTML = '<span style="color:#ff6b6b;">✏️ املأ جميع الحقول</span>';
        return;
    }

    fetch('/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, userId })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            result.innerHTML = `<span style="color:#ff6b6b;">❌ ${data.error}</span>`;
        } else {
            result.innerHTML = `<span style="color:#25d366;">✅ ${data.message}</span>`;
        }
    });
}

// ===== تسجيل / دخول =====
function handleAuth() {
    const username = document.getElementById('usernameInput').value.trim();
    const password = document.getElementById('passwordInput').value.trim();

    if (!username || !password) {
        document.getElementById('errorMsg').textContent = '✏️ املأ جميع الحقول';
        return;
    }

    if (!isLoginMode && password.length < 6) {
        document.getElementById('errorMsg').textContent = '❌ كلمة السر يجب أن تكون 6 أحرف أو أرقام على الأقل';
        return;
    }

    const url = isLoginMode ? '/login' : '/register';

    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            document.getElementById('errorMsg').textContent = data.error;
            return;
        }

        localStorage.setItem('authToken', data.token);
        localStorage.setItem('myId', data.userId);
        localStorage.setItem('myUsername', username);

        enterApp(data.userId, username);
    });
}

// ===== الدخول الفعلي للتطبيق (يُستخدم بعد تسجيل الدخول وبعد الدخول التلقائي) =====
function enterApp(userId, username) {
    myId = userId;
    myUsername = username;

    document.getElementById('userIdSpan').textContent = myId;
    document.getElementById('userIdDisplay').style.display = 'block';

    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('app').style.display = 'flex';

    document.getElementById('headerUsername').textContent = myUsername;
    document.getElementById('headerId').textContent = `🆔 ${myId}`;

    initSocket();
    loadFriends();
    loadPendingRequests();
    loadGroups();
    requestNotificationPermission();
}

// ===== محاولة الدخول التلقائي عند فتح الصفحة (لو فيه جلسة محفوظة) =====
function tryAutoLogin() {
    const token = localStorage.getItem('authToken');
    const savedId = localStorage.getItem('myId');
    const savedUsername = localStorage.getItem('myUsername');

    if (!token || !savedId || !savedUsername) return;

    authFetch(`/user/${savedId}`)
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                // التوكن غير صالح أو انتهى، نظّف الجلسة
                localStorage.removeItem('authToken');
                localStorage.removeItem('myId');
                localStorage.removeItem('myUsername');
                return;
            }
            enterApp(savedId, savedUsername);
        })
        .catch(() => {});
}

// ===== إشعارات المتصفح =====
function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log('✅ تم السماح بالإشعارات'); subscribeToPush();
            }
        });
    }
}

function sendNotification(title, body, icon = '💬') {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: icon
        });
    }
}

// ===== Socket =====
function initSocket() {
    socket = io('/', { auth: { token: localStorage.getItem('authToken') } });

    socket.on('friend-request', (data) => {
        playSound('notification');
        modalInfo(`📩 ${data.fromName} أرسل لك طلب صداقة!`);
        loadPendingRequests();
    });

    socket.on('friend-accepted', () => {
        playSound('notification');
        modalSuccess('✅ تم قبول طلب الصداقة!');
        loadFriends();
    });

    socket.on('user-online', ({ userId }) => {
        updateFriendStatus(userId, true);
    });

    socket.on('user-offline', ({ userId }) => {
        updateFriendStatus(userId, false);
    });

    socket.on('typing-start', ({ fromId }) => {
        if (currentChatFriend === fromId) {
            showTypingIndicator(fromId);
        }
    });

    socket.on('typing-stop', ({ fromId }) => {
        if (currentChatFriend === fromId) {
            hideTypingIndicator();
        }
    });

    socket.on('group-created', ({ groupId, name }) => {
        loadGroups();
    });

    socket.on('group-added', ({ groupId, name }) => {
        loadGroups();
        modalSuccess(`✅ تم إضافتك لمجموعة ${name}`);
    });

    socket.on('new-message', (data) => {
        playSound('receive');
        sendNotification('📩 رسالة جديدة', data.message);
        if (currentChatFriend === data.fromId) {
            displayMessage(data.fromId, data.message, data.time, data.type, data.imageUrl, data.edited, data.deletedForMe, data.timestamp, data.replyData);
        } else {
            playSound('notification');
            const friend = friends.find(f => f.id === data.fromId);
            const name = friend ? friend.username : data.fromId;
            modalInfo(`💬 رسالة جديدة من ${name}: ${data.message}`);
        }
    });

    socket.on('new-group-message', (data) => {
        playSound('receive');
        sendNotification('📩 رسالة جديدة في المجموعة', data.message);
        if (currentGroupId === data.groupId) {
            displayGroupMessage(data.fromId, data.message, data.time, data.type, data.imageUrl, data.edited, data.deletedForMe, data.timestamp, data.replyData);
        } else {
            playSound('notification');
            const group = groups.find(g => g.id === data.groupId);
            const name = group ? group.name : data.groupId;
            modalInfo(`💬 رسالة جديدة في ${name}`);
        }
    });
}

// ===== تحديث حالة الصديق =====
function updateFriendStatus(userId, online) {
    const items = document.querySelectorAll('.friend-item');
    items.forEach(item => {
        const onclickAttr = item.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(userId)) {
            const statusSpan = item.querySelector('.friend-status');
            if (statusSpan) {
                statusSpan.textContent = online ? '🟢 متصل' : '⚪ غير متصل';
                statusSpan.style.color = online ? '#25d366' : '#666';
            }
        }
    });
}

// ===== عرض مؤشر الكتابة =====
function showTypingIndicator(fromId) {
    let indicator = document.getElementById('typingIndicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'typingIndicator';
        indicator.style.cssText = 'padding:8px 16px; color:#888; font-size:13px; font-style:italic;';
        const container = document.getElementById('messagesContainer');
        container.appendChild(indicator);
    }
    const friend = friends.find(f => f.id === fromId);
    const name = friend ? friend.username : fromId;
    indicator.textContent = `${name} يكتب...`;
    indicator.scrollIntoView({ behavior: 'smooth' });
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

// ===== إرسال حالة الكتابة =====
function sendTypingStatus(isTypingNow) {
    if (!currentChatFriend) return;
    if (isTypingNow && !isTyping) {
        isTyping = true;
        socket.emit('typing-start', { toId: currentChatFriend });
    } else if (!isTypingNow && isTyping) {
        isTyping = false;
        socket.emit('typing-stop', { toId: currentChatFriend });
    }
}

// ===== تحميل الأصدقاء =====
function loadFriends() {
    authFetch(`/friends/${myId}`)
    .then(res => res.json())
    .then(data => {
        friends = data.friends || [];
        renderFriends();
    });
}

function renderFriends() {
    const container = document.getElementById('friendsContainer');
    if (friends.length === 0) {
        container.innerHTML = '<p style="color:#555; text-align:center; padding:20px;">ما عندك أصدقاء بعد<br /><span style="font-size:12px;">اضف اصدقاء بـ ID</span></p>';
        return;
    }
    container.innerHTML = friends.map(f => `
        <div class="friend-item" onclick="openChatWith('${f.id}')" style="cursor:pointer; display:flex; align-items:center; gap:12px; padding:12px; margin:4px 0; background:#0f3460; border-radius:12px; color:white; transition:0.2s; ${f.pinned ? 'border: 2px solid #f1c40f;' : ''}">
            <span class="friend-avatar" style="font-size:28px;">${f.pinned ? '📌' : '👤'}</span>
            <div style="flex:1;">
                <div style="font-weight:500;">${f.username}</div>
                <div class="friend-status" style="font-size:11px; color:${f.online ? '#25d366' : '#666'};">${f.online ? '🟢 متصل' : '⚪ غير متصل'}</div>
            </div>
            <button onclick="event.stopPropagation(); pinChat('${f.id}', ${!f.pinned})" style="background:none; border:none; color:#f1c40f; font-size:16px; cursor:pointer;">
                ${f.pinned ? '📌' : '📌'}
            </button>
            <button onclick="event.stopPropagation(); blockUser('${f.id}')" style="background:#e74c3c; border:none; color:white; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:12px;">🚫</button>
        </div>
    `).join('');
}

// ===== تثبيت محادثة =====
function pinChat(friendId, pinned) {
    authFetch('/pin-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: myId, friendId: friendId, pinned: pinned })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            modalError('❌ ' + data.error);
        } else {
            modalSuccess(pinned ? '📌 تم تثبيت المحادثة' : '📌 تم إلغاء تثبيت المحادثة');
            loadFriends();
        }
    });
}

// ===== تحميل طلبات الصداقة =====
function loadPendingRequests() {
    authFetch(`/user/${myId}`)
    .then(res => res.json())
    .then(data => {
        if (data.user) {
            pendingRequests = data.user.pendingRequests || [];
            renderPendingRequests();
        }
    });
}

function renderPendingRequests() {
    const container = document.getElementById('pendingRequests');
    container.innerHTML = '';
    if (pendingRequests.length === 0) return;

    pendingRequests.forEach(id => {
        authFetch(`/user/${id}`)
        .then(res => res.json())
        .then(data => {
            if (data.user) {
                const div = document.createElement('div');
                div.className = 'request-item';
                div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#0f3460; border-radius:10px; margin:4px 0; color:white;';
                div.innerHTML = `
                    <span>👤 ${data.user.username}</span>
                    <div>
                        <button class="accept" onclick="acceptFriend('${id}')" style="padding:6px 14px; border:none; border-radius:8px; cursor:pointer; font-weight:bold; margin-left:5px; background:#25d366; color:#000;">قبول</button>
                        <button class="reject" onclick="rejectFriend('${id}')" style="padding:6px 14px; border:none; border-radius:8px; cursor:pointer; font-weight:bold; background:#e74c3c; color:white;">رفض</button>
                    </div>
                `;
                container.appendChild(div);
            }
        });
    });
}

// ===== تحميل المجموعات =====
function loadGroups() {
    authFetch(`/groups/${myId}`)
    .then(res => res.json())
    .then(data => {
        groups = data.groups || [];
        renderGroups();
    });
}

function renderGroups() {
    const container = document.getElementById('groupsContainer');
    if (!container) return;
    if (groups.length === 0) {
        container.innerHTML = '<p style="color:#555; text-align:center; padding:10px; font-size:13px;">ما عندك مجموعات</p>';
        return;
    }
    container.innerHTML = groups.map(g => `
        <div class="group-item" onclick="openGroupChat('${g.id}')" style="cursor:pointer; display:flex; align-items:center; gap:12px; padding:10px; margin:4px 0; background:#0f3460; border-radius:12px; color:white; transition:0.2s;">
            <span style="font-size:24px;">👥</span>
            <div style="flex:1;">
                <div style="font-weight:500;">${g.name}</div>
                <div style="font-size:11px; color:#888;">${g.members.length} أعضاء</div>
            </div>
        </div>
    `).join('');
}

// ===== إرسال طلب صداقة =====
function sendFriendRequest() {
    const friendId = document.getElementById('addFriendInput').value.trim();
    if (!friendId) {
        document.getElementById('requestStatus').textContent = '✏️ اكتب ID';
        return;
    }
    if (friendId === myId) {
        document.getElementById('requestStatus').textContent = '❌ ما تقدر تضيف نفسك';
        return;
    }

    authFetch('/friend-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromId: myId, toId: friendId })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            document.getElementById('requestStatus').textContent = '❌ ' + data.error;
        } else {
            document.getElementById('requestStatus').textContent = '✅ تم إرسال الطلب!';
            document.getElementById('addFriendInput').value = '';
        }
    });
}

// ===== قبول/رفض طلب =====
function acceptFriend(friendId) {
    authFetch('/accept-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: myId, friendId: friendId })
    })
    .then(() => {
        loadPendingRequests();
        loadFriends();
    });
}

function rejectFriend(friendId) {
    authFetch('/reject-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: myId, friendId: friendId })
    })
    .then(() => {
        loadPendingRequests();
    });
}

// ===== حظر مستخدم =====
async function blockUser(blockId) {
    if (!await confirm('هل تريد حظر هذا المستخدم؟')) return;
    authFetch('/block-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: myId, blockId: blockId })
    })
    .then(() => {
        loadFriends();
        if (currentChatFriend === blockId) {
            backToChatList();
        }
        modalSuccess('✅ تم الحظر');
    });
}

// ===== فك حظر =====
async function unblockUser(blockId) {
    if (!await confirm('هل تريد فك الحظر عن هذا المستخدم؟')) return;
    authFetch('/unblock-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: myId, blockId: blockId })
    })
    .then(() => {
        loadBlockedUsers();
        loadFriends();
        modalSuccess('✅ تم فك الحظر');
    });
}

// ===== فتح الإعدادات =====
function openSettings() {
    document.getElementById('chatList').style.display = 'none';
    document.getElementById('chatArea').style.display = 'none';
    document.getElementById('groupChatArea').style.display = 'none';
    document.getElementById('emptyChat').style.display = 'none';
    document.getElementById('settingsPage').style.display = 'flex';
    loadBlockedUsers();
    updateThemeButton();
}

// ===== إغلاق الإعدادات =====
function closeSettings() {
    document.getElementById('settingsPage').style.display = 'none';
    document.getElementById('chatList').style.display = 'block';
    document.getElementById('emptyChat').style.display = 'flex';
}

// ===== تحميل المحظورين =====
function loadBlockedUsers() {
    const container = document.getElementById('blockedList');
    
    authFetch(`/user/${myId}`)
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            container.innerHTML = `<p style="color:#ff6b6b;">❌ ${data.error}</p>`;
            return;
        }
        
        const blocked = data.user.blocked || [];
        if (blocked.length === 0) {
            container.innerHTML = `<p style="color:#888;">📭 ما عندك محظورين</p>`;
            return;
        }
        
        let html = '';
        blocked.forEach(id => {
            authFetch(`/user/${id}`)
            .then(res => res.json())
            .then(userData => {
                if (userData.user) {
                    html += `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:#0f3460; border-radius:10px; margin:5px 0;">
                            <span>👤 ${userData.user.username}</span>
                            <button onclick="unblockUser('${id}')" style="background:#25d366; border:none; color:white; padding:6px 16px; border-radius:8px; cursor:pointer;">🔓 فك حظر</button>
                        </div>
                    `;
                    container.innerHTML = html;
                }
            });
        });
    })
    .catch(err => {
        container.innerHTML = `<p style="color:#ff6b6b;">❌ خطأ: ${err.message}</p>`;
    });
}

// ===== تغيير الاسم =====
function changeUsername() {
    const newName = prompt('👤 اكتب الاسم الجديد:');
    if (!newName || !newName.trim()) return;

    authFetch('/change-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: myId, newName: newName.trim() })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            modalError('❌ ' + data.error);
        } else {
            myUsername = newName.trim();
            document.getElementById('headerUsername').textContent = myUsername;
            modalSuccess('✅ تم تغيير الاسم بنجاح');
            loadFriends();
        }
    });
}

// ===== تغيير كلمة السر =====
function changePassword() {
    const oldPassword = prompt('🔒 اكتب كلمة السر القديمة:');
    if (!oldPassword) return;

    const newPassword = prompt('🔑 اكتب كلمة السر الجديدة (6 أحرف فأكثر):');
    if (!newPassword || newPassword.length < 6) {
        modalError('❌ كلمة السر يجب أن تكون 6 أحرف أو أكثر');
        return;
    }

    const confirmPassword = prompt('✅ اكتب كلمة السر الجديدة مرة أخرى للتأكيد:');
    if (newPassword !== confirmPassword) {
        modalError('❌ كلمة السر غير متطابقة');
        return;
    }

    authFetch('/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: myId, oldPassword, newPassword })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            modalError('❌ ' + data.error);
        } else {
            modalSuccess('✅ تم تغيير كلمة السر بنجاح');
        }
    });
}

// ===== نسخ الـ ID =====
function copyId() {
    navigator.clipboard.writeText(myId).then(() => {
        modalSuccess('✅ تم نسخ الـ ID: ' + myId);
    }).catch(() => {
        const input = document.createElement('input');
        input.value = myId;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        modalSuccess('✅ تم نسخ الـ ID: ' + myId);
    });
}

// ===== حذف كل المحادثات =====
async function clearAllChats() {
    if (!await confirm('⚠️ هل أنت متأكد؟ سيتم حذف كل الرسائل نهائياً!')) return;
    
    authFetch('/clear-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: myId })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            modalError('❌ ' + data.error);
        } else {
            modalSuccess('✅ تم حذف كل المحادثات');
            loadFriends();
        }
    })
    .catch(err => {
        modalError('❌ خطأ: ' + err.message);
    });
}

// ===== تسجيل الخروج =====
function logout() {
    if (socket) socket.disconnect();
    localStorage.removeItem('authToken');
    localStorage.removeItem('myId');
    localStorage.removeItem('myUsername');
    document.getElementById('app').style.display = 'none';
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('userIdDisplay').style.display = 'none';
    document.getElementById('errorMsg').textContent = '';
    document.getElementById('usernameInput').value = '';
    document.getElementById('passwordInput').value = '';
    closeSettings();
    modalSuccess('👋 تم تسجيل الخروج بنجاح');
}

function confirmLogout() {
    modalConfirm('🚪 هل تريد تسجيل الخروج؟', function() {
        logout();
    }, function() {
        modalInfo('✅ تم الإبقاء على الحساب');
    });
}

// ===== المظهر (فاتح/داكن) =====
let isDarkMode = true;

function toggleTheme() {
    isDarkMode = !isDarkMode;
    applyTheme(isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    updateThemeButton();
}

function applyTheme(dark) {
    const body = document.body;
    const app = document.getElementById('app');
    const settings = document.getElementById('settingsPage');
    const chatList = document.querySelector('.chat-list');
    const closeBtn = document.getElementById('closeSettingsBtn');
    
    if (dark) {
        body.style.background = '#0a0a0a';
        app.style.background = '#1a1a2e';
        if (settings) settings.style.background = '#0f0f1a';
        if (chatList) chatList.style.background = '#1a1a2e';
        if (closeBtn) closeBtn.style.color = 'white';
        document.querySelectorAll('.message.other').forEach(el => {
            el.style.background = '#1a1a2e';
            el.style.color = 'white';
            el.style.border = '1px solid #2a2a3e';
        });
        document.querySelectorAll('.message.me').forEach(el => {
            el.style.background = '#25d366';
            el.style.color = '#000';
        });
        document.querySelectorAll('.login-container').forEach(el => {
            el.style.background = '#1a1a2e';
        });
        document.querySelectorAll('h2, h3, p, span, div').forEach(el => {
            if (el.closest('.message')) return;
            if (el.id === 'closeSettingsBtn') return;
            if (el.style.color && el.style.color.includes('#')) return;
            el.style.color = 'white';
        });
    } else {
        body.style.background = '#f0f0f0';
        app.style.background = '#ffffff';
        if (settings) settings.style.background = '#f5f5f5';
        if (chatList) chatList.style.background = '#ffffff';
        if (closeBtn) closeBtn.style.color = '#000';
        document.querySelectorAll('.message.other').forEach(el => {
            el.style.background = '#e8e8e8';
            el.style.color = '#000';
            el.style.border = '1px solid #ddd';
        });
        document.querySelectorAll('.message.me').forEach(el => {
            el.style.background = '#25d366';
            el.style.color = '#000';
        });
        document.querySelectorAll('.login-container').forEach(el => {
            el.style.background = '#ffffff';
        });
        document.querySelectorAll('h2, h3, p, span, div').forEach(el => {
            if (el.closest('.message')) return;
            if (el.id === 'closeSettingsBtn') return;
            if (el.style.color && el.style.color.includes('#')) return;
            el.style.color = '#000';
        });
    }
}

function updateThemeButton() {
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
        btn.textContent = isDarkMode ? '🌙 الوضع الداكن' : '☀️ الوضع الفاتح';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        isDarkMode = savedTheme === 'dark';
        applyTheme(isDarkMode);
        updateThemeButton();
    }
    tryAutoLogin();
});

// ===== ردود الفعل =====
function addReaction(messageId, friendId, reaction, isGroup = false) {
    authFetch('/add-reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: myId,
            friendId: friendId,
            messageId: parseInt(messageId),
            reaction: reaction,
            isGroup: isGroup
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            modalError('❌ ' + data.error);
        } else {
            if (isGroup) {
                openGroupChat(friendId);
            } else {
                openChatWith(friendId);
            }
        }
    });
}

// ===== عرض ردود الفعل =====
function displayReactions(reactions) {
    if (!reactions || reactions.length === 0) return '';
    const reactionMap = {};
    reactions.forEach(r => {
        if (!reactionMap[r.reaction]) reactionMap[r.reaction] = [];
        reactionMap[r.reaction].push(r.userId);
    });
    let html = '<div style="display:flex; gap:4px; margin-top:4px; flex-wrap:wrap;">';
    for (let [emoji, users] of Object.entries(reactionMap)) {
        html += `<span style="background:rgba(255,255,255,0.1); border-radius:12px; padding:2px 8px; font-size:12px; display:flex; align-items:center; gap:2px; cursor:pointer;" onclick="addReaction('${reactions[0].messageId}', '${currentChatFriend || currentGroupId}', '${emoji}', ${!!currentGroupId})">
            ${emoji} ${users.length}
        </span>`;
    }
    html += '</div>';
    return html;
}

// ===== الرد على رسالة =====
function replyToMessage(messageId, senderId, message) {
    closeMessageOptions();
    replyTarget = { messageId, senderId, message };
    document.getElementById('messageInput').placeholder = `↩️ رد على: ${message.substring(0, 30)}...`;
    document.getElementById('messageInput').focus();
}

// ===== بدء الضغط المطول =====
function startLongPress(event, messageId, senderId, friendId, isGroup = false) {
    longPressTarget = {
        messageId,
        senderId,
        friendId,
        isGroup,
        element: event.currentTarget
    };
    
    longPressTimer = setTimeout(() => {
        showMessageOptions(longPressTarget);
    }, 600);
}

// ===== إلغاء الضغط المطول =====
function cancelLongPress() {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
}

// ===== عرض خيارات الرسالة =====
function showMessageOptions(target) {
    const { messageId, senderId, friendId, isGroup, element } = target;
    
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top:0; left:0; width:100%; height:100%;
        background: rgba(0,0,0,0.5); z-index:9999;
        display:flex; align-items:center; justify-content:center;
    `;
    
    const menu = document.createElement('div');
    menu.style.cssText = `
        background: #1a1a2e; border-radius:16px; padding:20px;
        width:300px; max-width:90%; box-shadow:0 10px 40px rgba(0,0,0,0.8);
    `;
    
    const isMyMessage = senderId === myId;
    let buttons = '';
    
    if (isMyMessage) {
        buttons += `
            <button onclick="editMessage('${messageId}', '${friendId}', ${isGroup})" style="width:100%; padding:12px; margin:5px 0; background:#0f3460; border:none; border-radius:8px; color:white; font-size:16px; cursor:pointer; text-align:right;">
                ✏️ تعديل الرسالة
            </button>
            <button onclick="deleteMessageMe('${messageId}', '${friendId}', ${isGroup})" style="width:100%; padding:12px; margin:5px 0; background:#e74c3c; border:none; border-radius:8px; color:white; font-size:16px; cursor:pointer; text-align:right;">
                🗑️ حذف من عندي
            </button>
            <button onclick="deleteMessageEveryone('${messageId}', '${friendId}', ${isGroup})" style="width:100%; padding:12px; margin:5px 0; background:#c0392b; border:none; border-radius:8px; color:white; font-size:16px; cursor:pointer; text-align:right;">
                🔥 حذف نهائياً
            </button>
        `;
    }
    
    buttons += `
        <button onclick="replyToMessage('${messageId}', '${senderId}', '${element.textContent.trim()}')" style="width:100%; padding:12px; margin:5px 0; background:#0f3460; border:none; border-radius:8px; color:white; font-size:16px; cursor:pointer; text-align:right;">
            ↩️ رد على الرسالة
        </button>
        <button onclick="closeMessageOptions()" style="width:100%; padding:12px; margin:5px 0; background:#555; border:none; border-radius:8px; color:white; font-size:16px; cursor:pointer; text-align:right;">
            ✕ إلغاء
        </button>
    `;
    
    menu.innerHTML = buttons;
    overlay.appendChild(menu);
    document.body.appendChild(overlay);
    
    window._messageOverlay = overlay;
}

// ===== إغلاق خيارات الرسالة =====
function closeMessageOptions() {
    if (window._messageOverlay) {
        window._messageOverlay.remove();
        window._messageOverlay = null;
    }
}

// ===== تعديل رسالة =====
function editMessage(messageId, friendId, isGroup) {
    closeMessageOptions();
    
    const newMessage = prompt('✏️ اكتب النص الجديد:');
    if (!newMessage || !newMessage.trim()) return;

    authFetch('/edit-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: myId,
            friendId: friendId,
            messageId: parseInt(messageId),
            newMessage: newMessage.trim(),
            isGroup: isGroup
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            modalError('❌ ' + data.error);
        } else {
            modalSuccess('✅ تم تعديل الرسالة');
            if (isGroup) {
                openGroupChat(friendId);
            } else {
                openChatWith(friendId);
            }
        }
    });
}

// ===== حذف رسالة (من عندي فقط) =====
async function deleteMessageMe(messageId, friendId, isGroup) {
    if (!await confirm('🗑️ هل تريد حذف هذه الرسالة من عندك فقط؟')) return;
    closeMessageOptions();

    authFetch('/delete-message-me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: myId,
            friendId: friendId,
            messageId: parseInt(messageId),
            isGroup: isGroup
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            modalError('❌ ' + data.error);
        } else {
            modalSuccess('✅ تم حذف الرسالة من عندك');
            if (isGroup) {
                openGroupChat(friendId);
            } else {
                openChatWith(friendId);
            }
        }
    });
}

// ===== حذف رسالة (نهائياً) =====
async function deleteMessageEveryone(messageId, friendId, isGroup) {
    if (!await confirm('🔥 هل تريد حذف هذه الرسالة نهائياً من الجميع؟')) return;
    closeMessageOptions();

    authFetch('/delete-message-everyone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: myId,
            friendId: friendId,
            messageId: parseInt(messageId),
            isGroup: isGroup
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            modalError('❌ ' + data.error);
        } else {
            modalSuccess('✅ تم حذف الرسالة نهائياً');
            if (isGroup) {
                openGroupChat(friendId);
            } else {
                openChatWith(friendId);
            }
        }
    });
}

// ===== إنشاء مجموعة =====
function createGroup() {
    const name = document.getElementById('groupNameInput').value.trim();
    const membersInput = document.getElementById('groupMembersInput').value.trim();
    if (!name) {
        modalError('✏️ اكتب اسم للمجموعة');
        return;
    }
    const members = membersInput ? membersInput.split(',').map(id => id.trim()) : [];
    const uniqueMembers = [...new Set(members)];
    if (uniqueMembers.includes(myId)) {
        modalError('لا تضع ID خاصتك');
        return;
    }

    authFetch('/create-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            adminId: myId,
            name: name,
            members: uniqueMembers
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            modalError('❌ ' + data.error);
        } else {
            modalSuccess('✅ تم إنشاء المجموعة!');
            document.getElementById('groupNameInput').value = '';
            document.getElementById('groupMembersInput').value = '';
            loadGroups();
        }
    });
}

// ===== فتح محادثة فردية =====
function openChatWith(friendId) {
    currentChatFriend = friendId;
    currentGroupId = null;
    replyTarget = null;

    document.getElementById('chatList').style.display = 'none';
    document.getElementById('chatArea').style.display = 'flex';
    document.getElementById('emptyChat').style.display = 'none';
    document.getElementById('groupChatArea').style.display = 'none';
    document.getElementById('settingsPage').style.display = 'none';

    document.getElementById('messagesContainer').innerHTML = '';
    document.getElementById('chatWithUser').textContent = '';
    document.getElementById('chatWithId').textContent = '';
    document.getElementById('messageInput').placeholder = 'اكتب رسالة...';

    authFetch(`/user/${friendId}`)
    .then(res => res.json())
    .then(data => {
        if (data.user) {
            document.getElementById('chatWithUser').textContent = data.user.username;
            document.getElementById('chatWithId').textContent = `🆔 ${friendId}`;
        } else {
            document.getElementById('chatWithUser').textContent = 'مستخدم غير معروف';
            document.getElementById('chatWithId').textContent = `🆔 ${friendId}`;
        }
    });

    authFetch(`/messages/${myId}/${friendId}`)
    .then(res => res.json())
    .then(data => {
        const messages = data.messages || [];
        messages.forEach(msg => {
            displayMessage(msg.fromId, msg.message, msg.time, msg.type || 'text', msg.imageUrl || null, msg.edited || false, msg.deletedForMe || false, msg.timestamp, msg.replyData || null);
        });
    });

    authFetch(`/blocked-messages/${myId}/${friendId}`)
    .then(res => res.json())
    .then(data => {
        const messages = data.messages || [];
        if (messages.length > 0) {
            const container = document.getElementById('messagesContainer');
            const notice = document.createElement('div');
            notice.style.cssText = 'text-align:center; color:#888; padding:10px; font-size:13px; border-bottom:1px solid #2a2a3e; margin-bottom:10px;';
            notice.textContent = `📩 ${messages.length} رسالة محظورة (ظهرت بعد فك الحظر)`;
            container.appendChild(notice);
            
            messages.forEach(msg => {
                displayMessage(msg.fromId, msg.message, msg.time, msg.type || 'text', msg.imageUrl || null, msg.edited || false, msg.deletedForMe || false, msg.timestamp, msg.replyData || null);
            });
        }
    });
}

// ===== فتح محادثة مجموعة =====
function openGroupChat(groupId) {
    currentGroupId = groupId;
    currentChatFriend = null;
    replyTarget = null;

    document.getElementById('chatList').style.display = 'none';
    document.getElementById('groupChatArea').style.display = 'flex';
    document.getElementById('emptyChat').style.display = 'none';
    document.getElementById('chatArea').style.display = 'none';
    document.getElementById('settingsPage').style.display = 'none';

    document.getElementById('groupMessagesContainer').innerHTML = '';
    const group = groups.find(g => g.id === groupId);
    document.getElementById('groupChatWithUser').textContent = group ? group.name : 'المجموعة';
    document.getElementById('groupMessageInput').placeholder = 'اكتب رسالة للمجموعة...';

    authFetch(`/group-messages/${groupId}`)
    .then(res => res.json())
    .then(data => {
        const messages = data.messages || [];
        messages.forEach(msg => {
            displayGroupMessage(msg.fromId, msg.message, msg.time, msg.type || 'text', msg.imageUrl || null, msg.edited || false, msg.deletedForMe || false, msg.timestamp, msg.replyData || null);
        });
    });
}

// ===== العودة لقائمة المحادثات =====
function backToChatList() {
    document.getElementById('chatList').style.display = 'block';
    document.getElementById('chatArea').style.display = 'none';
    document.getElementById('groupChatArea').style.display = 'none';
    document.getElementById('aiChatArea').style.display = 'none';
    document.getElementById('settingsPage').style.display = 'none';
    document.getElementById('emptyChat').style.display = 'flex';
    currentChatFriend = null;
    currentGroupId = null;
}
// ===== إرسال رسالة فردية =====
function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    if (!message || !currentChatFriend) {
        if (!currentChatFriend) modalError('❌ اختر محادثة أولاً');
        return;
    }

    const replyData = replyTarget ? {
        messageId: replyTarget.messageId,
        message: replyTarget.message,
        senderId: replyTarget.senderId
    } : null;

    socket.emit('send-message', {
        toId: currentChatFriend,
        message: message,
        type: 'text',
        replyData: replyData
    });

    displayMessage(myId, message, new Date().toLocaleTimeString('ar-EG'), 'text', null, false, false, Date.now(), replyData);
    input.value = '';
    input.placeholder = 'اكتب رسالة...';
    replyTarget = null;
    playSound('send');
    sendTypingStatus(false);
}

// ===== إرسال رسالة مجموعة =====
function sendGroupMessage() {
    const input = document.getElementById('groupMessageInput');
    const message = input.value.trim();
    if (!message || !currentGroupId) {
        if (!currentGroupId) modalError('❌ اختر مجموعة أولاً');
        return;
    }

    const replyData = replyTarget ? {
        messageId: replyTarget.messageId,
        message: replyTarget.message,
        senderId: replyTarget.senderId
    } : null;

    socket.emit('send-group-message', {
        groupId: currentGroupId,
        message: message,
        type: 'text',
        replyData: replyData
    });

    displayGroupMessage(myId, message, new Date().toLocaleTimeString('ar-EG'), 'text', null, false, false, Date.now(), replyData);
    input.value = '';
    input.placeholder = 'اكتب رسالة للمجموعة...';
    replyTarget = null;
    playSound('send');
}

// ===== إرسال صورة =====
function sendImage() {
    const input = document.getElementById('imageInput');
    const file = input.files[0];
    if (!file) {
        modalError('❌ اختر صورة أولاً');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        modalError('❌ الصورة كبيرة جداً (حد أقصى 5 ميجابايت)');
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const imageData = e.target.result;
        
        authFetch('/upload-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageData })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                modalError('❌ ' + data.error);
                return;
            }
            
            if (data.url) {
                if (currentChatFriend) {
                    socket.emit('send-message', {
                        toId: currentChatFriend,
                        message: '📷 صورة',
                        type: 'image',
                        imageUrl: data.url,
                        replyData: null
                    });
                    displayMessage(myId, '📷 صورة', new Date().toLocaleTimeString('ar-EG'), 'image', data.url);
                } else if (currentGroupId) {
                    socket.emit('send-group-message', {
                        groupId: currentGroupId,
                        message: '📷 صورة',
                        type: 'image',
                        imageUrl: data.url,
                        replyData: null
                    });
                    displayGroupMessage(myId, '📷 صورة', new Date().toLocaleTimeString('ar-EG'), 'image', data.url);
                } else {
                    modalError('❌ اختر محادثة أولاً');
                }
                playSound('send');
            }
        })
        .catch(err => {
            modalError('❌ خطأ في الاتصال: ' + err.message);
        });
    };
    reader.readAsDataURL(file);
    input.value = '';
}

// ===== عرض رسالة فردية =====
function displayMessage(senderId, message, time, type = 'text', imageUrl = null, edited = false, deletedForMe = false, timestamp = null, replyData = null) {
    const container = document.getElementById('messagesContainer');
    const div = document.createElement('div');
    div.className = `message ${senderId === myId ? 'me' : 'other'}`;

    if (deletedForMe && senderId === myId) {
        div.innerHTML = `<div style="color:#888; font-style:italic;">🗑️ تم حذف هذه الرسالة</div>`;
        container.appendChild(div);
        return;
    }

    let content = '';
    if (type === 'image' && imageUrl) {
        content = `<img src="${imageUrl}" style="max-width:200px; border-radius:10px; display:block; margin:4px 0;" />`;
        content += `<div style="font-size:12px; opacity:0.8;">${message}</div>`;
    } else {
        content = message;
    }

    // عرض الرد إذا موجود
    let replyHtml = '';
    if (replyData) {
        replyHtml = `
            <div style="background:rgba(255,255,255,0.05); border-radius:8px; padding:4px 8px; margin-bottom:4px; font-size:12px; color:#888; border-right:3px solid #25d366;">
                ↩️ ${replyData.message.substring(0, 40)}${replyData.message.length > 40 ? '...' : ''}
            </div>
        `;
    }

    const editedMark = edited ? `<span style="font-size:10px; opacity:0.5; margin-right:5px;">(تم التعديل)</span>` : '';
    const reactionsHtml = displayReactions([]); // سيتم تحسينها لاحقاً

    div.innerHTML = `
        ${replyHtml}
        <div style="display:flex; align-items:center; gap:4px;">
            <div>${content}</div>
            ${editedMark}
        </div>
        ${reactionsHtml}
        <span style="font-size:10px; opacity:0.6; margin-right:8px;">${time}</span>
    `;

    if (!deletedForMe) {
        const msgId = timestamp || Date.now() + Math.random();
        div.style.cursor = 'pointer';
        div.addEventListener('touchstart', (e) => {
            startLongPress(e, msgId, senderId, currentChatFriend, false);
        });
        div.addEventListener('touchend', cancelLongPress);
        div.addEventListener('touchmove', cancelLongPress);
        div.addEventListener('mousedown', (e) => {
            startLongPress(e, msgId, senderId, currentChatFriend, false);
        });
        div.addEventListener('mouseup', cancelLongPress);
        div.addEventListener('mouseleave', cancelLongPress);
    }

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// ===== عرض رسالة مجموعة =====
function displayGroupMessage(senderId, message, time, type = 'text', imageUrl = null, edited = false, deletedForMe = false, timestamp = null, replyData = null) {
    const container = document.getElementById('groupMessagesContainer');
    const div = document.createElement('div');
    div.className = `message ${senderId === myId ? 'me' : 'other'}`;

    authFetch(`/user/${senderId}`)
    .then(res => res.json())
    .then(data => {
        const senderName = data.user ? data.user.username : (senderId === myId ? 'أنت' : 'مستخدم');
        const nameSpan = document.createElement('div');
        nameSpan.style.cssText = 'font-size:11px; font-weight:bold; color:#25d366; margin-bottom:4px;';
        nameSpan.textContent = senderName;

        if (deletedForMe && senderId === myId) {
            div.innerHTML = `
                ${nameSpan.outerHTML}
                <div style="color:#888; font-style:italic;">🗑️ تم حذف هذه الرسالة</div>
            `;
            container.appendChild(div);
            container.scrollTop = container.scrollHeight;
            return;
        }

        let content = '';
        if (type === 'image' && imageUrl) {
            content = `<img src="${imageUrl}" style="max-width:200px; border-radius:10px; display:block; margin:4px 0;" />`;
            content += `<div style="font-size:12px; opacity:0.8;">${message}</div>`;
        } else {
            content = message;
        }

        let replyHtml = '';
        if (replyData) {
            replyHtml = `
                <div style="background:rgba(255,255,255,0.05); border-radius:8px; padding:4px 8px; margin-bottom:4px; font-size:12px; color:#888; border-right:3px solid #25d366;">
                    ↩️ ${replyData.message.substring(0, 40)}${replyData.message.length > 40 ? '...' : ''}
                </div>
            `;
        }

        const editedMark = edited ? `<span style="font-size:10px; opacity:0.5; margin-right:5px;">(تم التعديل)</span>` : '';
        const reactionsHtml = displayReactions([]);

        div.innerHTML = `
            ${nameSpan.outerHTML}
            ${replyHtml}
            <div style="display:flex; align-items:center; gap:4px;">
                <div>${content}</div>
                ${editedMark}
            </div>
            ${reactionsHtml}
            <span style="font-size:10px; opacity:0.6; margin-right:8px;">${time}</span>
        `;

        if (!deletedForMe) {
            const msgId = timestamp || Date.now() + Math.random();
            div.style.cursor = 'pointer';
            div.addEventListener('touchstart', (e) => {
                startLongPress(e, msgId, senderId, currentGroupId, true);
            });
            div.addEventListener('touchend', cancelLongPress);
            div.addEventListener('touchmove', cancelLongPress);
            div.addEventListener('mousedown', (e) => {
                startLongPress(e, msgId, senderId, currentGroupId, true);
            });
            div.addEventListener('mouseup', cancelLongPress);
            div.addEventListener('mouseleave', cancelLongPress);
        }

        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    });
}

// ===== بحث بين المحادثات =====
function searchFriends() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    const items = document.querySelectorAll('.friend-item');
    items.forEach(item => {
        const name = item.querySelector('.friend-name')?.textContent?.toLowerCase() || '';
        if (name.includes(query) || query === '') {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// ===== مستمعي الأحداث =====
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        if (document.getElementById('messageInput') === document.activeElement) {
            sendMessage();
        }
	if (document.getElementById('aiMessageInput') === document.activeElement) {
             sendAIMessage();
	}
        if (document.getElementById('groupMessageInput') === document.activeElement) {
            sendGroupMessage();
        }
        if (document.getElementById('addFriendInput') === document.activeElement) {
            sendFriendRequest();
        }
        if (document.getElementById('searchInput') === document.activeElement) {
            searchFriends();
        }
    }
});

// ===== مراقبة الكتابة =====
document.addEventListener('DOMContentLoaded', function() {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        let typingTimer;
        messageInput.addEventListener('input', function() {
            clearTimeout(typingTimer);
            sendTypingStatus(true);
            typingTimer = setTimeout(() => {
                sendTypingStatus(false);
            }, 1500);
        });
        messageInput.addEventListener('blur', function() {
            sendTypingStatus(false);
        });
    }
});

// ===== FastingAI =====
function openFastingAI() {
    currentChatFriend = null;
    currentGroupId = null;

    document.getElementById('chatList').style.display = 'none';
    document.getElementById('chatArea').style.display = 'none';
    document.getElementById('groupChatArea').style.display = 'none';
    document.getElementById('settingsPage').style.display = 'none';
    document.getElementById('emptyChat').style.display = 'none';
    document.getElementById('aiChatArea').style.display = 'flex';

    document.getElementById('aiMessagesContainer').innerHTML = '';
}

function sendAIMessage() {
    const input = document.getElementById('aiMessageInput');
    const message = input.value.trim();
    if (!message) return;

    // رسالة المستخدم
    const container = document.getElementById('aiMessagesContainer');
    const userDiv = document.createElement('div');
    userDiv.className = 'message me';
    userDiv.innerHTML = `<div>${message}</div>`;
    container.appendChild(userDiv);

    input.value = '';
    container.scrollTop = container.scrollHeight;

    // رد البوت الثابت بعد نصف ثانية
    setTimeout(() => {
        const botDiv = document.createElement('div');
        botDiv.className = 'message other';
        botDiv.innerHTML = `<div>سيتم إضافة الذكاء الاصطناعي قريبا...</div>`;
        container.appendChild(botDiv);
        container.scrollTop = container.scrollHeight;
    }, 500);
}

// ===== الملف الشخصي =====
function openProfile() {
    document.getElementById('chatList').style.display = 'none';
    document.getElementById('chatArea').style.display = 'none';
    document.getElementById('groupChatArea').style.display = 'none';
    document.getElementById('aiChatArea').style.display = 'none';
    document.getElementById('settingsPage').style.display = 'none';
    document.getElementById('emptyChat').style.display = 'none';
    document.getElementById('profilePage').style.display = 'flex';

    // جلب بيانات المستخدم
    fetch(`/user/${myId}`)
    .then(res => res.json())
    .then(data => {
        if (!data.user) return;

        const user = data.user;
        document.getElementById('profileUsername').textContent = user.username;
        document.getElementById('profileId').textContent = `ID: ${myId}`;
        document.getElementById('profileBio').value = user.bio || '';
        document.getElementById('profileFriendsCount').textContent = (user.friends || []).length;

        // تاريخ الانضمام
        if (user.createdAt) {
            const date = new Date(user.createdAt);
            document.getElementById('profileJoinDate').textContent = date.toLocaleDateString('ar-EG');
        } else {
            document.getElementById('profileJoinDate').textContent = '-';
        }

        // الصورة الشخصية
        const avatarImg = document.getElementById('profileAvatar');
        const headerAvatar = document.getElementById('headerAvatar');

        if (user.avatar) {
            avatarImg.src = user.avatar;
            headerAvatar.innerHTML = `<img src="${user.avatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        } else {
            avatarImg.src = '';
            headerAvatar.textContent = user.username.charAt(0).toUpperCase();
        }
    });
}

function closeProfile() {
    document.getElementById('profilePage').style.display = 'none';
    document.getElementById('chatList').style.display = 'block';
    document.getElementById('emptyChat').style.display = 'flex';
}

// رفع الصورة الشخصية
function uploadAvatar() {
    const input = document.getElementById('avatarInput');
    const file = input.files[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
        modalError('الصورة كبيرة جداً (الحد 3 ميجا)');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const imageData = e.target.result;

        authFetch('/upload-avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: myId,
                image: imageData
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                modalError(data.error);
            } else {
                modalSuccess('تم تحديث الصورة الشخصية');
                // تحديث الصورة فوراً
                document.getElementById('profileAvatar').src = data.url;
                document.getElementById('headerAvatar').innerHTML = `<img src="${data.url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            }
        })
        .catch(() => modalError('حدث خطأ أثناء رفع الصورة'));
    };
    reader.readAsDataURL(file);
    input.value = '';
}

// حفظ النبذة
function saveBio() {
    const bio = document.getElementById('profileBio').value.trim();

    authFetch('/update-bio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: myId,
            bio: bio
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            modalError(data.error);
        } else {
            modalSuccess('تم حفظ النبذة');
        }
    })
    .catch(() => modalError('حدث خطأ'));
}

console.log('✅ Script.js جاهز!');
