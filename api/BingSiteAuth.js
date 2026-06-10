// Serves Bing Webmaster verification XML file
module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(`<?xml version="1.0"?>
<users>
  <user>148DCC9206B1EAB68990C712CBC90D1D</user>
</users>`);
};
