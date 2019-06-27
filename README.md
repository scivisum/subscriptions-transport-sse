# subscriptions-transport-sse (SciVisum)

A GraphQL Server-Side-Events (SSE) server and client to facilitate GraphQL subscriptions.

## Getting Started

```bash
Using Yarn:
$ yarn add subscriptions-transport-sse

Or, using NPM:
$ npm install --save subscriptions-transport-sse
```

### Apollo Client (Browser)

For client side, we will use SubscriptionClient, and we also need to extend our network interface to use this transport for GraphQL subscriptions:

```javascript
import { SubscriptionClient, addGraphQLSubscriptions } from 'subscriptions-transport-sse'
const httpClient = createNetworkInterface({uri: `https://my-graphql.example.com/graphql`})
const sseClient = new SubscriptionClient(`https://my-graphql.example.com/subscriptions`)
const apolloClient = new ApolloClient({networkInterface: addGraphQLSubscriptions(httpClient, sseClient)})
```

Now, when you want to use subscriptions in client side, use your ApolloClient instance, with subscribe or subscribeToMore (according to your apollo-client usage):

```javascript
apolloClient.subscribeToMore({
    document: gql`
        subscription onNewItem {
            newItemCreated {
                id
            }
        }`,
    variables: {},
    updateQuery: (prev, {subscriptionData}) => {
        return; // Modify your store and return new state with the new arrived data
    }
});
```

## License

This project is licensed under the MIT license. See the [LICENSE](LICENSE) file for more info.
