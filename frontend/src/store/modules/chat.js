import { io } from 'socket.io-client'
import { apolloClient } from 'src/boot/apollo'
import { GET_CHATS } from 'src/graphql/ChatGQL/getChats'
import { GET_MESSAGES } from 'src/graphql/ChatGQL/getMessages'
import { GET_OR_CREATE_CHAT } from 'src/graphql/ChatGQL/getOrCreateChat'

function normalizeMessage(message) {
    return {
        id: message.id,
        chatId: Number(message.chatId ?? message.chat?.id),
        content: message.content,
        createdAt: message.createdAt,
        sender: {
            id: Number(message?.sender?.id ?? message?.from),
            name: message?.sender?.name ?? null,
            email: message?.sender?.email ?? null,
        },
    }
}

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
    SET_SOCKET(state, socketInstance) {
        state.socket = socketInstance
    },

    SET_CHATS(state, chatList) {
        state.chats = Array.isArray(chatList) ? chatList.slice() : []
        state.chats.sort((chatA, chatB) => {
            const timeA = chatA.lastMessage?.createdAt ? new Date(chatA.lastMessage.createdAt).getTime() : 0
            const timeB = chatB.lastMessage?.createdAt ? new Date(chatB.lastMessage.createdAt).getTime() : 0
            return timeB - timeA
        })
    },

    CLEAR_MESSAGES(state) {
        state.messages = []
    },

    SET_MESSAGES(state, { chatId, messages }) {
        if (Number(chatId) !== Number(state.currentChatId)) return
        const incomingMessages = (messages || []).map(normalizeMessage)
        const existingMessages = Array.isArray(state.messages) ? state.messages : []
        const messagesMap = new Map(existingMessages.map(msg => [String(msg.id), msg]))
        for (const msg of incomingMessages) {
            messagesMap.set(String(msg.id), msg)
        }
        state.messages = Array.from(messagesMap.values())
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    },

    ADD_MESSAGE(state, message) {
        const normalizedMessage = normalizeMessage(message)
        if (Number(normalizedMessage.chatId) !== Number(state.currentChatId)) return
        if (state.messages.some(existing => String(existing.id) === String(normalizedMessage.id))) return
        state.messages = [...state.messages, normalizedMessage]
    },

    SET_CURRENT_CHAT(state, chatId) {
        state.currentChatId = Number(chatId)
    },

    ADD_ONLINE(state, userId) {
        state.onlineUsers = { ...state.onlineUsers, [Number(userId)]: true }
    },
    REMOVE_ONLINE(state, userId) {
        const updatedOnlineUsers = { ...state.onlineUsers }
        delete updatedOnlineUsers[Number(userId)]
        state.onlineUsers = updatedOnlineUsers
    },
    SET_ONLINE_USERS(state, userIds) {
        const onlineMap = {}
        for (const id of userIds || []) onlineMap[Number(id)] = true
        state.onlineUsers = onlineMap
    },

    UPDATE_LAST_MESSAGE(state, message) {
        const normalizedMessage = normalizeMessage(message)
        const chatId = Number(normalizedMessage.chatId)
        const chatIndex = state.chats.findIndex(chat => Number(chat.id) === chatId)
        if (chatIndex === -1) return

        const chat = state.chats[chatIndex]
        if (chat.lastMessage && String(chat.lastMessage.id) === String(normalizedMessage.id)) return

        chat.lastMessage = {
            id: normalizedMessage.id,
            content: normalizedMessage.content,
            createdAt: normalizedMessage.createdAt,
            sender: normalizedMessage.sender,
        }
        const updatedChats = state.chats.slice()
        updatedChats.splice(chatIndex, 1)
        updatedChats.unshift(chat)
        state.chats = updatedChats
    },
}

const actions = {
    async initSocket({ commit, rootGetters, state, dispatch }) {
        if (state.socket) return

        let token = rootGetters['auth/accessToken']
        let attempts = 10
        while (!token && attempts-- > 0) {
            await new Promise(resolve => setTimeout(resolve, 100))
            token = rootGetters['auth/accessToken']
        }
        if (!token) {
            console.warn('❌ accessToken not found for WebSocket')
            return
        }

        const socketInstance = io('http://localhost:3000', { auth: { token } })

        socketInstance.on('connect', () => {
            console.log('🟢 WS connected')
            dispatch('loadChats')
        })
        socketInstance.on('disconnect', () => console.log('🔴 WS disconnected'))

        socketInstance.on('onlineUsers', (payload) => {
            const userIds = Array.isArray(payload) ? payload : payload?.userIds
            commit('SET_ONLINE_USERS', userIds || [])
        })
        socketInstance.on('userOnline', (data) => commit('ADD_ONLINE', typeof data === 'object' ? data.userId : data))
        socketInstance.on('userOffline', (data) => commit('REMOVE_ONLINE', typeof data === 'object' ? data.userId : data))

        socketInstance.on('receiveMessage', (message) => {
            commit('ADD_MESSAGE', message)
            commit('UPDATE_LAST_MESSAGE', message)
        })

        socketInstance.on('chatLastMessage', ({ chatId, lastMessage, lastMessageAt }) => {
            commit('UPDATE_LAST_MESSAGE', {
                chatId,
                id: lastMessage.id,
                content: lastMessage.content,
                createdAt: lastMessageAt,
                sender: { id: Number(lastMessage.senderId) },
            })
        })

        const { markRaw } = await import('vue')
        commit('SET_SOCKET', markRaw(socketInstance))
    },

    async loadChats({ commit, rootState }) {
        const { data } = await apolloClient.query({
            query: GET_CHATS,
            variables: { userId: Number(rootState.auth.user.id) },
            fetchPolicy: 'no-cache',
        })
        commit('SET_CHATS', data?.chats)
    },

    async loadMessages({ commit }, chatId) {
        const { data } = await apolloClient.query({
            query: GET_MESSAGES,
            variables: { chatId: Number(chatId) },
            fetchPolicy: 'no-cache',
        })
        commit('SET_MESSAGES', { chatId, messages: data.messagesForChat })
    },

    async getOrCreateChat({ dispatch, state }, { userAId, userBId }) {
        const result = await apolloClient.mutate({
            mutation: GET_OR_CREATE_CHAT,
            variables: { userAId: Number(userAId), userBId: Number(userBId) },
        })
        const chat = result?.data?.getOrCreateChat
        if (!chat) throw new Error('getOrCreateChat вернул пустой результат')

        await dispatch('loadChats')
        return state.chats.find(existingChat => Number(existingChat.id) === Number(chat.id)) || chat
    },

    async joinChat({ commit, state, dispatch }, chatId) {
        commit('SET_CURRENT_CHAT', chatId)
        commit('CLEAR_MESSAGES')
        await dispatch('loadMessages', chatId)
        if (state.socket) {
            state.socket.emit('joinChat', { chatId: Number(chatId) })
        }
    },

    async sendMessage({ state, rootState }, content) {
        if (!state.socket || !state.currentChatId) return
        const chat = state.chats.find(chatItem => Number(chatItem.id) === Number(state.currentChatId))
        if (!chat?.participants || chat.participants.length < 2) {
            console.warn('Не найдены участники чата:', chat)
            return
        }
        const currentUserId = Number(rootState.auth.user.id)
        const recipient = chat.participants.find(user => Number(user.id) !== currentUserId)
        if (!recipient) {
            console.warn('Получатель не найден в участниках:', chat.participants)
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
