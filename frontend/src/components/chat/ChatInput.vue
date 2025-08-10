<template>
    <div class="row items-start chat-input">
        <q-input
            v-model="message"
            filled
            dense
            autogrow
            placeholder="Введите сообщение..."
            class="col-grow overflow-auto"
            style="max-height: 130px"
            @keyup.enter="handleSend"
        />
        <q-btn color="primary" icon="send" @click="handleSend"/>
    </div>
</template>

<script>
export default {
    name: 'ChatInput',
    emits: ['send'],
    data () {
        return {
            message: '',
        }
    },
    methods: {
        handleSend() {
            const content = this.message.trim()
            if (!content) return
            this.$emit('send', content)
            this.message = ''
        },
    },
}
</script>
<style lang="scss">
.chat-input {
    gap: 10px;
}
</style>
