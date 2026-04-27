function registerSystemRoutes(app) {
  app.get('/healthz', (req, res) => {
    res.json({ ok: true, status: 'healthy' });
  });

  app.get('/sync/version', (req, res) => {
    res.json({ version: 0, status: 'deprecated, please access /vaults' });
  });
}

module.exports = {
  registerSystemRoutes,
};
