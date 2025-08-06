import { io } from 'socket.io-client'
import { apolloClient } from 'src/boot/apollo'
import { GET_CHATS } from 'src/graphql/ChatGQL/getChats'
import { GET_MESSAGES } from 'src/graphql/ChatGQL/getMessages'
import { GET_OR_CREATE_CHAT } from 'src/graphql/ChatGQL/getOrCreateChat'

const state = () => ({
    socket: null,
    chats: [],
    messages: [],
    onlineUsers: new Set(),
    currentChatId: null,
})

const getters = {
    chats: (state) => state.chats,
    messages: (state) => state.messages,
    onlineUsers: (state) => state.onlineUsers,
    currentChatId: (state) => state.currentChatId,
}

const mutations = {
    SET_SOCKET(state, socket) {
        state.socket = socket
    },
    SET_CHATS(state, chats) {
        state.chats = chats
    },
    SET_MESSAGES(state, messages) {
        state.messages = messages
    },
    ADD_MESSAGE(state, message) {
        if (+message.chatId === +state.currentChatId) {
            state.messages = [...state.messages, message];
        }
    },
    SET_CURRENT_CHAT(state, chatId) {
        state.currentChatId = chatId
    },
    ADD_ONLINE(state, userId) {
        state.onlineUsers.add(userId)
    },
    REMOVE_ONLINE(state, userId) {
        state.onlineUsers.delete(userId)
    },
}

const actions = {
    async initSocket({ commit, rootGetters, state }) {
        if (state.socket) return;

        let token = rootGetters['auth/accessToken'];
        let attempts = 10;

        while (!token && attempts-- > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
            token = rootGetters['auth/accessToken'];
        }

        if (!token) {
            console.warn('❌ accessToken not found for WebSocket');
            return;
        }

        console.log('📤 Token used for socket connection:', token);

        const socket = io('http://localhost:3000', {
            auth: { token },
        });

        socket.on('connect', () => console.log('🟢 Connected to WebSocket'));
        socket.on('disconnect', () => console.log('🔴 Disconnected from WebSocket'));

        socket.on('receiveMessage', (msg) => commit('ADD_MESSAGE', msg));
        socket.on('userOnline', (data) => commit('ADD_ONLINE', data.userId));
        socket.on('userOffline', (data) => commit('REMOVE_ONLINE', data.userId));

        commit('SET_SOCKET', socket);
    },

    async loadChats({ commit, rootState }) {
        const { data } = await apolloClient.query({
            query: GET_CHATS,
            variables: { userId: Number(rootState.auth.user.id) },
            fetchPolicy: 'no-cache'
        })
        commit('SET_CHATS', data.chats)
    },

    async loadMessages({ commit }, chatId) {
        const { data } = await apolloClient.query({
            query: GET_MESSAGES,
            variables: { chatId },
        })
        commit('SET_MESSAGES', data.messagesForChat)
    },

    async getOrCreateChat({ dispatch, state }, { userAId, userBId }) {
        const response = await apolloClient.mutate({
            mutation: GET_OR_CREATE_CHAT,
            variables: {
                userAId: Number(userAId),
                userBId: Number(userBId),
            },
        });

        const chat = response?.data?.getOrCreateChat;
        if (!chat) {
            throw new Error('❌ getOrCreateChat вернул пустой результат');
        }

        await dispatch('loadChats');

        const updatedChat = state.chats.find(c => c.id === chat.id);
        if (!updatedChat) {
            throw new Error('❌ Чат не найден в state после loadChats');
        }

        return updatedChat;
    },

    async joinChat({ commit, state }, chatId) {
        commit('SET_CURRENT_CHAT', chatId)
        if (state.socket) state.socket.emit('joinChat', chatId)
    },

    async sendMessage({ state, rootState }, content) {
        if (!state.socket || !state.currentChatId) return;

        const chat = state.chats.find(c => c.id === state.currentChatId);
        if (!chat || !chat.participants || chat.participants.length < 2) {
            console.warn('❌ Не найдены участники чата:', chat);
            return;
        }

        const currentUserId = rootState.auth.user.id;
        const recipient = chat.participants.find(p => p.id !== currentUserId);
        if (!recipient) {
            console.warn('❌ Получатель не найден в участниках:', chat.participants);
            return;
        }

        console.log('📤 Отправка сообщения в чат', chat.id, 'для пользователя', recipient.id);
        state.socket.emit('sendMessage', {
            chatId: chat.id,
            to: recipient.id,
            message: content,
        });
    }
}

export default {
    namespaced: true,
    state,
    getters,
    mutations,
    actions,
}
