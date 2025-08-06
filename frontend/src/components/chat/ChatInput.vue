<template>
    <div class="row q-gutter-sm items-center">
        <q-input
            v-model="message"
            filled
            dense
            placeholder="Введите сообщение..."
            class="col-grow"
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
