const { registerApprovePairingSessionRoute } = require('./approve_session_route');
const { registerCreatePairingSessionRoute } = require('./create_session_route');
const { registerGetPairingBundleRoute } = require('./get_bundle_route');
const { registerGetPairingSessionRoute } = require('./get_session_route');
const { registerJoinPairingSessionRoute } = require('./join_session_route');

function registerPairingRoutes(app, context) {
  registerCreatePairingSessionRoute(app, context);
  registerJoinPairingSessionRoute(app, context);
  registerGetPairingSessionRoute(app, context);
  registerApprovePairingSessionRoute(app, context);
  registerGetPairingBundleRoute(app, context);
}

module.exports = {
  registerPairingRoutes,
};
