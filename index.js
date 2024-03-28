const fp = require('fastify-plugin')
const Sequelize = require('sequelize')
const { DataTypes } = require('sequelize')

const { readdirSync, statSync } = require('fs')
const path = require('path')
const url = require('url');
const env = process.env.NODE_ENV || 'development';

const defaultConfig = {
  dialect: 'sqlite',
  modelsPath: './models',
  name: 'models',

  username: null,
  password: null
}

async function sequelizePlugin (fastify, opts) {
  const { name, ...userConfig } = opts
  const configByEnv = userConfig[env]
  const { modelsPath, ...config } = { ...defaultConfig, ...configByEnv }

  if(!config.username) delete config.username
  if(!config.password) delete config.password

  let files = {}
  let db = {}
  let sequelize

  sequelize = new Sequelize(config.database, config.username, config.password, config)


  if(statSync(modelsPath, { throwIfNoEntry: false })){
    files = readdirSync(modelsPath)
    .filter(file => (file.indexOf('.') !== 0) && (file.slice(-3) === '.js'))
  }

  for await (const file of files) {		
			const model = await import(url.pathToFileURL(path.resolve("models", `${file}`)).href);
			if (model.default) {
				const namedModel = await model.default(sequelize, DataTypes);
				db[namedModel.name] = namedModel;
			}
	}

	Object.keys(db).forEach((modelName) => {
		if (modelName) {
			if (db[modelName].associate) {
				db[modelName].associate(db);
			}
		}
	});

	db.sequelize = sequelize;
	db.Sequelize = Sequelize;

  fastify.decorate(name || defaultConfig.name, db)

  return db.sequelize.sync({ alter: true, logging: false })
}

module.exports = fp(sequelizePlugin)
