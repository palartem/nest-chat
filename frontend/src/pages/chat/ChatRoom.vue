<template>
    <q-page class="column full-height chat-room">
        <div class="chat-room__header col-auto q-pa-md bg-grey-2">
            <div class="header-user">
                <q-avatar color="primary" text-color="white">
                    {{ getInitial(chatPartnerName) }}
                </q-avatar>
                <div class="header-user__name">{{ chatPartnerName }}</div>
            </div>
        </div>
        <ChatMessages
            class="col overflow-auto q-px-md"
        />
        <ChatInput
            class="col-auto q-pa-md"
            @send="sendMessage"
        />
    </q-page>
</template>

<script>
import ChatMessages from 'src/components/chat/ChatMessages.vue'
import ChatInput from 'src/components/chat/ChatInput.vue'
import { mapGetters } from "vuex"

export default {
    name: 'ChatRoom',
    components: {ChatMessages, ChatInput},

    computed: {
        ...mapGetters('chat', ['messages']),
        ...mapGetters('auth', { me: 'currentUser' }),
        ...mapGetters('chat', ['chats']),
        chatId() {
            return this.$route.params.chatId
        },
        currentChat() {
            return this.chats.find(c => c.id === this.chatId)
        },
        chatPartnerName() {
            if (!this.currentChat || !this.currentChat.participants) return 'Чат';

            const partner = this.currentChat.participants.find(p => p.id !== this.me.id);
            return partner?.name || 'Собеседник';
        },
    },
    async mounted () {
        await this.$store.dispatch('chat/joinChat', this.chatId)
        await this.$store.dispatch('chat/loadMessages', Number(this.chatId))
    },
    methods: {
        async sendMessage(content) {
            await this.$store.dispatch('chat/sendMessage', content);
            console.log(content);
        },
        getInitial(name) {
            return name?.trim().charAt(0).toUpperCase() || '?'
        },
    },
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
