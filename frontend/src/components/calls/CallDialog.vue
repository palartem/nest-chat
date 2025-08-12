<template>
    <q-dialog v-model="visible" persistent>
        <q-card>
            <q-card-section class="text-h6">
                Входящий звонок
            </q-card-section>

            <q-card-section>
                Пользователь хочет позвонить. Принять звонок?
            </q-card-section>

            <q-card-actions align="right">
                <q-btn flat label="Отклонить" color="negative" @click="decline" />
                <q-btn flat label="Принять" color="primary" @click="accept" />
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
    name: 'CallDialog',
    computed: {
        ...mapGetters('calls', ['incomingCall']),
        visible: {
            get () {
                return !!this.incomingCall
            },
            set () { /* no-op */ }
        }
    },
    methods: {
        async accept () {
            const call = this.incomingCall
            if (!call) return
            await this.$store.dispatch('calls/acceptIncoming', {
                fromUserId: call.fromUserId,
                chatId: call.chatId,
                sdp: call.sdp
            })
        },
        decline () {
            this.$store.dispatch('calls/declineIncoming')
        }
    }
}
</script>
