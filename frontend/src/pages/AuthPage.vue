<template>
    <q-page class="flex flex-center">
        <div class="auth-container q-pa-md bg-white shadow-2 rounded-borders" style="min-width: 300px; max-width: 400px;">
            <q-tabs v-model="tab" class="text-primary" align="justify" narrow-indicator>
                <q-tab name="login" label="Вход" />
                <q-tab name="register" label="Регистрация" />
            </q-tabs>

            <q-separator />

            <div class="q-mt-md">
                <login-form v-if="tab === 'login'" />
                <register-form v-else />
            </div>
        </div>
    </q-page>
</template>

<script>
import LoginForm from '../components/auth/LoginForm.vue';
import RegisterForm from '../components/auth/RegisterForm.vue';

export default {
    components: {
        LoginForm,
        RegisterForm
    },
    data() {
        return {
            tab: this.$route.query.tab || 'login'
        }
    },
    watch: {
        '$route.query.tab'(val) {
            if (val) this.tab = val;
        }
    }
}
</script>

<style scoped>
.auth-container {
    width: 100%;
}
</style>
