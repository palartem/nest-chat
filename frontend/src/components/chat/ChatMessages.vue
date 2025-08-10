<template>
    <div
        ref="messagesContainer"
        class="scroll no-wrap column q-mb-md"
        style="flex: 1; overflow-y: auto"
    >
        <div
            v-for="msg in messages.filter(m => m && m.id)"
            :key="msg.id"
            class="messages-container q-py-sm"
            :class="isMe(msg) ? 'justify-end' : 'justify-start'"
        >
            <div
                class="message-item rounded-border"
                :class="{ 'message-item--me': isMe(msg) }"
                style="max-width: 70%; word-break: break-word;"
            >
                <div class="massage-item__name text-caption q-mb-xs">
                    {{ formatSender(msg) }}
                </div>
                <div class="message-item__content">
                    {{ msg.content }}
                    <div class="message-item__time">{{ formatTime(msg.createdAt) }}</div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
    name: 'ChatMessages',
    computed: {
        ...mapGetters('chat', ['messages']),
        ...mapGetters('auth', { currentUser: 'currentUser' }),
    },
    watch: {
        messages() {
            this.$nextTick(this.scrollToBottom)
        }
    },
    mounted() {
        this.scrollToBottom()
    },
    methods: {
        scrollToBottom() {
            const container = this.$refs.messagesContainer
            if (container) {
                container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
            }
        },
        formatTime(dateString) {
            const date = new Date(dateString)
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        formatSender(message) {
            return this.isMe(message) ? 'Вы' : message.sender?.name
        },
        isMe(message) {
            return Number(this.currentUser?.id) === Number(message?.sender?.id ?? message?.from)
        },
    }
}
</script>

<style lang="scss">
.messages-container {
    display: flex;
}
.message-item {
    display: inline-flex;
    flex-direction: column;
    border-radius: 8px;
    padding: 8px;
    min-width: 200px;
    background: #f5f5f5;
    color: black;
    .massage-item__name {
        color: #757575;
    }
    .message-item__content {
        display: flex;
        justify-content: space-between;
        gap: 10px;
    }
    .message-item__time {
        display: flex;
        align-items: flex-end;
        flex-shrink: 0;
    }
    &--me {
        background: var(--q-primary);
        color: white;
        .massage-item__name {
            color: #e0e0e0;
        }
    }
}
</style>
