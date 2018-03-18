import 'reflect-metadata';

import * as pluralize from 'pluralize';

export const nameSymbol = Symbol('name');

export function name(singular: string, plural = pluralize(singular)) {
  return Reflect.metadata(nameSymbol, {singular, plural});
}
