import {ApolloLink, Observable} from 'apollo-link';
import EventSource from 'eventsource';
import {print} from 'graphql/language/printer';
import isString from 'lodash.isstring';
import isObject from 'lodash.isobject';

let numSubs = 0;

export class SubscriptionClient {
  constructor(url, httpOptions) {
    this.httpOptions = httpOptions;
    this.url = url;
    this.subscriptions = {};
  }

  subscribe(options, handler) {
    const {timeout, headers} =
      typeof this.httpOptions === 'function'
        ? this.httpOptions()
        : this.httpOptions;

    const {query, variables, operationName, context} = options;
    if (!query) throw new Error('Must provide `query` to subscribe.');
    if (!handler) throw new Error('Must provide `handler` to subscribe.');
    if (
      (operationName && !isString(operationName)) ||
      (variables && !isObject(variables))
    )
      throw new Error(
        'Incorrect option types to subscribe. `operationName` must be a string, and `variables` must be an object.'
      );

    let subId = numSubs;
    numSubs++;

    let queryString = Object.keys(options)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(options[key])}`)
    .join('&');
    const evtSource = new EventSource(`${this.url}?${queryString}`, {
      headers
    });
    this.subscriptions[subId] = {options, handler, evtSource};

    evtSource.onmessage = e => {
      const message = JSON.parse(e.data);
      switch (message.type) {
        case 'SUBSCRIPTION_DATA':
          this.subscriptions[subId].handler(message.data);
          break;
        case 'KEEPALIVE':
          break;
      }
    };
    evtSource.onerror = e => {
      console.error(
        `EventSource connection failed for subscription ID: ${subId}`
      );
    };
    return Promise.resolve(subId);
  }

  unsubscribe(subId) {
    if (this.subscriptions[subId] && this.subscriptions[subId].evtSource) {
      this.subscriptions[subId].evtSource.close();
    }
    delete this.subscriptions[subId];
  }

  unsubscribeAll() {
    Object.keys(this.subscriptions).forEach(subId => {
      this.unsubscribe(parseInt(subId));
    });
  }
}

export function addGraphQLSubscriptions(networkInterface, spdyClient) {
  return Object.assign(networkInterface, {
    subscribe(request, handler) {
      return spdyClient.subscribe(
        {
          query: print(request.query),
          variables: request.variables
        },
        handler
      );
    },
    unsubscribe(id) {
      spdyClient.unsubscribe(id);
    }
  });
}

export class SSELink extends ApolloLink {
  constructor(paramsOrClient) {
    super();
    this.subscriptionClient = paramsOrClient;
  }

  request(operation) {
    return new Observable(observer => {
      const subscription = this.subscriptionClient.subscribe(
        Object.assign(operation, {query: print(operation.query)}),
        data => observer.next({data})
      );

      return () => this.subscriptionClient.unsubscribe(subscription);
    });
  }
}
