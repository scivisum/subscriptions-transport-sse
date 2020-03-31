"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SSELink = exports.SubscriptionClient = void 0;

var _typeof2 = _interopRequireDefault(require("@babel/runtime/helpers/typeof"));

var _possibleConstructorReturn2 = _interopRequireDefault(require("@babel/runtime/helpers/possibleConstructorReturn"));

var _getPrototypeOf2 = _interopRequireDefault(require("@babel/runtime/helpers/getPrototypeOf"));

var _inherits2 = _interopRequireDefault(require("@babel/runtime/helpers/inherits"));

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var _apolloLink = require("apollo-link");

var _printer = require("graphql/language/printer");

var _eventSourcePolyfill = require("event-source-polyfill");

var SubscriptionClient =
/*#__PURE__*/
function () {
  function SubscriptionClient(url) {
    (0, _classCallCheck2["default"])(this, SubscriptionClient);
    this._url = url;
    this._subscriptions = {};
    this._numSubscriptions = 0;
  }

  (0, _createClass2["default"])(SubscriptionClient, [{
    key: "subscribe",
    value: function subscribe(options, handler) {
      var _this = this;

      var subID = this._numSubscriptions++;
      var queryString = Object.keys(options).map(function (key) {
        return "".concat(encodeURIComponent(key), "=").concat(toQueryParam(options[key]));
      }).join("&");
      var EventSource = _eventSourcePolyfill.NativeEventSource || _eventSourcePolyfill.EventSourcePolyfill;
      var evtSource = new EventSource("".concat(this._url, "?").concat(queryString), {
        heartbeatTimeout: 660000,
        withCredentials: true
      });
      this._subscriptions[subID] = {
        options: options,
        handler: handler,
        evtSource: evtSource
      };

      evtSource.onmessage = function (event) {
        var parsed = JSON.parse(event.data);

        _this._subscriptions[subID].handler(null, parsed);
      };

      evtSource.onerror = function (event) {
        console.warn("EventSource connection dropped for subscription ID ".concat(subID), event); // Don't do anything other than log it, otherwise Apollo will unsubscribe when we want the
        // EventSource to auto-reconnect.
      };

      return subID;
    }
  }, {
    key: "unsubscribe",
    value: function unsubscribe(subID) {
      if (this._subscriptions[subID] && this._subscriptions[subID].evtSource) {
        this._subscriptions[subID].evtSource.close();
      }

      delete this._subscriptions[subID];
    }
  }]);
  return SubscriptionClient;
}();

exports.SubscriptionClient = SubscriptionClient;

var SSELink =
/*#__PURE__*/
function (_ApolloLink) {
  (0, _inherits2["default"])(SSELink, _ApolloLink);

  function SSELink(subscriptionClient) {
    var _this2;

    (0, _classCallCheck2["default"])(this, SSELink);
    _this2 = (0, _possibleConstructorReturn2["default"])(this, (0, _getPrototypeOf2["default"])(SSELink).call(this));
    _this2._subscriptionClient = subscriptionClient;
    return _this2;
  }

  (0, _createClass2["default"])(SSELink, [{
    key: "request",
    value: function request(operation, forward) {
      var _this3 = this;

      // Note: the following means that we do not support batch operations if one of them is a
      // subscription.
      if (operation.query.definitions[0].operation !== "subscription") {
        return forward(operation);
      }

      return new _apolloLink.Observable(function (observer) {
        var subID = _this3._subscriptionClient.subscribe(Object.assign(operation, {
          query: (0, _printer.print)(operation.query)
        }), // Odd callback signature necessary for compatibility with graphiql-subscriptions-fetcher.
        function (_, data) {
          observer.next(data);
        });

        return function () {
          return _this3._subscriptionClient.unsubscribe(subID);
        };
      });
    }
  }]);
  return SSELink;
}(_apolloLink.ApolloLink);

exports.SSELink = SSELink;

var toQueryParam = function toQueryParam(obj) {
  if ((0, _typeof2["default"])(obj) === "object") {
    obj = JSON.stringify(obj);
  }

  return encodeURIComponent(obj);
};
//# sourceMappingURL=client.js.map
