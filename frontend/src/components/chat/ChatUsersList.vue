<template>
    <div class="bg-grey-1 flex column no-wrap" style="height: 100%">
        <q-toolbar class="col-auto q-pa-md">
            <q-toolbar-title>Чаты</q-toolbar-title>
        </q-toolbar>

        <div class="col overflow-auto">
            <q-list>
                <q-item
                    v-for="user in chatUsers"
                    :key="user.id"
                    clickable
                    :active="isActiveChat(user.id)"
                    active-class="bg-primary text-white"
                    @click="openChat(user)"
                >
                    <q-item-section avatar>
                        <q-avatar color="primary" text-color="white">
                            {{ getInitial(user.name) }}
                            <q-badge
                                v-if="isOnline(user.id)"
                                color="green"
                                rounded
                                floating
                                class="q-badge--online"
                            />
                        </q-avatar>
                    </q-item-section>

                    <!-- Имя и последнее сообщение -->
                    <q-item-section>
                        <q-item-label>{{ user.name }}</q-item-label>
                        <q-item-label caption class="text-grey">
                            {{ getLastMessageForUser(user.id) }}
                        </q-item-label>
                    </q-item-section>
                </q-item>
            </q-list>
        </div>
    </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex'

export default {
    name: 'ChatUsersList',

    computed: {
        ...mapState('user', ['users']),
        ...mapState('chat', ['chats']),
        ...mapState('auth', ['user']),
        ...mapGetters('chat', ['isOnline']),

        chatUsers() {
            return this.users.filter(u => u.id !== this.user.id)
        },
    },

    async mounted () {
        await this.$store.dispatch('user/loadUsers')
    },

    methods: {
        getInitial(name) {
            return name?.trim().charAt(0).toUpperCase() || '?'
        },

        async openChat(user) {
            try {
                const chat = await this.$store.dispatch('chat/getOrCreateChat', {
                    userAId: this.user.id,
                    userBId: user.id,
                })
                if (chat?.id) this.$router.push(`/chats/${chat.id}`)
            } catch (err) {
                console.error('Ошибка при создании/получении чата:', err)
            }
        },

        isActiveChat(userId) {
            const currentChatId = this.$route.params.chatId
            if (!currentChatId) return false
            const chat = this.chats.find(c => c.participants.some(p => p.id === userId))
            return chat && String(chat.id) === currentChatId
        },

        getLastMessageForUser(userId) {
            const chat = this.chats.find(c => c.participants.some(p => p.id === userId))
            return chat?.lastMessage?.content || 'Нет сообщений'
        },
    },
}
</script>
