const smartStrategy = require('@asymmetrik/sof-strategy');

module.exports.strategy = smartStrategy({
	introspectionUrl: process.env.INTROSPECTION_URL,
	clientSecret: process.env.CLIENT_SECRET,
	clientId: process.env.CLIENT_ID
});
