<template>
    <div
        ref="messagesContainer"
        class="scroll no-wrap column q-mb-md"
        style="flex: 1; overflow-y: auto"
    >
        <div
            v-for="msg in messages"
            :key="msg.id"
            class="messages-container q-py-sm"
            :class="msg.sender?.id === me.id ? 'justify-end' : 'justify-start'"
        >
            <div
                class="message-item rounded-border"
                :class="{'message-item--me': msg.sender?.id === me.id}"
                style="max-width: 70%; word-break: break-word;"
            >
                <div class="massage-item__name text-caption q-mb-xs">
                    {{ formatSender(msg) }} — {{ formatTime(msg.createdAt) }}
                </div>
                {{ msg.content }}
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
        ...mapGetters('auth', { me: 'currentUser' }),
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
            const el = this.$refs.messagesContainer
            if (el) {
                el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
            }
        },
        formatTime(dateStr) {
            const d = new Date(dateStr)
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        formatSender(msg) {
            return msg.sender?.id === this.me.id ? 'Вы' : msg.sender?.name
        }
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
    &--me {
        background: var(--q-primary);
        color: white;
        .massage-item__name {
            color: #e0e0e0;
        }
    }
}
</style>
