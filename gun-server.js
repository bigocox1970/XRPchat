// Local Gun.js P2P server for testing
const Gun = require('gun');
const port = 8080;

// Create Gun server
const gun = Gun({
  web: require('http').createServer().listen(port),
  peers: []
});

console.log(`🔫 Gun.js P2P server running on http://localhost:${port}/gun`);
console.log('Both browsers can now connect to this local relay for P2P testing');
console.log('Press Ctrl+C to stop the server');