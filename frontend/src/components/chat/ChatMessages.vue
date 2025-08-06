<template>
    <div class="scroll no-wrap column q-mb-md" style="flex: 1; overflow-y: auto">
        <div
            v-for="msg in messages"
            :key="msg.id"
            class="q-pa-sm"
        >
            <div class="q-mb-xs text-caption text-grey-7">
                {{ formatSender(msg) }} — {{ formatTime(msg.createdAt) }}
            </div>
            <div class="q-pa-sm bg-grey-2 rounded-borders">
                {{ msg.content }}
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'ChatMessages',
    props: {
        messages: {
            type: Array,
            required: true,
        },
    },
    computed: {
        me() {
            return this.$store.state.auth.user
        },
    },
    methods: {
        formatTime(dateStr) {
            const d = new Date(dateStr)
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        formatSender(msg) {
            return msg.sender?.email === this.me.email ? 'Вы' : msg.sender?.email
        },
    },
    mounted () {
        console.log('me.email:', this.me.email);
    }
}
</script>
