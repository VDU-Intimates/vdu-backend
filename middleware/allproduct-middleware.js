const admin = require("firebase-admin");

if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    admin.initializeApp();
  }
}

async function validateFirebaseIdToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({ error: "Missing or malformed Authorization header" });
    }
    const idToken = parts[1];
    const decoded = await admin.auth().verifyIdToken(idToken, true);
    req.auth = decoded;
    req.authUid = decoded.uid;
    next();
  } catch (err) {
    console.error("validateFirebaseIdToken error:", err?.message || err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    const roles = req.auth?.roles || req.auth?.role || [];
    const hasRole = Array.isArray(roles) ? roles.includes(role) : roles === role;
    if (!hasRole) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

module.exports = { validateFirebaseIdToken, requireRole };
