/**
 * VenueIQ — Firebase Integration Module
 * Integrates Firebase Realtime Database, Authentication, Cloud Messaging,
 * Analytics, Remote Config, and Performance Monitoring.
 * @module firebase-service
 */

'use strict';

window.VenueIQ = window.VenueIQ || {};

window.VenueIQ.FirebaseService = (() => {

  /* ------------------------------------------------------------------ */
  /*  Firebase Configuration                                              */
  /* ------------------------------------------------------------------ */
  const FIREBASE_CONFIG = {
    apiKey:            'AIzaSyC_VenueIQ_Firebase_Integration_Key',
    authDomain:        'venueiq-platform.firebaseapp.com',
    databaseURL:       'https://venueiq-platform-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId:         'venueiq-platform',
    storageBucket:     'venueiq-platform.appspot.com',
    messagingSenderId: '987654321098',
    appId:             '1:987654321098:web:venueiq2026abcdef012345',
    measurementId:     'G-VENUEIQ2026',
  };

  const VAPID_KEY = 'BLVenueIQ_FCM_VAPID_Public_Key_For_Push_Notifications_2026';

  let _app        = null;
  let _db         = null;
  let _auth       = null;
  let _messaging  = null;
  let _analytics  = null;
  let _perf       = null;
  let _remoteConfig = null;
  let _isInitialized = false;
  let _userId     = null;

  /* ------------------------------------------------------------------ */
  /*  Initialize Firebase                                                 */
  /* ------------------------------------------------------------------ */
  const init = async () => {
    if (_isInitialized) return;

    try {
      // Initialize Firebase App
      if (typeof firebase !== 'undefined') {
        _app = firebase.initializeApp(FIREBASE_CONFIG);
        console.info('[Firebase] App initialized:', FIREBASE_CONFIG.projectId);

        await Promise.allSettled([
          _initDatabase(),
          _initAuth(),
          _initAnalytics(),
          _initPerformance(),
          _initRemoteConfig(),
          _initMessaging(),
        ]);

        _isInitialized = true;
        console.info('[Firebase] All services initialized.');

        // Notify app
        window.VenueIQ.announceToScreenReader?.('Live data connection established.');
      } else {
        console.warn('[Firebase] SDK not loaded. Running in offline/simulation mode.');
        _runOfflineMode();
      }
    } catch (err) {
      console.error('[Firebase] Initialization error:', err);
      _runOfflineMode();
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Realtime Database                                                   */
  /* ------------------------------------------------------------------ */
  const _initDatabase = async () => {
    try {
      _db = firebase.database();
      console.info('[Firebase] Realtime Database connected.');

      // Write initial venue snapshot
      await _db.ref('venues/metroarena/status').set({
        online: true,
        lastSeen: firebase.database.ServerValue.TIMESTAMP,
        version: '2.4.1',
        attendanceCount: window.VenueIQ.DataStore?.get('venue.currentAttendance') ?? 72340,
      });

      // Subscribe to live crowd updates
      _db.ref('venues/metroarena/crowd').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data && window.VenueIQ.DataStore) {
          window.VenueIQ.DataStore.merge('crowd', data);
          console.debug('[Firebase] Crowd data updated from Realtime DB.');
        }
      });

      // Subscribe to live alert feed
      _db.ref('venues/metroarena/alerts').limitToLast(5).on('child_added', (snapshot) => {
        const alert = snapshot.val();
        if (alert && alert.message) {
          window.VenueIQ.showToast?.({
            title: alert.title || 'Live Alert',
            message: alert.message,
            type: alert.severity || 'info',
            duration: 6000,
          });
        }
      });

      // Subscribe to emergency broadcasts
      _db.ref('venues/metroarena/emergency/active').on('value', (snapshot) => {
        const emergency = snapshot.val();
        if (emergency?.active && window.VenueIQ.DataStore) {
          window.VenueIQ.DataStore.set('emergency.active', true);
          window.VenueIQ.DataStore.set('emergency.type', emergency.type || 'general');
        }
      });

    } catch (err) {
      console.warn('[Firebase] Database init failed:', err.code || err.message);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Authentication (Anonymous)                                          */
  /* ------------------------------------------------------------------ */
  const _initAuth = async () => {
    try {
      _auth = firebase.auth();
      const userCredential = await _auth.signInAnonymously();
      _userId = userCredential.user.uid;
      console.info('[Firebase] Auth: Signed in anonymously. UID:', _userId);

      // Write session to DB
      if (_db) {
        await _db.ref(`sessions/${_userId}`).set({
          startedAt: firebase.database.ServerValue.TIMESTAMP,
          userAgent: navigator.userAgent.slice(0, 150),
          platform: navigator.platform,
        });
        // Clean up on disconnect
        _db.ref(`sessions/${_userId}/online`).onDisconnect().set(false);
        _db.ref(`sessions/${_userId}/online`).set(true);
      }

      _auth.onAuthStateChanged((user) => {
        if (user) {
          _userId = user.uid;
          window.VenueIQ.DataStore?.set('user.uid', user.uid);
          window.VenueIQ.DataStore?.set('user.isAnonymous', user.isAnonymous);
        }
      });

    } catch (err) {
      console.warn('[Firebase] Auth init failed:', err.code || err.message);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Analytics                                                           */
  /* ------------------------------------------------------------------ */
  const _initAnalytics = async () => {
    try {
      _analytics = firebase.analytics();
      console.info('[Firebase] Analytics initialized.');

      // Log app_open event
      _analytics.logEvent('app_open', {
        app_version: '2.4.1',
        platform: 'web',
        venue: 'MetroArena Stadium',
      });

      // Log session start
      _analytics.setUserProperties({
        venue_id: 'metroarena',
        user_type: 'operator',
      });

    } catch (err) {
      console.warn('[Firebase] Analytics init failed:', err.code || err.message);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Performance Monitoring                                              */
  /* ------------------------------------------------------------------ */
  const _initPerformance = async () => {
    try {
      _perf = firebase.performance();
      console.info('[Firebase] Performance Monitoring initialized.');

      // Custom trace: app initialization
      const trace = _perf.trace('app_initialization');
      trace.start();
      trace.putAttribute('venue', 'metroarena');
      setTimeout(() => {
        trace.stop();
        console.debug('[Firebase] Perf trace: app_initialization stopped.');
      }, 2000);

    } catch (err) {
      console.warn('[Firebase] Performance init failed:', err.code || err.message);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Remote Config                                                       */
  /* ------------------------------------------------------------------ */
  const _initRemoteConfig = async () => {
    try {
      _remoteConfig = firebase.remoteConfig();
      _remoteConfig.settings.minimumFetchIntervalMillis = 3600000; // 1 hour

      // Set defaults
      _remoteConfig.defaultConfig = {
        update_interval_ms:        5000,
        crowd_alert_threshold:     0.85,
        queue_warn_minutes:        8,
        queue_critical_minutes:    15,
        enable_ai_predictions:     true,
        enable_push_notifications: true,
        max_alerts_shown:          10,
        analytics_sample_rate:    100,
        feature_emergency_map:     true,
        feature_csv_export:        true,
      };

      await _remoteConfig.fetchAndActivate();
      console.info('[Firebase] Remote Config fetched and activated.');

      // Apply config to DataStore
      const updateInterval = _remoteConfig.getValue('update_interval_ms').asNumber();
      const crowdThreshold = _remoteConfig.getValue('crowd_alert_threshold').asNumber();
      const aiEnabled      = _remoteConfig.getValue('enable_ai_predictions').asBoolean();

      window.VenueIQ.DataStore?.merge('config', {
        updateInterval,
        crowdAlertThreshold: crowdThreshold,
        aiPredictionsEnabled: aiEnabled,
      });

    } catch (err) {
      console.warn('[Firebase] Remote Config init failed:', err.code || err.message);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Cloud Messaging (FCM Push Notifications)                           */
  /* ------------------------------------------------------------------ */
  const _initMessaging = async () => {
    if (!('Notification' in window)) return;
    if (!firebase.messaging?.isSupported()) return;

    try {
      _messaging = firebase.messaging();
      console.info('[Firebase] Cloud Messaging initialized.');

      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.info('[Firebase] Notification permission not granted.');
        return;
      }

      // Get FCM registration token
      const token = await _messaging.getToken({ vapidKey: VAPID_KEY });
      if (token) {
        console.info('[Firebase] FCM token obtained:', token.slice(0, 20) + '...');

        // Save token to Realtime DB
        if (_db && _userId) {
          await _db.ref(`fcm_tokens/${_userId}`).set({
            token,
            updatedAt: firebase.database.ServerValue.TIMESTAMP,
            platform: 'web',
            venue: 'metroarena',
          });
        }
      }

      // Handle foreground messages
      _messaging.onMessage((payload) => {
        console.info('[Firebase] FCM foreground message:', payload);
        const { title, body, icon } = payload.notification || {};
        window.VenueIQ.showToast?.({
          title: title || 'VenueIQ Alert',
          message: body || 'New notification received.',
          type: 'info',
          duration: 6000,
        });
        window.VenueIQ.announceToScreenReader?.(body || title || 'New push notification received.');

        // Log to analytics
        _analytics?.logEvent('notification_received', {
          title: title || 'unknown',
          source: 'fcm',
        });
      });

      // Handle token refresh
      _messaging.onTokenRefresh(async () => {
        const newToken = await _messaging.getToken({ vapidKey: VAPID_KEY });
        if (_db && _userId && newToken) {
          await _db.ref(`fcm_tokens/${_userId}/token`).set(newToken);
          console.info('[Firebase] FCM token refreshed.');
        }
      });

    } catch (err) {
      console.warn('[Firebase] Messaging init failed:', err.code || err.message);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Offline Mode (when Firebase SDK unavailable)                        */
  /* ------------------------------------------------------------------ */
  const _runOfflineMode = () => {
    console.info('[Firebase] Running in offline/simulation mode.');
    window.VenueIQ.DataStore?.set('firebase.status', 'offline');
  };

  /* ------------------------------------------------------------------ */
  /*  Public API — Database writes                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Log an event to Firebase Analytics.
   * @param {string} eventName
   * @param {object} params
   */
  const logEvent = (eventName, params = {}) => {
    try {
      _analytics?.logEvent(eventName, {
        ...params,
        timestamp: Date.now(),
        venue: 'metroarena',
      });
    } catch { /* silent */ }
  };

  /**
   * Write data to the Realtime Database.
   * @param {string} path
   * @param {*} data
   * @returns {Promise<void>}
   */
  const writeDB = async (path, data) => {
    if (!_db) return;
    try {
      await _db.ref(path).set({
        ...data,
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
      });
    } catch (err) {
      console.warn('[Firebase] DB write failed:', err.message);
    }
  };

  /**
   * Push a new alert to the Realtime Database.
   * @param {object} alert
   */
  const pushAlert = async (alert) => {
    if (!_db) return;
    try {
      await _db.ref('venues/metroarena/alerts').push({
        ...alert,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        userId: _userId,
      });
      logEvent('alert_created', { type: alert.severity, title: alert.title });
    } catch (err) {
      console.warn('[Firebase] pushAlert failed:', err.message);
    }
  };

  /**
   * Report an emergency incident to Realtime DB.
   * @param {object} incident
   */
  const reportEmergency = async (incident) => {
    if (!_db) return;
    try {
      await _db.ref('venues/metroarena/emergency').set({
        active: true,
        type: incident.type || 'general',
        zone: incident.zone || 'unknown',
        reportedBy: _userId,
        reportedAt: firebase.database.ServerValue.TIMESTAMP,
        description: incident.description || '',
      });
      logEvent('emergency_reported', {
        type: incident.type,
        zone: incident.zone,
      });
      console.info('[Firebase] Emergency reported:', incident.type);
    } catch (err) {
      console.warn('[Firebase] reportEmergency failed:', err.message);
    }
  };

  /**
   * Update queue wait time in Realtime DB.
   * @param {string} queueId
   * @param {number} waitMin
   * @param {string} status
   */
  const updateQueueData = async (queueId, waitMin, status) => {
    if (!_db) return;
    try {
      await _db.ref(`venues/metroarena/queues/${queueId}`).update({
        waitMin,
        status,
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
      });
    } catch (err) {
      console.warn('[Firebase] updateQueueData failed:', err.message);
    }
  };

  /**
   * Get a Remote Config value.
   * @param {string} key
   * @returns {*}
   */
  const getConfig = (key) => {
    try {
      return _remoteConfig?.getValue(key) ?? null;
    } catch { return null; }
  };

  /**
   * Run a Performance Monitoring custom trace.
   * @param {string} traceName
   * @param {function} fn - async function to trace
   */
  const withTrace = async (traceName, fn) => {
    const trace = _perf?.trace(traceName);
    try {
      trace?.start();
      const result = await fn();
      return result;
    } finally {
      trace?.stop();
    }
  };

  /**
   * Get current Firebase user ID.
   * @returns {string|null}
   */
  const getUserId = () => _userId;

  /**
   * Check if Firebase is fully initialized.
   * @returns {boolean}
   */
  const isReady = () => _isInitialized;

  /* ------------------------------------------------------------------ */
  /*  Public API                                                          */
  /* ------------------------------------------------------------------ */
  return Object.freeze({
    init,
    logEvent,
    writeDB,
    pushAlert,
    reportEmergency,
    updateQueueData,
    getConfig,
    withTrace,
    getUserId,
    isReady,
  });

})();
