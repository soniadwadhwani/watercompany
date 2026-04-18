const { initDb } = require('../database');
const app = require('../server');

let initialized = false;

module.exports = async (req, res) => {
  if (!initialized) {
    await initDb();
    initialized = true;
  }
  return app(req, res);
};
