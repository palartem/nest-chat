<template>
    <q-page class="flex flex-center">
        <q-card class="q-pa-md text-center" style="max-width: 400px;">
            <q-spinner v-if="loading" size="40px" color="primary"/>

            <div v-else>
                <div v-if="success" class="text-positive text-h6">
                    ✅ Email успешно подтверждён!
                </div>
                <div v-else class="text-negative text-h6">
                    ❌ Ошибка: ссылка недействительна.
                </div>

                <q-btn
                    label="Перейти к логину"
                    color="primary"
                    class="q-mt-md"
                    @click="$router.push('/login')"
                />
            </div>
        </q-card>
    </q-page>
</template>

<script>
import confirmEmail from 'src/graphql/AuthGQL/confirmEmail';

export default {
    name: 'ConfirmPage',
    data() {
        return {loading: true, success: false};
    },
    async mounted() {
        const token = this.$route.query.token;

        try {
            const res = await this.$apollo.mutate({
                mutation: confirmEmail.mutation,
                variables: {token}
            });
            this.success = res.data.confirmEmail;
        } catch (err) {
            console.error(err);
            this.success = false;
        } finally {
            this.loading = false;
        }
    }
};
</script>
