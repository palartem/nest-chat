<template>
    <q-layout
        view="hHh lpR fFf"
        style="height: 100vh"
    >
        <div class="flex justify-between full-height">
            <q-header elevated class="bg-primary text-white">
                <q-toolbar class="q-py-sm q-px-md">
                    <q-toolbar-title>
                        Nest chat
                    </q-toolbar-title>
                    <q-btn
                        round
                        icon="logout"
                        @click="handleLogout"
                        class="q-ml-sm"
                    >
                        <q-tooltip>
                            Выход
                        </q-tooltip>
                    </q-btn>
                </q-toolbar>
            </q-header>
            <q-page-container class="col">
                <q-splitter
                    v-model="splitterModel"
                    class="full-height"
                    :limits="[0, 50]"
                >
                    <template #before>
                        <ChatUsersList />
                    </template>

                    <template #after>
                        <router-view :key="$route.params.chatId"/>
                    </template>
                </q-splitter>
            </q-page-container>
        </div>

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
    async mounted () {
        await this.$store.dispatch('user/loadUsers');
        await this.$store.dispatch('chat/initSocket');
        await this.$store.dispatch('chat/loadChats')
    },
    methods: {
        async handleLogout () {
            await this.$store.dispatch('auth/logout')
            this.$router.push('/login')
        }
    }
}
</script>

<style>
.q-splitter__panel {
    overflow: hidden;
}
</style>
