// ==UserScript==
// @name        Twitter/X Video Link Console
// @description Menampilkan link download video/foto Twitter di console browser dan kirim ke Telegram
// @namespace   video_link_console
// @version     1.2.0
// @author      Kilo Code
// @include     https://x.com/*
// @include     https://twitter.com/*
// @include     https://mobile.x.com/*
// @exclude     *://x.com/i/flow/*
// @license     MIT
// @run-at      document-start
// @noframes
// @grant       GM_registerMenuCommand
// @grant       GM_addStyle
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_xmlhttpRequest
// @grant       GM_notification
// ==/UserScript==

(function () {
  'use strict';

  // Storage untuk media URLs
  const mediaMap = new Map();

  // Telegram settings
  let telegramBotToken = GM_getValue('telegramBotToken', '');
  let telegramChatId = GM_getValue('telegramChatId', '');
  let sendThumbnail = GM_getValue('sendThumbnail', false); // Default: tidak kirim thumbnail
  let sendAsLink = GM_getValue('sendAsLink', true); // Default: kirim sebagai link (lebih reliable)

  // Cache untuk tweet yang sudah dikirim (disimpan di GM storage)
  let sentTweetsCache = GM_getValue('sentTweetsCache', {});
  
  // Fungsi untuk mengecek apakah tweet sudah pernah dikirim
  function isTweetSent(tweetId) {
    return sentTweetsCache.hasOwnProperty(tweetId);
  }
  
  // Fungsi untuk menandai tweet sebagai sudah dikirim
  function markTweetAsSent(tweetId) {
    sentTweetsCache[tweetId] = {
      timestamp: Date.now(),
      date: new Date().toISOString()
    };
    GM_setValue('sentTweetsCache', sentTweetsCache);
  }

  // Fungsi untuk menampilkan floating notification
  function showFloatingNotification(message, type = 'success') {
    const existing = document.querySelector('.floating-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `floating-notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Hapus setelah 3 detik
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // CSS untuk tombol dan dialog
  GM_addStyle(`
    .video-link-btn {
      margin-left: 12px;
      order: 99;
      cursor: pointer;
    }
    .video-link-btn:hover > div > div > div > div { color: #1da1f2; }
    .video-link-btn:hover > div > div > div > div > div { background-color: #1da1f21a; }
    .video-link-btn svg { color: #1da1f2; }
    
    .telegram-btn {
      margin-left: 6px;
      order: 100;
      cursor: pointer;
    }
    .telegram-btn:hover > div > div > div > div { color: #0088cc; }
    .telegram-btn:hover > div > div > div > div > div { background-color: #0088cc1a; }
    .telegram-btn svg { color: #0088cc; }
    
    /* Tombol Telegram untuk tweet yang sudah dikirim */
    .telegram-btn.sent {
      opacity: 0.7;
    }
    .telegram-btn.sent:hover > div > div > div > div { color: #e0245e; }
    .telegram-btn.sent:hover > div > div > div > div > div { background-color: #e0245e1a; }
    .telegram-btn.sent svg { color: #e0245e; }
    
    /* Floating notification */
    .floating-notification {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 15px 25px;
      border-radius: 10px;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      font-weight: bold;
      z-index: 2147483647;
      animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    }
    .floating-notification.success {
      background: linear-gradient(135deg, #4CAF50, #45a049);
    }
    .floating-notification.error {
      background: linear-gradient(135deg, #f44336, #d32f2f);
    }
    .floating-notification.info {
      background: linear-gradient(135deg, #2196F3, #1976D2);
    }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    
    .settings-dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-width: 350px;
    }
    .settings-dialog h3 {
      margin: 0 0 15px 0;
      color: #0088cc;
      font-size: 18px;
    }
    .settings-dialog label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
      color: #333;
    }
    .settings-dialog input {
      width: 100%;
      padding: 10px;
      margin-bottom: 15px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      box-sizing: border-box;
    }
    .settings-dialog .btn-group {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }
    .settings-dialog button {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: bold;
    }
    .settings-dialog .btn-save {
      background: #0088cc;
      color: white;
    }
    .settings-dialog .btn-cancel {
      background: #e0e0e0;
      color: #333;
    }
    .settings-dialog .help-text {
      font-size: 12px;
      color: #666;
      margin-top: -10px;
      margin-bottom: 15px;
    }
  `);

  // SVG icons
  const svgIcon = `
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path fill="currentColor" d="M3,14 v5 q0,2 2,2 h14 q2,0 2,-2 v-5 M7,10 l4,4 q1,1 2,0 l4,-4 M12,3 v11" 
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`;

  const telegramIcon = `
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
    </svg>`;

  // Ekstrak status ID dari URL
  function extractStatusId(url) {
    if (!url) return null;
    const match = url.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  }

  // Cari parent object berdasarkan key
  function findParent(obj, targetKey) {
    let result = [];
    if (typeof obj === 'object' && obj !== null) {
      for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (key === targetKey) result.push(obj);
          result = result.concat(findParent(obj[key], targetKey));
        }
      }
    } else if (Array.isArray(obj)) {
      for (let item of obj) {
        result = result.concat(findParent(item, targetKey));
      }
    }
    return result;
  }

  // Ekstrak media dari response API
  function extractMediaFromResponse(url, responseText) {
    try {
      const data = JSON.parse(responseText);
      const entities = findParent(data, 'extended_entities');
      
      if (entities.length === 0) return;

      for (let entity of entities) {
        if (!entity.extended_entities) continue;
        
        const entityId = entity.id_str || entity.conversation_id_str;
        const media = entity.extended_entities.media || [];
        const text = (entity.full_text || '').split('https://t.co')[0].trim().slice(0, 50) || entityId;
        
        const mediaList = [];
        
        media.filter(m => ['video', 'animated_gif', 'photo'].includes(m.type))
             .forEach(m => {
          const variants = m.video_info?.variants || [];
          const bestVideo = variants
            .filter(v => v.content_type === 'video/mp4')
            .sort((a, b) => b.bitrate - a.bitrate)[0];
          
          mediaList.push({
            id: m.id_str,
            type: m.type,
            thumbnail: m.media_url_https?.split('.jpg')[0],
            video: bestVideo?.url,
            photo: m.media_url_https
          });
        });
        
        if (mediaList.length > 0) {
          mediaMap.set(entityId, {
            entityId,
            text,
            mediaList
          });
        }
      }
    } catch (e) {}
  }

  // Hook XMLHttpRequest
  function hookXMLHttpRequest() {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url) {
      this._url = url;
      return originalOpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function() {
      this.addEventListener('load', function() {
        if (this._url && this.response) {
          try {
            if (this.responseType === '' || this.responseType === 'text') {
              extractMediaFromResponse(this._url, this.responseText);
            }
          } catch (e) {}
        }
      });
      return originalSend.apply(this, arguments);
    };
  }

  // Tampilkan link di console
  function showLinksInConsole(statusIds) {
    console.log('%c[Video Link] Media URLs', 'color: #1DA1F2; font-size: 16px; font-weight: bold;');
    console.log('='.repeat(60));
    
    let found = false;
    statusIds.forEach(id => {
      const data = mediaMap.get(id);
      if (data) {
        found = true;
        console.log(`%cTweet: ${id}`, 'color: #1DA1F2; font-weight: bold;');
        console.log(`%cText: ${data.text}`, 'color: #666;');
        
        data.mediaList.forEach((m, idx) => {
          const num = idx + 1;
          if (m.video) {
            console.log(`%c🎬 Video ${num}: ${m.video}`, 'color: #4CAF50;');
          }
          if (m.photo) {
            console.log(`%c📷 Photo ${num}: ${m.photo}`, 'color: #2196F3;');
          }
        });
        console.log('-'.repeat(40));
      }
    });
    
    if (!found) {
      console.log('%c⚠️ Media tidak ditemukan', 'color: #f44336;');
    }
    console.log('='.repeat(60));
  }

  // Kirim ke Telegram
  function sendToTelegram(statusIds) {
    if (!telegramBotToken || !telegramChatId) {
      showFloatingNotification('⚠️ Setel Bot Token dan Chat ID dulu!', 'error');
      return;
    }

    // Kumpulkan semua media
    const allMedia = [];
    const allLinks = [];
    let tweetInfo = '';
    
    statusIds.forEach(id => {
      const data = mediaMap.get(id);
      if (data) {
        tweetInfo = `📌 Tweet: ${id}\n📝 ${data.text}`;
        allLinks.push(tweetInfo);
        let mediaIndex = 0;
        data.mediaList.forEach((m) => {
          // Kirim video jika ada
          if (m.video) {
            allMedia.push({
              type: 'video',
              media: m.video,
              caption: mediaIndex === 0 ? tweetInfo : undefined
            });
            allLinks.push(`🎬 Video: ${m.video}`);
            mediaIndex++;
          }
          // Kirim photo hanya jika:
          // 1. Tidak ada video (foto terpisah), ATAU
          // 2. Ada video DAN sendThumbnail = true (thumbnail video)
          if (m.photo && (!m.video || sendThumbnail)) {
            allMedia.push({
              type: 'photo',
              media: m.photo,
              caption: mediaIndex === 0 ? tweetInfo : undefined
            });
            allLinks.push(`📷 Photo: ${m.photo}`);
            mediaIndex++;
          }
        });
        allLinks.push('');
      }
    });

    if (allMedia.length === 0 && allLinks.length === 0) {
      showFloatingNotification('⚠️ Tidak ada media untuk dikirim', 'error');
      return;
    }

    console.log('%c📤 Mengirim ke Telegram...', 'color: #0088cc; font-weight: bold;');
    console.log('Mode:', sendAsLink ? 'Link Text' : 'Media');
    console.log('Media count:', allMedia.length);

    // Pilih metode pengiriman
    if (sendAsLink) {
      // Kirim sebagai text link (lebih reliable)
      sendAsTextMessage(allLinks, statusIds);
    } else {
      // Kirim sebagai media (mungkin gagal untuk beberapa URL)
      const maxPerRequest = 10;
      const requests = [];
      
      for (let i = 0; i < allMedia.length; i += maxPerRequest) {
        const chunk = allMedia.slice(i, i + maxPerRequest);
        requests.push(sendMediaGroup(chunk));
      }

      Promise.all(requests).then(() => {
        handleSuccess(statusIds, allMedia.length);
      }).catch(err => {
        console.error('❌ Error:', err);
        showFloatingNotification(`❌ Gagal: ${err}`, 'error');
      });
    }
  }

  // Kirim sebagai text message
  function sendAsTextMessage(links, statusIds) {
    const message = `🔗 Twitter Media Links\n\n${links.join('\n')}`;
    
    GM_xmlhttpRequest({
      method: 'POST',
      url: `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        chat_id: telegramChatId,
        text: message,
        disable_web_page_preview: false
      }),
      onload: function(response) {
        const result = JSON.parse(response.responseText);
        if (result.ok) {
          handleSuccess(statusIds, links.length);
        } else {
          console.error('❌ Telegram Error:', result.description);
          showFloatingNotification(`❌ Gagal: ${result.description}`, 'error');
        }
      },
      onerror: function(error) {
        console.error('❌ Network Error:', error);
        showFloatingNotification('❌ Gagal: Network error', 'error');
      }
    });
  }

  // Handle sukses
  function handleSuccess(statusIds, count) {
    // Tandai semua tweet sebagai sudah dikirim
    statusIds.forEach(id => markTweetAsSent(id));
    
    // Update tampilan tombol
    updateButtonStatus(statusIds);
    
    console.log('%c✅ Terkirim ke Telegram!', 'color: #4CAF50; font-weight: bold;');
    showFloatingNotification(`✅ ${count} item berhasil dikirim!`, 'success');
  }

  // Kirim media group ke Telegram
  function sendMediaGroup(mediaList) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: `https://api.telegram.org/bot${telegramBotToken}/sendMediaGroup`,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({
          chat_id: telegramChatId,
          media: mediaList
        }),
        onload: function(response) {
          const result = JSON.parse(response.responseText);
          if (result.ok) {
            resolve(result);
          } else {
            reject(result.description);
          }
        },
        onerror: function(error) {
          reject('Network error');
        }
      });
    });
  }

  // Dialog settings Telegram
  function showSettingsDialog() {
    const existing = document.querySelector('.settings-dialog');
    if (existing) existing.remove();

    const dialog = document.createElement('div');
    dialog.className = 'settings-dialog';
    dialog.innerHTML = `
      <h3>⚙️ Telegram Settings</h3>
      <label>Bot Token</label>
      <input type="text" id="telegram-token" placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz" value="${telegramBotToken}">
      <div class="help-text">Dapatkan dari @BotFather di Telegram</div>
      
      <label>Chat ID</label>
      <input type="text" id="telegram-chat-id" placeholder="-1001234567890 atau username" value="${telegramChatId}">
      <div class="help-text">Chat ID grup/channel atau username (contoh: @mychannel)</div>
      
      <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; margin-top: 15px;">
        <input type="checkbox" id="send-as-link" ${sendAsLink ? 'checked' : ''}>
        <span>Kirim sebagai link text (recommended)</span>
      </label>
      <div class="help-text">Lebih reliable. Jika tidak dicentang, kirim sebagai media (mungkin gagal)</div>
      
      <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; margin-top: 10px;">
        <input type="checkbox" id="send-thumbnail" ${sendThumbnail ? 'checked' : ''}>
        <span>Kirim thumbnail video juga</span>
      </label>
      <div class="help-text">Hanya berlaku jika tidak mengirim sebagai link</div>
      
      <div class="btn-group">
        <button class="btn-cancel" id="btn-cancel">Batal</button>
        <button class="btn-save" id="btn-save">Simpan</button>
      </div>
    `;
    
    document.body.appendChild(dialog);

    dialog.querySelector('#btn-cancel').onclick = () => dialog.remove();
    dialog.querySelector('#btn-save').onclick = () => {
      telegramBotToken = dialog.querySelector('#telegram-token').value.trim();
      telegramChatId = dialog.querySelector('#telegram-chat-id').value.trim();
      sendAsLink = dialog.querySelector('#send-as-link').checked;
      sendThumbnail = dialog.querySelector('#send-thumbnail').checked;
      GM_setValue('telegramBotToken', telegramBotToken);
      GM_setValue('telegramChatId', telegramChatId);
      GM_setValue('sendAsLink', sendAsLink);
      GM_setValue('sendThumbnail', sendThumbnail);
      dialog.remove();
      showFloatingNotification('✅ Pengaturan disimpan!', 'success');
    };
  }

  // Tambah tombol ke tweet
  function addButtonToTweet(article) {
    if (article.dataset.linkBtn) return;
    article.dataset.linkBtn = 'true';
    
    const statusIds = Array.from(article.querySelectorAll('a[href*="/status/"]'))
      .map(el => extractStatusId(el.href))
      .filter(id => id);
    
    if (statusIds.length === 0) return;
    
    const mediaSelector = [
      'a[href*="/photo/1"]',
      'div[role="progressbar"]',
      'button[data-testid="playButton"]',
      'div[data-testid="videoComponent"]'
    ];
    
    const hasMedia = article.querySelector(mediaSelector.join(','));
    if (!hasMedia) return;
    
    const btnGroup = article.querySelector('div[role="group"]:last-of-type');
    if (!btnGroup) return;
    
    const btnShare = Array.from(btnGroup.querySelectorAll(':scope>div>div')).pop()?.parentNode;
    if (!btnShare) return;
    
    // Tombol Console
    const btnConsole = btnShare.cloneNode(true);
    btnConsole.style.marginLeft = '10px';
    btnConsole.classList.add('video-link-btn');
    
    const svgContainer1 = btnConsole.querySelector('svg');
    if (svgContainer1) svgContainer1.outerHTML = svgIcon;
    
    btnConsole.title = 'Tampilkan Link di Console';
    btnGroup.insertBefore(btnConsole, btnShare.nextSibling);
    btnConsole.onclick = () => showLinksInConsole([...new Set(statusIds)]);

    // Tombol Telegram
    const btnTelegram = btnShare.cloneNode(true);
    btnTelegram.style.marginLeft = '6px';
    btnTelegram.classList.add('telegram-btn');
    
    // Cek apakah tweet sudah pernah dikirim
    const uniqueStatusIds = [...new Set(statusIds)];
    const anySent = uniqueStatusIds.some(id => isTweetSent(id));
    if (anySent) {
      btnTelegram.classList.add('sent');
      btnTelegram.title = '✓ Sudah dikirim ke Telegram (klik untuk kirim ulang)';
    } else {
      btnTelegram.title = 'Kirim ke Telegram';
    }
    
    // Simpan statusIds di dataset untuk update nanti
    btnTelegram.dataset.tweetIds = uniqueStatusIds.join(',');
    
    const svgContainer2 = btnTelegram.querySelector('svg');
    if (svgContainer2) svgContainer2.outerHTML = telegramIcon;
    
    btnGroup.insertBefore(btnTelegram, btnConsole.nextSibling);
    btnTelegram.onclick = () => sendToTelegram(uniqueStatusIds);
  }

  // Update tampilan tombol setelah berhasil kirim
  function updateButtonStatus(statusIds) {
    document.querySelectorAll('.telegram-btn').forEach(btn => {
      const btnTweetIds = btn.dataset.tweetIds ? btn.dataset.tweetIds.split(',') : [];
      const hasMatch = statusIds.some(id => btnTweetIds.includes(id));
      if (hasMatch && !btn.classList.contains('sent')) {
        btn.classList.add('sent');
        btn.title = '✓ Sudah dikirim ke Telegram (klik untuk kirim ulang)';
      }
    });
  }

  // Menu commands
  GM_registerMenuCommand('📋 Tampilkan Semua Link', () => {
    console.log('%c[Video Link] Semua Media Tersedia', 'color: #1DA1F2; font-size: 16px; font-weight: bold;');
    console.log('='.repeat(60));
    console.log(`Total: ${mediaMap.size} tweet dengan media`);
    console.log('-'.repeat(40));
    
    mediaMap.forEach((data, id) => {
      console.log(`%cTweet: ${id}`, 'color: #1DA1F2;');
      console.log(`%cText: ${data.text}`, 'color: #666;');
      data.mediaList.forEach((m, idx) => {
        const num = idx + 1;
        if (m.video) console.log(`%c🎬 Video ${num}: ${m.video}`, 'color: #4CAF50;');
        if (m.photo) console.log(`%c📷 Photo ${num}: ${m.photo}`, 'color: #2196F3;');
      });
      console.log('-'.repeat(40));
    });
    console.log('='.repeat(60));
  });

  GM_registerMenuCommand('📤 Kirim Semua ke Telegram', () => {
    const allIds = Array.from(mediaMap.keys());
    if (allIds.length === 0) {
      alert('⚠️ Tidak ada media yang terdeteksi');
      return;
    }
    sendToTelegram(allIds);
  });

  GM_registerMenuCommand('⚙️ Telegram Settings', showSettingsDialog);

  GM_registerMenuCommand('🗑️ Hapus Cache Tweet Terkirim', () => {
    const count = Object.keys(sentTweetsCache).length;
    if (count === 0) {
      alert('Cache sudah kosong');
      return;
    }
    if (confirm(`Hapus ${count} tweet dari cache?\n\nTombol akan kembali berwarna biru.`)) {
      sentTweetsCache = {};
      GM_setValue('sentTweetsCache', {});
      // Update semua tombol
      document.querySelectorAll('.telegram-btn.sent').forEach(btn => {
        btn.classList.remove('sent');
        btn.title = 'Kirim ke Telegram';
      });
      alert('✅ Cache dihapus!');
    }
  });

  GM_registerMenuCommand('📊 Lihat Cache Tweet Terkirim', () => {
    const count = Object.keys(sentTweetsCache).length;
    if (count === 0) {
      alert('Cache kosong - belum ada tweet yang dikirim');
      return;
    }
    console.log('%c📊 Cache Tweet Terkirim', 'color: #e0245e; font-size: 16px; font-weight: bold;');
    console.log('='.repeat(60));
    console.log(`Total: ${count} tweet`);
    console.log('-'.repeat(40));
    for (const [id, data] of Object.entries(sentTweetsCache)) {
      const date = new Date(data.timestamp).toLocaleString('id-ID');
      console.log(`Tweet: ${id} | ${date}`);
    }
    console.log('='.repeat(60));
  });

  // Inisialisasi
  hookXMLHttpRequest();
  
  // Observer untuk mendeteksi tweet baru
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) {
          const article = node.tagName === 'ARTICLE' ? node : 
                         node.querySelector('article') || node.closest('article');
          if (article) addButtonToTweet(article);
        }
      });
    });
  });

  // Mulai setelah body ready
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

})();
