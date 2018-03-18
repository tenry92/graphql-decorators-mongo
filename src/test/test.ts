import {assert} from 'chai';
import * as graphql from 'graphql';
import {Db, MongoClient} from 'mongodb';

import {decorators} from '@tenry/graphql-decorators';
import {Manager, name} from '..';

@decorators.entity()
@name('user')
class TestUserEntity {
  @decorators.field('JSON')
  data: Object;

  @decorators.field({list: TestUserEntity})
  friends: TestUserEntity[];

  @decorators.field('ID')
  id: string;

  @decorators.field()
  name: string;
}

describe('Manager', function() {
  describe('#createSchema()', function() {
    it('should return an instance of GraphQLSchema', function() {
      const schema = new Manager().createSchema();
      assert.instanceOf(schema, graphql.GraphQLSchema);
    });
  });

  describe('#registerEntity()', function() {
    it('should add the controller to the schema', function() {
      const manager = new Manager();
      manager.registerEntity(TestUserEntity);
      const schema = manager.createSchema();
      assert.instanceOf(schema, graphql.GraphQLSchema);
    });
  });
});

describe('mongo', async function() {
  const idSymbol = Symbol('id');
  const mock = {
    users: [
      {_id: '1', name: 'tenry', friends: ['2']},
      {_id: '2', name: 'alica'},
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
    manager.registerEntity(TestUserEntity);
    schema = manager.createSchema();
  });

  after(async function() {
    await db.dropDatabase();
    await mongo.close();
  });

  describe('users', function() {
    it('should give a list of all users', async function() {
      const response = await graphql.graphql(schema, `
        query {
          users {
            name
          }
        }
      `);

      assert.deepEqual(response.data.users, mock.users.map(user => ({name: user.name})));
    });
  });

  describe('users by id (2)', function() {
    it('should give a list of all users', async function() {
      const response = await graphql.graphql(schema, `
        query {
          users(filter: [{field: "_id", operator: "$eq", value: "2"}]) {
            name
          }
        }
      `);

      assert.deepEqual(response.data.users, mock.users.filter(user => user[idSymbol] == '2').map(user => ({name: user.name})));
    });
  });

  describe('users by name (tenry)', function() {
    it('should give a list of all users', async function() {
      const response = await graphql.graphql(schema, `
        query {
          users(filter: [{field: "name", operator: "$eq", value: "tenry"}]) {
            name
          }
        }
      `);

      assert.deepEqual(response.data.users, mock.users.filter(user => user.name == 'tenry').map(user => ({name: user.name})));
    });
  });

  describe('users by name (dummy)', function() {
    it('should give a list of all users', async function() {
      const response = await graphql.graphql(schema, `
        query {
          users(filter: [{field: "name", operator: "$eq", value: "dummy"}]) {
            name
          }
        }
      `);

      assert.deepEqual(response.data.users, mock.users.filter(user => user.name == 'dummy').map(user => ({name: user.name})));
    });
  });

  describe('users sorted by name asc', function() {
    it('should give a list of all users', async function() {
      const response = await graphql.graphql(schema, `
        query {
          users(order: [{field: "name", order: "asc"}]) {
            name
          }
        }
      `);

      assert.deepEqual(response.data.users, mock.users.sort((a, b) => a.name < b.name ? -1 : 1).map(user => ({name: user.name})));
    });
  });

  describe('users sorted by name desc', function() {
    it('should give a list of all users', async function() {
      const response = await graphql.graphql(schema, `
        query {
          users(order: [{field: "name", order: "desc"}]) {
            name
          }
        }
      `);

      assert.deepEqual(response.data.users, mock.users.sort((a, b) => a.name > b.name ? -1 : 1).map(user => ({name: user.name})));
    });
  });

  describe('friends', function() {
    it('should give a list of all users', async function() {
      const response = await graphql.graphql(schema, `
        query {
          users(filter: [{field: "name", operator: "$eq", value: "tenry"}]) {
            name
            friends {
              name
            }
          }
        }
      `);

      // console.log(response.data.users);
      assert.deepEqual(response.data.users, mock.users
        .filter(user => user.name == 'tenry')
        .map(user => ({
          name: user.name,
          friends: mock.users.filter(friend => friend.name == 'alica').map(friend => ({name: friend.name})),
        })),
      );
    });
  });
});
