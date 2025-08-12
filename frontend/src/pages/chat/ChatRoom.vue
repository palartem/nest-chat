<template>
    <q-page class="column full-height chat-room">
        <div class="chat-room__header col-auto q-pa-md bg-grey-2">
            <div class="header-user">
                <UserAvatar
                    :name="chatPartnerName"
                    :is-online="!!(chatPartner && isOnline(chatPartner.id))"
                    size="40px"
                />
                <div class="header-user__name">{{ chatPartnerName }}</div>

                <div class="q-ml-md row items-center q-gutter-sm">
                    <q-btn
                        v-if="chatPartner && !callActive"
                        color="primary"
                        icon="phone"
                        label="Позвонить"
                        @click="startCall()"
                    />
                    <q-btn
                        v-if="callActive"
                        color="negative"
                        icon="call_end"
                        label="Завершить"
                        @click="endCall()"
                    />
                </div>
            </div>
        </div>

        <!-- Блок видео виден только во время звонка -->
        <div v-if="callActive" class="q-pa-md row q-gutter-md">
            <video
                ref="localVideoRef"
                autoplay
                playsinline
                muted
                class="col-4"
                style="background:#000; border-radius:8px; max-height:220px"
            ></video>
            <video
                ref="remoteVideoRef"
                autoplay
                playsinline
                class="col-8"
                style="background:#000; border-radius:8px; max-height:220px"
            ></video>
        </div>
        <CallDialog />
        <ChatMessages class="col overflow-auto q-px-md" />
        <ChatInput class="col-auto q-pa-md" @send="sendMessage" />
    </q-page>
</template>

<script>
import ChatMessages from 'src/components/chat/ChatMessages.vue'
import ChatInput from 'src/components/chat/ChatInput.vue'
import UserAvatar from 'src/components/user/UserAvatar.vue'
import CallDialog from 'src/components/calls/CallDialog.vue'
import { mapGetters } from 'vuex'

export default {
    name: 'ChatRoom',
    components: { ChatMessages, ChatInput, UserAvatar, CallDialog },

    computed: {
        ...mapGetters('chat', ['messages', 'chats', 'isOnline']),
        ...mapGetters('auth', { me: 'currentUser' }),
        ...mapGetters('calls', { callActive: 'callActive', localStream: 'localStream', remoteStream: 'remoteStream' }),

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

    watch: {
        '$route.params.chatId': {
            async handler (val) {
                await this.enterRoom(Number(val))
            }
        },
        localStream (stream) {
            const el = this.$refs.localVideoRef
            if (el && stream && el.srcObject !== stream) el.srcObject = stream
        },
        remoteStream (stream) {
            const el = this.$refs.remoteVideoRef
            if (el && stream && el.srcObject !== stream) el.srcObject = stream
        }
    },

    async mounted () {
        await this.enterRoom(this.chatId)
        // Привяжем уже имеющиеся стримы (если звонок активен)
        if (this.localStream && this.$refs.localVideoRef) this.$refs.localVideoRef.srcObject = this.localStream
        if (this.remoteStream && this.$refs.remoteVideoRef) this.$refs.remoteVideoRef.srcObject = this.remoteStream
    },

    methods: {
        async enterRoom (id) {
            if (!id) return
            await this.$store.dispatch('chat/joinChat', id)
        },

        async sendMessage (content) {
            await this.$store.dispatch('chat/sendMessage', content)
        },

        async startCall () {
            if (!this.chatPartner) return
            await this.$store.dispatch('calls/startCall', {
                chatId: this.chatId,
                toUserId: Number(this.chatPartner.id),
            })
        },

        endCall () {
            this.$store.dispatch('calls/endCall')
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
