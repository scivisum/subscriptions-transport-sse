'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SSELink = exports.SubscriptionClient = undefined;

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _apolloLink = require('apollo-link');

var _printer = require('graphql/language/printer');

var _eventSourcePolyfill = require('event-source-polyfill');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var EventSource = _eventSourcePolyfill.NativeEventSource || _eventSourcePolyfill.EventSourcePolyfill;

var SubscriptionClient = exports.SubscriptionClient = function () {
  function SubscriptionClient(url) {
    (0, _classCallCheck3.default)(this, SubscriptionClient);

    this._url = url;
    this._subscriptions = {};
    this._numSubscriptions = 0;
  }

  (0, _createClass3.default)(SubscriptionClient, [{
    key: 'subscribe',
    value: function subscribe(options, handler) {
      var _this = this;

      var subID = this._numSubscriptions++;

      var queryString = (0, _keys2.default)(options).map(function (key) {
        return encodeURIComponent(key) + '=' + toQueryParam(options[key]);
      }).join('&');

      var evtSource = new EventSource(this._url + '?' + queryString);
      this._subscriptions[subID] = { options: options, handler: handler, evtSource: evtSource };

      evtSource.onmessage = function (event) {
        var parsed = JSON.parse(event.data);
        _this._subscriptions[subID].handler(null, parsed);
      };
      evtSource.onerror = function (event) {
        console.warn('EventSource connection dropped for subscription ID ' + subID, event);
        // Don't do anything other than log it, otherwise Apollo will unsubscribe when we want the
        // EventSource to auto-reconnect.
      };
      return subID;
    }
  }, {
    key: 'unsubscribe',
    value: function unsubscribe(subId) {
      if (this._subscriptions[subId] && this._subscriptions[subId].evtSource) {
        this._subscriptions[subId].evtSource.close();
      }
      delete this._subscriptions[subId];
    }
  }]);
  return SubscriptionClient;
}();

var SSELink = exports.SSELink = function (_ApolloLink) {
  (0, _inherits3.default)(SSELink, _ApolloLink);

  function SSELink(paramsOrClient) {
    (0, _classCallCheck3.default)(this, SSELink);

    var _this2 = (0, _possibleConstructorReturn3.default)(this, (SSELink.__proto__ || (0, _getPrototypeOf2.default)(SSELink)).call(this));

    _this2._subscriptionClient = paramsOrClient;
    return _this2;
  }

  (0, _createClass3.default)(SSELink, [{
    key: 'request',
    value: function request(operation, forward) {
      var _this3 = this;

      // Note: the following means that we do not support batch operations if one of them is a
      // subscription.
      if (operation.query.definitions[0].operation !== 'subscription') {
        return forward(operation);
      }
      return new _apolloLink.Observable(function (observer) {
        var subID = _this3._subscriptionClient.subscribe((0, _assign2.default)(operation, { query: (0, _printer.print)(operation.query) }),
        // Odd callback signature necessary for compatibility with graphiql-_subscriptions-fetcher.
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

var toQueryParam = function toQueryParam(obj) {
  if ((typeof obj === 'undefined' ? 'undefined' : (0, _typeof3.default)(obj)) === 'object') {
    return (0, _stringify2.default)(obj);
  }
  return encodeURIComponent(obj);
};
//# sourceMappingURL=client.js.map