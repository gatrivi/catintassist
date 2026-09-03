/**
 * Dev proxy (v4.86.1) — routes /api/translate to the local gateway server
 * (`npm run gateway`, port 59210) so translation works under `npm start`.
 * In production the request hits the real Vercel /api endpoint instead.
 */
const http = require('http');

module.exports = function setupProxy(app) {
  if (process.env.NODE_ENV !== 'development') return;
  app.use('/api/translate', (req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const upstream = http.request(
        {
          host: '127.0.0.1',
          port: process.env.TRANSLATE_GATEWAY_PORT || 59210,
          path: '/api/translate',
          method: req.method,
          headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
          timeout: 8000,
        },
        (up) => {
          res.writeHead(up.statusCode, up.headers);
          up.pipe(res);
        },
      );
      upstream.on('error', () => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'gateway_down', hint: 'Run: npm run gateway' }));
      });
      upstream.end(body);
    });
  });
};
