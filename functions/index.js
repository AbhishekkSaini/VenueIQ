/**
 * VenueIQ — Firebase Cloud Functions
 * Server-side logic for crowd alerts, queue notifications,
 * emergency broadcasts, and scheduled data aggregation.
 * Deploy: firebase deploy --only functions
 */

'use strict';

const functions    = require('firebase-functions');
const admin        = require('firebase-admin');
const { logger }   = require('firebase-functions');

admin.initializeApp();
const db  = admin.database();
const fcm = admin.messaging();

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */
const VENUE_ID              = 'metroarena';
const CROWD_ALERT_THRESHOLD = 0.90;  // 90% capacity
const QUEUE_WARN_MINUTES    = 8;
const QUEUE_CRITICAL_MINUTES = 15;

/* ================================================================== */
/*  Crowd Density Alert Trigger                                        */
/* Fires whenever crowd density is written to Realtime Database.       */
/* ================================================================== */
exports.onCrowdUpdate = functions
  .region('asia-south1')
  .database.ref(`/venues/${VENUE_ID}/crowd/{zoneId}`)
  .onWrite(async (change, context) => {
    const data = change.after.val();
    if (!data) return null;

    const { zoneId } = context.params;
    const density = (data.current ?? 0) / (data.capacity ?? 1);

    if (density >= CROWD_ALERT_THRESHOLD) {
      logger.warn(`[CrowdAlert] Zone ${zoneId} at ${Math.round(density * 100)}% capacity.`);

      // Push FCM notification to all subscribed operator devices
      const alert = {
        title: `⚠ Crowd Alert: Zone ${zoneId}`,
        body: `Zone ${zoneId} has reached ${Math.round(density * 100)}% capacity. Immediate action required.`,
      };

      try {
        await fcm.sendToTopic(`venue_${VENUE_ID}_operators`, {
          notification: alert,
          data: {
            zone: zoneId,
            density: String(Math.round(density * 100)),
            type: 'crowd_alert',
            click_action: '#crowd',
          },
          android: { priority: 'high' },
          webpush: {
            headers: { Urgency: 'high' },
            notification: { ...alert, icon: '/assets/icon-192.png', badge: '/assets/badge-72.png' },
          },
        });

        // Write alert to DB
        await db.ref(`/venues/${VENUE_ID}/alerts`).push({
          title: alert.title,
          message: alert.body,
          severity: density >= 0.95 ? 'critical' : 'warning',
          zone: zoneId,
          timestamp: admin.database.ServerValue.TIMESTAMP,
          source: 'cloud_function',
        });

        logger.info(`[CrowdAlert] FCM sent for zone ${zoneId}.`);
      } catch (err) {
        logger.error('[CrowdAlert] FCM send failed:', err);
      }
    }

    return null;
  });

/* ================================================================== */
/*  Queue Wait Time Alert Trigger                                      */
/* ================================================================== */
exports.onQueueUpdate = functions
  .region('asia-south1')
  .database.ref(`/venues/${VENUE_ID}/queues/{queueId}`)
  .onWrite(async (change, context) => {
    const data = change.after.val();
    if (!data) return null;

    const { queueId } = context.params;
    const { waitMin, status } = data;

    if (waitMin >= QUEUE_CRITICAL_MINUTES) {
      logger.warn(`[QueueAlert] Queue ${queueId} critical: ${waitMin}m wait.`);

      await db.ref(`/venues/${VENUE_ID}/alerts`).push({
        title: `🚨 Queue Critical: ${queueId}`,
        message: `Wait time has reached ${waitMin} minutes. Deploy additional staff immediately.`,
        severity: 'critical',
        zone: queueId,
        timestamp: admin.database.ServerValue.TIMESTAMP,
        source: 'cloud_function',
      }).catch(err => logger.error('[QueueAlert] DB write failed:', err));

    } else if (waitMin >= QUEUE_WARN_MINUTES && status !== 'ok') {
      await db.ref(`/venues/${VENUE_ID}/alerts`).push({
        title: `⚠ Queue Warning: ${queueId}`,
        message: `Wait time is ${waitMin} minutes. Consider redeploying staff.`,
        severity: 'warning',
        zone: queueId,
        timestamp: admin.database.ServerValue.TIMESTAMP,
        source: 'cloud_function',
      }).catch(err => logger.error('[QueueAlert] DB write failed:', err));
    }

    return null;
  });

/* ================================================================== */
/*  Emergency Broadcast                                                */
/* Fires when emergency.active is set to true in the DB.              */
/* ================================================================== */
exports.onEmergencyActivated = functions
  .region('asia-south1')
  .database.ref(`/venues/${VENUE_ID}/emergency/active`)
  .onWrite(async (change, context) => {
    const isActive = change.after.val();
    if (!isActive) return null;

    const emergencyData = (await db.ref(`/venues/${VENUE_ID}/emergency`).once('value')).val();
    const emergencyType = emergencyData?.type || 'general';

    logger.error(`[Emergency] EMERGENCY ACTIVATED: ${emergencyType}`);

    // Broadcast high-priority FCM to ALL subscribed topics
    const topics = [
      `venue_${VENUE_ID}_operators`,
      `venue_${VENUE_ID}_security`,
      `venue_${VENUE_ID}_medical`,
    ];

    const broadcastPayload = {
      notification: {
        title: '🚨 EMERGENCY ALERT — VenueIQ',
        body: `${emergencyType.toUpperCase()} emergency declared at MetroArena Stadium. Immediate action required.`,
      },
      data: {
        type: 'emergency',
        emergency_type: emergencyType,
        click_action: '#emergency',
        priority: 'critical',
      },
      android: { priority: 'high', notification: { sound: 'alarm', channelId: 'emergency' } },
      webpush: {
        headers: { Urgency: 'very-high' },
        notification: {
          title: '🚨 EMERGENCY ALERT',
          body: `${emergencyType.toUpperCase()} emergency at MetroArena Stadium.`,
          icon: '/assets/icon-192.png',
          badge: '/assets/badge-72.png',
          requireInteraction: true,
        },
      },
    };

    await Promise.allSettled(
      topics.map(topic => fcm.sendToTopic(topic, broadcastPayload))
    );

    logger.info('[Emergency] Broadcast sent to all emergency topics.');
    return null;
  });

/* ================================================================== */
/*  Scheduled: Hourly Analytics Aggregation                           */
/* Runs every hour to compute venue-wide stats and write to DB.       */
/* ================================================================== */
exports.aggregateHourlyStats = functions
  .region('asia-south1')
  .pubsub.schedule('every 60 minutes')
  .timeZone('Asia/Kolkata')
  .onRun(async () => {
    logger.info('[Scheduler] Running hourly stats aggregation...');

    const [crowdSnap, queuesSnap, sessionsSnap] = await Promise.all([
      db.ref(`/venues/${VENUE_ID}/crowd`).once('value'),
      db.ref(`/venues/${VENUE_ID}/queues`).once('value'),
      db.ref('/sessions').once('value'),
    ]);

    const crowds  = crowdSnap.val()  || {};
    const queues  = queuesSnap.val() || {};
    const sessions = sessionsSnap.val() || {};

    // Compute aggregate metrics
    const zoneList    = Object.values(crowds);
    const totalCurrent = zoneList.reduce((s, z) => s + (z.current || 0), 0);
    const totalCapacity = zoneList.reduce((s, z) => s + (z.capacity || 1), 0);

    const queueList   = Object.values(queues);
    const avgWait     = queueList.length
      ? queueList.reduce((s, q) => s + (q.waitMin || 0), 0) / queueList.length
      : 0;

    const activeUsers = Object.values(sessions).filter(s => s.online).length;

    const aggregated = {
      timestamp: admin.database.ServerValue.TIMESTAMP,
      totalAttendance: totalCurrent,
      totalCapacity,
      occupancyPct: Math.round((totalCurrent / totalCapacity) * 1000) / 10,
      avgQueueWaitMin: Math.round(avgWait * 10) / 10,
      activeOperators: activeUsers,
      computedBy: 'cloud_function',
    };

    await db.ref(`/venues/${VENUE_ID}/hourly_stats/${Date.now()}`).set(aggregated);
    await db.ref(`/venues/${VENUE_ID}/latest_stats`).set(aggregated);

    logger.info('[Scheduler] Hourly stats aggregated:', aggregated);
    return null;
  });

/* ================================================================== */
/*  HTTP Endpoint: Venue Status API                                    */
/* A callable Cloud Function for external system integrations.        */
/* ================================================================== */
exports.getVenueStatus = functions
  .region('asia-south1')
  .https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', 'https://venueiq.app');
    res.set('Access-Control-Allow-Methods', 'GET');
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

    try {
      const [statsSnap, emergencySnap] = await Promise.all([
        db.ref(`/venues/${VENUE_ID}/latest_stats`).once('value'),
        db.ref(`/venues/${VENUE_ID}/emergency`).once('value'),
      ]);

      const stats    = statsSnap.val()    || {};
      const emergency = emergencySnap.val() || {};

      res.status(200).json({
        venue: VENUE_ID,
        status: emergency.active ? 'emergency' : 'operational',
        occupancyPct: stats.occupancyPct || 0,
        avgQueueWaitMin: stats.avgQueueWaitMin || 0,
        activeOperators: stats.activeOperators || 0,
        lastUpdated: stats.timestamp || null,
        emergency: emergency.active ? { type: emergency.type, zone: emergency.zone } : null,
        apiVersion: '1.0.0',
      });
    } catch (err) {
      logger.error('[VenueStatusAPI] Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

/* ================================================================== */
/*  Callable: Subscribe Operator to FCM Topic                         */
/* ================================================================== */
exports.subscribeToAlerts = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }

    const { fcmToken, role = 'operator' } = data;
    if (!fcmToken) {
      throw new functions.https.HttpsError('invalid-argument', 'FCM token required.');
    }

    const topic = `venue_${VENUE_ID}_${role}`;
    await fcm.subscribeToTopic([fcmToken], topic);

    logger.info(`[FCMSubscribe] User ${context.auth.uid} subscribed to ${topic}`);
    return { success: true, topic };
  });
