const { GraphQLScalarType } = require("graphql");
const { authorizeWithGithub } = require('./lib');
const fetch = require('node-fetch');
require("dotenv").config()

var users = [
  { "githubLogin": "mHattrup", "name": "Mike Hattrup" },
  { "githubLogin": "gPlake", "name": "Glen Plake" },
  { "githubLogin": "sSchmidt", "name": "Scot Schmidt" }
];

var photos = [
  {
    "id": "1",
    "name": "Dropping the Heart Chute",
    "description": "The heart chute is one of my favorite chutes",
    "category": "ACTION",
    "githubUser": "gPlake",
    "created": "3-28-1977"
  },
  {
    "id": "2",
    "name": "Enjoying the sunshine",
    "category": "SELFIE",
    "githubUser": "sSchmidt",
    "created": "1-2-1985"
  },
  {
    "id": "3",
    "name": "Gunbarrel 25",
    "description": "25 laps on gunbarrel today",
    "category": "LANDSCAPE",
    "githubUser": "sSchmidt",
    "created": "2018-04-15T19:09:57.308Z"
  }
];

var tags = [
  { "photoID": "1", "userID": "gPlake" },
  { "photoID": "1", "userID": "sSchmidt" },
  { "photoID": "2", "userID": "sSchmidt" },
  { "photoID": "3", "userID": "mHattrup" },
  { "photoID": "4", "userID": "gPlake" }
]

const resolvers = {
  Query: {
    me: (parent, args, { currentUser }) => currentUser,
    totalPhotos: (parent, args, { db }) =>
      db.collection('photos')
        .estimatedDocumentCount(),

    allPhotos: (parent, args, { db }) =>
      db.collection('photos')
        .find()
        .toArray(),
    
    totalUsers: (parent, args, { db }) =>
      db.collection('users')
        .estimatedDocumentCount(),

    allUsers: (parent, args, { db }) =>
      db.collection('users')
        .find()
        .toArray()
  },
  Mutation: {
    async postPhoto(parent, args, { db, currentUser, pubsub }) {
      if (!currentUser) {
        throw new Error('Only authorized users can post a photo')
      }
      const newPhoto = {
        ...args.input,
        userID: currentUser.githubLogin,
        created: new Date()
      }
      const { insertedIds } = await db.collection('photos').insert(newPhoto)
      newPhoto.id = insertedIds[0]

      pubsub.publish('photo-added', { newPhoto })
      return newPhoto
    },
    async githubAuth(parent, { code }, { db }) {
      // obtain data from github
      let {
        message,
        access_token,
        avatar_url,
        login,
        name
      } = await authorizeWithGithub({
        client_id: process.env.client_id,
        client_secret: process.env.client_secret,
        code 
      })
      // if message, then something went wrong
      if (message) {
        throw new Error(message)
      }
      let latestUserInfo = {
        name,
        githubLogin: login,
        githubToken: access_token,
        avatar: avatar_url
      }
      // add or update user record
      const { ops:[user] } = await db
        .collection('users')
        .replaceOne({ githubLogin: login }, latestUserInfo, { upsert: true })
      
      return { user, token: access_token }
    },
    addFakeUsers: async (root, {count}, {db, pubsub}) => {
      var randomUserApi = `https://randomuser.me/api/?results=${count}`

      var { results } = await fetch(randomUserApi)
        .then(res => res.json())

      var users = results.map(r => ({
        githubLogin: r.login.username,
        name: `${r.name.first} ${r.name.last}`,
        avatar: r.picture.thumbnail,
        githubToken: r.login.sha1
      }))

      await db.collection('users').insert(users)
      var newUsers = await db.collection('users')
        .find()
        .sort({ _id: -1 })
        .limit(count)
        .toArray()

      newUsers.forEach(newUser => pubsub.publish('user-added', { newUser }))
      return users
    },
    async fakeUserAuth(parent, { githubLogin }, { db }) {
      var user = await db.collection('users').findOne({ githubLogin })

      if (!user) {
        throw new Error(`Cannot find user with githubLogin "${githubLogin}"`)
      }

      return {
        token: user.githubToken,
        user
      }
    }
  },
  Subscription: {
    newPhoto: {
      subscribe: (parent, args, { pubsub }) => {
        pubsub.asyncIterator('photo-added')
      }
    },
    newUsers: {
      subscribe: (parent, args, { pubsub }) => {
        pubsub.asyncIterator('user-added')
      }
    }
  },
  Photo: {
    id: parent => parent.id.toString() || parent._id.toString(),
    url: parent => `/img/photos/${parent._id}.jpg`,
    postedBy: (parent, args, { db }) => 
      db.collection('users').findOne({ githubLogin: parent.userID }),
    taggedUsers: parent => tags
      .filter(tag => tag.photoID === parent.id)
      .map(tag => tag.userID)
      .map(userID => users.find(u => u.githubLogin === userID))

  },
  User: {
    postedPhotos: parent => {
      return photos.filter(p => p.githubUser === parent.githubLogin)
    },
    inPhotos: parent => tags
      .filter(tag => tag.userID === parent.id)
      .map(tag => tag.photoID)
      .map(photoID => photos.find(p => p.id === photoID))
  },
  DateTime: new GraphQLScalarType({
    name: 'DateTime',
    description: 'A valid date time value',
    parseValue: value => new Date(value),
    serialize: value => new Date(value).toISOString(),
    parseLiteral: ast => ast.value
  })
}

module.exports = resolvers;