import * as pg from 'pg'
import * as mongodb from 'mongodb'
import * as RedisSMQ from 'rsmq'
import * as Redis from 'redis'

interface Disconnectable {
  disconnect(): Promise<void>
}

type Connectable = (options: object) => Promise<any>

const conns = {
  psql,
  mongo,
  redis,
  rsmq
} as { [key: string]: Connectable }

export {
  connect,
  mongo,
  psql,
  redis,
  rsmq,
  disconnect
}

async function disconnect(connections: { [key: string]: Disconnectable }): Promise<void[]> {
  return Promise.all(Object.keys(connections).map((key: string) =>
    connections[key].disconnect()
  ))
}

async function redis({
  url: redisURL
}: { url?: string }): Promise<void | { redis: Redis.RedisClient }> {
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
}: { url?: string }): Promise<void | { redis: Redis.RedisClient, rsmq: RedisSMQ }> {
  const client = url && await redis({ url })
  if (client) {
    const redisClient = client.redis
    return {
      redis: redisClient,
      rsmq: new RedisSMQ.default({
        client: redisClient
      } as RedisSMQ.ConstructorOptions)
    }
  }
}

async function connect(args: { [key: string]: { type: string, options: any } } = {}): Promise<{ [key: string]: any }> {
  const connections = await Promise.all(Object.keys(args).map(async (key) => {
    const arg = args[key]
    if (!conns.hasOwnProperty(arg.type)) {
      return { [key]: null }
    }
    const connected = await (conns[arg.type] as Connectable)(arg.options)
    return { [key]: connected }
  }))
  const obj = {}
  return Object.assign.apply({}, [obj, ...connections])
}

async function mongo ({
  url,
  dbName
}: { url?: string, dbName?: string } = {}): Promise<void | {mongo?:mongodb.Db | null, mongoClient?: mongodb.MongoClient | null}> {
  if (url && typeof url === 'string') {
    const mongoClient = await connectMongo({ url })
    const mongoDBName = dbName || pathname(url)
    const mongoDB = mongoClient.db(mongoDBName)
    return {
      mongo: mongoDB,
      mongoClient
    }
  }
  return
}

async function psql ({
  url,
  ssl = {
    rejectUnauthorized: false
  }
}: { url?: string, ssl?: boolean | {rejectUnauthorized: boolean} } = {}): Promise<void | { postgres: pg.PoolClient, postgresPool: pg.Pool }> {
  if (url) {
    const postgresPool = new pg.Pool({
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
}: { url?: string } = {}): Promise<mongodb.MongoClient> {
  return new Promise((resolve, reject) => {
    return mongodb.connect(url as string, {
      useUnifiedTopology: true,
      useNewUrlParser: true
    }, (err: Error, client: mongodb.MongoClient) => {
      if (err) {
        reject(err)
      } else {
        resolve(client)
      }
    })
  })
}

function pathname (url: string) {
  const shardSplits = url.split(',')
  const shard = shardSplits[shardSplits.length - 1]
  const pathnames = shard.split('/')
  const pathnameAndAfter = pathnames[pathnames.length - 1]
  const noQuerySplit = pathnameAndAfter.split('?')
  return noQuerySplit[0]
}
