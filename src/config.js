const { VERSIONS } = require('@asymmetrik/node-fhir-server-core').constants;
const env = require('var');

/**
 * @name mongoConfig
 * @summary Configurations for our Mongo instance
 */
let mongoConfig = {
  connection: `mongodb+srv://${env.MONGO_USER}:${env.MONGO_PASS}@${env.MONGO_HOSTNAME}`,
  db_name: env.MONGO_DB_NAME,
  options: {
    auto_reconnect: true,
    retryWrites: true,
    w: 'majority'
  },
};

let whitelist_env = (env.WHITELIST && env.WHITELIST.split(',').map((host) => host.trim())) || false;
let whitelist = whitelist_env && whitelist_env.length === 1 ? whitelist_env[0] : whitelist_env;

/**
 * @name fhirServerConfig
 * @summary @asymmetrik/node-fhir-server-core configurations.
 */
let fhirServerConfig = {
  auth: {
    resourceServer: env.RESOURCE_SERVER,
		type: 'smart',
		// Define our strategy here, for smart to work, we need the name to be bearer
		// and to point to a service that exports a Smart on FHIR compatible strategy
		strategy: {
			name: 'bearer',
			service: './src/strategies/smart.strategy.js'
		}
  },
  server: {
    port: env.PORT || env.SERVER_PORT,
    corsOptions: {
      maxAge: 86400,
      origin: whitelist,
    },
  },
  logging: {
    level: env.LOGGING_LEVEL,
  },
  security: [
    {
      url: 'authorize',
      valueUri: `${env.AUTH_SERVER_URI}/auth`,
    },
    {
      url: 'token',
      valueUri: `${env.AUTH_SERVER_URI}/token`,
    },
  ],
  profiles: {
    Observation: {
      service: './src/services/observation/observation.service.js',
      versions: [VERSIONS['4_0_0']],
    },
    Patient: {
      service: './src/services/patient/patient.service.js',
      versions: [VERSIONS['4_0_0']],
    },
  },
};

module.exports = {
  fhirServerConfig,
  mongoConfig,
};
