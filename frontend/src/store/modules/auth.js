import { apolloClient } from 'src/boot/apollo'
import LOGOUT_MUTATION from 'src/graphql/AuthGQL/logout'

export default {
    namespaced: true,

    state: {
        token: null,
        user: null
    },

    mutations: {
        setAuth(state, payload) {
            state.token = payload.token
            state.user = payload.user
        },
        logout(state) {
            state.token = null
            state.user = null
        }
    },

    actions: {
        async logout({ commit }) {
            try {
                await apolloClient.mutate({ mutation: LOGOUT_MUTATION })
            } catch (e) {
                console.warn('Ошибка при logout', e)
            }
            commit('logout')
        }
    },

    getters: {
        accessToken: (state) => state.token,
        currentUser: (state) => state.user
    }
}
