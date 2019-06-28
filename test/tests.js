import EventSource from "eventsourcemock";
import {sources} from "eventsourcemock";
import {execute} from "apollo-link";
import gql from "graphql-tag";
import * as EventSourcePolyfill from "event-source-polyfill";

import {SSELink, SubscriptionClient} from "../src/client";

// Mock out EventSource.  We assume we're running tests on browsers with native support.
EventSourcePolyfill.NativeEventSource = EventSource;

describe("SubscriptionClient", () => {
  beforeEach(() => {});

  it("doesn't immediately start the EventSource", () => {
    spyOn(EventSourcePolyfill, "NativeEventSource");

    new SubscriptionClient();

    expect(EventSourcePolyfill.NativeEventSource).not.toHaveBeenCalled();
  });

  describe("subscribe", () => {
    let client, eventSources, callback;

    beforeEach(() => {
      client = new SubscriptionClient("https://mock/url");
      callback = jasmine.createSpy("callback");
    });

    it("parses event and executes callback", () => {
      // setup
      const message = new MessageEvent("message", {
        data: '{"mock": "result"}'
      });

      // action
      client.subscribe({query: "{some { graphql }}"}, callback);

      // confirm
      expect(callback).not.toHaveBeenCalled();

      // action
      sources[
        "https://mock/url?query=%7Bsome%20%7B%20graphql%20%7D%7D"
      ].emitMessage(message);

      // confirm
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(null, {mock: "result"});
    });

    it("does nothing on error", () => {
      // setup
      client.subscribe({query: "{some { graphql }}"}, callback);

      // action
      sources[
        "https://mock/url?query=%7Bsome%20%7B%20graphql%20%7D%7D"
      ].emitError("ignored");

      // confirm
      expect(callback).not.toHaveBeenCalled();
    });

    it("handles multiple subscriptions", () => {
      // setup
      const message = new MessageEvent("message", {
        data: '{"mock": "result"}'
      });
      const otherMessage = new MessageEvent("message", {
        data: '{"otherMock": "other result"}'
      });
      const otherCallback = jasmine.createSpy("callback");

      client.subscribe({query: "{some { graphql }}"}, callback);
      client.subscribe({query: "{other { graphql }}"}, otherCallback);

      // action
      sources[
        "https://mock/url?query=%7Bsome%20%7B%20graphql%20%7D%7D"
      ].emitMessage(message);
      sources[
        "https://mock/url?query=%7Bother%20%7B%20graphql%20%7D%7D"
      ].emitMessage(otherMessage);

      // confirm
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(null, {mock: "result"});
      expect(otherCallback).toHaveBeenCalledTimes(1);
      expect(otherCallback).toHaveBeenCalledWith(null, {
        otherMock: "other result"
      });
    });
  });

  describe("unsubscribe", () => {
    it("closes the connection for the specified subscription", () => {
      // setup
      const client = new SubscriptionClient("https://mock/url");

      client.subscribe({query: "{some { graphql }}"}, () => {});
      const subID = client.subscribe({query: "{some { graphql }}"}, () => {});
      client.subscribe({query: "{some { graphql }}"}, () => {});

      const sub1 = client._subscriptions[0];
      const sub2 = client._subscriptions[1];
      const sub3 = client._subscriptions[2];

      // confirm
      expect(Object.keys(client._subscriptions).length).toBe(3);

      // action
      client.unsubscribe(subID);

      // confirm
      expect(Object.keys(client._subscriptions).length).toBe(2);
      expect(sub1.evtSource.readyState).not.toBe(2);
      expect(sub2.evtSource.readyState).toBe(2);
      expect(sub3.evtSource.readyState).not.toBe(2);
    });
  });
});

describe("SSELink", () => {
  let link, fallback, callback, client;
  const operation = {
    query: gql`
      subscription {
        test
      }
    `,
    variables: {},
    extensions: {},
    operationName: null
  };

  beforeEach(() => {
    fallback = jasmine.createSpyObj("fallback", ["request"]);
    callback = jasmine.createSpy("callback");
    client = jasmine.createSpyObj("subscriptionClient", [
      "subscribe",
      "unsubscribe"
    ]);

    link = new SSELink(client).concat(fallback);
  });

  it("forwards non-subscriptions", () => {
    const queryOperation = {
      query: gql`
        {
          test
        }
      `,
      variables: {},
      extensions: {},
      operationName: null
    };

    execute(link, queryOperation).subscribe({
      next: callback
    });

    expect(fallback.request).toHaveBeenCalledWith(queryOperation);
  });

  it("subscribes to events", () => {
    execute(link, operation).subscribe({
      next: callback
    });

    expect(client.subscribe).toHaveBeenCalledTimes(1);
    expect(client.subscribe).toHaveBeenCalledWith(
      {
        query: "subscription {\n  test\n}\n",
        variables: {},
        extensions: {},
        operationName: null
      },
      jasmine.any(Function)
    );
    expect(fallback.request).not.toHaveBeenCalled();
    expect(client.unsubscribe).not.toHaveBeenCalled();
  });

  it("observes events", () => {
    execute(link, operation).subscribe({
      next: callback
    });
    const subscriber = client.subscribe.calls.allArgs()[0][1];

    subscriber(null, "first");
    subscriber(null, "second");

    expect(callback.calls.allArgs()).toEqual([["first"], ["second"]]);
  });

  it("unsubscribes from events", () => {
    client.subscribe.and.returnValue("mock id");
    const subscription = execute(link, operation).subscribe({
      next: callback
    });

    subscription.unsubscribe();

    expect(client.unsubscribe).toHaveBeenCalledWith("mock id");
  });
});
