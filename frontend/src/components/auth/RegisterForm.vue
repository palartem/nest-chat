<template>
    <div class="q-pa-md q-gutter-md">
        <q-card flat bordered class="q-pa-lg shadow-1" style="max-width: 400px; margin: auto;">
            <q-card-section>
                <div class="text-h6">Регистрация</div>
            </q-card-section>

            <q-card-section>
                <q-form @submit.prevent="handleRegister">
                    <q-input
                        v-model="name"
                        label="Имя"
                        type="text"
                        filled
                        lazy-rules
                        :rules="[val => !!val || 'Введите имя']"
                    />

                    <q-input
                        v-model="email"
                        label="Email"
                        type="email"
                        filled
                        lazy-rules
                        :rules="[val => !!val || 'Введите email']"
                        class="q-mt-md"
                    />

                    <q-input
                        v-model="password"
                        label="Пароль"
                        type="password"
                        filled
                        lazy-rules
                        :rules="[val => !!val || 'Введите пароль']"
                        class="q-mt-md"
                    />

                    <div v-if="error" class="text-negative q-mt-sm">{{ error }}</div>

                    <q-btn label="Зарегистрироваться" type="submit" color="primary" class="q-mt-md full-width" />
                </q-form>
            </q-card-section>
        </q-card>

        <q-dialog v-model="showDialog" persistent>
            <q-card>
                <q-card-section>
                    <div class="text-h6">Подтверждение регистрации</div>
                </q-card-section>

                <q-card-section>
                    На вашу почту <b>{{ email }}</b> отправлено письмо для подтверждения аккаунта.
                </q-card-section>

                <q-card-actions align="right">
                    <q-btn flat label="Ок" color="primary" v-close-popup />
                </q-card-actions>
            </q-card>
        </q-dialog>
    </div>
</template>

<script>
import gql from 'graphql-tag';

const REGISTER_MUTATION = gql`
  mutation Register($data: CreateUserInput!) {
    register(data: $data) {
      id
      email
    }
  }
`;

export default {
    name: 'RegisterForm',
    data() {
        return {
            name: '',
            email: '',
            password: '',
            error: null,
            showDialog: false,
        };
    },
    methods: {
        async handleRegister() {
            this.error = null;
            try {
                await this.$apollo.mutate({
                    mutation: REGISTER_MUTATION,
                    variables: {
                        data: {
                            name: this.name,
                            email: this.email,
                            password: this.password,
                        },
                    },
                    context: {
                        credentials: 'include',
                    },
                });
                this.showDialog = true;
            } catch (err) {
                this.error = err.message || 'Ошибка регистрации';
            }
        },
    },
};
</script>

<style scoped>
.full-width {
    width: 100%;
}
</style>
