/* eslint-disable */
const {onRequest} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {MetricServiceClient} = require('@google-cloud/monitoring');
const logger = require("firebase-functions/logger");
const cors = require("cors")({origin: true});
const crypto = require("crypto");

initializeApp();
const db = getFirestore();

exports.subscribeUser = onRequest({
  region: "europe-west1",
  cpu: 0.167,
  memory: "256Mi",
  timeoutSeconds: 10,
  maxInstances: 2
}, (req, res) => {
  cors(req, res, async () => {
    const {email} = req.body;

    if (
      !email ||
      !email.match(
        /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/
      )
    ) {
      return res.status(400).send("Invalid email.");
    }

    const snapshot = await db
      .collection("subscribers")
      .where("email", "==", email)
      .get();

    if (!snapshot.empty) {
      return res.status(200).send("You are already subscribed.");
    }

    await db.collection("subscribers").add({
      email,
      timestamp: Date.now(),
      emails_sent: 0
    });

    logger.log(`New subscriber: ${email}`);
    return res.status(200).send("Subscription successful!");
  });
});

exports.unsubscribeUser = onRequest({ 
  region: "europe-west1",
  cpu: 0.167,
  memory: "256Mi",
  timeoutSeconds: 10,
  maxInstances: 2
}, (req, res) => {
  cors(req, res, async () => {
    const email = req.query.email;
    const token = req.query.token;

    if (!email || !token) {
      return res.status(400).send("Missing email or token.");
    }
    
    const secretKey = process.env.SECRET_KEY;
    const expected = crypto.createHash("sha256").update(email + secretKey).digest("hex");

    if (token !== expected) {
      return res.status(403).send("Invalid or expired token.");
    }

    const snapshot = await db
      .collection("subscribers")
      .where("email", "==", email)
      .get();

    if (snapshot.empty) {
      return res.status(404).send("Email not found.");
    }

    const batch = db.batch();
    snapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    return res.status(200).send(`<h2>You have been unsubscribed: ${email}</h2>`);
  });
});

exports.getSubscribers = onRequest({
  region: "europe-west1",
  cpu: 0.167,
  memory: "256Mi",
  timeoutSeconds: 10,
  maxInstances: 2
}, async (req, res) => {
  cors(req, res, async () => {
    try {
      const snapshot = await db.collection("subscribers").get();
      const data = [];

      snapshot.forEach(doc => {
        const sub = doc.data();
        data.push({
          id: doc.id,
          email: sub.email || "unknown",
          timestamp: sub.timestamp,
          emails_sent: sub.emails_sent || 0
        });
      });

      res.status(200).json({ subscribers: data });
    } catch (error) {
      console.error("Failed to fetch subscribers:", error);
      res.status(500).json({ error: "Failed to fetch subscribers" });
    }
  });
});

exports.deleteSubscriber = onRequest({
  region: "europe-west1",
  cpu: 0.167,
  memory: "256Mi",
  timeoutSeconds: 10,
  maxInstances: 2
}, async (req, res) => {
  cors(req, res, async () => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const snapshot = await db
        .collection("subscribers")
        .where("email", "==", email)
        .get();

      if (snapshot.empty) {
        return res.status(404).json({ error: "Subscriber not found" });
      }

      const batch = db.batch();
      snapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      res.status(200).json({ message: "Subscriber deleted successfully" });
    } catch (error) {
      console.error("Failed to delete subscriber:", error);
      res.status(500).json({ error: "Failed to delete subscriber" });
    }
  });
});

exports.getEarthquakeHistory = onRequest({
  region: "europe-west1",
  cpu: 0.167,
  memory: "256Mi",
  timeoutSeconds: 15,
  maxInstances: 2
}, async (req, res) => {
  cors(req, res, async () => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const snapshot = await db
        .collection("earthquakes")
        .orderBy("timestamp", "desc")
        .limit(limit)
        .get();

      const data = [];
      snapshot.forEach(doc => {
        data.push({
          id: doc.id,
          ...doc.data()
        });
      });

      res.status(200).json({ earthquakes: data });
    } catch (error) {
      console.error("Failed to fetch earthquake history:", error);
      res.status(500).json({ error: "Failed to fetch earthquake history" });
    }
  });
});

// index.js'de getMailgunStats fonksiyonunu değiştir:
exports.getMailgunStats = onRequest({
  region: "europe-west1",
  cpu: 0.167,
  memory: "256Mi",
  timeoutSeconds: 15,
  maxInstances: 2
}, (req, res) => {
  cors(req, res, async () => {
    const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
    const SANDBOX_DOMAIN = process.env.SANDBOX_DOMAIN;

    try {
      const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64");
      
      // Simpler API call - just basic stats
      const statsResp = await fetch(
        `https://api.mailgun.net/v3/${SANDBOX_DOMAIN}/stats/total?event=delivered&event=failed&event=accepted&event=opened&duration=30d`,
        { headers: { Authorization: `Basic ${auth}` } }
      );

      if (!statsResp.ok) {
        console.error(`Mailgun API error: ${statsResp.status} ${statsResp.statusText}`);
        throw new Error(`Stats API error: ${statsResp.status}`);
      }

      const statsData = await statsResp.json();

      // Process stats
      const totals = statsData.stats.reduce((acc, day) => {
        acc.delivered += (day.delivered && day.delivered.total) || 0;
        acc.failed += (day.failed && day.failed.total) || 0;
        acc.accepted += (day.accepted && day.accepted.total) || 0;
        acc.opened += (day.opened && day.opened.total) || 0;
        return acc;
      }, { delivered: 0, failed: 0, accepted: 0, opened: 0 });

      // Calculate rates
      const openRate = totals.delivered > 0 ? ((totals.opened / totals.delivered) * 100).toFixed(1) : "0";
      const clickRate = "0"; // Not available in basic stats
      const bounceRate = totals.accepted > 0 ? ((totals.failed / totals.accepted) * 100).toFixed(1) : "0";

      // Firestore data
      const snapshot = await db.collection("subscribers").get();
      const totalSubscribers = snapshot.size;
      let totalEmailsSent = 0;

      snapshot.forEach(doc => {
        const sub = doc.data();
        totalEmailsSent += sub.emails_sent || 0;
      });

      // Daily stats for chart
      const dailyStats = statsData.stats.map(day => ({
        date: day.time,
        delivered: (day.delivered && day.delivered.total) || 0,
        failed: (day.failed && day.failed.total) || 0,
        accepted: (day.accepted && day.accepted.total) || 0,
        opened: (day.opened && day.opened.total) || 0,
        clicked: 0,
        bounced: 0
      }));

      res.status(200).json({
        mailgunStats: { ...totals, clicked: 0, bounced: 0 },
        rates: { openRate, clickRate, bounceRate },
        dailyStats,
        totalSubscribers,
        totalEmailsSent
      });

    } catch (error) {
      console.error("Mailgun stats fetch failed:", error);
      res.status(500).json({ error: "Failed to fetch Mailgun statistics." });
    }
  });
});

exports.getCloudMetrics = onRequest({
  region: "europe-west1",
  cpu: 0.167,
  memory: "256Mi",
  timeoutSeconds: 30,
  maxInstances: 2
}, (req, res) => {
  cors(req, res, async () => {
    try {
      const projectId = process.env.GCLOUD_PROJECT || 'deprem-460420';
      const client = new MetricServiceClient();
      
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Function invocations (last 24h)
      const functionInvocationsRequest = {
        name: `projects/${projectId}`,
        filter: 'metric.type="cloudfunctions.googleapis.com/function/execution_count"',
        interval: {
          startTime: { seconds: Math.floor(oneDayAgo.getTime() / 1000) },
          endTime: { seconds: Math.floor(now.getTime() / 1000) }
        },
        aggregation: {
          alignmentPeriod: { seconds: 3600 }, // 1 hour intervals
          perSeriesAligner: 'ALIGN_RATE',
          crossSeriesReducer: 'REDUCE_SUM'
        }
      };

      // Function errors (last 24h)
      const functionErrorsRequest = {
        name: `projects/${projectId}`,
        filter: 'metric.type="cloudfunctions.googleapis.com/function/execution_count" AND metric.label.status!="ok"',
        interval: {
          startTime: { seconds: Math.floor(oneDayAgo.getTime() / 1000) },
          endTime: { seconds: Math.floor(now.getTime() / 1000) }
        },
        aggregation: {
          alignmentPeriod: { seconds: 3600 },
          perSeriesAligner: 'ALIGN_RATE',
          crossSeriesReducer: 'REDUCE_SUM'
        }
      };

      // Firestore document reads
      const firestoreReadsRequest = {
        name: `projects/${projectId}`,
        filter: 'metric.type="firestore.googleapis.com/document/read_count"',
        interval: {
          startTime: { seconds: Math.floor(oneDayAgo.getTime() / 1000) },
          endTime: { seconds: Math.floor(now.getTime() / 1000) }
        },
        aggregation: {
          alignmentPeriod: { seconds: 3600 },
          perSeriesAligner: 'ALIGN_RATE',
          crossSeriesReducer: 'REDUCE_SUM'
        }
      };

      // Firestore document writes
      const firestoreWritesRequest = {
        name: `projects/${projectId}`,
        filter: 'metric.type="firestore.googleapis.com/document/write_count"',
        interval: {
          startTime: { seconds: Math.floor(oneDayAgo.getTime() / 1000) },
          endTime: { seconds: Math.floor(now.getTime() / 1000) }
        },
        aggregation: {
          alignmentPeriod: { seconds: 3600 },
          perSeriesAligner: 'ALIGN_RATE',
          crossSeriesReducer: 'REDUCE_SUM'
        }
      };

      // Execute all requests in parallel
      const [
        [functionInvocationsResponse],
        [functionErrorsResponse], 
        [firestoreReadsResponse],
        [firestoreWritesResponse]
      ] = await Promise.all([
        client.listTimeSeries(functionInvocationsRequest),
        client.listTimeSeries(functionErrorsRequest),
        client.listTimeSeries(firestoreReadsRequest),
        client.listTimeSeries(firestoreWritesRequest)
      ]);

      // Process data for charts
      const processTimeSeries = (timeSeries) => {
        if (!timeSeries || timeSeries.length === 0) return [];
        
        return timeSeries[0].points.map(point => ({
          timestamp: new Date(point.interval.endTime.seconds * 1000).toISOString(),
          value: parseFloat(point.value.doubleValue || point.value.int64Value || 0)
        })).reverse();
      };

      // Convert rates to more meaningful numbers (per hour)
      const convertToHourly = (timeSeries) => {
        return timeSeries.map(point => ({
          ...point,
          value: Math.round(point.value * 3600 * 100) / 100 // per hour, 2 decimal places
        }));
      };

      const metrics = {
        functionInvocations: convertToHourly(processTimeSeries(functionInvocationsResponse)),
        functionErrors: convertToHourly(processTimeSeries(functionErrorsResponse)),
        firestoreReads: convertToHourly(processTimeSeries(firestoreReadsResponse)),
        firestoreWrites: convertToHourly(processTimeSeries(firestoreWritesResponse)),
        summary: {
          totalInvocations: Math.round(functionInvocationsResponse.reduce((sum, ts) => 
            sum + ts.points.reduce((pointSum, point) => 
              pointSum + parseFloat(point.value.doubleValue || point.value.int64Value || 0), 0), 0) * 3600),
          totalErrors: Math.round(functionErrorsResponse.reduce((sum, ts) => 
            sum + ts.points.reduce((pointSum, point) => 
              pointSum + parseFloat(point.value.doubleValue || point.value.int64Value || 0), 0), 0) * 3600),
          totalReads: Math.round(firestoreReadsResponse.reduce((sum, ts) => 
            sum + ts.points.reduce((pointSum, point) => 
              pointSum + parseFloat(point.value.doubleValue || point.value.int64Value || 0), 0), 0) * 3600),
          totalWrites: Math.round(firestoreWritesResponse.reduce((sum, ts) => 
            sum + ts.points.reduce((pointSum, point) => 
              pointSum + parseFloat(point.value.doubleValue || point.value.int64Value || 0), 0), 0) * 3600)
        }
      };

      res.status(200).json(metrics);

    } catch (error) {
      console.error("Failed to fetch Cloud metrics:", error);
      res.status(500).json({ 
        error: "Failed to fetch Cloud metrics",
        details: error.message 
      });
    }
  });
});