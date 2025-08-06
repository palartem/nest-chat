<template>
    <q-layout view="hHh lpR fFf">
        <q-page-container>
            <q-splitter
                v-model="splitterModel"
                :limits="[15, 50]"
                style="height: 100vh"
            >
                <template #before>
                    <ChatUsersList />
                </template>

                <template #after>
                    <router-view :key="$route.params.chatId"/>
                </template>
            </q-splitter>
        </q-page-container>
    </q-layout>
</template>

<script>
import ChatUsersList from 'src/components/chat/ChatUsersList.vue'

export default {
    name: 'ChatLayout',
    components: { ChatUsersList },
    data () {
        return {
            splitterModel: 25
        }
    },
    async mounted() {
        await this.$store.dispatch('user/loadUsers');
        await this.$store.dispatch('chat/initSocket');
    }
}
</script>

<style>
.q-splitter__panel {
    overflow: hidden;
}
</style>
