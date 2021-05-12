/*eslint no-unused-vars: "warn"*/

const { resolveSchema } = require('@asymmetrik/node-fhir-server-core');
const { COLLECTION, CLIENT_DB } = require('../../constants');
const moment = require('moment-timezone');
const globals = require('../../globals');
const logger = require('@asymmetrik/node-fhir-server-core').loggers.get();

let getObservation = (base_version) => {
  return resolveSchema(base_version, 'Observation');
};

let getMeta = (base_version) => {
  return resolveSchema(base_version, 'Meta');
};

const findById = (args) =>
  new Promise((resolve, reject) => {
    logger.info('Observation >>> findById');

    let { base_version, id } = args;
    let Observation = getObservation(base_version);

    // Grab an instance of our DB and collection
    let db = globals.get(CLIENT_DB);
    let collection = db.collection(`${COLLECTION.OBSERVATION}_${base_version}`);
    // Query our collection for this observation
    collection.findOne({ id: id.toString() }, (err, obs) => {
      if (err) {
        logger.error('Error with Observation.findById: ', err);
        return reject(err);
      }
      if (obs) {
        resolve(new Observation(obs));
      }
      resolve();
    });
  });

const create = (args, { req }) =>
  new Promise((resolve, reject) => {
    logger.info('Observation >>> create');

    let resource = req.body;

    let { base_version } = args;

    // Grab an instance of our DB and collection (by version)
    let db = globals.get(CLIENT_DB);
    let collection = db.collection(`${COLLECTION.OBSERVATION}_${base_version}`);

    // Get current record
    let Observation = getObservation(base_version);
    let observation = new Observation(resource);

    // If no resource ID was provided, generate one.
    let id = getUuid(observation);

    // Create the resource's metadata
    let Meta = getMeta(base_version);
    observation.meta = new Meta({
      versionId: '1',
      lastUpdated: moment.utc().format('YYYY-MM-DDTHH:mm:ssZ'),
    });

    // Create the document to be inserted into Mongo
    let doc = JSON.parse(JSON.stringify(observation.toJSON()));
    Object.assign(doc, { id: id });

    // Create a clone of the object without the _id parameter before assigning a value to
    // the _id parameter in the original document
    let history_doc = Object.assign({}, doc);
    Object.assign(doc, { _id: id });

    collection.insertOne(doc, (err) => {
      if (err) {
        logger.error('Error with Observation.create: ', err);
        return reject(err);
      }

      // Save the resource to history
      let history_collection = db.collection(`${COLLECTION.OBSERVATION}_${base_version}_History`);

      return history_collection.insertOne(history_doc, (err2) => {
        if (err2) {
          logger.error('Error with ObservationHistory.create: ', err2);
          return reject(err2);
        }
        return resolve({ id: doc.id, resource_version: doc.meta.versionId });
      });
    });
  });

const update = (args, { req }) =>
  new Promise((resolve, reject) => {
    logger.info('Observation >>> update');

    let { base_version, id, resource } = args;

    // Grab an instance of our DB and collection
    let db = globals.get(CLIENT_DB);
    let collection = db.collection(`${COLLECTION.OBSERVATION}_${base_version}`);

    // Get current record
    // Query our collection for this observation
    collection.findOne({ id: id.toString() }, (err, data) => {
      if (err) {
        logger.error('Error with Observation.searchById: ', err);
        return reject(err);
      }

      let Observation = getObservation(base_version);
      let observation = new Observation(resource);

      if (data && data.meta) {
        let foundObs = new Observation(data);
        let meta = foundObs.meta;
        meta.versionId = `${parseInt(foundObs.meta.versionId) + 1}`;
        observation.meta = meta;
      } else {
        let Meta = getMeta(base_version);
        observation.meta = new Meta({
          versionId: '1',
          lastUpdated: moment.utc().format('YYYY-MM-DDTHH:mm:ssZ'),
        });
      }

      let cleaned = JSON.parse(JSON.stringify(observation));
      let doc = Object.assign(cleaned, { _id: id });

      collection.findOneAndUpdate({ id: id }, { $set: doc }, { upsert: true }, (err2, res) => {
        if (err2) {
          logger.error('Error with Observation.update: ', err2);
          return reject(err2);
        }

        // save to history
        let history_collection = db.collection(`${COLLECTION.OBSERVATION}_${base_version}_History`);

        let history_obs = Object.assign(cleaned, { id: id });

        return history_collection.insertOne(history_obs, (err3) => {
          if (err3) {
            logger.error('Error with ObservationHistory.create: ', err3);
            return reject(err3);
          }

          return resolve({
            id: id,
            created: res.lastErrorObject && !res.lastErrorObject.updatedExisting,
            resource_version: doc.meta.versionId,
          });
        });
      });
    });
  });

const remove = (args, context) =>
  new Promise((resolve, reject) => {
    logger.info('Observation >>> remove');

    let { base_version, id } = args;

    // Grab an instance of our DB and collection
    let db = globals.get(CLIENT_DB);
    let collection = db.collection(`${COLLECTION.OBSERVATION}_${base_version}`);

    collection.deleteOne({ id: id }, (err, _) => {
      if (err) {
        logger.error('Error with Observation.remove');
        return reject({
          // Must be 405 (Method Not Allowed) or 409 (Conflict)
          // 405 if you do not want to allow the delete
          // 409 if you can't delete because of referential
          // integrity or some other reason
          code: 409,
          message: err.message,
        });
      }

      // delete history as well.  You can chose to save history.  Up to you
      let history_collection = db.collection(`${COLLECTION.OBSERVATION}_${base_version}_History`);
      return history_collection.deleteMany({ id: id }, (err2) => {
        if (err2) {
          logger.error('Error with Observation.remove');
          return reject({
            // Must be 405 (Method Not Allowed) or 409 (Conflict)
            // 405 if you do not want to allow the delete
            // 409 if you can't delete because of referential
            // integrity or some other reason
            code: 409,
            message: err2.message,
          });
        }

        return resolve({ deleted: _.result && _.result.n });
      });
    });
  });

const findByVersionId = (args, context) =>
  new Promise((resolve, reject) => {
    logger.info('Observation >>> searchByVersionId');

    let { base_version, id, version_id } = args;

    let Observation = getObservation(base_version);

    let db = globals.get(CLIENT_DB);
    let history_collection = db.collection(`${COLLECTION.OBSERVATION}_${base_version}_History`);

    // Query our collection for this observation
    history_collection.findOne(
      { id: id.toString(), 'meta.versionId': `${version_id}` },
      (err, obs) => {
        if (err) {
          logger.error('Error with Observation.findByVersionId: ', err);
          return reject(err);
        }

        if (obs) {
          resolve(new Observation(obs));
        }

        resolve();
      }
    );
  });

module.exports = {
  searchById: findById,
  searchByVersionId: findByVersionId,
  create: create,
  update: update,
  remove: remove
};