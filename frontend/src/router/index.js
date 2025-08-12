import { defineRouter } from '#q-app/wrappers'
import { createRouter, createMemoryHistory, createWebHistory, createWebHashHistory } from 'vue-router'
import routes from './routes'
import store from 'src/store'
import { apolloClient } from 'src/boot/apollo'
import gql from 'graphql-tag'

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

export default defineRouter(async function () {
  // перед роутингом пытаемся обновить токен
  try {
    const res = await apolloClient.mutate({ mutation: REFRESH_MUTATION })
    if (res.data?.refreshToken?.access_token) {
      store.commit('auth/setAuth', {
        token: res.data.refreshToken.access_token,
        user: res.data.refreshToken.user
      })
    }
  } catch (err) {
    console.warn('❌ refreshToken не сработал', err.message)
  }

  const createHistory = process.env.SERVER
      ? createMemoryHistory
      : (process.env.VUE_ROUTER_MODE === 'history' ? createWebHistory : createWebHashHistory)

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    history: createHistory(process.env.VUE_ROUTER_BASE)
  })

  Router.beforeEach((to, from, next) => {
    const token = store.getters['auth/accessToken']
    if (to.meta.requiresAuth && !token) {
      return next('/login')
    }
    if (token && (to.path === '/login' || to.path === '/')) {
      return next('/chats')
    }
    next()
  })

  return Router
})
