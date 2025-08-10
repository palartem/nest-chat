import { io } from 'socket.io-client'
import { apolloClient } from 'src/boot/apollo'
import { GET_CHATS } from 'src/graphql/ChatGQL/getChats'
import { GET_MESSAGES } from 'src/graphql/ChatGQL/getMessages'
import { GET_OR_CREATE_CHAT } from 'src/graphql/ChatGQL/getOrCreateChat'

const state = () => ({
    socket: null,
    chats: [],
    messages: [],
    onlineUsers: {},
    currentChatId: null,
})

const getters = {
    chats: (state) => state.chats,
    messages: (state) => state.messages,
    onlineUsers: (state) => state.onlineUsers,
    currentChatId: (state) => state.currentChatId,
    isOnline: (state) => (userId) => !!state.onlineUsers[Number(userId)],
}

const mutations = {
    SET_SOCKET(state, socket) {
        state.socket = socket
    },
    SET_CHATS(state, chats) {
        state.chats = Array.isArray(chats) ? chats.slice() : []
        state.chats.sort((a, b) => {
            const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0
            const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0
            return bTime - aTime
        })
    },
    SET_MESSAGES(state, messages) {
        state.messages = Array.isArray(messages) ? messages.slice() : []
    },
    ADD_MESSAGE(state, message) {
        if (+message.chatId === +state.currentChatId) {
            state.messages = [...state.messages, message]
        }
    },
    SET_CURRENT_CHAT(state, chatId) {
        state.currentChatId = Number(chatId)
    },
    ADD_ONLINE(state, userId) {
        state.onlineUsers = { ...state.onlineUsers, [Number(userId)]: true }
    },
    REMOVE_ONLINE(state, userId) {
        const clone = { ...state.onlineUsers }
        delete clone[Number(userId)]
        state.onlineUsers = clone
    },
    SET_ONLINE_USERS(state, userIds) {
        const map = {}
        for (const id of userIds) map[Number(id)] = true
        state.onlineUsers = map
    },
    UPDATE_LAST_MESSAGE(state, message) {
        const chatId = Number(message.chatId)
        const idx = state.chats.findIndex(c => Number(c.id) === chatId)
        if (idx === -1) return
        const chat = state.chats[idx]
        chat.lastMessage = {
            id: message.id,
            content: message.content,
            createdAt: message.createdAt,
            sender: message.sender,
        }
        const next = state.chats.slice()
        next.splice(idx, 1)
        next.unshift(chat)
        state.chats = next
    },
}

const actions = {
    async initSocket({ commit, rootGetters, state }) {
        if (state.socket) return

        let token = rootGetters['auth/accessToken']
        let attempts = 10
        while (!token && attempts-- > 0) {
            await new Promise(r => setTimeout(r, 100))
            token = rootGetters['auth/accessToken']
        }
        if (!token) {
            console.warn('❌ accessToken not found for WebSocket')
            return
        }

        const socket = io('http://localhost:3000', { auth: { token } })

        socket.on('connect', () => console.log('🟢 WS connected'))
        socket.on('disconnect', () => console.log('🔴 WS disconnected'))

        socket.on('onlineUsers', (payload) => {
            const userIds = Array.isArray(payload) ? payload : payload.userIds
            commit('SET_ONLINE_USERS', userIds || [])
        })
        socket.on('userOnline', ({ userId }) => commit('ADD_ONLINE', userId))
        socket.on('userOffline', ({ userId }) => commit('REMOVE_ONLINE', userId))

        socket.on('receiveMessage', (msg) => {
            commit('ADD_MESSAGE', msg)
            commit('UPDATE_LAST_MESSAGE', msg)
        })

        socket.on('chatLastMessage', ({ chatId, lastMessage, lastMessageAt }) => {
            commit('UPDATE_LAST_MESSAGE', {
                chatId,
                id: lastMessage.id,
                content: lastMessage.content,
                createdAt: lastMessageAt,
                sender: { id: lastMessage.senderId },
            })
        })

        const { markRaw } = await import('vue')
        commit('SET_SOCKET', markRaw(socket))
    },

    async loadChats({ commit, rootState }) {
        const { data } = await apolloClient.query({
            query: GET_CHATS,
            variables: { userId: Number(rootState.auth.user.id) },
            fetchPolicy: 'no-cache',
        })
        commit('SET_CHATS', data.chats)
    },

    async loadMessages({ commit }, chatId) {
        const { data } = await apolloClient.query({
            query: GET_MESSAGES,
            variables: { chatId: Number(chatId) },
            fetchPolicy: 'no-cache',
        })
        commit('SET_MESSAGES', data.messagesForChat)
    },

    async getOrCreateChat({ dispatch, state }, { userAId, userBId }) {
        const res = await apolloClient.mutate({
            mutation: GET_OR_CREATE_CHAT,
            variables: {
                userAId: Number(userAId),
                userBId: Number(userBId),
            },
        })
        const chat = res?.data?.getOrCreateChat
        if (!chat) throw new Error('❌ getOrCreateChat вернул пустой результат')

        await dispatch('loadChats')
        return state.chats.find(c => Number(c.id) === Number(chat.id)) || chat
    },

    async joinChat({ commit, state }, chatId) {
        commit('SET_CURRENT_CHAT', chatId)
        if (state.socket) {
            state.socket.emit('joinChat', { chatId: Number(chatId) })
        }
    },

    async sendMessage({ state, rootState }, content) {
        if (!state.socket || !state.currentChatId) return
        const chat = state.chats.find(c => Number(c.id) === Number(state.currentChatId))
        if (!chat?.participants || chat.participants.length < 2) {
            console.warn('❌ Не найдены участники чата:', chat)
            return
        }
        const currentUserId = Number(rootState.auth.user.id)
        const recipient = chat.participants.find(p => Number(p.id) !== currentUserId)
        if (!recipient) {
            console.warn('❌ Получатель не найден в участниках:', chat.participants)
            return
        }
        state.socket.emit('sendMessage', {
            chatId: Number(chat.id),
            to: Number(recipient.id),
            message: content,
        })
    },
}

export default {
    namespaced: true,
    state,
    getters,
    mutations,
    actions,
}
