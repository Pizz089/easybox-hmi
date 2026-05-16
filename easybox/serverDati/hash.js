var crypto = require('crypto');

console.log("TOKEN_SECRET="+crypto.randomBytes(64).toString('hex'));