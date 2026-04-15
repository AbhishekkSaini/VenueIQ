/**
 * VenueIQ — Notifications Module
 * Inbox, push notification management, and quick broadcast.
 * @module notifications
 */

'use strict';

window.VenueIQ = window.VenueIQ || {};

window.VenueIQ.Notifications = (() => {

  const { Security, DataStore, Utils } = window.VenueIQ;
  const { $, $$, formatRelativeTime } = Utils;

  let _isInitialized = false;

  const init = () => {
    if (_isInitialized) { renderNotificationsList(); return; }
    _isInitialized = true;

    renderNotificationsList();
    initNotificationActions();
    requestPushPermission();
  };

  /* ------------------------------------------------------------------ */
  /*  Notifications List                                                  */
  /* ------------------------------------------------------------------ */
  const renderNotificationsList = () => {
    const container = $('#notifications-list');
    if (!container) return;
    container.innerHTML = '';

    const notifications = DataStore.get('notifications') ?? [];
    if (!notifications.length) {
      const empty = Security.createElement('div');
      empty.style.cssText = 'text-align:center;padding:32px;color:var(--text-muted);';
      empty.textContent = '✓ No notifications';
      container.appendChild(empty);
      return;
    }

    notifications.forEach(n => {
      const item = Security.createElement('div', {
        class: `notification-item ${n.read ? '' : 'unread'}`,
        role: 'listitem',
        tabindex: '0',
        'aria-label': `${n.read ? '' : 'Unread notification: '}${n.title} — ${n.body}`,
      });

      const icon    = Security.createElement('span', { class: 'notification-icon', 'aria-hidden': 'true' }, [n.icon]);
      const content = Security.createElement('div', { class: 'notification-content' });
      const title   = Security.createElement('div', { class: 'notification-title', textContent: n.title });
      const body    = Security.createElement('div', { class: 'notification-body',  textContent: n.body });
      const meta    = Security.createElement('div', { class: 'notification-meta' });
      const time    = Security.createElement('span', { class: 'notification-time',    textContent: formatRelativeTime(n.time) });
      const channel = Security.createElement('span', { class: 'notification-channel', textContent: n.channel });

      meta.append(time, channel);
      content.append(title, body, meta);

      if (!n.read) {
        const dot = Security.createElement('div', { class: 'unread-dot', 'aria-label': 'Unread' });
        item.append(icon, content, dot);
      } else {
        item.append(icon, content);
      }

      item.addEventListener('click', () => markRead(n.id, item));
      item.addEventListener('keydown', (e) => { if (e.key === 'Enter') markRead(n.id, item); });
      container.appendChild(item);
    });
  };

  const markRead = (id, item) => {
    const notifications = DataStore.get('notifications').map(n =>
      n.id === id ? { ...n, read: true } : n
    );
    DataStore.set('notifications', notifications);
    item.classList.remove('unread');
    item.querySelector('.unread-dot')?.remove();
    updateNotifBadge();
  };

  const markAllRead = () => {
    const notifications = DataStore.get('notifications').map(n => ({ ...n, read: true }));
    DataStore.set('notifications', notifications);
    renderNotificationsList();
    updateNotifBadge();
    window.VenueIQ.showToast?.({ title: 'All Marked Read', message: 'All notifications marked as read.', type: 'success', duration: 2000 });
    window.VenueIQ.announceToScreenReader?.('All notifications marked as read.');
  };

  const updateNotifBadge = () => {
    const notifications = DataStore.get('notifications') ?? [];
    const unread = notifications.filter(n => !n.read).length;
    $$('.nav-btn[data-view="notifications"] .nav-badge').forEach(badge => {
      badge.textContent = unread || '';
      badge.style.display = unread ? '' : 'none';
    });
  };

  /* ------------------------------------------------------------------ */
  /*  Actions                                                             */
  /* ------------------------------------------------------------------ */
  const initNotificationActions = () => {
    $('#mark-all-read')?.addEventListener('click', markAllRead);

    $('#compose-notification')?.addEventListener('click', () => {
      const quick = $('#quick-msg');
      if (quick) { quick.focus(); quick.scrollIntoView({ behavior: 'smooth' }); }
    });
  };

  /* ------------------------------------------------------------------ */
  /*  Push Notification Permission                                        */
  /* ------------------------------------------------------------------ */
  const requestPushPermission = async () => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      // Delay to not immediately trigger on page load
      setTimeout(async () => {
        try {
          const perm = await Notification.requestPermission();
          if (perm === 'granted') {
            window.VenueIQ.showToast?.({
              title: '🔔 Notifications Enabled',
              message: 'You will receive live venue alerts.',
              type: 'success',
              duration: 3000,
            });
            typeof gtag !== 'undefined' && gtag('event', 'push_permission_granted');
          }
        } catch { /* User denied or error — fail silently */ }
      }, 8000);
    }
  };

  /**
   * Show a native push notification (if permitted).
   * @param {string} title
   * @param {string} body
   */
  const sendPushNotification = (title, body) => {
    if (Notification.permission !== 'granted') return;
    try {
      new Notification(Security.sanitizeText(title, 80), {
        body: Security.sanitizeText(body, 200),
        icon: './assets/icon-192.png',
        badge: './assets/badge-72.png',
        tag: 'venueiq-alert',
      });
    } catch (e) {
      console.warn('[Notifications] Push notification failed:', e);
    }
  };

  return Object.freeze({ init, sendPushNotification, markAllRead, updateNotifBadge });

})();
