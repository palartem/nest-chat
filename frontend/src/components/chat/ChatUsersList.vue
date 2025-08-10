<template>
    <div class="bg-grey-1 flex column no-wrap" style="height: 100%">
        <q-toolbar class="col-auto q-pa-md toolbar-chats">
            <q-toolbar-title>Чаты</q-toolbar-title>
        </q-toolbar>

        <div class="col overflow-auto">
            <q-list class="users-list">
                <q-item
                    v-for="user in chatUsers"
                    :key="user.id"
                    class="users-list__item"
                    clickable
                    :active="isActiveChat(user.id)"
                    active-class="bg-primary text-white"
                    @click="openChat(user)"
                >
                    <q-item-section avatar>
                        <UserAvatar
                            :name="user.name"
                            :is-online="isOnline(user.id)"
                            size="40px"
                        />
                    </q-item-section>

                    <q-item-section>
                        <q-item-label>{{ user.name }}</q-item-label>
                        <q-item-label caption class="users-list__message text-grey">
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
import UserAvatar from 'src/components/user/UserAvatar.vue'

export default {
    name: 'ChatUsersList',
    components: { UserAvatar },

    computed: {
        ...mapState('user', ['users']),
        ...mapState('chat', ['chats']),
        ...mapState('auth', ['user']),
        ...mapGetters('chat', ['isOnline']),

        chatUsers () {
            return this.users.filter(u => u.id !== this.user.id)
        },
    },

    async mounted () {
        await this.$store.dispatch('user/loadUsers')
    },

    methods: {
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
<style lang="scss" scoped>
.users-list {
    .users-list__item {
        align-items: start;
    }
    .users-list__message {
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: normal;
    }
}
.toolbar-chats {
    min-height: 72px;
}
</style>
