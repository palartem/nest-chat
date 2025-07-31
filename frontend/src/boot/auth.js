import { boot } from 'quasar/wrappers'
import gql from 'graphql-tag'
import { apolloClient } from './apollo'
import store from 'src/store'

const REFRESH_MUTATION = gql`
  mutation {
    refreshToken {
      access_token
      user {
        id
        email
        name
      }
    }
  }
`

export default boot(async () => {
    try {
        const res = await apolloClient.mutate({ mutation: REFRESH_MUTATION })
        if (res.data?.refreshToken?.access_token) {
            store.commit('auth/setAuth', {
                token: res.data.refreshToken.access_token,
                user: res.data.refreshToken.user
            })
            console.log('✅ Access token обновлен')
        }
    } catch (err) {
        console.warn('⚠ Пользователь не авторизован', err.message)
    }
})
