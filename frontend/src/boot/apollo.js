import { boot } from 'quasar/wrappers'
import {
    ApolloClient,
    createHttpLink,
    InMemoryCache,
    from
} from '@apollo/client/core'
import { onError } from '@apollo/client/link/error'
import { createApolloProvider } from '@vue/apollo-option'

const httpLink = createHttpLink({
    uri: import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:3000/graphql',
    credentials: 'include'
})

const errorLink = onError(({ graphQLErrors }) => {
    if (graphQLErrors) {
        for (const err of graphQLErrors) {
            if (err.extensions?.code === 'UNAUTHENTICATED') {
                console.warn('🔄 Access token expired')
            }
        }
    }
})

export const apolloClient = new ApolloClient({
    link: from([errorLink, httpLink]),
    cache: new InMemoryCache()
})

export default boot(({ app }) => {
    app.use(createApolloProvider({ defaultClient: apolloClient }))
})
