import {assert} from 'chai';
import * as graphql from 'graphql';
import {Db, MongoClient} from 'mongodb';

import {decorators} from '@tenry/graphql-decorators';
import {Manager, name} from '..';

// @decorators.entity()
@name('publisher')
class Publisher {
  // @decorators.field({list: 'Game'})
  games: Game[];

  @decorators.field()
  name: string;
}

@decorators.entity()
@name('developer')
class Developer {
  @decorators.field({list: 'Game'})
  games: Game[];

  @decorators.field()
  name: string;
}

@decorators.entity()
@name('game')
class Game {
  @decorators.field()
  developer: Developer;

  @decorators.field()
  publisher: Publisher;

  @decorators.field()
  title: string;

  @decorators.field()
  year: number;
}

// deferred decoration for cyclic references
// decorators.field(String)(Publisher.prototype, 'name');
decorators.field({list: Game})(Publisher.prototype, 'games');
decorators.entity()(Publisher);

@decorators.entity()
@name('user')
class User {
  @decorators.field()
  favoriteGame: Game;

  @decorators.field()
  name: string;
}

describe('gamedb', function() {
  const idSymbol = Symbol('id');
  const mock = {
    games: [
      {_id: '1', title: 'Super Mario 64', year: 1996, publisher: '3', developer: '4'},
      {_id: '2', title: 'Banjo-Kazooie', year: 1998, publisher: '3', developer: '5'},
    ],
    publishers: [
      {_id: '3', name: 'Nintendo', games: ['1']},
    ],
    developers: [
      {_id: '4', name: 'Nintendo EAD', games: ['1']},
      {_id: '5', name: 'Rare', games: ['2']},
    ],
    users: [
      {name: 'tenry', favoriteGame: '2'},
    ],
  };

  let mongo: MongoClient;
  let db: Db;
  let manager: Manager;
  let schema: graphql.GraphQLSchema;

  before(async function() {
    mongo = await MongoClient.connect('mongodb://localhost');
    db = mongo.db('graphql_decorators_mongo_test');

    for(const collectionName of Object.keys(mock)) {
      const collection = await db.collection(collectionName);
      await collection.insertMany(mock[collectionName]);

      mock[collectionName].forEach(doc => {
        doc[idSymbol] = doc._id;
        delete doc._id;
      });
    }

    manager = new Manager(db);
    manager.registerEntity(Game);
    manager.registerEntity(Publisher);
    manager.registerEntity(Developer);
    manager.registerEntity(User);
    schema = manager.createSchema();
  });

  after(async function() {
    await db.dropDatabase();
    await mongo.close();
  });

  describe('games and tenry\'s favorite game', function() {
    it('should give a list publishers, games and users', async function() {
      const response = await graphql.graphql(schema, `
        query {
          publishers {
            name
            games {
              title
            }
          }

          games {
            title
            year
            publisher {
              name
            }
            developer {
              name
              games {
                title
              }
            }
          }

          users(filter: [{field: "name", operator: "$eq", value: "tenry"}]) {
            name
            favoriteGame {
              title
              year
            }
          }
        }
      `, undefined, {});
      assert.deepEqual(response.data, {
        publishers: [
          {
            name: 'Nintendo',
            games: [
              {title: 'Super Mario 64'},
            ],
          },
        ],
        games: [
          {
            title: 'Super Mario 64',
            year: 1996,
            publisher: {name: 'Nintendo'},
            developer: {
              name: 'Nintendo EAD',
              games: [
                {title: 'Super Mario 64'},
              ],
            },
          },
          {
            title: 'Banjo-Kazooie',
            year: 1998,
            publisher: {name: 'Nintendo'},
            developer: {
              name: 'Rare',
              games: [
                {title: 'Banjo-Kazooie'},
              ],
            },
          },
        ],
        users: [
          {
            name: 'tenry',
            favoriteGame: {title: 'Banjo-Kazooie', year: 1998},
          },
        ],
      });
    });
  });
});
