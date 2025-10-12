// routes/demoSim.js
const express = require('express');
const router = express.Router();

/*
  SAFE demonstration endpoint.
  - Local/staging only.
  - Does NOT execute any DB queries.
  - Returns a JSON object showing:
      - intended: how server *should* treat inputs (safe view)
      - constructedQuery: direct spread of req.body (what insecure code would pass to DB)
*/

function buildQueryFromLogin(body = {}) {
    const b = (body && typeof body === 'object') ? body : {};
  
    const safeEmail =
      typeof b.email === 'string'
        ? b.email.trim().toLowerCase()
        : (b.email ?? null);
  
    const safePassword =
      typeof b.password === 'string'
        ? `[REDACTED_LENGTH:${b.password.length}]`
        : (b.password ?? null);
  
    return {
      intended: { email: safeEmail, password: safePassword },
      constructedQuery: { ...b },
    };
  }
  

router.post('/simulate-login-query', (req, res) => {
  try {
    const demo = buildQueryFromLogin(req.body);

    // Log to console for instructor evidence (local only)
    console.warn('[DEMO-SIM] constructedQuery preview:', {
      time: new Date().toISOString(),
      path: req.originalUrl,
      ip: req.ip,
      constructedQueryPreview: demo.constructedQuery,
    });

    // Return the simulated query object to the caller (safe — no DB ops)
    return res.json({
      message: 'Simulation: server built this query object from your request (no DB interaction).',
      simulated: demo,
    });
  } catch (err) {
    console.error('Demo sim error', err && err.stack ? err.stack : err);
    return res.status(500).json({ message: 'Simulation error.' });
  }
});

module.exports = router;
