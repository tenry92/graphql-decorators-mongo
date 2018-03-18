import {decorators} from '@tenry/graphql-decorators';

@decorators.input({name: 'MongoFilterInput'})
export class FilterInput {
  @decorators.field()
  field: string;

  @decorators.field()
  operator: string;

  @decorators.field('JSON')
  value: any;
}

@decorators.input({name: 'MongoOrderInput'})
export class OrderInput {
  @decorators.field()
  field: string;

  @decorators.field()
  order: string;
}
