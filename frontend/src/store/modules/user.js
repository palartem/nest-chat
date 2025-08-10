import { apolloClient } from 'src/boot/apollo'
import { GET_USERS } from 'src/graphql/UserGQL/getUsers'

export default {
    namespaced: true,
    state: () => ({
        users: []
    }),
    mutations: {
        setUsers(state, users) {
            state.users = users
        }
    },
    actions: {
        async loadUsers({ commit }) {
            const res = await apolloClient.query({
                query: GET_USERS,
                fetchPolicy: 'no-cache'
            })
            commit('setUsers', res.data.users)
        }
    }
}
