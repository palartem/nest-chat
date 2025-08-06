<template>
    <q-page class="column q-pa-md full-height">
        <div class="col-auto">
            {{ chatId }} / {{ me.name }}
        </div>
        <ChatMessages
            :messages="messages"
            class="col overflow-auto"
        />
        <ChatInput
            class="col-auto"
            @send="sendMessage"
        />
    </q-page>
</template>

<script>
import {mapState} from 'vuex'
import ChatMessages from 'src/components/chat/ChatMessages.vue'
import ChatInput from 'src/components/chat/ChatInput.vue'

export default {
    name: 'ChatRoom',
    components: {ChatMessages, ChatInput},

    computed: {
        ...mapState('chat', ['messages']),
        chatId() {
            return this.$route.params.chatId
        },
        me() {
            return this.$store.state.auth.user
        },
    },
    async mounted () {
        await this.$store.dispatch('chat/loadChats');
        await this.$store.dispatch('chat/joinChat', this.chatId)
        await this.$store.dispatch('chat/loadMessages', Number(this.chatId))
    },
    methods: {
        async sendMessage(content) {
            await this.$store.dispatch('chat/sendMessage', content);
            console.log(content);
        },
    },
}
</script>
