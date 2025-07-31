<template>
    <div class="q-pa-md">
        <q-card flat bordered class="q-pa-lg shadow-1" style="max-width: 400px; margin: auto;">
            <q-card-section>
                <div class="text-h6">Login</div>
            </q-card-section>

            <q-card-section>
                <q-form @submit.prevent="handleLogin">
                    <q-input
                        v-model="email"
                        label="Email"
                        type="email"
                        filled
                        lazy-rules
                        :rules="[val => !!val || 'Email is required']"
                    />

                    <q-input
                        v-model="password"
                        label="Password"
                        type="password"
                        filled
                        lazy-rules
                        :rules="[val => !!val || 'Password is required']"
                        class="q-mt-md"
                    />

                    <div v-if="error" class="text-negative q-mt-sm">{{ error }}</div>

                    <q-btn label="Login" type="submit" color="primary" class="q-mt-md full-width" />
                </q-form>
            </q-card-section>
        </q-card>
    </div>
</template>

<script>
import LOGIN_MUTATION from 'src/graphql/AuthGQL/login'

export default {
    name: 'LoginForm',
    data() {
        return {
            email: '',
            password: '',
            error: null
        }
    },
    methods: {
        async handleLogin() {
            this.error = null
            try {
                const result = await this.$apollo.mutate({
                    mutation: LOGIN_MUTATION.mutation,
                    variables: {
                        ...LOGIN_MUTATION.variables,
                        email: this.email,
                        password: this.password
                    },
                    context: { credentials: 'include' }
                })

                const { access_token, user } = result.data.login

                this.$store.commit('auth/setAuth', { token: access_token, user })
                console.log('🔥 TOKEN после логина:', this.$store.state.auth.token)
                this.$router.push('/')

            } catch (err) {
                this.error = err.message || 'Login failed'
            }
        }
    }
}
</script>

<style scoped>
</style>
