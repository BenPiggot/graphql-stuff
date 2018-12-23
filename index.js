const { ApolloServer, PubSub } = require("apollo-server-express");
const express = require('express');
const expressPlayground = require("graphql-playground-middleware-express").default;
const { readFileSync } = require("fs");
const { MongoClient } = require("mongodb");
const { createServer } = require('http'); 
const path = require('path');
require("dotenv").config()

const typeDefs = readFileSync('./typeDefs.graphql', 'UTF-8');
const resolvers = require('./resolvers');

async function start() {
  const app = express();
  const MONGO_DB = process.env.DB_HOST;
  const pubsub = new PubSub();

  const client = await MongoClient.connect(
    MONGO_DB,
    { useNewUrlParser: true }
  )

  const db = client.db();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    engine: true,
    context: async ({ req, connection }) => {
      const githubToken = req ? req.headers.authorization : connection.context.Authorization
      const currentUser = await db.collection('users').findOne({ githubToken })
      return { db, currentUser, pubsub }
    }
  })

  server.applyMiddleware({ app })

  app.get('/', (req, res) => {
    res.end("Welcome the Photoshare API")
  })

  app.get('/playground', expressPlayground({ endpoint: '/graphql' }))

  app.use(
    '/assets/photos',
    express.static(path.join(__dirname, 'assets', 'photos'))
  )

  const httpServer = createServer(app)
  server.installSubscriptionHandlers(httpServer)

  httpServer.timeout = 5000

  httpServer.listen({ port: 4000 }, () =>
    console.log(`GraphQL Server running at http://localhost:4000${server.graphqlPath}`)
  )
};

start();
