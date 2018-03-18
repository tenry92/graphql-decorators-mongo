import 'reflect-metadata';

import {GraphQLSchema} from 'graphql';

import {Manager as GraphqlManager, decorators, utils} from '@tenry/graphql-decorators';
import {Db} from 'mongodb';

import {camel, lower, pascalCase} from 'change-case';

import {nameSymbol} from './decorators';
import * as types from './types';

const controllerSymbol = Symbol('controller');
const collectionSymbol = Symbol('collection');
const listSymbol = Symbol('list');

const controllersByEntityName = new Map();

function referenceResolver(reference: string | string[], controller: Object, context: Context) {
  return async () => {
    let operator = '$eq';
    if(Array.isArray(reference)) {
      operator = '$in';
    }

    const result = await controller[listSymbol]({
      filter: [
        {
          field: '_id',
          operator: operator,
          value: reference,
        },
      ],
    }, context);

    if(Array.isArray(reference)) {
      return result;
    }

    return result[0];
  };
}

type CollectionName = string;
type Document = Object;

interface Context {
  cache: Map<CollectionName, Map<any, Document>>;
}

export default class Manager {
  private graphqlManager: GraphqlManager;
  private mongo: Db;

  constructor(mongo?: Db) {
    this.graphqlManager = new GraphqlManager();
    this.mongo = mongo;
  }

  createSchema() {
    return this.graphqlManager.createSchema();
  }

  registerController(controller: Object) {
    this.graphqlManager.registerObject(controller);
  }

  registerEntity(entity: Function) {
    if(!Reflect.hasMetadata(nameSymbol, entity)) {
      throw new Error('no name defined for entity');
    }

    const {singular, plural} = Reflect.getMetadata(nameSymbol, entity);
    const mongo = this.mongo;
    const collectionName = plural;

    class Controller {
      @decorators.query({
        parameters: {
          filter: {
            list: types.FilterInput,
          },
          order: {
            list: types.OrderInput,
          },
          limit: {
            type: 'Int',
          },
          offset: {
            type: 'Int',
          },
        },
        returnType: entity,
        list: true,
      })
      async [camel(plural)]({filter, order, limit, offset}, context?: Context) {
        if(context && typeof context == 'object' && !('cache' in context)) {
          (<Context> context).cache = new Map();
        }

        if(!context || typeof context != 'object') {
          context = {
            cache: new Map(),
          };
        }

        const query = {};
        const sort = [];

        if(Array.isArray(filter)) {
          for(const {field, operator, value} of filter) {
            query[field] = {[operator]: value};
          }

          if(filter.length == 1 && typeof query['_id'] == 'object') {
            if(query['_id']['$eq']) {
              if(context.cache.has(collectionName)) {
                const cachedDocument = context.cache.get(collectionName).get(query['_id']['$eq']);

                if(cachedDocument) {
                  return [cachedDocument];
                }
              }
            }
          }
        }

        if(Array.isArray(order)) {
          for(const {field, order: sortOrder} of order) {
            if(typeof sortOrder == 'string' && sortOrder.toLowerCase() == 'desc') {
              sort.push([field, -1]);
            } else {
              sort.push([field, 1]);
            }
          }
        }

        const pipeline: Object[] = [
          {$match: query},
          ...sort.map(([field, sortOrder]) => ({$sort: {[field]: sortOrder}})),
        ];

        if(limit) {
          pipeline.push({$limit: limit});
        }

        if(offset) {
          pipeline.push({$skip: offset});
        }

        const fields = Reflect.getMetadata(decorators.fieldsSymbol, entity);
        const refFields = {};

        for(const [fieldName, declaredField] of Object.entries(fields)) {
          const baseType = (<any> declaredField).list || (<any> declaredField).type;

          if(typeof baseType == 'function' && Reflect.hasMetadata(controllerSymbol, baseType)) {
            refFields[fieldName] = Reflect.getMetadata(controllerSymbol, baseType);
          } else if(controllersByEntityName.has(baseType)) {
            refFields[fieldName] = controllersByEntityName.get(baseType);
          }
        }

        const result = await mongo.collection(collectionName).find(query, {
          limit: limit || 0,
          skip: offset || 0,
          sort,
        }).toArray();

        if(Object.getOwnPropertyNames(refFields).length > 0) {
          for(const item of result) {
            for(const [fieldName, refController] of Object.entries(refFields)) {
              const reference = item[fieldName];
              item[fieldName] = referenceResolver(reference, refController, context);
            }
          }
        }

        if(!context.cache.has(collectionName)) {
          context.cache.set(collectionName, new Map());
        }

        const cache = context.cache.get(collectionName);

        for(const item of result) {
          cache.set(item._id, item);
        }

        return result;
      }

      @decorators.mutation({
        parameters: {
          [lower(singular)]: {
            type: entity,
          },
        },
        returnType: entity,
      })
      [`add${pascalCase(singular)}`](parameters) {
        return {};
      }

      @decorators.mutation({
        parameters: {
          id: {
            type: 'ID',
          },
          [lower(singular)]: {
            type: entity,
          },
        },
        returnType: entity,
      })
      [`update${pascalCase(singular)}`](parameters) {
        return {};
      }

      @decorators.mutation({
        parameters: {
          id: {
            type: 'ID',
          },
        },
        returnType: entity,
      })
      [`remove${pascalCase(singular)}`](parameters) {
        return {};
      }
    }

    const controller = new Controller();
    controller[listSymbol] = controller[camel(plural)];
    controller[collectionSymbol] = collectionName;
    controllersByEntityName.set(entity.name, controller);
    this.graphqlManager.registerObject(controller);
    Reflect.defineMetadata(controllerSymbol, controller, entity);
  }
}
