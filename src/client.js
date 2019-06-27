import {ApolloLink, Observable} from 'apollo-link';
import {print} from 'graphql/language/printer';
import {NativeEventSource, EventSourcePolyfill} from 'event-source-polyfill';

const EventSource = NativeEventSource || EventSourcePolyfill;

export class SubscriptionClient {
  constructor(url) {
    this._url = url;
    this._subscriptions = {};
    this._numSubscriptions = 0;
  }

  subscribe(options, handler) {
    let subID = this._numSubscriptions++;

    let queryString = Object.keys(options)
      .map(key => `${encodeURIComponent(key)}=${toQueryParam(options[key])}`)
      .join('&');

    const evtSource = new EventSource(`${this._url}?${queryString}`);
    this._subscriptions[subID] = {options, handler, evtSource};

    evtSource.onmessage = event => {
      const parsed = JSON.parse(event.data);
      this._subscriptions[subID].handler(null, parsed);
    };
    evtSource.onerror = event => {
      console.warn(
        `EventSource connection dropped for subscription ID ${subID}`, event
      );
      // Don't do anything other than log it, otherwise Apollo will unsubscribe when we want the
      // EventSource to auto-reconnect.
    };
    return subID;
  }

  unsubscribe(subId) {
    if (this._subscriptions[subId] && this._subscriptions[subId].evtSource) {
      this._subscriptions[subId].evtSource.close();
    }
    delete this._subscriptions[subId];
  }
}

export class SSELink extends ApolloLink {
  constructor(paramsOrClient) {
    super();
    this._subscriptionClient = paramsOrClient;
  }

  request(operation, forward) {
    // Note: the following means that we do not support batch operations if one of them is a
    // subscription.
    if (operation.query.definitions[0].operation !== 'subscription') {
      return forward(operation);
    }
    return new Observable(observer => {
      const subID = this._subscriptionClient.subscribe(
        Object.assign(operation, {query: print(operation.query)}),
        // Odd callback signature necessary for compatibility with graphiql-_subscriptions-fetcher.
        (_, data) => {
          observer.next(data);
        }
      );

      return () => this._subscriptionClient.unsubscribe(subID);
    });
  }
}

const toQueryParam = obj => {
  if (typeof obj === 'object') {
    return JSON.stringify(obj);
  }
  return encodeURIComponent(obj);
};
