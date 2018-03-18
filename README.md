# @tenry/graphql-decorators-mongo

This package provides useful TypeScript decorators for creating class-based
entities, persisted to a mongo database and queryable and manipulable using the
GraphQL query language.

It is based on the `@tenry/graphql-decorators` package.


## Example

~~~ts
// import the libraries
import {MongoClient} from 'mongodb';
import {decorators} from '@tenry/graphql-decorators';
import {Manager, name} from '@tenry/graphql-decorators-mongo';

// define an entity
@name('user')
class User {
  @decorators.field('ID')
  id: string;

  // primitive types like string or number is automatically detected,
  // if the emitDecoratorMetadata flag is enabled
  @decorators.field()
  name: string;

  @decorators.field('JSON')
  data: Object;

  // use this syntax, if the data type is an array of something
  @decorators.field({list: UserType})
  friends: UserType[];
}

// now set everything up
const mongo = await MongoClient.connect('mongodb://localhost');
const db = mongo.db('my_database');
const manager = new Manager(db);

// register all available entities
manager.registerEntity(User);

// get GraphQL schema
const schema = manager.createSchema();

// now do whatever you would do with a GraphQL schema
graphql(schema, someAwesomeGraphqlQuery).then(response => {
  console.log(response);
});

// or (using express and express-graphql):
const app = express();

app.use('/graphql', graphqlHTTP({
  schema,
}));

app.listen(8080);
~~~

Using this example the library would create the following GraphQL schema:

~~~graphql
input MongoFilterInput {
  field: String
  operator: String
  value: JSON
}

input MongoOrderInput {
  field: String
  order: String
}

type Mutation {
  addUser(user: TestUserEntityInput): TestUserEntityType
  updateUser(id: ID, user: TestUserEntityInput): TestUserEntityType
  removeUser(id: ID): TestUserEntityType
}

type Query {
  users(filter: [MongoFilterInput], order: [MongoOrderInput], limit: Int, offset: Int): [TestUserEntityType]
}

input TestUserEntityInput {
  data: JSON
  friends: [TestUserEntityInput]
  id: ID
  name: String
}

type TestUserEntityType {
  data: JSON
  friends: [TestUserEntityType]
  id: ID
  name: String
}
~~~


## Installation and Usage

Use `npm` to install the package:

~~~sh
$ npm install graphql graphql-type-json mongodb @tenry/graphql-decorators @tenry/graphql-decorators-mongo
~~~

Now *import* the `Manager`, the `name` decorator along with the decorators from
`@tenry/graphql-decorators`:

~~~ts
import {Manager, name} from '@tenry/graphql-decorators-mongo';
import {decorators} from '@tenry/graphql-decorators';

import {MongoClient} from 'mongodb';

const mongo = await MongoClient.connect('mongodb://localhost');
const db = mongo.db('my_database');

const manager = new Manager(db);

// define entities here
// register entities to the manager via manager.registerEntity(MyEntity); here

// retrieve GraphQL schema
const schema = manager.createSchema();
~~~


## License

@tenry/graphql-decorators-mongo is licensed under the MIT License.
