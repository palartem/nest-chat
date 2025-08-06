<template>
    <q-scroll-area class="bg-grey-1" style="height: 100%">
        <q-toolbar>
            <q-toolbar-title>Чаты</q-toolbar-title>
        </q-toolbar>

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
                        {{ getInitial(user.name || user.email) }}
                    </q-avatar>
                </q-item-section>

                <q-item-section>
                    {{ user.name || user.email }}
                </q-item-section>
            </q-item>
        </q-list>
    </q-scroll-area>
</template>

<script>
import { mapState } from 'vuex'

export default {
    name: 'ChatUsersList',

    computed: {
        ...mapState('user', ['users']),
        me() {
            return this.$store.state.auth.user
        },
        chatUsers() {
            // убираем себя из списка
            return this.users.filter(u => u.id !== this.me.id)
        }
    },

    async mounted() {
        await this.$store.dispatch('user/loadUsers')
    },

    methods: {
        getInitial(name) {
            if (!name) return '?'
            return name.trim().charAt(0).toUpperCase()
        },
        async openChat(user) {
            try {
                const userAId = this.me.id
                const userBId = user.id
                const chat = await this.$store.dispatch('chat/getOrCreateChat', { userAId, userBId })
                if (chat?.id) {
                    this.$router.push(`/chats/${chat.id}`)
                } else {
                    console.error('Чат не был создан или получен:', chat)
                }
            } catch (err) {
                console.error('Ошибка при создании/получении чата:', err)
            }
        },
        isActiveChat(userId) {
            const currentChatId = this.$route.params.chatId
            if (!currentChatId) return false
            const chat = this.$store.state.chat.chats.find((c) =>
                c.participants.some((p) => p.id === userId)
            )
            return chat && String(chat.id) === currentChatId
        }
    }
}
</script>
