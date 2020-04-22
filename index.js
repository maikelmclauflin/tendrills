const { Pool } = require('pg')
const MongoClient = require('mongodb')
const RSMQ = require('rsmq')
const Redis = require('redis')
module.exports = {
  connect,
  mongo,
  postgres,
  disconnect
}

async function disconnect(connections) {
  if (connections.mongoClient) {
    console.log('disconnecting mongo')
    connections.mongoClient.close()
  }
  if (connections.postgres) {
    console.log('disconnecting postgres')
    connections.postgres.release()
  }
  if (connections.redis) {
    console.log('disconnecting redis')
    await connections.redis.quit()
  }
  if (connections.rsmq) {
    console.log('disconnecting rsmq')
    await connections.rsmq.quit()
  }
}

async function redis(redisURL) {
  if (redisURL) {
    return {
      redis: Redis.createClient({
        url: redisURL
      })
    }
  }
}

async function rsmq({
  url
}, redisClient) {
  const rc = await redisClient
  const previouslySetupRedisClient = rc && rc.redis
  let client = previouslySetupRedisClient || (url && await redis(url))
  if (client) {
    client = (client.redis || client)
    return {
      redis: client,
      rsmq: new RSMQ({
        client
      })
    }
  }
}

async function connect(args = {}) {
  const redisPromise = redis(args.redis)
  const waiting = await Promise.all([
    postgres(args.postgres),
    mongo(args.mongo),
    redisPromise,
    rsmq(args.rsmq, redisPromise)
  ])
  return Object.assign.apply({}, waiting)
}

async function mongo ({
  url,
  dbName
} = {}) {
  if (url) {
    let mongoClient = url
    let mongoDBName = dbName
    if (typeof url === 'string') {
      mongoClient = await connectMongo(url)
      mongoDBName = dbName || pathname(url)
    }
    const mongo = mongoClient.db(mongoDBName)
    return {
      mongo,
      mongoClient
    }
  }
}

async function postgres ({
  url,
  ssl = {
    rejectUnauthorized: false
  }
} = {}) {
  if (url) {
    const postgresPool = new Pool({
      connectionString: url,
      ssl
    })
    return {
      postgresPool,
      postgres: await postgresPool.connect()
    }
  }
}

function connectMongo({
  url
} = {}) {
  return new Promise((resolve, reject) => {
    return MongoClient.connect(url, {
      useUnifiedTopology: true,
      useNewUrlParser: true
    }, (err, client) => {
      if (err) {
        reject(err)
      } else {
        resolve(client)
      }
    })
  })
}

function pathname (url) {
  const shardSplits = url.split(',')
  const shard = shardSplits[shardSplits.length - 1]
  const pathnames = shard.split('/')
  const pathnameAndAfter = pathnames[pathnames.length - 1]
  const noQuerySplit = pathnameAndAfter.split('?')
  return noQuerySplit[0]
}
