<template>
    <q-page class="column full-height chat-room">
        <div class="chat-room__header col-auto q-pa-md bg-grey-2">
            <div class="header-user">
                <UserAvatar
                    :name="chatPartnerName"
                    :is-online="!!(chatPartner && isOnline(chatPartner.id))"
                    size="40px"
                />
                <div class="header-user__name">
                    {{ chatPartnerName }}
                </div>
            </div>
        </div>

        <ChatMessages class="col overflow-auto q-px-md" />

        <ChatInput class="col-auto q-pa-md" @send="sendMessage" />
    </q-page>
</template>

<script>
import ChatMessages from 'src/components/chat/ChatMessages.vue'
import ChatInput from 'src/components/chat/ChatInput.vue'
import UserAvatar from 'src/components/user/UserAvatar.vue'
import { mapGetters } from 'vuex'

export default {
    name: 'ChatRoom',
    components: { ChatMessages, ChatInput, UserAvatar },

    computed: {
        ...mapGetters('chat', ['messages', 'chats', 'isOnline']),
        ...mapGetters('auth', { me: 'currentUser' }),

        chatId () {
            return Number(this.$route.params.chatId)
        },

        currentChat () {
            return this.chats.find(c => Number(c.id) === this.chatId) || null
        },

        chatPartner () {
            if (!this.currentChat || !this.currentChat.participants) return null
            const meId = Number(this.me?.id)
            return this.currentChat.participants.find(p => Number(p.id) !== meId) || null
        },

        chatPartnerName () {
            return this.chatPartner?.name || 'Собеседник'
        }
    },

    async mounted () {
        await this.enterRoom(this.chatId)
    },

    watch: {
        '$route.params.chatId': {
            async handler (val) {
                await this.enterRoom(Number(val))
            }
        }
    },

    methods: {
        async enterRoom (id) {
            if (!id) return
            await this.$store.dispatch('chat/joinChat', id)
        },

        async sendMessage (content) {
            await this.$store.dispatch('chat/sendMessage', content)
        }
    }
}
</script>

<style lang="scss">
.header-user {
    display: flex;
    align-items: center;
    gap: 10px;

    &__name {
        font-size: 20px;
    }
}
</style>
